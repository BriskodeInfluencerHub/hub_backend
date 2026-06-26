import express from 'express';
import { createReview, getInfluencerReviews } from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, authorize('brand', 'admin'), createReview);
router.get('/influencer/:influencerId', getInfluencerReviews);

export default router;
