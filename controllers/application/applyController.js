import Application from '../../models/Application.js';
import Campaign from '../../models/Campaign.js';
import Influencer from '../../models/Influencer.js';
import Notification from '../../models/Notification.js';

export const applyToCampaign = async (req, res) => {
  const { pitch, proposedRate, portfolio, socialStats } = req.body;
  const { campaignId } = req.params;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ message: 'This campaign is not accepting applications' });
    }

    if (req.user.role === 'influencer') {
      const influencer = await Influencer.findOne({ user: req.user._id });
      if (!influencer) {
        return res.status(400).json({ message: 'Influencer profile not found' });
      }
      if (!influencer.isVerified) {
        return res.status(403).json({ message: 'Your profile must be verified by admin before applying to campaigns' });
      }
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
      portfolio: portfolio || [],
      socialStats: socialStats || [],
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
