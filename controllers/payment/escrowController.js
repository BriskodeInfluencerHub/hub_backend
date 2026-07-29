import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Payment from '../../models/Payment.js';
import Campaign from '../../models/Campaign.js';
import Influencer from '../../models/Influencer.js';
import Notification from '../../models/Notification.js';

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
