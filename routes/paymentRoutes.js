import express from 'express';
import {
  getWallet,
  withdrawRequest,
  releaseEscrow,
} from '../controllers/paymentController.js';
import { getPaymentConfig } from '../controllers/payment/paymentConfigController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/config', getPaymentConfig);
router.get('/wallet', protect, getWallet);
router.post('/withdraw', protect, authorize('influencer', 'agency'), withdrawRequest);
router.post('/release/:paymentId', protect, releaseEscrow);

export default router;
