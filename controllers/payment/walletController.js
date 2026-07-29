import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';

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
