import User from '../../models/User.js';
import Referral from '../../models/Referral.js';
import { generateReferralCode } from './referralRewardService.js';

export const getMyReferral = async (req, res) => {
  try {
    let user = await User.findById(req.user._id);

    // Auto-generate referral code for users who registered before the referral system
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode();
      await user.save({ validateBeforeSave: false });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const referralLink = `${frontendUrl}/register?ref=${user.referralCode}`;

    const rawReferrals = await Referral.find({ referrer: req.user._id })
      .populate('referredUser', 'name email role createdAt')
      .sort({ createdAt: -1 });

    // Clean up / filter out orphaned referrals (where referredUser no longer exists in DB)
    const referrals = [];
    const orphanedIds = [];

    for (const r of rawReferrals) {
      if (!r.referredUser) {
        orphanedIds.push(r._id);
      } else {
        referrals.push(r);
      }
    }

    if (orphanedIds.length > 0) {
      await Referral.deleteMany({ _id: { $in: orphanedIds } });
    }

    const totalReferrals = referrals.length;
    const pendingReferrals = referrals.filter((r) => r.status !== 'rewarded').length;
    const completedReferrals = referrals.filter((r) => r.status === 'rewarded').length;

    // Sync user referral stats with valid database referrals
    const actualEarnings = referrals
      .filter((r) => r.status === 'rewarded')
      .reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

    if (user.referralEarnings !== actualEarnings || user.totalReferrals !== totalReferrals) {
      user.referralEarnings = actualEarnings;
      user.totalReferrals = totalReferrals;
      await user.save({ validateBeforeSave: false });
    }

    res.json({
      referralCode: user.referralCode,
      referralLink,
      totalReferrals,
      pendingReferrals,
      completedReferrals,
      totalEarnings: user.referralEarnings || 0,
      referrals,
    });
  } catch (error) {
    console.error('[GET MY REFERRAL ERROR]:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getReferralHistory = async (req, res) => {
  try {
    const rawReferrals = await Referral.find({ referrer: req.user._id })
      .populate('referredUser', 'name email role createdAt profileImage')
      .sort({ createdAt: -1 });

    const referrals = rawReferrals.filter((r) => r.referredUser != null);

    res.json({ referrals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
