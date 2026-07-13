import CampaignInfluencer from '../../models/CampaignInfluencer.js';
import CampaignRequest from '../../models/CampaignRequest.js';
import Notification from '../../models/Notification.js';

export const getCampaignInfluencers = async (req, res) => {
  try {
    const members = await CampaignInfluencer.find({ campaignRequest: req.params.campaignId })
      .populate('influencer', 'name email profileImage')
      .sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateInfluencerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const member = await CampaignInfluencer.findOne({
      campaignRequest: req.params.campaignId,
      _id: req.params.influencerId,
    }).populate('influencer', 'name email');

    if (!member) {
      return res.status(404).json({ message: 'Campaign influencer not found' });
    }

    member.status = status;
    if (status === 'accepted' || status === 'rejected') {
      member.respondedAt = new Date();
    }
    await member.save();

    const campaignRequest = await CampaignRequest.findById(req.params.campaignId);

    if (status === 'rejected') {
      await Notification.create({
        recipient: member.influencer._id,
        sender: req.user._id,
        type: 'campaign_invite',
        title: 'Campaign Update',
        message: `Your participation in "${campaignRequest.title}" has been marked as ${status}.`,
        data: { campaignRequestId: campaignRequest._id },
      });
    }

    res.json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCoordinatorNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    const member = await CampaignInfluencer.findOne({
      campaignRequest: req.params.campaignId,
      _id: req.params.influencerId,
    });

    if (!member) {
      return res.status(404).json({ message: 'Campaign influencer not found' });
    }

    member.coordinatorNotes = notes;
    await member.save();

    res.json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
