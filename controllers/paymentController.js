import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
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
  const { amount } = req.body;

  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Withdrawal amount must be greater than zero' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    wallet.balance -= amount;
    wallet.pendingWithdrawals += amount;
    await wallet.save();

    const transaction = await Transaction.create({
      wallet: wallet._id,
      amount,
      type: 'debit',
      description: 'Withdrawal request pending bank processing',
      status: 'pending',
    });

    res.json({
      message: 'Withdrawal request submitted successfully',
      wallet,
      transaction,
    });
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
