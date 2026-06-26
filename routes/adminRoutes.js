import express from 'express';
import {
  getAdminAnalytics,
  getAdminUsers,
  getUserProfileDetail,
  updateUserStatus,
  getAdminCampaigns,
  approveCampaign,
} from '../controllers/adminController.js';
import {
  getCategories,
  createCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/analytics', getAdminAnalytics);
router.get('/users', getAdminUsers);
router.get('/users/:userId/profile', getUserProfileDetail);
router.patch('/users/:userId/status', updateUserStatus);
router.get('/campaigns', getAdminCampaigns);
router.patch('/campaigns/:id/approve', approveCampaign);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
