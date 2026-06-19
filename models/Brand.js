import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  website: { type: String, default: '' },
  industry: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  kycStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
  kycDocumentUrl: { type: String, default: '' }
}, { timestamps: true });

const Brand = mongoose.model('Brand', brandSchema);
export default Brand;
