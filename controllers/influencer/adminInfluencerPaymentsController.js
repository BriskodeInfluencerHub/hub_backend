import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import sendEmail from '../../utils/sendEmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECEIPTS_DIR = path.resolve(__dirname, '../../private_uploads/receipts');

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(name) || name.includes('..')) return null;
  return name;
};

export const getInfluencerPayments = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { role: 'influencer', approvalStatus: { $ne: 'not_required' }, isDeleted: { $ne: true } };

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.approvalStatus = status;
    }

    const influencers = await User.find(query)
      .select('name email phone createdAt paymentAmount utrNumber paymentStatus receiptStatus approvalStatus rejectionReason isApproved isActive')
      .sort({ createdAt: -1 });

    return res.status(200).json(influencers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getInfluencerPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const influencer = await User.findOne({ _id: id, role: 'influencer', isDeleted: { $ne: true } })
      .select('name email phone createdAt paymentAmount utrNumber paymentStatus receiptStatus approvalStatus rejectionReason isApproved isActive');

    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }

    return res.status(200).json(influencer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const serveInfluencerReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'influencer') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!user.receiptFilename) {
      return res.status(404).json({ message: 'No receipt on file.' });
    }

    const sanitized = sanitizeFilename(user.receiptFilename);
    if (!sanitized) {
      return res.status(400).json({ message: 'Invalid receipt reference.' });
    }

    const absolutePath = path.join(RECEIPTS_DIR, sanitized);
    if (!absolutePath.startsWith(RECEIPTS_DIR + path.sep)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Receipt file not found.' });
    }

    const ext = path.extname(sanitized).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.pdf') contentType = 'application/pdf';

    res.setHeader('Content-Type', contentType);
    return res.sendFile(absolutePath);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveInfluencerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'influencer') {
      return res.status(400).json({ message: 'Target user is not an influencer.' });
    }

    user.paymentStatus = 'verified';
    user.receiptStatus = 'verified';
    user.approvalStatus = 'approved';
    user.isApproved = true;
    user.isActive = true;
    user.status = 'active';
    user.isVerified = true;
    user.rejectionReason = '';
    user.paymentToken = null;
    user.paymentTokenExpiry = null;
    user.reuploadToken = null;
    user.reuploadTokenExpiry = null;

    await user.save();

    await Notification.create({
      recipient: user._id,
      sender: req.user._id,
      type: 'profile_verified',
      title: 'Account Approved!',
      message: 'Your influencer registration payment receipt has been verified and your account is now active. You can now log in.',
    });

    const approvalHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#10b981;margin-top:0;">Account Approved!</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Great news! Your payment receipt has been verified and your influencer account on <strong>Odisha Influencer Market</strong> is now fully active.</p>
        <p>You can now log in to your account and explore campaigns.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Log In Now</a>
        </div>
      </div>
    `;

    await sendEmail({ to: user.email, subject: 'Account Approved — Odisha Influencer Market', html: approvalHtml }).catch(console.error);

    return res.status(200).json({ message: 'Influencer account approved successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const rejectInfluencerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'influencer') {
      return res.status(400).json({ message: 'Target user is not an influencer.' });
    }

    if (user.approvalStatus !== 'pending') {
      return res.status(409).json({ message: 'Cannot reject: record is not in pending state.' });
    }

    const cleanReason = (rejectionReason && typeof rejectionReason === 'string') ? rejectionReason.trim().slice(0, 500) : '';

    user.paymentStatus = 'rejected';
    user.receiptStatus = 'rejected';
    user.approvalStatus = 'rejected';
    user.isApproved = false;
    user.isActive = false;
    user.rejectionReason = cleanReason;

    const rawReuploadToken = crypto.randomBytes(32).toString('hex');
    const hashedReuploadToken = crypto.createHash('sha256').update(rawReuploadToken).digest('hex');

    user.reuploadToken = hashedReuploadToken;
    user.reuploadTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reuploadUrl = `${frontendUrl}/register/reupload?token=${rawReuploadToken}`;

    await Notification.create({
      recipient: user._id,
      sender: req.user._id,
      type: 'profile_rejected',
      title: 'Payment Receipt Rejected',
      message: `Your payment receipt was rejected. Reason: ${cleanReason || 'Invalid receipt or details.'}. Please check your email to re-upload.`,
    });

    const rejectionHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#ef4444;margin-top:0;">Payment Receipt Rejected</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your payment receipt submission for <strong>Odisha Influencer Market</strong> was reviewed and rejected by our team.</p>
        ${cleanReason ? `<p><strong>Reason:</strong> ${cleanReason}</p>` : ''}
        <p>Please click the link below to upload a valid payment receipt and enter the correct UTR transaction ID. This link is valid for 48 hours.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${reuploadUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#db2777,#7c3aed);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">Upload Replacement Receipt</a>
        </div>
        <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;font-size:13px;"><a href="${reuploadUrl}" style="color:#7c3aed;">${reuploadUrl}</a></p>
      </div>
    `;

    await sendEmail({ to: user.email, subject: 'Receipt Rejected — Action Required', html: rejectionHtml }).catch(console.error);

    return res.status(200).json({ message: 'Receipt rejected. Re-upload link sent via email.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
