import Application from '../../models/Application.js';
import Campaign from '../../models/Campaign.js';
import Payment from '../../models/Payment.js';
import Notification from '../../models/Notification.js';
import Influencer from '../../models/Influencer.js';
import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';

export const updateApplicationStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const application = await Application.findById(req.params.id).populate('campaign');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to manage this application' });
    }

    application.status = status;
    await application.save();

    if (status === 'approved') {
      await Payment.create({
        campaign: application.campaign._id,
        brand: application.campaign.brand,
        influencer: application.influencer,
        amount: application.proposedRate,
        escrowStatus: 'held',
      });

      const campaign = await Campaign.findById(application.campaign._id);
      if (campaign && campaign.status === 'active') {
        campaign.status = 'in_progress';
        await campaign.save();
      }
    }

    let notifType = 'app_rejected';
    let notifTitle = 'Application Update';
    let notifMsg = `Your application for campaign "${application.campaign.title}" was updated.`;

    if (status === 'approved') {
      notifType = 'app_approved';
      notifTitle = 'Application Approved!';
      notifMsg = `Congratulations! Your application for "${application.campaign.title}" was approved. Escrow payment of $${application.proposedRate} is held.\n\nCampaign Instructions:\n${application.campaign.description}\n\nDeadline: ${new Date(application.campaign.endDate).toLocaleDateString()}\n\nMake sure to submit your deliverables (Instagram Post, YouTube Video, Reel, Screenshot) before the deadline.`;
    } else if (status === 'rejected') {
      notifType = 'app_rejected';
      notifTitle = 'Application Rejected';
      notifMsg = `Unfortunately, your application for "${application.campaign.title}" was rejected.`;
    } else if (status === 'shortlisted') {
      notifType = 'app_shortlisted';
      notifTitle = 'You\'ve Been Shortlisted!';
      notifMsg = `Great news! Your application for "${application.campaign.title}" has been shortlisted. The brand will review your profile further.`;
    }

    await Notification.create({
      recipient: application.influencer,
      sender: req.user._id,
      type: notifType,
      title: notifTitle,
      message: notifMsg,
      data: { campaignId: application.campaign._id, applicationId: application._id },
    });

    res.json({ message: `Application status updated to ${status}`, application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitDeliverables = async (req, res) => {
  const { instagramPost, youtubeVideo, reelLink, screenshot } = req.body;

  const cleanInsta = (instagramPost || '').trim();
  const cleanYt = (youtubeVideo || '').trim();
  const cleanReel = (reelLink || '').trim();
  const cleanScreenshot = (screenshot || '').trim();

  if (!cleanInsta && !cleanYt && !cleanReel && !cleanScreenshot) {
    return res.status(400).json({ message: 'At least one deliverable link or screenshot proof is required.' });
  }

  try {
    const application = await Application.findById(req.params.id).populate('campaign');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.influencer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to submit deliverables' });
    }

    application.deliverables = {
      instagramPost: cleanInsta,
      youtubeVideo: cleanYt,
      reelLink: cleanReel,
      screenshot: cleanScreenshot,
    };
    application.status = 'delivered';
    await application.save();

    await Notification.create({
      recipient: application.campaign.brand,
      sender: req.user._id,
      type: 'deliverables_submitted',
      title: 'Deliverables Submitted',
      message: `${req.user.name} has submitted deliverables for campaign "${application.campaign.title}". Please review and approve them.`,
      data: { campaignId: application.campaign._id, applicationId: application._id },
    });

    res.json({ message: 'Deliverables submitted successfully. Awaiting brand approval.', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveDeliverables = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('campaign');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to approve deliverables for this campaign' });
    }

    if (application.status !== 'delivered') {
      return res.status(400).json({ message: 'Deliverables have not been submitted yet or already approved' });
    }

    application.status = 'completed';
    await application.save();

    const campaignDoc = await Campaign.findById(application.campaign._id);
    if (campaignDoc) {
      campaignDoc.status = 'completed';
      await campaignDoc.save();
    }

    const payment = await Payment.findOne({
      campaign: application.campaign._id,
      influencer: application.influencer,
      escrowStatus: 'held',
    });

    if (payment) {
      payment.escrowStatus = 'released';
      await payment.save();

      const influencerWallet = await Wallet.findOne({ user: application.influencer });
      if (influencerWallet) {
        influencerWallet.balance += payment.amount;
        await influencerWallet.save();

        await Transaction.create({
          wallet: influencerWallet._id,
          amount: payment.amount,
          type: 'credit',
          description: `Payment released for campaign: ${campaignDoc?.title || application.campaign._id}`,
          status: 'completed',
        });
      }

      const influencerProfile = await Influencer.findOne({ user: application.influencer });
      if (influencerProfile) {
        influencerProfile.totalEarnings += payment.amount;
        await influencerProfile.save();
      }
    }

    await Notification.create({
      recipient: application.influencer,
      sender: req.user._id,
      type: 'deliverables_approved',
      title: 'Deliverables Approved!',
      message: `Your deliverables for campaign "${application.campaign.title}" have been approved. Payment of $${payment?.amount || 0} has been released to your wallet.`,
      data: { campaignId: application.campaign._id, applicationId: application._id },
    });

    res.json({
      message: 'Deliverables approved. Campaign completed and payment released.',
      application,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
