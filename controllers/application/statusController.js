import Application from '../../models/Application.js';
import Campaign from '../../models/Campaign.js';
import Payment from '../../models/Payment.js';
import Notification from '../../models/Notification.js';
import Influencer from '../../models/Influencer.js';
import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Agency from '../../models/Agency.js';
import User from '../../models/User.js';

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
      notifMsg = `Congratulations! Your application for "${application.campaign.title}" was approved. Escrow payment of ₹${application.proposedRate} is held.\n\nCampaign Instructions:\n${application.campaign.description}\n\nDeadline: ${new Date(application.campaign.endDate).toLocaleDateString()}\n\nMake sure to submit your deliverables (Instagram Post, YouTube Video, Reel, Screenshot) before the deadline.`;
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

    const influencerUserId = application.influencer?._id || application.influencer;

    // 1. Find existing payment or auto-create if missing
    let payment = await Payment.findOne({
      campaign: application.campaign._id,
      influencer: influencerUserId,
    });

    const campaignDoc = await Campaign.findById(application.campaign._id);

    if (!payment) {
      payment = await Payment.create({
        campaign: application.campaign._id,
        brand: application.campaign.brand,
        influencer: influencerUserId,
        amount: application.proposedRate || campaignDoc?.budget || 0,
        escrowStatus: 'held',
      });
    }

    let influencerWallet = await Wallet.findOne({ user: influencerUserId });
    if (!influencerWallet) {
      influencerWallet = await Wallet.create({ user: influencerUserId, balance: 0 });
    }

    const titleMatch = campaignDoc?.title || application.campaign._id?.toString() || '';
    const existingInfluencerTx = await Transaction.findOne({
      wallet: influencerWallet._id,
      type: 'credit',
      $or: [
        { description: { $regex: titleMatch, $options: 'i' } },
        { description: { $regex: application._id.toString(), $options: 'i' } },
      ],
    });

    if (application.status === 'completed' && payment.escrowStatus === 'released' && existingInfluencerTx) {
      return res.status(400).json({ message: 'Deliverables have already been approved and payment released.' });
    }

    const hasDeliverables = application.deliverables && (
      application.deliverables.instagramPost ||
      application.deliverables.youtubeVideo ||
      application.deliverables.reelLink ||
      application.deliverables.screenshot
    );

    if (application.status !== 'delivered' && application.status !== 'approved' && application.status !== 'in_progress' && application.status !== 'completed' && !hasDeliverables) {
      return res.status(400).json({ message: 'Deliverables have not been submitted yet or application is not active.' });
    }

    application.status = 'completed';
    await application.save();

    if (campaignDoc) {
      campaignDoc.status = 'completed';
      await campaignDoc.save();
    }

    if (payment.escrowStatus !== 'released') {
      payment.escrowStatus = 'released';
      await payment.save();

      const totalAmount = payment.amount || application.proposedRate || 0;
      let agencyFee = 0;
      let influencerPayout = totalAmount;

      // Check if creator belongs to an Agency roster
      const managingAgency = await Agency.findOne({ managedInfluencers: influencerUserId });
      if (managingAgency && managingAgency.revenueShare > 0) {
        agencyFee = Math.round(totalAmount * (managingAgency.revenueShare / 100));
        influencerPayout = totalAmount - agencyFee;

        // Credit Agency Wallet
        let agencyWallet = await Wallet.findOne({ user: managingAgency.user });
        if (!agencyWallet) {
          agencyWallet = await Wallet.create({ user: managingAgency.user, balance: 0 });
        }
        agencyWallet.balance += agencyFee;
        await agencyWallet.save();

        const influencerUser = await User.findById(influencerUserId).select('name');
        await Transaction.create({
          wallet: agencyWallet._id,
          amount: agencyFee,
          type: 'credit',
          description: `Agency Commission (${managingAgency.revenueShare}%) for campaign "${campaignDoc?.title || application.campaign._id}" (${influencerUser?.name || 'Creator'})`,
          status: 'completed',
        });

        // Notify Agency
        await Notification.create({
          recipient: managingAgency.user,
          sender: req.user._id,
          type: 'agency_commission',
          title: 'Agency Commission Received!',
          message: `You received ₹${agencyFee.toLocaleString()} commission (${managingAgency.revenueShare}%) for campaign "${campaignDoc?.title}" completed by ${influencerUser?.name || 'creator'}.`,
          data: { campaignId: application.campaign._id, applicationId: application._id },
        });
      }

      // Credit Influencer Wallet
      if (!influencerWallet) {
        influencerWallet = await Wallet.findOne({ user: influencerUserId });
      }
      if (!influencerWallet) {
        influencerWallet = await Wallet.create({ user: influencerUserId, balance: 0 });
      }
      influencerWallet.balance += influencerPayout;
      await influencerWallet.save();

      const descNote = agencyFee > 0 ? ` (Net payout after ${managingAgency.revenueShare}% agency fee)` : '';
      await Transaction.create({
        wallet: influencerWallet._id,
        amount: influencerPayout,
        type: 'credit',
        description: `Payment released for campaign: ${campaignDoc?.title || application.campaign._id}${descNote}`,
        status: 'completed',
      });

      const influencerProfile = await Influencer.findOne({ user: influencerUserId });
      if (influencerProfile) {
        influencerProfile.totalEarnings += influencerPayout;
        await influencerProfile.save();
      }

      await Notification.create({
        recipient: influencerUserId,
        sender: req.user._id,
        type: 'deliverables_approved',
        title: 'Deliverables Approved!',
        message: `Your deliverables for campaign "${campaignDoc?.title || application.campaign._id}" have been approved. Payment of ₹${influencerPayout.toLocaleString()} has been released to your wallet.`,
        data: { campaignId: application.campaign._id, applicationId: application._id },
      });
    }

    res.json({
      message: 'Deliverables approved. Campaign completed and payment released.',
      application,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
