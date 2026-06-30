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
import {
  getAllCampaignRequests,
  getCampaignRequestById,
  updateCampaignRequestStatus,
} from '../controllers/campaignRequestController.js';
import {
  createCoordinator,
  getCoordinators,
  getCoordinatorById,
  updateCoordinator,
  deleteCoordinator,
} from '../controllers/coordinatorController.js';
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

router.get('/campaign-requests', getAllCampaignRequests);
router.get('/campaign-requests/:id', getCampaignRequestById);
router.patch('/campaign-requests/:id/status', updateCampaignRequestStatus);

router.post('/coordinators', createCoordinator);
router.get('/coordinators', getCoordinators);
router.get('/coordinators/:id', getCoordinatorById);
router.patch('/coordinators/:id', updateCoordinator);
router.delete('/coordinators/:id', deleteCoordinator);

export default router;
