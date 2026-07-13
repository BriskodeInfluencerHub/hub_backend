import CampaignInfluencer from '../../models/CampaignInfluencer.js';
import CampaignRequest from '../../models/CampaignRequest.js';
import Notification from '../../models/Notification.js';

export const inviteInfluencer = async (req, res) => {
  try {
    const { influencerId } = req.body;
    const campaignRequest = await CampaignRequest.findById(req.params.campaignId);
    if (!campaignRequest) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    if (String(campaignRequest.assignedCoordinator) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not the assigned coordinator for this campaign' });
    }

    const existing = await CampaignInfluencer.findOne({
      campaignRequest: req.params.campaignId,
      influencer: influencerId,
    });
    if (existing) {
      return res.status(400).json({ message: 'Influencer already invited to this campaign' });
    }

    const member = await CampaignInfluencer.create({
      campaignRequest: req.params.campaignId,
      influencer: influencerId,
    });

    const populated = await CampaignInfluencer.findById(member._id)
      .populate('influencer', 'name email profileImage');

    await Notification.create({
      recipient: influencerId,
      sender: req.user._id,
      type: 'campaign_invite',
      title: 'Campaign Invitation',
      message: `You have been invited to join the campaign "${campaignRequest.title}" by coordinator ${req.user.name}.`,
      data: { campaignRequestId: campaignRequest._id },
    });

    const io = req.app.get('socketio');
    if (io) {
      io.to(influencerId.toString()).emit('campaign_invitation', { campaignRequest });
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyInvitations = async (req, res) => {
  try {
    const invitations = await CampaignInfluencer.find({ influencer: req.user._id })
      .populate({
        path: 'campaignRequest',
        populate: { path: 'assignedCoordinator', select: 'name email' },
      })
      .sort({ createdAt: -1 });
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const respondToInvitation = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or rejected' });
    }

    const invitation = await CampaignInfluencer.findOne({
      _id: req.params.id,
      influencer: req.user._id,
    }).populate('campaignRequest');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    if (invitation.status !== 'invited') {
      return res.status(400).json({ message: `Cannot respond — current status is ${invitation.status}` });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    if (invitation.campaignRequest?.assignedCoordinator) {
      await Notification.create({
        recipient: invitation.campaignRequest.assignedCoordinator,
        sender: req.user._id,
        type: 'campaign_invite',
        title: status === 'accepted' ? 'Influencer Accepted' : 'Influencer Rejected',
        message: `${req.user.name} has ${status} the invitation for "${invitation.campaignRequest.title}".`,
        data: { campaignRequestId: invitation.campaignRequest._id },
      });
    }

    res.json(invitation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
