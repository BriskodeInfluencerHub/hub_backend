import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Notification from '../../models/Notification.js';

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
