import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  source: { type: String, enum: ['referral', 'campaign', 'withdrawal', 'other'], default: 'other' },
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral', default: null },
  payoutInfo: { type: String, default: '' },
  withdrawalStatus: {
    type: String,
    enum: ['not_requested', 'requested', 'approved', 'rejected', 'paid'],
    default: 'not_requested',
  },
  withdrawalRequestedAt: { type: Date, default: null },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
