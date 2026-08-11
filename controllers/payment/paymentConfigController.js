import { getInfluencerRegistrationFee, getUpiId } from '../../config/paymentConfig.js';

export const getPaymentConfig = (req, res) => {
  const fee = getInfluencerRegistrationFee();
  const upiId = getUpiId();

  if (!upiId) {
    return res.status(503).json({
      message: 'Payment configuration is currently unavailable. Please contact support.',
    });
  }

  return res.status(200).json({
    influencerRegistrationFee: fee,
    currency: 'INR',
    upiId,
  });
};
