import User from '../../models/User.js';
import Influencer from '../../models/Influencer.js';
import Brand from '../../models/Brand.js';
import Agency from '../../models/Agency.js';
import Wallet from '../../models/Wallet.js';
import Referral from '../../models/Referral.js';
import Notification from '../../models/Notification.js';
import { generateReferralCode, checkAndRewardReferral } from '../referralController.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/generateToken.js';

export const registerUser = async (req, res) => {
  console.log("\n[REFERRAL DEBUG 11 & 12] Backend req.body:", req.body);
  const { name, email, phone, password, role, referralCode } = req.body;
  console.log("[REFERRAL DEBUG 11 & 12] Backend referralCode received:", referralCode);

  try {
    const emailExists = await User.findOne({ email });
    const phoneExists = await User.findOne({ phone });

    if (emailExists) {
      if (emailExists.isDeleted || emailExists.status === 'deleted') {
        return res.status(400).json({
          message: 'This email address was associated with a deleted account and cannot be re-registered.',
        });
      }
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    if (phoneExists) {
      if (phoneExists.isDeleted || phoneExists.status === 'deleted') {
        return res.status(400).json({
          message: 'This phone number was associated with a deleted account and cannot be re-registered.',
        });
      }
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    // Validate referral code if provided
    let referrer = null;
    const cleanRefCode = (referralCode && referralCode !== 'undefined' && referralCode !== 'null') ? referralCode.trim().toUpperCase() : null;
    console.log(`[REFERRAL DEBUG] raw referralCode: "${referralCode}" | cleaned: "${cleanRefCode}"`);
    if (cleanRefCode) {
      referrer = await User.findOne({ referralCode: cleanRefCode });
      console.log(`[REFERRAL DEBUG] Referrer found: ${referrer ? referrer.email : 'NOT FOUND'}`);
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Generate a unique referral code for the new user using their name
    const newUserReferralCode = await generateReferralCode(name);

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      status: 'pending',
      referralCode: newUserReferralCode,
      referredBy: referrer ? referrer._id : null,
      otp: {
        code: otpCode,
        expiresAt: otpExpires
      }
    });

    // Self-referral guard
    if (referrer && referrer._id.toString() === user._id.toString()) {
      await User.findByIdAndUpdate(user._id, { referredBy: null });
      referrer = null;
    }

    if (role === 'influencer') {
      await Influencer.create({ user: user._id, location: 'Bhubaneswar, Odisha, India' });
    } else if (role === 'brand') {
      await Brand.create({ user: user._id, companyName: `${name} Brand` });
    } else if (role === 'agency') {
      await Agency.create({ user: user._id, agencyName: `${name} Agency` });
    }

    await Wallet.create({ user: user._id, balance: 0 });

    // Create referral record and notify referrer
    if (referrer) {
      const referralDoc = await Referral.create({
        referrer: referrer._id,
        referredUser: user._id,
        referralCode: referrer.referralCode,
        rewardAmount: 150,
        status: 'registered',
      });
      console.log(`[REFERRAL DEBUG] ✅ Referral document created: ${referralDoc._id} | referrer: ${referrer.email} → referred: ${user.email}`);

      await Notification.create({
        recipient: referrer._id,
        type: 'referral_joined',
        title: '🎉 Someone joined using your referral!',
        message: `${name} just registered using your referral link. You'll earn ₹150 once they complete their profile.`,
        data: { referredUserId: user._id },
      });
    } else {
      console.log(`[REFERRAL DEBUG] ⚠️  No referrer — registration without referral code`);
    }

    console.log(`\n====================================\n[OTP NOTIFICATION] To: ${email}\nYour OTP Verification Code is: ${otpCode}\nValid for 10 minutes.\n====================================\n`);

    res.status(201).json({
      message: 'Registration initiated. OTP sent to your email/phone.',
      email: user.email,
      otpCode: otpCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified' });
    }

    if (!user.otp || user.otp.code !== code || new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.status = 'active';
    user.otp = undefined;
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    // Advance referral status from 'registered' → 'verified'
    if (user.referredBy) {
      await Referral.findOneAndUpdate(
        { referredUser: user._id, status: 'registered' },
        { status: 'verified' }
      );
      // For coordinators, check eligibility immediately since they have no extra requirements
      if (user.role === 'coordinator') {
        checkAndRewardReferral(user._id).catch(console.error);
      }
    }

    res.status(200).json({
      message: 'OTP verified successfully. Account activated.',
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
