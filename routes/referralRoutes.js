import express from 'express';
import {
  getMyReferral,
  getReferralHistory,
  releaseReferralReward,
  retryPendingReferrals,
} from '../controllers/referralController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Authenticated user routes
router.get('/me', protect, getMyReferral);
router.get('/history', protect, getReferralHistory);

// Admin-only: manually trigger reward for a user
router.post('/reward/:userId', protect, authorize('admin'), releaseReferralReward);

// Admin-only: retry all stuck 'eligible' referrals that never got rewarded
router.post('/retry-pending', protect, authorize('admin'), retryPendingReferrals);


export default router;
