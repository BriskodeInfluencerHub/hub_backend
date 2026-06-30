import User from '../models/User.js';
import Coordinator from '../models/Coordinator.js';
import CampaignRequest from '../models/CampaignRequest.js';
import Notification from '../models/Notification.js';

export const createCoordinator = async (req, res) => {
  try {
    const { name, email, phone, password, assignedRegion } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'coordinator',
      status: 'active',
      isVerified: true,
    });

    const coordinator = await Coordinator.create({
      user: user._id,
      assignedRegion: assignedRegion || '',
      phone: phone || '',
    });

    await Notification.create({
      recipient: user._id,
      sender: req.user._id,
      type: 'profile_verified',
      title: 'Welcome, Coordinator!',
      message: `You have been registered as a coordinator by the admin. You can now manage assigned campaigns.`,
      data: { coordinatorId: coordinator._id },
    });

    res.status(201).json({
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      coordinator,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCoordinators = async (req, res) => {
  try {
    const coordinators = await Coordinator.find()
      .populate('user', 'name email phone status isVerified createdAt')
      .sort({ createdAt: -1 });
    res.json(coordinators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCoordinatorById = async (req, res) => {
  try {
    const coordinator = await Coordinator.findById(req.params.id)
      .populate('user', 'name email phone status isVerified');
    if (!coordinator) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }
    res.json(coordinator);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCoordinator = async (req, res) => {
  try {
    const { assignedRegion, isActive } = req.body;
    const coordinator = await Coordinator.findById(req.params.id).populate('user', 'name email');
    if (!coordinator) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    if (assignedRegion !== undefined) coordinator.assignedRegion = assignedRegion;
    if (isActive !== undefined) coordinator.isActive = isActive;
    await coordinator.save();

    res.json(coordinator);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCoordinator = async (req, res) => {
  try {
    const coordinator = await Coordinator.findById(req.params.id);
    if (!coordinator) {
      return res.status(404).json({ message: 'Coordinator not found' });
    }

    await User.findByIdAndUpdate(coordinator.user, { status: 'suspended' });
    await CampaignRequest.updateMany(
      { assignedCoordinator: coordinator.user },
      { assignedCoordinator: null, status: 'pending' }
    );
    await coordinator.deleteOne();

    res.json({ message: 'Coordinator removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
