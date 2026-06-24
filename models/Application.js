import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  influencer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pitch: { type: String, required: true },
  proposedRate: { type: Number, required: true },
  portfolio: [{
    title: String,
    description: String,
    fileUrl: String,
    thumbnail: String
  }],
  socialStats: [{
    platform: String,
    username: String,
    followers: Number,
    engagementRate: Number,
    link: String
  }],
  deliverablesUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['applied', 'under_review', 'shortlisted', 'approved', 'rejected', 'completed'], 
    default: 'applied' 
  }
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
