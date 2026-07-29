import crypto from 'crypto';
import User from '../../models/User.js';
import sendEmail from '../../utils/sendEmail.js';

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
    } catch (_) { }
    return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Reset token is missing.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
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
