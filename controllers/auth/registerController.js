import crypto from 'crypto';
import User from '../../models/User.js';
import Influencer from '../../models/Influencer.js';
import Brand from '../../models/Brand.js';
import Agency from '../../models/Agency.js';
import Wallet from '../../models/Wallet.js';
import Referral from '../../models/Referral.js';
import Notification from '../../models/Notification.js';
import { generateReferralCode, checkAndRewardReferral } from '../referralController.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/generateToken.js';
import sendEmail from '../../utils/sendEmail.js';
import { getInfluencerRegistrationFee } from '../../config/paymentConfig.js';

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

    let rawPaymentToken = null;
    let hashedPaymentToken = null;
    let paymentTokenExpiry = null;

    if (role === 'influencer') {
      rawPaymentToken = crypto.randomBytes(32).toString('hex');
      hashedPaymentToken = crypto.createHash('sha256').update(rawPaymentToken).digest('hex');
      paymentTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

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
      },
      paymentAmount: role === 'influencer' ? getInfluencerRegistrationFee() : 0,
      paymentStatus: role === 'influencer' ? 'pending' : 'not_required',
      receiptStatus: role === 'influencer' ? 'not_uploaded' : 'not_required',
      approvalStatus: role === 'influencer' ? 'pending' : 'not_required',
      isApproved: role !== 'influencer',
      isActive: role !== 'influencer',
      paymentToken: hashedPaymentToken,
      paymentTokenExpiry: paymentTokenExpiry,
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

    // Send OTP via Email
    const otpHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#db2777;margin-top:0;">Email Verification OTP</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your OTP verification code for <strong>Odisha Influencer Market</strong> is:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#7c3aed;background:#f3e8ff;padding:12px 24px;border-radius:8px;display:inline-block;">${otpCode}</span>
        </div>
        <p style="font-size:13px;color:#6b7280;">This code is valid for 10 minutes. Do not share it with anyone.</p>
      </div>
    `;
    await sendEmail({ to: user.email, subject: 'Your Verification OTP — Odisha Influencer Market', html: otpHtml }).catch(console.error);

    if (role === 'influencer') {
      return res.status(201).json({
        message: 'Registration initiated. Please verify your email to continue.',
        email: user.email,
        requiresPayment: true,
        userId: user._id,
        paymentToken: rawPaymentToken,
      });
    }

    res.status(201).json({
      message: 'Registration initiated. OTP sent to your email.',
      email: user.email,
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

    if (!user.isVerified) {
      if (!user.otp || user.otp.code !== code || new Date() > user.otp.expiresAt) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      user.isVerified = true;
      user.otp = undefined;

      if (user.role === 'influencer') {
        // Rotate payment token for fresh 24h window from OTP completion
        const rawPaymentToken = crypto.randomBytes(32).toString('hex');
        const hashedPaymentToken = crypto.createHash('sha256').update(rawPaymentToken).digest('hex');
        user.paymentToken = hashedPaymentToken;
        user.paymentTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        return res.status(200).json({
          message: 'Email verified. Proceed to payment.',
          requiresPayment: true,
          userId: user._id,
          paymentToken: rawPaymentToken,
        });
      }

      user.status = 'active';

      // Advance referral status from 'registered' → 'verified'
      if (user.referredBy) {
        await Referral.findOneAndUpdate(
          { referredUser: user._id, status: 'registered' },
          { status: 'verified' }
        );
        if (user.role === 'coordinator') {
          checkAndRewardReferral(user._id).catch(console.error);
        }
      }
    } else if (user.role === 'influencer') {
      // Email was already verified, return rotated token if requested
      const rawPaymentToken = crypto.randomBytes(32).toString('hex');
      const hashedPaymentToken = crypto.createHash('sha256').update(rawPaymentToken).digest('hex');
      user.paymentToken = hashedPaymentToken;
      user.paymentTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      return res.status(200).json({
        message: 'Email verified. Proceed to payment.',
        requiresPayment: true,
        userId: user._id,
        paymentToken: rawPaymentToken,
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

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

export const resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = {
      code: otpCode,
      expiresAt: otpExpires,
    };
    await user.save();

    const otpHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#db2777;margin-top:0;">Email Verification OTP</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your new OTP verification code for <strong>Odisha Influencer Market</strong> is:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#7c3aed;background:#f3e8ff;padding:12px 24px;border-radius:8px;display:inline-block;">${otpCode}</span>
        </div>
        <p style="font-size:13px;color:#6b7280;">This code is valid for 10 minutes. Do not share it with anyone.</p>
      </div>
    `;
    await sendEmail({ to: user.email, subject: 'Your Verification OTP — Odisha Influencer Market', html: otpHtml }).catch(console.error);

    res.json({ message: 'A new OTP code has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

