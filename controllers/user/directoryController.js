import Influencer from '../../models/Influencer.js';

export const getPublicInfluencers = async (req, res) => {
  try {
    const { category, search, location, minFollowers, minEngagement } = req.query;
    let filter = { isVerified: true };

    if (category) {
      filter.categories = { $in: [category] };
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    let influencers = await Influencer.find(filter)
      .populate('user', 'name email profileImage')
      .sort({ profileCompletion: -1 });

    if (search) {
      const term = search.toLowerCase();
      influencers = influencers.filter((inf) =>
        inf.user?.name?.toLowerCase().includes(term)
      );
    }

    if (minFollowers) {
      const min = parseInt(minFollowers, 10);
      if (!isNaN(min)) {
        influencers = influencers.filter((inf) =>
          (inf.socialAccounts || []).some((acct) => (acct.followers || 0) >= min)
        );
      }
    }

    if (minEngagement) {
      const min = parseFloat(minEngagement);
      if (!isNaN(min)) {
        influencers = influencers.filter((inf) =>
          (inf.socialAccounts || []).some((acct) => (acct.engagementRate || 0) >= min)
        );
      }
    }

    const result = influencers.map((inf) => ({
      _id: inf._id,
      userId: inf.user?._id || '',
      name: inf.user?.name || 'Unknown',
      handle: inf.user?.email || '',
      profileImage: inf.user?.profileImage || '',
      location: inf.location || '',
      categories: inf.categories || [],
      socialAccounts: inf.socialAccounts || [],
      totalEarnings: inf.totalEarnings || 0,
      profileCompletion: inf.profileCompletion || 0,
      averageRating: inf.averageRating || 0,
      reviewCount: inf.reviewCount || 0,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
