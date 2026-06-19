import express from 'express';
import {
  applyToCampaign,
  getCampaignApplications,
  getMyApplications,
  updateApplicationStatus,
  submitDeliverables,
} from '../controllers/applicationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate, applicationSchema } from '../validators/schemas.js';

const router = express.Router();

router.get('/my-applications', protect, authorize('influencer', 'agency'), getMyApplications);
router.post('/campaign/:campaignId/apply', protect, authorize('influencer', 'agency'), validate(applicationSchema), applyToCampaign);
router.get('/campaign/:campaignId/applications', protect, getCampaignApplications);
router.patch('/:id/status', protect, updateApplicationStatus);
router.patch('/:id/submit-deliverables', protect, authorize('influencer'), submitDeliverables);

export default router;
