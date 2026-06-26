import Review from '../models/Review.js';
import Application from '../models/Application.js';
import Campaign from '../models/Campaign.js';
import Influencer from '../models/Influencer.js';
import Notification from '../models/Notification.js';

export const createReview = async (req, res) => {
  const { applicationId, rating, comment } = req.body;

  try {
    const application = await Application.findById(applicationId)
      .populate('campaign', 'title brand');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.campaign.brand.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to review this application' });
    }

    if (application.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed campaigns' });
    }

    const existing = await Review.findOne({
      brand: req.user._id,
      campaign: application.campaign._id,
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this campaign' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const review = await Review.create({
      brand: req.user._id,
      influencer: application.influencer,
      campaign: application.campaign._id,
      application: application._id,
      rating,
      comment: comment || '',
    });

    const stats = await Review.aggregate([
      { $match: { influencer: application.influencer } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const influencerProfile = await Influencer.findOne({ user: application.influencer });
    if (influencerProfile) {
      influencerProfile.averageRating = stats[0]?.avgRating
        ? Math.round(stats[0].avgRating * 10) / 10
        : rating;
      influencerProfile.reviewCount = stats[0]?.count || 1;
      await influencerProfile.save();
    }

    await Notification.create({
      recipient: application.influencer,
      sender: req.user._id,
      type: 'profile_verified',
      title: 'New Review Received!',
      message: `You received a ${rating}-star review from the brand for campaign "${application.campaign.title}".${comment ? ` They said: "${comment}"` : ''}`,
      data: { campaignId: application.campaign._id, reviewId: review._id },
    });

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getInfluencerReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ influencer: req.params.influencerId })
      .populate('brand', 'name profileImage')
      .populate('campaign', 'title')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
