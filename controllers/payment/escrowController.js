import Wallet from '../../models/Wallet.js';
import Transaction from '../../models/Transaction.js';
import Payment from '../../models/Payment.js';
import Campaign from '../../models/Campaign.js';
import Influencer from '../../models/Influencer.js';
import Notification from '../../models/Notification.js';
import Agency from '../../models/Agency.js';
import User from '../../models/User.js';
import Application from '../../models/Application.js';

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

    // Also mark related application as completed
    await Application.findOneAndUpdate(
      { campaign: payment.campaign._id, influencer: payment.influencer },
      { status: 'completed' }
    );

    const totalAmount = payment.amount;
    let agencyFee = 0;
    let influencerPayout = totalAmount;

    // Check if creator belongs to an Agency roster
    const managingAgency = await Agency.findOne({ managedInfluencers: payment.influencer });
    if (managingAgency && managingAgency.revenueShare > 0) {
      agencyFee = Math.round(totalAmount * (managingAgency.revenueShare / 100));
      influencerPayout = totalAmount - agencyFee;

      // Credit Agency Wallet
      let agencyWallet = await Wallet.findOne({ user: managingAgency.user });
      if (!agencyWallet) {
        agencyWallet = await Wallet.create({ user: managingAgency.user, balance: 0 });
      }
      agencyWallet.balance += agencyFee;
      await agencyWallet.save();

      const influencerUser = await User.findById(payment.influencer).select('name');
      await Transaction.create({
        wallet: agencyWallet._id,
        amount: agencyFee,
        type: 'credit',
        description: `Agency Commission (${managingAgency.revenueShare}%) for campaign "${payment.campaign.title}" (${influencerUser?.name || 'Creator'})`,
        status: 'completed',
      });

      // Notify Agency
      await Notification.create({
        recipient: managingAgency.user,
        sender: req.user._id,
        type: 'agency_commission',
        title: 'Agency Commission Received!',
        message: `You received ₹${agencyFee.toLocaleString()} commission (${managingAgency.revenueShare}%) for campaign "${payment.campaign.title}" completed by ${influencerUser?.name || 'creator'}.`,
        data: { campaignId: payment.campaign._id, paymentId: payment._id },
      });
    }

    // Credit Influencer Wallet
    let influencerWallet = await Wallet.findOne({ user: payment.influencer });
    if (!influencerWallet) {
      influencerWallet = await Wallet.create({ user: payment.influencer, balance: 0 });
    }
    influencerWallet.balance += influencerPayout;
    await influencerWallet.save();

    const descNote = agencyFee > 0 ? ` (Net payout after ${managingAgency.revenueShare}% agency fee)` : '';
    await Transaction.create({
      wallet: influencerWallet._id,
      amount: influencerPayout,
      type: 'credit',
      description: `Payout released for campaign: ${payment.campaign.title}${descNote}`,
      status: 'completed',
    });

    const influencerProfile = await Influencer.findOne({ user: payment.influencer });
    if (influencerProfile) {
      influencerProfile.totalEarnings += influencerPayout;
      await influencerProfile.save();
    }

    await Notification.create({
      recipient: payment.influencer,
      sender: req.user._id,
      type: 'payment_released',
      title: 'Payment Released!',
      message: `Your payment of ₹${influencerPayout.toLocaleString()} for campaign "${payment.campaign.title}" has been released to your wallet.`,
      data: { campaignId: payment.campaign._id, paymentId: payment._id },
    });

    res.json({ message: 'Escrow funds successfully released to wallet', payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
