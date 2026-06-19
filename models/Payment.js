import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  influencer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  escrowStatus: { type: String, enum: ['held', 'released', 'refunded'], default: 'held' }
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
