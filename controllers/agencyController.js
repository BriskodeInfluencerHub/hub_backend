import Agency from '../models/Agency.js';
import User from '../models/User.js';
import Application from '../models/Application.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';

// Get Agency Dashboard Data
export const getAgencyDashboardData = async (req, res) => {
  try {
    let agency = await Agency.findOne({ user: req.user._id }).populate(
      'managedInfluencers',
      'name email profileImage phone'
    );

    if (!agency) {
      agency = await Agency.create({
        user: req.user._id,
        agencyName: `${req.user.name || 'Agency'} Hub`,
        revenueShare: 10,
      });
      agency = await Agency.findById(agency._id).populate(
        'managedInfluencers',
        'name email profileImage phone'
      );
    }

    const managedInfluencerIds = (agency.managedInfluencers || []).map((inf) => inf._id);

    // Active applications of managed influencers
    const activeApplications = await Application.find({
      influencer: { $in: managedInfluencerIds },
    })
      .populate('campaign', 'title category budget endDate brand status')
      .populate('influencer', 'name email profileImage')
      .sort({ createdAt: -1 });

    // Wallet & Transactions for Agency
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id, balance: 0 });
    }

    const transactions = await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 });

    res.json({
      agency,
      managedInfluencers: agency.managedInfluencers || [],
      activeApplications,
      wallet,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Influencer to Agency Roster
export const addToRoster = async (req, res) => {
  try {
    const { email, influencerId } = req.body;
    let influencerUser = null;

    if (influencerId) {
      influencerUser = await User.findOne({ _id: influencerId, role: 'influencer' });
    } else if (email) {
      influencerUser = await User.findOne({ email: email.trim().toLowerCase(), role: 'influencer' });
    }

    if (!influencerUser) {
      return res.status(404).json({ message: 'Creator not found with the specified email or ID.' });
    }

    let agency = await Agency.findOne({ user: req.user._id });
    if (!agency) {
      agency = await Agency.create({
        user: req.user._id,
        agencyName: `${req.user.name || 'Agency'} Hub`,
      });
    }

    const alreadyManaged = agency.managedInfluencers.some(
      (id) => id.toString() === influencerUser._id.toString()
    );

    if (alreadyManaged) {
      return res.status(400).json({ message: 'This creator is already in your roster.' });
    }

    agency.managedInfluencers.push(influencerUser._id);
    await agency.save();

    agency = await Agency.findById(agency._id).populate(
      'managedInfluencers',
      'name email profileImage phone'
    );

    res.json({
      message: `${influencerUser.name} added to your roster successfully.`,
      managedInfluencers: agency.managedInfluencers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove Influencer from Roster
export const removeFromRoster = async (req, res) => {
  try {
    const { influencerId } = req.params;

    let agency = await Agency.findOne({ user: req.user._id });
    if (!agency) {
      return res.status(404).json({ message: 'Agency profile not found.' });
    }

    agency.managedInfluencers = agency.managedInfluencers.filter(
      (id) => id.toString() !== influencerId.toString()
    );
    await agency.save();

    agency = await Agency.findById(agency._id).populate(
      'managedInfluencers',
      'name email profileImage phone'
    );

    res.json({
      message: 'Creator removed from roster.',
      managedInfluencers: agency.managedInfluencers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Revenue Share Percentage
export const updateRevenueShare = async (req, res) => {
  try {
    const { revenueShare } = req.body;

    const shareNum = Number(revenueShare);
    if (isNaN(shareNum) || shareNum < 0 || shareNum > 50) {
      return res.status(400).json({ message: 'Revenue share must be a percentage between 0% and 50%.' });
    }

    let agency = await Agency.findOne({ user: req.user._id });
    if (!agency) {
      agency = await Agency.create({
        user: req.user._id,
        agencyName: `${req.user.name || 'Agency'} Hub`,
        revenueShare: shareNum,
      });
    } else {
      agency.revenueShare = shareNum;
      await agency.save();
    }

    res.json({
      message: 'Revenue share percentage updated successfully.',
      revenueShare: agency.revenueShare,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search Influencers to Add
export const searchInfluencers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const agency = await Agency.findOne({ user: req.user._id });
    const managedIds = agency ? agency.managedInfluencers.map((id) => id.toString()) : [];

    const influencers = await User.find({
      role: 'influencer',
      _id: { $nin: managedIds },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .select('name email profileImage phone')
      .limit(10);

    res.json(influencers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
