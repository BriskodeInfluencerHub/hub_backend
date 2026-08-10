import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['influencer', 'brand', 'agency', 'admin', 'coordinator'], required: true },
  status: { type: String, enum: ['pending', 'active', 'suspended', 'deleted'], default: 'pending' },
  profileImage: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  otp: {
    code: String,
    expiresAt: Date
  },
  refreshToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Referral System Fields
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  totalReferrals: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  // Influencer Registration Payment & Admin Approval Fields
  paymentAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'receipt_submitted', 'verified', 'rejected'],
    default: 'not_required',
  },
  receiptFilename: { type: String, default: '' },
  receiptStatus: {
    type: String,
    enum: ['not_required', 'not_uploaded', 'submitted', 'verified', 'rejected'],
    default: 'not_required',
  },
  approvalStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required',
  },
  isApproved: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  rejectionReason: { type: String, default: '' },
  utrNumber: { type: String, default: '' },
  paymentToken: { type: String, default: null },
  paymentTokenExpiry: { type: Date, default: null },
  reuploadToken: { type: String, default: null },
  reuploadTokenExpiry: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
