import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  budget: { type: Number, required: true },
  targetAudience: { type: String, default: '' },
  location: { type: String, default: '' },
  requiredFollowers: { type: Number, default: 0 },
  requiredPlatforms: [{ type: String }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'pending_approval', 'active', 'in_progress', 'completed', 'cancelled', 'rejected'], 
    default: 'pending_approval' 
  }
}, { timestamps: true });

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
