import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { 
    type: String, 
    enum: ['campaign_invite', 'app_approved', 'app_rejected', 'payment_released', 'new_message', 'profile_verified'], 
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
