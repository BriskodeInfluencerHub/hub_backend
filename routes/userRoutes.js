import express from 'express';
import {
  getPublicInfluencers,
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  uploadFile,
  getUserNotifications,
  markNotificationsRead,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate, profileUpdateSchema } from '../validators/schemas.js';

const router = express.Router();

router.get('/influencers', getPublicInfluencers);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, validate(profileUpdateSchema), updateUserProfile);
router.post('/upload-avatar', protect, upload.single('profileImage'), uploadAvatar);
router.post('/upload-file', protect, upload.single('file'), uploadFile);
router.get('/notifications', protect, getUserNotifications);
router.patch('/notifications/read', protect, markNotificationsRead);

export default router;
