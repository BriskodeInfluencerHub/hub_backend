import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Payment from '../models/Payment.js';

export const getAdminAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalInfluencers = await User.countDocuments({ role: 'influencer' });
    const totalBrands = await User.countDocuments({ role: 'brand' });
    const totalAgencies = await User.countDocuments({ role: 'agency' });
    const totalCampaigns = await Campaign.countDocuments();

    const paymentSums = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const platformVolume = paymentSums[0]?.total || 0;

    const signupsOverview = [
      { month: 'Jan', users: 120 },
      { month: 'Feb', users: 210 },
      { month: 'Mar', users: 450 },
      { month: 'Apr', users: 600 },
      { month: 'May', users: 800 },
      { month: 'Jun', users: totalUsers },
    ];

    res.json({
      metrics: {
        totalUsers,
        totalInfluencers,
        totalBrands,
        totalAgencies,
        totalCampaigns,
        platformVolume,
      },
      signupsOverview,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  const { status, isVerified } = req.body;
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (status !== undefined) user.status = status;
    if (isVerified !== undefined) user.isVerified = isVerified;
    await user.save();

    if (user.role === 'brand') {
      const brand = await Brand.findOne({ user: userId });
      if (brand) {
        brand.kycStatus = isVerified ? 'verified' : 'unverified';
        await brand.save();
      }
    }

    res.json({ message: 'User status updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ status: 'pending_approval' })
      .populate('brand', 'name email companyName');
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveCampaign = async (req, res) => {
  const { approve } = req.body;

  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    campaign.status = approve ? 'active' : 'cancelled';
    await campaign.save();

    res.json({
      message: approve ? 'Campaign approved and published!' : 'Campaign rejected/cancelled',
      campaign,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
