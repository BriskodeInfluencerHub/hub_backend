import Campaign from '../models/Campaign.js';
import User from '../models/User.js';
import { checkAndRewardReferral } from './referralController.js';

export const createCampaign = async (req, res) => {
  const { title, description, category, budget, targetAudience, location, requiredFollowers, requiredPlatforms, startDate, endDate, isDraft } = req.body;

  try {
    const parsedStartDate = startDate && !isNaN(Date.parse(startDate)) ? new Date(startDate) : new Date();
    const parsedEndDate = endDate && !isNaN(Date.parse(endDate)) ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const campaign = await Campaign.create({
      brand: req.user._id,
      title,
      description,
      category,
      budget,
      targetAudience: targetAudience || '',
      location: location || '',
      requiredFollowers: Number(requiredFollowers) || 0,
      requiredPlatforms: requiredPlatforms || ['instagram'],
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: isDraft ? 'draft' : 'pending_approval',
    });

    res.status(201).json({
      message: isDraft ? 'Campaign saved as draft' : 'Campaign created successfully, awaiting admin approval',
      campaign,
    });

    // Trigger referral eligibility check for brand after first campaign is created
    checkAndRewardReferral(req.user._id).catch(console.error);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCampaigns = async (req, res) => {
  const { search, category, platform, minBudget, maxBudget, requiredFollowers, status, sortBy, brandId } = req.query;

  let query = {};

  if (status) {
    query.status = status;
  } else {
    query.status = 'active';
  }

  if (brandId) {
    query.brand = brandId;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) {
    query.category = category;
  }

  if (platform) {
    query.requiredPlatforms = { $in: [platform] };
  }

  if (minBudget || maxBudget) {
    query.budget = {};
    if (minBudget) query.budget.$gte = Number(minBudget);
    if (maxBudget) query.budget.$lte = Number(maxBudget);
  }

  if (requiredFollowers) {
    query.requiredFollowers = { $lte: Number(requiredFollowers) };
  }

  try {
    let apiQuery = Campaign.find(query).populate('brand', 'name email profileImage');

    if (sortBy === 'highest-budget') {
      apiQuery = apiQuery.sort({ budget: -1 });
    } else if (sortBy === 'recently-joined') {
      apiQuery = apiQuery.sort({ createdAt: -1 });
    } else {
      apiQuery = apiQuery.sort({ createdAt: -1 });
    }

    const campaigns = await apiQuery;
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('brand', 'name email profileImage');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this campaign' });
    }

    const fieldsToUpdate = [
      'title', 'description', 'category', 'budget',
      'targetAudience', 'location', 'requiredFollowers', 'requiredPlatforms',
      'startDate', 'endDate', 'status'
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          campaign[field] = new Date(req.body[field]);
        } else {
          campaign[field] = req.body[field];
        }
      }
    });

    await campaign.save();
    res.json({ message: 'Campaign updated successfully', campaign });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.brand.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this campaign' });
    }

    await campaign.deleteOne();
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
