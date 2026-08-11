import CampaignInfluencer from '../../models/CampaignInfluencer.js';
import Notification from '../../models/Notification.js';
import Influencer from '../../models/Influencer.js';

export const addDeliverable = async (req, res) => {
  try {
    const { title, url, notes } = req.body;
    const member = await CampaignInfluencer.findOne({
      campaignRequest: req.params.campaignId,
      _id: req.params.influencerId,
    }).populate('influencer', 'name email');

    if (!member) {
      return res.status(404).json({ message: 'Campaign influencer not found' });
    }

    member.deliverables.push({ title, url, notes });
    if (member.status !== 'submitted') {
      member.status = 'submitted';
    }
    await member.save();

    res.json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeDeliverable = async (req, res) => {
  try {
    const { deliverableId } = req.params;
    const member = await CampaignInfluencer.findOne({
      campaignRequest: req.params.campaignId,
      _id: req.params.influencerId,
    });

    if (!member) {
      return res.status(404).json({ message: 'Campaign influencer not found' });
    }

    member.deliverables = member.deliverables.filter((d) => String(d._id) !== deliverableId);
    await member.save();

    res.json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const influencerSubmitDeliverable = async (req, res) => {
  try {
    const { title, url, notes } = req.body;

    const targetIds = [req.user._id];
    const infProfile = await Influencer.findOne({ user: req.user._id });
    if (infProfile) {
      targetIds.push(infProfile._id);
    }

    const invitation = await CampaignInfluencer.findOne({
      _id: req.params.id,
      influencer: { $in: targetIds },
    }).populate('campaignRequest');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    if (!['accepted', 'submitted', 'approved'].includes(invitation.status)) {
      return res.status(400).json({ message: 'You must accept the invitation before submitting deliverables' });
    }

    invitation.deliverables.push({ title, url, notes });
    if (invitation.status !== 'approved') {
      invitation.status = 'submitted';
    }
    await invitation.save();

    if (invitation.campaignRequest?.assignedCoordinator) {
      const coordinatorId = invitation.campaignRequest.assignedCoordinator;
      await Notification.create({
        recipient: coordinatorId,
        sender: req.user._id,
        type: 'campaign_invite',
        title: 'Deliverables Submitted',
        message: `${req.user.name} has submitted deliverables for "${invitation.campaignRequest.title}".`,
        data: { campaignRequestId: invitation.campaignRequest._id },
      });

      const io = req.app.get('socketio');
      if (io) {
        io.to(coordinatorId.toString()).emit('deliverable_submitted', {
          campaignId: invitation.campaignRequest._id,
          influencerId: req.user._id,
          deliverable: { title, url, notes },
        });
      }
    }

    res.json(invitation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
