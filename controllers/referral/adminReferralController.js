import Referral from '../../models/Referral.js';
import { checkAndRewardReferral } from './referralRewardService.js';

export const releaseReferralReward = async (req, res) => {
  try {
    const { userId } = req.params;
    await checkAndRewardReferral(userId);
    res.json({ message: 'Referral reward check completed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const retryPendingReferrals = async (req, res) => {
  try {
    // Find all referrals that are stuck at 'eligible' (reward not yet released)
    const stuckReferrals = await Referral.find({
      status: 'eligible',
      rewardReleased: false,
    });

    const results = [];
    for (const ref of stuckReferrals) {
      try {
        await checkAndRewardReferral(ref.referredUser.toString());
        results.push({ referralId: ref._id, status: 'processed' });
      } catch (e) {
        results.push({ referralId: ref._id, status: 'error', error: e.message });
      }
    }

    res.json({
      message: `Processed ${stuckReferrals.length} stuck referral(s)`,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminReferrals = async (req, res) => {
  try {
    const rawReferrals = await Referral.find()
      .populate('referrer', 'name email role')
      .populate('referredUser', 'name email role createdAt')
      .sort({ createdAt: -1 });

    const allReferrals = rawReferrals.filter((r) => r.referrer != null && r.referredUser != null);

    const totalReferrals = allReferrals.length;
    const totalPayouts = allReferrals
      .filter((r) => r.status === 'rewarded')
      .reduce((sum, r) => sum + r.rewardAmount, 0);
    const pendingRewards = allReferrals.filter((r) => r.status !== 'rewarded').length;

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
