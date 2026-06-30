import mongoose from 'mongoose';

const campaignInfluencerSchema = new mongoose.Schema({
  campaignRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignRequest', required: true },
  influencer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['invited', 'accepted', 'submitted', 'approved', 'rejected'],
    default: 'invited',
  },
  deliverables: [{
    title: { type: String, default: '' },
    url: { type: String, default: '' },
    notes: { type: String, default: '' },
  }],
  coordinatorNotes: { type: String, default: '' },
  invitedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
}, { timestamps: true });

campaignInfluencerSchema.index({ campaignRequest: 1, influencer: 1 }, { unique: true });

const CampaignInfluencer = mongoose.model('CampaignInfluencer', campaignInfluencerSchema);
export default CampaignInfluencer;
