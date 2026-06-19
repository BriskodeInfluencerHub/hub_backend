import mongoose from 'mongoose';

const agencySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  agencyName: { type: String, required: true },
  website: { type: String, default: '' },
  bio: { type: String, default: '' },
  managedInfluencers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  revenueShare: { type: Number, default: 10 }
}, { timestamps: true });

const Agency = mongoose.model('Agency', agencySchema);
export default Agency;
