import express from 'express';
import {
  createCampaignRequest,
  createPublicCampaignRequest,
  getMyCampaignRequests,
  getCoordinatorCampaigns,
} from '../controllers/campaignRequestController.js';
import {
  getMyInvitations,
  respondToInvitation,
  influencerSubmitDeliverable,
} from '../controllers/campaignInfluencerController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/public', createPublicCampaignRequest);

router.route('/')
  .post(protect, authorize('brand'), createCampaignRequest)
  .get(protect, authorize('brand'), getMyCampaignRequests);

router.get('/coordinator', protect, authorize('coordinator'), getCoordinatorCampaigns);

router.get('/my-invitations', protect, authorize('influencer'), getMyInvitations);
router.patch('/my-invitations/:id/respond', protect, authorize('influencer'), respondToInvitation);
router.post('/my-invitations/:id/deliverables', protect, authorize('influencer'), influencerSubmitDeliverable);

export default router;
