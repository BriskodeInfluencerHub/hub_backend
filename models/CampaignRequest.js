import mongoose from 'mongoose';

const campaignRequestSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  brandInfo: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    companyName: { type: String, default: '' },
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  requirements: { type: String, default: '' },
  location: { type: String, default: '' },
  budget: { type: Number, default: 0 },
  timeline: { type: String, default: '' },
  categories: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'assigned', 'completed'],
    default: 'pending',
  },
  assignedCoordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminNote: { type: String, default: '' },
}, { timestamps: true });

const CampaignRequest = mongoose.model('CampaignRequest', campaignRequestSchema);
export default CampaignRequest;
