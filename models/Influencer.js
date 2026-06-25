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
  tagline: { type: String, default: '' },
  pastBrands: { type: String, default: '' },
  featuredVideo: { type: String, default: '' },
  services: [{
    title: String,
    price: Number,
    deliveryDays: Number
  }],
  audienceGenderMale: { type: Number, default: 50 },
  audienceGenderFemale: { type: Number, default: 50 },
  audienceTopCountries: { type: String, default: '' },
  audienceAgeRange: { type: String, default: '' },
  contentFormats: { type: String, default: '' },
  businessEmail: { type: String, default: '' },
  businessPhone: { type: String, default: '' },
  faqs: [{
    question: String,
    answer: String
  }],
  totalEarnings: { type: Number, default: 0 },
  profileCompletion: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

const Influencer = mongoose.model('Influencer', influencerSchema);
export default Influencer;
