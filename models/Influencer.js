import mongoose from 'mongoose';

const influencerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio: { type: String, default: '' },
  location: { type: String, required: true },
  categories: [{ type: String }],
  socialAccounts: [{
    platform: { type: String, enum: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook'] },
    username: String,
    followers: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    link: String
  }],
  portfolio: [{
    title: String,
    description: String,
    fileUrl: String,
    thumbnail: String
  }],
  totalEarnings: { type: Number, default: 0 },
  profileCompletion: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

const Influencer = mongoose.model('Influencer', influencerSchema);
export default Influencer;
