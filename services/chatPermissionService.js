import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import Notification from '../models/Notification.js';
import { canInitiateChat } from '../helpers/chatRolePermission.js';

/**
 * Handles chat initiation with permission validation, existing chat priority, and target user eligibility checks.
 * 
 * @param {Object} params
 * @param {Object} params.currentUser - Authenticated user object (req.user)
 * @param {string} params.participantId - Target user ID to chat with
 * @param {string} [params.campaignId] - Optional associated campaign ID
 * @param {string} [params.text] - Optional initial message text
 * @param {Object} [params.io] - Socket.io server instance
 * @returns {Promise<{ chat: Object, isNew: boolean }>}
 */
export const initiateChat = async ({ currentUser, participantId, campaignId, text, io }) => {
  if (currentUser._id.toString() === participantId.toString()) {
    const error = new Error('Cannot initiate a chat with yourself');
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await User.findById(participantId);
  if (!targetUser) {
    const error = new Error('Participant user not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Existing Chat Thread Priority
  let chatQuery = {
    participants: { $all: [currentUser._id, participantId] },
  };
  if (campaignId) {
    chatQuery.campaign = campaignId;
  }

  let chat = await Chat.findOne(chatQuery)
    .populate('participants', 'name email role profileImage')
    .populate('campaign', 'title');

  let isNew = false;

  // 2. If NO chat exists, validate target user eligibility and role permissions
  if (!chat) {
    if (targetUser.status !== 'active' || targetUser.isVerified !== true || targetUser.isDeleted === true) {
      const error = new Error('Target user account is suspended or ineligible for chat initiation');
      error.statusCode = 403;
      throw error;
    }

    if (!canInitiateChat(currentUser.role, targetUser.role)) {
      const error = new Error(`Role '${currentUser.role}' is not authorized to initiate a chat with role '${targetUser.role}'`);
      error.statusCode = 403;
      throw error;
    }

    const chatData = {
      participants: [currentUser._id, participantId],
    };
    if (campaignId) {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        chatData.campaign = campaignId;
      }
    }

    chat = await Chat.create(chatData);
    chat = await chat.populate('participants', 'name email role profileImage');
    if (chat.campaign) {
      chat = await chat.populate('campaign', 'title');
    }
    isNew = true;
  }

  // Process initial message if text provided
  if (text && typeof text === 'string' && text.trim()) {
    const message = await Message.create({
      chat: chat._id,
      sender: currentUser._id,
      text: text.trim(),
      readBy: [currentUser._id],
    });

    chat.lastMessage = message._id;
    await chat.save();

    const populatedMessage = await message.populate('sender', 'name profileImage');

    if (io) {
      io.to(chat._id.toString()).emit('message_received', populatedMessage);
    }
  }

  // Create notification
  await Notification.create({
    recipient: participantId,
    sender: currentUser._id,
    type: 'new_message',
    title: 'New Message',
    message: text
      ? `${currentUser.name} sent you a message${campaignId ? ' regarding a campaign' : ''}`
      : `${currentUser.name} wants to connect with you`,
    data: { chatId: chat._id, campaignId: campaignId || null },
  });

  return { chat, isNew };
};
