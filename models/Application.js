import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  influencer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pitch: { type: String, required: true },
  proposedRate: { type: Number, required: true },
  deliverablesUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['applied', 'under_review', 'shortlisted', 'approved', 'rejected', 'completed'], 
    default: 'applied' 
  }
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
