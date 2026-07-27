import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Campaign from '../models/Campaign.js';

const REWARD_AMOUNT = 150;

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Generate unique referral code like "BRISKODE7A92"
// ─────────────────────────────────────────────────────────────────────────────
export const generateReferralCode = async () => {
  let code;
  let exists = true;
  while (exists) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    code = `BRISKODE${suffix}`;
    const found = await User.findOne({ referralCode: code });
    exists = !!found;
  }
  return code;
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Check eligibility and release reward (idempotent — safe to call multiple times)
// ─────────────────────────────────────────────────────────────────────────────
export const checkAndRewardReferral = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) return;

    // Find the referral record
    const referral = await Referral.findOne({ referredUser: userId, rewardReleased: false });
    if (!referral) return; // Already rewarded or no referral record

    // Check role-specific eligibility
    let isEligible = false;

    if (user.role === 'influencer') {
      const profile = await Influencer.findOne({ user: userId });
      isEligible =
        user.isVerified &&
        profile &&
        profile.profileCompletion > 0 &&
        profile.socialAccounts &&
        profile.socialAccounts.length > 0;
    } else if (user.role === 'brand') {
      const profile = await Brand.findOne({ user: userId });
      const campaignCount = await Campaign.countDocuments({ brand: userId });
      isEligible =
        user.isVerified &&
        profile &&
        profile.companyName &&
        campaignCount > 0;
    } else if (user.role === 'agency') {
      const profile = await Agency.findOne({ user: userId });
      isEligible = profile && !!profile.agencyName;
    } else if (user.role === 'coordinator') {
      isEligible = true; // Coordinators are auto-eligible after profile is set
    }

    if (!isEligible) return;

    // Update referral status to eligible
    referral.status = 'eligible';
    await referral.save();

    // Release reward — use a session to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Idempotency double-check inside session
      const freshReferral = await Referral.findById(referral._id).session(session);
      if (freshReferral.rewardReleased) {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Credit referrer's wallet
      const referrerWallet = await Wallet.findOne({ user: referral.referrer }).session(session);
      if (!referrerWallet) {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      referrerWallet.balance += REWARD_AMOUNT;
      await referrerWallet.save({ session });

      // Create wallet transaction
      await Transaction.create([{
        wallet: referrerWallet._id,
        amount: REWARD_AMOUNT,
        type: 'credit',
        description: `Referral reward — ${user.name} joined and completed profile`,
        status: 'completed',
        source: 'referral',
        referralId: referral._id,
      }], { session });

      // Update referral record
      freshReferral.rewardReleased = true;
      freshReferral.rewardReleasedAt = new Date();
      freshReferral.status = 'rewarded';
      await freshReferral.save({ session });

      // Update referrer user stats
      await User.findByIdAndUpdate(
        referral.referrer,
        { $inc: { totalReferrals: 1, referralEarnings: REWARD_AMOUNT } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Send notification to referrer (outside session — non-critical)
      await Notification.create({
        recipient: referral.referrer,
        type: 'referral_rewarded',
        title: '🎉 Referral Reward Credited!',
        message: `₹${REWARD_AMOUNT} has been credited to your wallet because ${user.name} completed their profile using your referral.`,
        data: { referralId: referral._id, amount: REWARD_AMOUNT },
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('Referral reward transaction failed:', err.message);
    }
  } catch (err) {
    console.error('checkAndRewardReferral error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referrals/me
// ─────────────────────────────────────────────────────────────────────────────
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
    const pendingReferrals = referrals.filter(r => r.status !== 'rewarded').length;
    const completedReferrals = referrals.filter(r => r.status === 'rewarded').length;

    // Sync user referral stats with valid database referrals
    const actualEarnings = referrals
      .filter(r => r.status === 'rewarded')
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referrals/history
// ─────────────────────────────────────────────────────────────────────────────
export const getReferralHistory = async (req, res) => {
  try {
    const rawReferrals = await Referral.find({ referrer: req.user._id })
      .populate('referredUser', 'name email role createdAt profileImage')
      .sort({ createdAt: -1 });

    const referrals = rawReferrals.filter(r => r.referredUser != null);

    res.json({ referrals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referrals/reward/:userId  (Admin-triggered manual reward release)
// ─────────────────────────────────────────────────────────────────────────────
export const releaseReferralReward = async (req, res) => {
  try {
    const { userId } = req.params;
    await checkAndRewardReferral(userId);
    res.json({ message: 'Referral reward check completed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/referrals
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminReferrals = async (req, res) => {
  try {
    const rawReferrals = await Referral.find()
      .populate('referrer', 'name email role')
      .populate('referredUser', 'name email role createdAt')
      .sort({ createdAt: -1 });

    const allReferrals = rawReferrals.filter(r => r.referrer != null && r.referredUser != null);

    const totalReferrals = allReferrals.length;
    const totalPayouts = allReferrals
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + r.rewardAmount, 0);
    const pendingRewards = allReferrals.filter(r => r.status !== 'rewarded').length;

    // Top referrers
    const referrerMap = {};
    for (const r of allReferrals) {
      if (!r.referrer) continue;
      const key = r.referrer._id.toString();
      if (!referrerMap[key]) {
        referrerMap[key] = {
          user: r.referrer,
          totalReferrals: 0,
          rewardedReferrals: 0,
          totalEarned: 0,
        };
      }
      referrerMap[key].totalReferrals++;
      if (r.status === 'rewarded') {
        referrerMap[key].rewardedReferrals++;
        referrerMap[key].totalEarned += r.rewardAmount;
      }
    }
    const topReferrers = Object.values(referrerMap)
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, 10);

    res.json({
      totalReferrals,
      totalPayouts,
      pendingRewards,
      topReferrers,
      referrals: allReferrals,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
