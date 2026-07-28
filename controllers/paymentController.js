import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import Campaign from '../models/Campaign.js';
import Influencer from '../models/Influencer.js';
import Notification from '../models/Notification.js';

export const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    const transactions = await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 });

    res.json({
      wallet,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const withdrawRequest = async (req, res) => {
  const { walletTransactionId, upiId, payoutInfo, amount } = req.body;
  const paymentDetails = upiId || payoutInfo;

  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (!walletTransactionId) {
      return res.status(400).json({ message: 'Wallet transaction ID is required' });
    }

    if (!paymentDetails || !paymentDetails.trim()) {
      return res.status(400).json({ message: 'UPI ID or payment details are required' });
    }

    const transaction = await Transaction.findById(walletTransactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Target wallet transaction not found' });
    }

    // Validate ownership
    if (transaction.wallet.toString() !== wallet._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to transaction' });
    }

    // Validate type: Only credit transactions can be withdrawn
    if (transaction.type !== 'credit') {
      return res.status(400).json({ message: 'Only credited earnings can be withdrawn' });
    }

    // Validate status: Prevent duplicate withdrawal requests
    if (transaction.withdrawalStatus && transaction.withdrawalStatus !== 'not_requested') {
      return res.status(400).json({
        message: `Withdrawal has already been requested or processed for this earning (Status: ${transaction.withdrawalStatus})`,
      });
    }

    // Validate wallet balance
    if (wallet.balance < transaction.amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance for this withdrawal' });
    }

    // Update wallet balance
    wallet.balance -= transaction.amount;
    wallet.pendingWithdrawals += transaction.amount;
    await wallet.save();

    // Update target transaction
    transaction.withdrawalStatus = 'requested';
    transaction.payoutInfo = paymentDetails.trim();
    transaction.withdrawalRequestedAt = new Date();
    await transaction.save();

    res.json({
      message: 'Withdrawal request submitted successfully',
      wallet,
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Get all withdrawal requests
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminWithdrawals = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [
        { withdrawalStatus: { $in: ['requested', 'approved', 'rejected', 'paid'] } },
        { source: 'withdrawal' },
        { type: 'debit', description: { $regex: /withdrawal/i } },
      ],
    })
      .populate({
        path: 'wallet',
        populate: {
          path: 'user',
          select: 'name email role profileImage',
        },
      })
      .sort({ withdrawalRequestedAt: -1, createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Approve withdrawal request & mark as paid
// ─────────────────────────────────────────────────────────────────────────────
export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id).populate({
      path: 'wallet',
      populate: { path: 'user', select: 'name email' },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Withdrawal transaction not found' });
    }

    if (transaction.withdrawalStatus !== 'requested' && transaction.status !== 'pending') {
      return res.status(400).json({
        message: `Transaction withdrawal status is already ${transaction.withdrawalStatus || transaction.status}`,
      });
    }

    transaction.withdrawalStatus = 'paid';
    transaction.status = 'completed';
    await transaction.save();

    // Update wallet: reduce pending withdrawals
    if (transaction.wallet) {
      const wallet = await Wallet.findById(transaction.wallet._id);
      if (wallet) {
        wallet.pendingWithdrawals = Math.max(0, wallet.pendingWithdrawals - transaction.amount);
        await wallet.save();
      }

      // Notify user
      if (wallet.user) {
        await Notification.create({
          recipient: wallet.user._id || wallet.user,
          sender: req.user._id,
          type: 'payment_released',
          title: '🎉 Withdrawal Approved & Paid!',
          message: `Your withdrawal request of ₹${transaction.amount} for "${transaction.description}" has been approved and paid out by Admin.`,
          data: { transactionId: transaction._id, amount: transaction.amount },
        });
      }
    }

    res.json({ message: 'Withdrawal request approved successfully', transaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Reject withdrawal request & refund wallet balance
// ─────────────────────────────────────────────────────────────────────────────
export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const transaction = await Transaction.findById(id).populate({
      path: 'wallet',
      populate: { path: 'user', select: 'name email' },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Withdrawal transaction not found' });
    }

    if (transaction.withdrawalStatus !== 'requested' && transaction.status !== 'pending') {
      return res.status(400).json({
        message: `Transaction withdrawal status is already ${transaction.withdrawalStatus || transaction.status}`,
      });
    }

    transaction.withdrawalStatus = 'rejected';
    transaction.status = 'failed';
    await transaction.save();

    // Update wallet: refund balance and clear pending
    if (transaction.wallet) {
      const wallet = await Wallet.findById(transaction.wallet._id);
      if (wallet) {
        wallet.pendingWithdrawals = Math.max(0, wallet.pendingWithdrawals - transaction.amount);
        wallet.balance += transaction.amount;
        await wallet.save();
      }

      // Notify user
      if (wallet.user) {
        await Notification.create({
          recipient: wallet.user._id || wallet.user,
          sender: req.user._id,
          type: 'payment_released',
          title: '⚠️ Withdrawal Request Rejected',
          message: `Your withdrawal request of ₹${transaction.amount} for "${transaction.description}" was rejected${reason ? `: ${reason}` : ''}. The amount has been refunded to your wallet.`,
          data: { transactionId: transaction._id, amount: transaction.amount },
        });
      }
    }

    res.json({ message: 'Withdrawal request rejected and amount refunded', transaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const releaseEscrow = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId).populate('campaign');
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    if (payment.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to release these funds' });
    }

    if (payment.escrowStatus !== 'held') {
      return res.status(400).json({ message: `Escrow has already been ${payment.escrowStatus}` });
    }

    payment.escrowStatus = 'released';
    await payment.save();

    const campaignDoc = await Campaign.findById(payment.campaign._id);
    if (campaignDoc) {
      campaignDoc.status = 'completed';
      await campaignDoc.save();
    }

    const influencerWallet = await Wallet.findOne({ user: payment.influencer });
    if (influencerWallet) {
      influencerWallet.balance += payment.amount;
      await influencerWallet.save();

      await Transaction.create({
        wallet: influencerWallet._id,
        amount: payment.amount,
        type: 'credit',
        description: `Payout released for campaign: ${payment.campaign.title}`,
        status: 'completed',
      });
    }

    const influencerProfile = await Influencer.findOne({ user: payment.influencer });
    if (influencerProfile) {
      influencerProfile.totalEarnings += payment.amount;
      await influencerProfile.save();
    }

    await Notification.create({
      recipient: payment.influencer,
      sender: req.user._id,
      type: 'payment_released',
      title: 'Payment Released!',
      message: `Your payment of $${payment.amount} for campaign "${payment.campaign.title}" has been released to your wallet.`,
      data: { campaignId: payment.campaign._id, paymentId: payment._id },
    });

    res.json({ message: 'Escrow funds successfully released to influencer wallet', payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
