import Influencer from '../../models/Influencer.js';
import Campaign from '../../models/Campaign.js';

// ─────────────────────────────────────────────────────────────────────────────
// Get Influencer's Bucket List (Saved Campaigns & Brands)
// ─────────────────────────────────────────────────────────────────────────────
export const getBucketList = async (req, res) => {
  try {
    const influencer = await Influencer.findOne({ user: req.user._id }).populate({
      path: 'bucketList',
      populate: { path: 'brand', select: 'name email profileImage companyName location' },
    });

    if (!influencer) {
      return res.status(404).json({ message: 'Influencer profile not found' });
    }

    res.json({ bucketList: influencer.bucketList || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Item in Bucket List (Add or Remove Campaign ID)
// ─────────────────────────────────────────────────────────────────────────────
export const toggleBucketListItem = async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ message: 'Campaign ID is required' });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const influencer = await Influencer.findOne({ user: req.user._id });
    if (!influencer) {
      return res.status(404).json({ message: 'Influencer profile not found' });
    }

    const existingIndex = influencer.bucketList.findIndex(
      (id) => id.toString() === campaignId.toString()
    );

    let saved = false;
    if (existingIndex > -1) {
      // Remove from bucket list
      influencer.bucketList.splice(existingIndex, 1);
      saved = false;
    } else {
      // Add to bucket list
      influencer.bucketList.push(campaignId);
      saved = true;
    }

    await influencer.save();

    res.json({
      message: saved ? 'Added to your Bucket List!' : 'Removed from your Bucket List.',
      saved,
      bucketList: influencer.bucketList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
