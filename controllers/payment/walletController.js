import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Application from '../../models/Application.js';
import Payment from '../../models/Payment.js';
import Agency from '../../models/Agency.js';
import Influencer from '../../models/Influencer.js';

export const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id, balance: 0 });
    }

    // Self-healing check: Sync any completed applications/payments that were not credited to wallet
    const completedApps = await Application.find({
      influencer: req.user._id,
      status: 'completed',
    }).populate('campaign', 'title budget');

    let walletUpdated = false;

    for (const app of completedApps) {
      const titleMatch = app.campaign?.title || app.campaign?._id?.toString() || '';
      const existingTx = await Transaction.findOne({
        wallet: wallet._id,
        type: 'credit',
        $or: [
          { description: { $regex: titleMatch, $options: 'i' } },
          { description: { $regex: app._id.toString(), $options: 'i' } },
        ],
      });

      if (!existingTx) {
        // Uncredited completed application found! Credit wallet now.
        let payment = await Payment.findOne({ campaign: app.campaign._id, influencer: req.user._id });
        const totalAmount = payment?.amount || app.proposedRate || app.campaign?.budget || 0;

        let agencyFee = 0;
        let influencerPayout = totalAmount;

        const managingAgency = await Agency.findOne({ managedInfluencers: req.user._id });
        if (managingAgency && managingAgency.revenueShare > 0) {
          agencyFee = Math.round(totalAmount * (managingAgency.revenueShare / 100));
          influencerPayout = totalAmount - agencyFee;
        }

        wallet.balance += influencerPayout;
        walletUpdated = true;

        const descNote = agencyFee > 0 ? ` (Net payout after ${managingAgency.revenueShare}% agency fee)` : '';
        await Transaction.create({
          wallet: wallet._id,
          amount: influencerPayout,
          type: 'credit',
          description: `Payment released for campaign: ${titleMatch}${descNote}`,
          status: 'completed',
        });

        const influencerProfile = await Influencer.findOne({ user: req.user._id });
        if (influencerProfile) {
          influencerProfile.totalEarnings += influencerPayout;
          await influencerProfile.save();
        }
      }
    }

    if (walletUpdated) {
      await wallet.save();
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
