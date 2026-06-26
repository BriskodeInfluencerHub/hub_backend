import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  influencer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
}, { timestamps: true });

reviewSchema.index({ influencer: 1, createdAt: -1 });
reviewSchema.index({ brand: 1, campaign: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
