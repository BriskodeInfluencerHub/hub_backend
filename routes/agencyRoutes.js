import express from 'express';
import {
  getAgencyDashboardData,
  addToRoster,
  removeFromRoster,
  updateRevenueShare,
  searchInfluencers,
} from '../controllers/agencyController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('agency'));

router.get('/dashboard', getAgencyDashboardData);
router.post('/roster/add', addToRoster);
router.delete('/roster/:influencerId', removeFromRoster);
router.put('/revenue-share', updateRevenueShare);
router.get('/search-influencers', searchInfluencers);

export default router;
