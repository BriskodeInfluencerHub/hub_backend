import crypto from 'crypto';
import User from '../models/User.js';
import Influencer from '../models/Influencer.js';
import Brand from '../models/Brand.js';
import Agency from '../models/Agency.js';
import Wallet from '../models/Wallet.js';
import Referral from '../models/Referral.js';
import Notification from '../models/Notification.js';
import { generateReferralCode, checkAndRewardReferral } from './referralController.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import jwt from 'jsonwebtoken';
import sendEmail from '../utils/sendEmail.js';

export const registerUser = async (req, res) => {
  const { name, email, phone, password, role, referralCode } = req.body;

  try {
    const emailExists = await User.findOne({ email });
    const phoneExists = await User.findOne({ phone });

    if (emailExists || phoneExists) {
      return res.status(400).json({ message: 'User with this email or phone already exists' });
    }

    // Validate referral code if provided
    let referrer = null;
    const cleanRefCode = (referralCode && referralCode !== 'undefined' && referralCode !== 'null') ? referralCode.trim().toUpperCase() : null;
    console.log(`\n[REFERRAL DEBUG] raw referralCode: "${referralCode}" | cleaned: "${cleanRefCode}"`);
    if (cleanRefCode) {
      referrer = await User.findOne({ referralCode: cleanRefCode });
      console.log(`[REFERRAL DEBUG] Referrer found: ${referrer ? referrer.email : 'NOT FOUND'}`);
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Generate a unique referral code for the new user
    const newUserReferralCode = await generateReferralCode();

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

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified && user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Account not verified. Please verify OTP first.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account is suspended. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
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

export const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account is suspended' });
    }

    const newAccessToken = generateAccessToken(user._id);
    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  // Always return a generic message so we never reveal whether an email is registered
  const GENERIC_OK = { message: 'If an account with this email exists, a password reset link has been sent.' };

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(200).json(GENERIC_OK); // silent — don't reveal existence

    // Generate a cryptographically secure raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store the SHA-256 hash (never store the raw token)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    // Build reset URL — raw token goes in the link; hash lives in DB
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#db2777;margin-top:0;">Password Reset Request</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Someone (hopefully you) requested a password reset for your account on <strong>Odisha Influencer Market</strong>.</p>
        <p>Click the button below to set a new password. This link expires in <strong>10 minutes</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#db2777,#7c3aed);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Reset My Password</a>
        </div>
        <p style="font-size:13px;color:#6b7280;">If the button doesn't work, paste this link into your browser:</p>
        <p style="word-break:break-all;font-size:13px;"><a href="${resetUrl}" style="color:#7c3aed;">${resetUrl}</a></p>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;"/>
        <p style="font-size:12px;color:#9ca3af;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `;

    await sendEmail({ to: user.email, subject: 'Odisha Influencer Market — Password Reset', html });

    return res.status(200).json(GENERIC_OK);
  } catch (error) {
    // Clean up token fields if email fails so the token can't be left dangling
    try {
      await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $unset: { resetPasswordToken: '', resetPasswordExpires: '' } }
      );
    } catch (_) {}
    return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/reset-password/:token
// ─────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Reset token is missing.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    // Hash the incoming raw token to compare against what is stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // must not be expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
    }

    // Set new password — pre-save hook will hash it
    user.password = password;
    // Invalidate the token (single-use)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
