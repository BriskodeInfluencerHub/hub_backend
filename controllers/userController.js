import User from '../models/User.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Notification from '../models/Notification.js';

export const getPublicInfluencers = async (req, res) => {
  try {
    const { category, search } = req.query;
    let filter = { isVerified: true };

    if (category) {
      filter.categories = { $in: [category] };
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

    const result = influencers.map((inf) => ({
      _id: inf._id,
      name: inf.user?.name || 'Unknown',
      handle: inf.user?.email || '',
      profileImage: inf.user?.profileImage || '',
      location: inf.location || '',
      categories: inf.categories || [],
      socialAccounts: inf.socialAccounts || [],
      totalEarnings: inf.totalEarnings || 0,
      profileCompletion: inf.profileCompletion || 0,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let roleData = null;
    if (user.role === 'influencer') {
      roleData = await Influencer.findOne({ user: user._id });
    } else if (user.role === 'brand') {
      roleData = await Brand.findOne({ user: user._id });
    } else if (user.role === 'agency') {
      roleData = await Agency.findOne({ user: user._id })
        .populate('managedInfluencers', 'name email profileImage');
    }

    res.json({
      user,
      profile: roleData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.phone) user.phone = req.body.phone;
    if (req.body.profileImage !== undefined) user.profileImage = req.body.profileImage;
    await user.save();

    let roleData = null;
    if (user.role === 'influencer') {
      roleData = await Influencer.findOne({ user: user._id });
      if (roleData) {
        if (req.body.bio !== undefined) roleData.bio = req.body.bio;
        if (req.body.location !== undefined) roleData.location = req.body.location;
        if (req.body.categories !== undefined) roleData.categories = req.body.categories;
        if (req.body.socialAccounts !== undefined) roleData.socialAccounts = req.body.socialAccounts;
        if (req.body.portfolio !== undefined) roleData.portfolio = req.body.portfolio;
        if (req.body.tagline !== undefined) roleData.tagline = req.body.tagline;
        if (req.body.pastBrands !== undefined) roleData.pastBrands = req.body.pastBrands;
        if (req.body.featuredVideo !== undefined) roleData.featuredVideo = req.body.featuredVideo;
        if (req.body.services !== undefined) roleData.services = req.body.services;
        if (req.body.audienceGenderMale !== undefined) roleData.audienceGenderMale = req.body.audienceGenderMale;
        if (req.body.audienceGenderFemale !== undefined) roleData.audienceGenderFemale = req.body.audienceGenderFemale;
        if (req.body.audienceTopCountries !== undefined) roleData.audienceTopCountries = req.body.audienceTopCountries;
        if (req.body.audienceAgeRange !== undefined) roleData.audienceAgeRange = req.body.audienceAgeRange;
        if (req.body.contentFormats !== undefined) roleData.contentFormats = req.body.contentFormats;
        if (req.body.businessEmail !== undefined) roleData.businessEmail = req.body.businessEmail;
        if (req.body.businessPhone !== undefined) roleData.businessPhone = req.body.businessPhone;
        if (req.body.faqs !== undefined) roleData.faqs = req.body.faqs;

        let fields = 0;
        let filled = 0;
        const checkFields = ['bio', 'location', 'categories', 'socialAccounts', 'portfolio', 'tagline', 'pastBrands', 'featuredVideo', 'services', 'audienceTopCountries', 'audienceAgeRange', 'contentFormats', 'businessEmail', 'faqs'];
        checkFields.forEach((field) => {
          fields++;
          if (roleData[field] && (Array.isArray(roleData[field]) ? roleData[field].length > 0 : !!roleData[field])) {
            filled++;
          }
        });
        roleData.profileCompletion = Math.round((filled / fields) * 100);

        await roleData.save();
      }
    } else if (user.role === 'brand') {
      roleData = await Brand.findOne({ user: user._id });
      if (roleData) {
        if (req.body.companyName !== undefined) roleData.companyName = req.body.companyName;
        if (req.body.website !== undefined) roleData.website = req.body.website;
        if (req.body.industry !== undefined) roleData.industry = req.body.industry;
        if (req.body.bio !== undefined) roleData.bio = req.body.bio;
        if (req.body.location !== undefined) roleData.location = req.body.location;
        if (req.body.kycDocumentUrl !== undefined) {
          roleData.kycDocumentUrl = req.body.kycDocumentUrl;
          roleData.kycStatus = 'pending';
        }
        await roleData.save();
      }
    } else if (user.role === 'agency') {
      roleData = await Agency.findOne({ user: user._id });
      if (roleData) {
        if (req.body.agencyName !== undefined) roleData.agencyName = req.body.agencyName;
        if (req.body.website !== undefined) roleData.website = req.body.website;
        if (req.body.bio !== undefined) roleData.bio = req.body.bio;
        if (req.body.revenueShare !== undefined) roleData.revenueShare = req.body.revenueShare;
        if (req.body.managedInfluencers !== undefined) roleData.managedInfluencers = req.body.managedInfluencers;
        await roleData.save();
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
      profile: roleData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    user.profileImage = relativePath;
    await user.save();

    res.json({
      message: 'Avatar uploaded successfully',
      profileImage: relativePath,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({
    message: 'File uploaded successfully',
    fileUrl: `/uploads/${req.file.filename}`,
  });
};

export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPublicInfluencerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the id matches a Mongoose ObjectId format
    const isValidId = id.match(/^[0-9a-fA-F]{24}$/);
    if (!isValidId) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const influencer = await Influencer.findOne({
      $or: [
        { _id: id },
        { user: id }
      ]
    }).populate('user', 'name email profileImage phone');

    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }

    res.json({
      _id: influencer._id,
      user: {
        _id: influencer.user?._id,
        name: influencer.user?.name || 'Unknown',
        email: influencer.user?.email || '',
        profileImage: influencer.user?.profileImage || '',
        phone: influencer.user?.phone || '',
      },
      location: influencer.location || '',
      bio: influencer.bio || '',
      categories: influencer.categories || [],
      socialAccounts: influencer.socialAccounts || [],
      portfolio: influencer.portfolio || [],
      tagline: influencer.tagline || '',
      pastBrands: influencer.pastBrands || '',
      featuredVideo: influencer.featuredVideo || '',
      services: influencer.services || [],
      audienceGenderMale: influencer.audienceGenderMale || 50,
      audienceGenderFemale: influencer.audienceGenderFemale || 50,
      audienceTopCountries: influencer.audienceTopCountries || '',
      audienceAgeRange: influencer.audienceAgeRange || '',
      contentFormats: influencer.contentFormats || '',
      businessEmail: influencer.businessEmail || '',
      businessPhone: influencer.businessPhone || '',
      faqs: influencer.faqs || [],
      profileCompletion: influencer.profileCompletion || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
