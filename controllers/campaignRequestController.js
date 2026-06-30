import CampaignRequest from '../models/CampaignRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

export const createCampaignRequest = async (req, res) => {
  try {
    const { title, description, requirements, location, budget, timeline, categories } = req.body;
    const campaignRequest = await CampaignRequest.create({
      brand: req.user._id,
      title,
      description,
      requirements,
      location,
      budget,
      timeline,
      categories,
    });

    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        sender: req.user._id,
        type: 'campaign_invite',
        title: 'New Campaign Request',
        message: `Brand ${req.user.name} has submitted a new campaign request: "${title}"`,
        data: { campaignRequestId: campaignRequest._id },
      });
    }

    const io = req.app.get('socketio');
    if (io) {
      for (const admin of admins) {
        io.to(admin._id.toString()).emit('new_campaign_request', { campaignRequest });
      }
    }

    res.status(201).json(campaignRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createPublicCampaignRequest = async (req, res) => {
  try {
    const { name, email, phone, companyName, title, description, requirements, location, budget, timeline, categories } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const campaignRequest = await CampaignRequest.create({
      brandInfo: { name, email, phone, companyName },
      title,
      description,
      requirements,
      location,
      budget: Number(budget) || 0,
      timeline,
      categories,
    });

    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        sender: admin._id,
        type: 'campaign_invite',
        title: 'New Campaign Request (Public)',
        message: `${name} (${email}) has submitted a new campaign request: "${title}"`,
        data: { campaignRequestId: campaignRequest._id },
      });
    }

    const io = req.app.get('socketio');
    if (io) {
      for (const admin of admins) {
        io.to(admin._id.toString()).emit('new_campaign_request', { campaignRequest });
      }
    }

    res.status(201).json({ message: 'Campaign request submitted successfully! We will contact you shortly.', id: campaignRequest._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyCampaignRequests = async (req, res) => {
  try {
    const requests = await CampaignRequest.find({ brand: req.user._id })
      .populate('assignedCoordinator', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllCampaignRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await CampaignRequest.find(filter)
      .populate('brand', 'name email')
      .populate('assignedCoordinator', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCampaignRequestById = async (req, res) => {
  try {
    const request = await CampaignRequest.findById(req.params.id)
      .populate('brand', 'name email')
      .populate('assignedCoordinator', 'name email');
    if (!request) {
      return res.status(404).json({ message: 'Campaign request not found' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCampaignRequestStatus = async (req, res) => {
  try {
    const { status, adminNote, assignedCoordinator } = req.body;
    const request = await CampaignRequest.findById(req.params.id).populate('brand', 'name email');
    if (!request) {
      return res.status(404).json({ message: 'Campaign request not found' });
    }

    if (status) request.status = status;
    if (adminNote !== undefined) request.adminNote = adminNote;
    if (assignedCoordinator) request.assignedCoordinator = assignedCoordinator;

    if (assignedCoordinator && status === 'assigned') {
      const coordinator = await User.findById(assignedCoordinator);
      if (coordinator) {
        await Notification.create({
          recipient: assignedCoordinator,
          sender: req.user._id,
          type: 'campaign_invite',
          title: 'Campaign Assigned to You',
          message: `Campaign "${request.title}" has been assigned to you by admin. Please review and manage influencers.`,
          data: { campaignRequestId: request._id },
        });

        const io = req.app.get('socketio');
        if (io) {
          io.to(assignedCoordinator.toString()).emit('campaign_assigned', { campaignRequest: request });
        }
      }
    }

    await request.save();

    if (request.brand) {
      await Notification.create({
        recipient: request.brand._id,
        sender: req.user._id,
        type: 'campaign_invite',
        title: `Campaign Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your campaign request "${request.title}" has been ${status}.${adminNote ? ` Note: ${adminNote}` : ''}`,
        data: { campaignRequestId: request._id },
      });

      const io = req.app.get('socketio');
      if (io) {
        io.to(request.brand._id.toString()).emit('campaign_request_update', { campaignRequest: request });
      }
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCoordinatorCampaigns = async (req, res) => {
  try {
    const requests = await CampaignRequest.find({ assignedCoordinator: req.user._id })
      .populate('brand', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
