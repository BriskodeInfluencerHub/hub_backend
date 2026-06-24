import express from 'express';
import {
  getAdminAnalytics,
  getAdminUsers,
  getUserProfileDetail,
  updateUserStatus,
  getAdminCampaigns,
  approveCampaign,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/analytics', getAdminAnalytics);
router.get('/users', getAdminUsers);
router.get('/users/:userId/profile', getUserProfileDetail);
router.patch('/users/:userId/status', updateUserStatus);
router.get('/campaigns', getAdminCampaigns);
router.patch('/campaigns/:id/approve', approveCampaign);

export default router;
