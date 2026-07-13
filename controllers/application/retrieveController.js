import Application from '../../models/Application.js';
import Campaign from '../../models/Campaign.js';
import Payment from '../../models/Payment.js';

export const getCampaignApplications = async (req, res) => {
  const { campaignId } = req.params;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view applications' });
    }

    const applications = await Application.find({ campaign: campaignId })
      .populate('influencer', 'name email phone profileImage');

    const applicationsWithPayments = await Promise.all(
      applications.map(async (app) => {
        const appObj = app.toObject();
        const payment = await Payment.findOne({
          campaign: campaignId,
          influencer: app.influencer._id,
        });
        appObj.payment = payment || null;
        return appObj;
      })
    );

    res.json(applicationsWithPayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ influencer: req.user._id })
      .populate({
        path: 'campaign',
        populate: {
          path: 'brand',
          select: 'name email profileImage',
        },
      });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
