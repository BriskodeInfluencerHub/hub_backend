import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';

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

    const result = [];
    for (const user of users) {
      const u = user.toObject();
      if (user.role === 'influencer') {
        const influencer = await Influencer.findOne({ user: user._id });
        u.influencerProfile = influencer
          ? { profileCompletion: influencer.profileCompletion, isVerified: influencer.isVerified, categories: influencer.categories }
          : null;
      }
      if (user.role === 'brand') {
        const brand = await Brand.findOne({ user: user._id });
        u.brandProfile = brand
          ? { kycStatus: brand.kycStatus, companyName: brand.companyName }
          : null;
      }
      result.push(u);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfileDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile = null;
    if (user.role === 'influencer') {
      profile = await Influencer.findOne({ user: user._id });
    } else if (user.role === 'brand') {
      profile = await Brand.findOne({ user: user._id });
    } else if (user.role === 'agency') {
      profile = await Agency.findOne({ user: user._id });
    }

    res.json({ user, profile });
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

    if (user.role === 'influencer') {
      const influencer = await Influencer.findOne({ user: userId });
      if (influencer && isVerified !== undefined) {
        influencer.isVerified = isVerified;
        await influencer.save();

        if (isVerified) {
          await Notification.create({
            recipient: userId,
            sender: req.user._id,
            type: 'profile_verified',
            title: 'Profile Verified!',
            message: 'Your influencer profile has been verified by the admin and is now public. You can apply to campaigns.',
          });
        }
      }
    }

    if (user.role === 'brand') {
      const brand = await Brand.findOne({ user: userId });
      if (brand) {
        brand.kycStatus = isVerified ? 'verified' : 'unverified';
        await brand.save();

        if (isVerified) {
          await Notification.create({
            recipient: userId,
            sender: req.user._id,
            type: 'profile_verified',
            title: 'Brand Verified!',
            message: 'Your brand account has been verified by the admin. You can now create and manage campaigns.',
          });
        }
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
    const campaign = await Campaign.findById(req.params.id).populate('brand', 'name email');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    campaign.status = approve ? 'active' : 'cancelled';
    await campaign.save();

    await Notification.create({
      recipient: campaign.brand._id,
      sender: req.user._id,
      type: 'campaign_invite',
      title: approve ? 'Campaign Approved!' : 'Campaign Rejected',
      message: approve
        ? `Your campaign "${campaign.title}" has been approved and is now live for influencer applications.`
        : `Your campaign "${campaign.title}" was not approved by the admin.`,
      data: { campaignId: campaign._id },
    });

    res.json({
      message: approve ? 'Campaign approved and published!' : 'Campaign rejected/cancelled',
      campaign,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
