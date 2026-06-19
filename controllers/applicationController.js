import Application from '../models/Application.js';
import Campaign from '../models/Campaign.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';

export const applyToCampaign = async (req, res) => {
  const { pitch, proposedRate } = req.body;
  const { campaignId } = req.params;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'This campaign is not accepting applications' });
    }

    const alreadyApplied = await Application.findOne({
      campaign: campaignId,
      influencer: req.user._id,
    });

    if (alreadyApplied) {
      return res.status(400).json({ message: 'You have already applied to this campaign' });
    }

    const application = await Application.create({
      campaign: campaignId,
      influencer: req.user._id,
      pitch,
      proposedRate,
    });

    await Notification.create({
      recipient: campaign.brand,
      sender: req.user._id,
      type: 'campaign_invite',
      title: 'New Campaign Application',
      message: `${req.user.name} has applied to your campaign "${campaign.title}"`,
      data: { campaignId, applicationId: application._id },
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCampaignApplications = async (req, res) => {
  const { campaignId } = req.params;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view applications' });
    }

    const applications = await Application.find({ campaign: campaignId })
      .populate('influencer', 'name email phone profileImage');

    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ influencer: req.user._id })
      .populate({
        path: 'campaign',
        populate: {
          path: 'brand',
          select: 'name email profileImage',
        },
      });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
    }

    let notifType = 'app_rejected';
    let notifTitle = 'Application Update';
    let notifMsg = `Your application for campaign "${application.campaign.title}" was updated.`;

    if (status === 'approved') {
      notifType = 'app_approved';
      notifTitle = 'Application Approved!';
      notifMsg = `Congratulations! Your application for "${application.campaign.title}" was approved. Escrow payment of $${application.proposedRate} is held.`;
    } else if (status === 'rejected') {
      notifMsg = `Unfortunately, your application for "${application.campaign.title}" was rejected.`;
    } else if (status === 'shortlisted') {
      notifMsg = `Your application for "${application.campaign.title}" has been shortlisted.`;
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
  const { deliverablesUrl } = req.body;

  try {
    const application = await Application.findById(req.params.id).populate('campaign');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.influencer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to submit deliverables' });
    }

    application.deliverablesUrl = deliverablesUrl;
    application.status = 'completed';
    await application.save();

    await Notification.create({
      recipient: application.campaign.brand,
      sender: req.user._id,
      type: 'profile_verified',
      title: 'Deliverables Submitted',
      message: `${req.user.name} has submitted deliverables for campaign "${application.campaign.title}". You can now release escrow.`,
      data: { campaignId: application.campaign._id, applicationId: application._id },
    });

    res.json({ message: 'Deliverables submitted successfully', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
