import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  referralCode: { type: String, required: true },
  rewardAmount: { type: Number, default: 150 },
  rewardReleased: { type: Boolean, default: false },
  rewardReleasedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['registered', 'verified', 'eligible', 'rewarded'],
    default: 'registered',
  },
}, { timestamps: true });

// Compound index for quick lookups
referralSchema.index({ referrer: 1, status: 1 });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
