import express from 'express';
import { execSync } from 'child_process';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Import Route Handlers (to be defined)
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import campaignRequestRoutes from './routes/campaignRequestRoutes.js';
import coordinatorRoutes from './routes/coordinatorRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import Category from './models/Category.js';

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const DEFAULT_CATEGORIES = ['Fashion', 'Tech', 'Food', 'Travel', 'Fitness'];

const seedCategories = async () => {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ name })));
      console.log('Default categories seeded');
    }
  } catch (e) {
    console.error('Category seed error:', e.message);
  }
};
seedCategories();

const app = express();
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: ['*', 'http://localhost:5173', 'http://localhost:5174', 'https://briskodeinfluencerhub.netlify.app/'],
    methods: ['GET', 'POST'],
  },
});

app.set('socketio', io);

// Security Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads static folder
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Root Route
app.get('/', (req, res) => {
  res.send('Odisha Influencer Market API is running...');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaign-requests', campaignRequestRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/referrals', referralRoutes);

// Socket connection logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`User joined room: ${chatId}`);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('typing', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5002;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[PORT BUSY] Port ${PORT} is occupied. Auto-releasing port...`);
    try {
      execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
    } catch (_) {}
    setTimeout(() => {
      server.listen(PORT);
    }, 1000);
  } else {
    console.error('[SERVER ERROR]', err);
  }
});
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
export { app, io };
