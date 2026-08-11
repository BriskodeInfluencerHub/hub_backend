import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import sendEmail from '../utils/sendEmail.js';

export const getAdminAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalInfluencers = await User.countDocuments({ role: 'influencer' });
    const totalBrands = await User.countDocuments({ role: 'brand' });
    const totalAgencies = await User.countDocuments({ role: 'agency' });
    const totalCampaigns = await Campaign.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'active' });

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
        activeCampaigns,
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
    const users = await User.find({ isDeleted: { $ne: true } }).select('-password').sort({ createdAt: -1 });

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

    if (user.role === 'influencer' && (status === 'active' || isVerified === true)) {
      user.isApproved = true;
      user.isActive = true;
      user.approvalStatus = 'approved';
      user.paymentStatus = 'verified';
      user.receiptStatus = 'verified';
      user.rejectionReason = '';
    }

    await user.save();

    if (user.role === 'influencer') {
      const influencer = await Influencer.findOne({ user: userId });
      if (influencer) {
        if (isVerified !== undefined) {
          influencer.isVerified = isVerified;
          await influencer.save();
        }

        if (status === 'active' || isVerified === true) {
          await Notification.create({
            recipient: userId,
            sender: req.user._id,
            type: 'profile_verified',
            title: 'Account Approved!',
            message: 'Your influencer registration payment receipt has been verified and your account is now active. You can now log in.',
          });

          const approvalHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
              <h2 style="color:#10b981;margin-top:0;">Account Approved!</h2>
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Great news! Your payment receipt has been verified and your influencer account on <strong>Odisha Influencer Market</strong> is now fully active.</p>
              <p>You can now log in to your account and explore campaigns.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Log In Now</a>
              </div>
            </div>
          `;
          await sendEmail({ to: user.email, subject: 'Account Approved — Odisha Influencer Market', html: approvalHtml }).catch(console.error);
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
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    const campaigns = await Campaign.find(filter)
      .populate('brand', 'name email companyName')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveCampaign = async (req, res) => {
  const { approve, spam } = req.body;

  try {
    const campaign = await Campaign.findById(req.params.id).populate('brand', 'name email');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (spam) {
      campaign.status = 'rejected';
    } else {
      campaign.status = approve ? 'active' : 'cancelled';
    }
    await campaign.save();

    const brandRecipient = campaign.brand?._id || campaign.brand;
    if (brandRecipient) {
      await Notification.create({
        recipient: brandRecipient,
        sender: req.user?._id,
        type: 'campaign_invite',
        title: spam ? 'Campaign Marked as Spam' : (approve ? 'Campaign Approved!' : 'Campaign Rejected'),
        message: spam
          ? `Your campaign "${campaign.title}" was flagged as spam and has been rejected.`
          : (approve
            ? `Your campaign "${campaign.title}" has been approved and is now live for influencer applications.`
            : `Your campaign "${campaign.title}" was not approved by the admin.`),
        data: { campaignId: campaign._id },
      });
    }

    res.json({
      message: spam ? 'Campaign rejected as spam' : (approve ? 'Campaign approved and published!' : 'Campaign rejected/cancelled'),
      campaign,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetUserPassword = async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const tempPassword = newPassword || 'Reset@1234';
    // Set plain-text password — the User model's pre-save hook will hash it automatically
    user.password = tempPassword;
    await user.save();
    await Notification.create({
      recipient: userId,
      sender: req.user._id,
      type: 'profile_verified',
      title: 'Password Reset by Admin',
      message: `Your password has been reset by an administrator. Your new temporary password is: ${tempPassword}. Please change it after logging in.`,
    });
    res.json({ message: `Password reset successfully. Temporary password: ${tempPassword}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isDeleted = true;
    user.status = 'deleted';
    user.deletedAt = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'User deleted and account closed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
