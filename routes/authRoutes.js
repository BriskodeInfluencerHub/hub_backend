import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema, otpVerifySchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/schemas.js';

const router = express.Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/verify-otp', validate(otpVerifySchema), verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', validate(loginSchema), loginUser);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logoutUser);

// Password recovery
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

export default router;
