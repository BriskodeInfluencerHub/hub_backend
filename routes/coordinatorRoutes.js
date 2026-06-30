import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getCoordinatorCampaigns } from '../controllers/campaignRequestController.js';
import {
  getCampaignInfluencers,
  inviteInfluencer,
  updateInfluencerStatus,
  addDeliverable,
  removeDeliverable,
  updateCoordinatorNotes,
} from '../controllers/campaignInfluencerController.js';

const router = express.Router();

router.use(protect, authorize('coordinator'));

router.get('/campaigns', getCoordinatorCampaigns);

router.get('/campaigns/:campaignId/influencers', getCampaignInfluencers);
router.post('/campaigns/:campaignId/invite', inviteInfluencer);
router.patch('/campaigns/:campaignId/influencers/:influencerId/status', updateInfluencerStatus);
router.post('/campaigns/:campaignId/influencers/:influencerId/deliverables', addDeliverable);
router.delete('/campaigns/:campaignId/influencers/:influencerId/deliverables/:deliverableId', removeDeliverable);
router.patch('/campaigns/:campaignId/influencers/:influencerId/notes', updateCoordinatorNotes);

export default router;
