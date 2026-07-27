import express from 'express';
import {
  getMyReferral,
  getReferralHistory,
  releaseReferralReward,
} from '../controllers/referralController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Authenticated user routes
router.get('/me', protect, getMyReferral);
router.get('/history', protect, getReferralHistory);

// Admin-only: manually trigger reward for a user
router.post('/reward/:userId', protect, authorize('admin'), releaseReferralReward);

export default router;
