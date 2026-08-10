// Single backend source of truth for influencer payment configuration, loaded directly from process.env.
export const getInfluencerRegistrationFee = () => Number(process.env.INFLUENCER_REGISTRATION_FEE) || 1000;
export const getUpiId = () => process.env.UPI_ID || '';
