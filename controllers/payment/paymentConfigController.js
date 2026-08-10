export const getPaymentConfig = (req, res) => {
  const fee = Number(process.env.INFLUENCER_REGISTRATION_FEE) || 1000;
  const upiId = process.env.UPI_ID;

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
