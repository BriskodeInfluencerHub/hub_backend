import crypto from 'crypto';
import User from '../../models/User.js';
import Referral from '../../models/Referral.js';
import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Notification from '../../models/Notification.js';
import Influencer from '../../models/Influencer.js';
import Brand from '../../models/Brand.js';
import Agency from '../../models/Agency.js';
import Campaign from '../../models/Campaign.js';

const REWARD_AMOUNT = 150;

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Generate unique referral code like "BRISKODE7A92"
// ─────────────────────────────────────────────────────────────────────────────
export const generateReferralCode = async (userName) => {
  let namePrefix = 'USER';
  if (userName && typeof userName === 'string') {
    const cleaned = userName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length >= 2) {
      namePrefix = cleaned.slice(0, 8);
    }
  }

  let code;
  let exists = true;
  while (exists) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    code = `${namePrefix}${suffix}`;
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

    // Atomically claim the reward slot — only one process wins this update
    const claimedReferral = await Referral.findOneAndUpdate(
      { _id: referral._id, rewardReleased: false },
      { $set: { status: 'rewarded', rewardReleased: true, rewardReleasedAt: new Date() } },
      { new: true }
    );

    if (!claimedReferral) return;

    try {
      // Credit referrer's wallet
      const referrerWallet = await Wallet.findOne({ user: referral.referrer });
      if (!referrerWallet) {
        // Roll back the referral claim if wallet is missing
        await Referral.findByIdAndUpdate(referral._id, { rewardReleased: false, status: 'eligible' });
        console.error('Referral reward aborted — referrer wallet not found');
        return;
      }

      referrerWallet.balance += REWARD_AMOUNT;
      await referrerWallet.save();

      // Create wallet transaction
      await Transaction.create({
        wallet: referrerWallet._id,
        amount: REWARD_AMOUNT,
        type: 'credit',
        description: `Referral reward — ${user.name} joined and completed profile`,
        status: 'completed',
        source: 'referral',
        referralId: referral._id,
      });

      // Update referrer user stats
      await User.findByIdAndUpdate(
        referral.referrer,
        { $inc: { totalReferrals: 1, referralEarnings: REWARD_AMOUNT } }
      );

      // Send notification to referrer (non-critical)
      await Notification.create({
        recipient: referral.referrer,
        type: 'referral_rewarded',
        title: '🎉 Referral Reward Credited!',
        message: `₹${REWARD_AMOUNT} has been credited to your wallet because ${user.name} completed their profile using your referral.`,
        data: { referralId: referral._id, amount: REWARD_AMOUNT },
      });

      console.log(`[REFERRAL] ✅ Reward of ₹${REWARD_AMOUNT} released for referral ${referral._id}`);
    } catch (err) {
      // Roll back the atomic claim so it can be retried
      await Referral.findByIdAndUpdate(referral._id, { rewardReleased: false, rewardReleasedAt: null, status: 'eligible' });
      console.error('Referral reward post-processing failed:', err.message);
    }
  } catch (err) {
    console.error('checkAndRewardReferral error:', err.message);
  }
};
