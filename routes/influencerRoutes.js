import express from 'express';
import { uploadReceipt } from '../middleware/upload.js';
import {
  submitPaymentReceipt,
  submitReuploadReceipt,
} from '../controllers/influencer/influencerPaymentController.js';

const router = express.Router();

// Defined before /:id to prevent param matching collision
router.post('/reupload-receipt', uploadReceipt.single('receipt'), submitReuploadReceipt);
router.post('/:id/payment-receipt', uploadReceipt.single('receipt'), submitPaymentReceipt);

export default router;
