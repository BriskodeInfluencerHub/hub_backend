import express from 'express';
import {
  getChats,
  createChat,
  getMessages,
  sendMessage,
  getChatContacts,
} from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/contacts', getChatContacts);

router.route('/')
  .get(getChats)
  .post(createChat);

router.route('/:chatId/messages')
  .get(getMessages)
  .post(sendMessage);

export default router;
