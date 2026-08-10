import express from 'express';
import {
  getAdminAnalytics,
  getAdminUsers,
  getUserProfileDetail,
  updateUserStatus,
  getAdminCampaigns,
  approveCampaign,
  resetUserPassword,
  deleteUser,
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
import { getAdminReferrals, releaseReferralReward } from '../controllers/referralController.js';
import {
  getAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from '../controllers/paymentController.js';
import {
  getInfluencerPayments,
  getInfluencerPaymentById,
  serveInfluencerReceipt,
  approveInfluencerPayment,
  rejectInfluencerPayment,
} from '../controllers/influencer/adminInfluencerPaymentsController.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/analytics', getAdminAnalytics);
router.get('/users', getAdminUsers);
router.get('/users/:userId/profile', getUserProfileDetail);
router.patch('/users/:userId/status', updateUserStatus);
router.post('/users/:userId/reset-password', resetUserPassword);
router.delete('/users/:userId', deleteUser);
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

// Referral Management
router.get('/referrals', getAdminReferrals);
router.post('/referrals/reward/:userId', releaseReferralReward);

// Withdrawal Management
router.get('/withdrawals', getAdminWithdrawals);
router.post('/withdrawals/:id/approve', approveWithdrawal);
router.post('/withdrawals/:id/reject', rejectWithdrawal);

// Influencer Payments & Approval Management
router.get('/influencer-payments', getInfluencerPayments);
router.get('/influencer-payments/:id', getInfluencerPaymentById);
router.get('/influencer-payments/:id/receipt', serveInfluencerReceipt);
router.patch('/influencer-payments/:id/approve', approveInfluencerPayment);
router.patch('/influencer-payments/:id/reject', rejectInfluencerPayment);

export default router;
