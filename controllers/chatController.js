import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import Notification from '../models/Notification.js';
import { fetchContacts } from '../services/chatContactService.js';
import { initiateChat } from '../services/chatPermissionService.js';

export const getChatContacts = async (req, res) => {
  try {
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const q = req.query.q;

    let page = 1;
    if (rawPage !== undefined) {
      const parsedPage = Number(rawPage);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({ message: 'Query parameter "page" must be a positive integer >= 1' });
      }
      page = parsedPage;
    }

    let limit = 20;
    if (rawLimit !== undefined) {
      const parsedLimit = Number(rawLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return res.status(400).json({ message: 'Query parameter "limit" must be an integer between 1 and 50' });
      }
      limit = parsedLimit;
    }

    const data = await fetchContacts({
      currentUserId: req.user._id,
      currentUserRole: req.user.role,
      page,
      limit,
      q,
    });

    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
};


export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    })
      .populate('participants', 'name email role profileImage')
      .populate('campaign', 'title')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name profileImage' }
      })
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createChat = async (req, res) => {
  const { participantId, campaignId, text } = req.body;

  if (!participantId) {
    return res.status(400).json({ message: 'Participant ID is required' });
  }

  try {
    const io = req.app.get('socketio');
    const { chat, isNew } = await initiateChat({
      currentUser: req.user,
      participantId,
      campaignId,
      text,
      io,
    });

    res.status(isNew ? 201 : 200).json(chat);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  const rawPage = req.query.page;
  const rawLimit = req.query.limit;

  let page = 1;
  if (rawPage !== undefined) {
    const parsedPage = Number(rawPage);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ message: 'Query parameter "page" must be a positive integer >= 1' });
    }
    page = parsedPage;
  }

  let limit = 50;
  if (rawLimit !== undefined) {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ message: 'Query parameter "limit" must be an integer between 1 and 100' });
    }
    limit = parsedLimit;
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat thread not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view messages in this thread' });
    }

    const skip = (page - 1) * limit;

    const [rawMessages, total] = await Promise.all([
      Message.find({ chat: chatId })
        .populate('sender', 'name profileImage')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ chat: chatId }),
    ]);

    const messages = rawMessages.reverse();
    const pages = Math.ceil(total / limit) || 1;

    res.set({
      'X-Total-Count': total,
      'X-Page': page,
      'X-Limit': limit,
      'X-Total-Pages': pages,
    });

    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { text, fileUrl } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat thread not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send messages in this thread' });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: text || '',
      fileUrl: fileUrl || '',
      readBy: [req.user._id],
    });

    chat.lastMessage = message._id;
    await chat.save();

    const populatedMessage = await message.populate('sender', 'name profileImage');

    const io = req.app.get('socketio');
    if (io) {
      io.to(chatId).emit('message_received', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
