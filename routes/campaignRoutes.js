import express from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from '../controllers/campaignController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate, campaignSchema } from '../validators/schemas.js';

const router = express.Router();

router.route('/')
  .get(getCampaigns)
  .post(protect, authorize('brand', 'admin'), validate(campaignSchema), createCampaign);

router.route('/:id')
  .get(getCampaignById)
  .put(protect, updateCampaign)
  .delete(protect, deleteCampaign);

export default router;
