import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    })
      .populate('participants', 'name email role profileImage')
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
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ message: 'Participant ID is required' });
  }

  try {
    const targetUser = await User.findById(participantId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Participant user not found' });
    }

    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, participantId] },
    }).populate('participants', 'name email role profileImage');

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, participantId],
      });
      chat = await chat.populate('participants', 'name email role profileImage');
    }

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMessages = async (req, res) => {
  const { chatId } = req.params;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat thread not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view messages in this thread' });
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name profileImage')
      .sort({ createdAt: 1 });

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
