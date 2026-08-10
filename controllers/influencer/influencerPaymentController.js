import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECEIPTS_DIR = path.resolve(__dirname, '../../private_uploads/receipts');

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return null;
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(name)) return null;
  if (name.includes('..')) return null;
  return name;
};

const safeDeleteReceipt = (filename) => {
  const safe = sanitizeFilename(filename);
  if (!safe) return;
  const absPath = path.join(RECEIPTS_DIR, safe);
  if (!absPath.startsWith(RECEIPTS_DIR + path.sep)) return;
  fs.unlink(absPath, (err) => {
    if (err) console.error('[RECEIPT CLEANUP] Failed to delete old receipt:', err.message);
  });
};

export const submitPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentTokenHeader = req.headers['x-payment-token'];
    const { utrNumber } = req.body;

    const user = await User.findById(id);
    if (!user) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'influencer') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'Only influencers can submit payment receipts' });
    }

    if (!user.isVerified) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'Please verify your email before submitting the payment receipt.' });
    }

    if (!paymentTokenHeader) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ message: 'Payment token is required' });
    }

    const hashedIncoming = hashToken(paymentTokenHeader);
    if (
      !user.paymentToken ||
      user.paymentToken !== hashedIncoming ||
      !user.paymentTokenExpiry ||
      new Date() > new Date(user.paymentTokenExpiry)
    ) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ message: 'Invalid or expired payment token.' });
    }

    if (user.approvalStatus === 'approved') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({ message: 'Account is already approved.' });
    }

    if (user.approvalStatus !== 'pending') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Invalid account state for receipt submission.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required.' });
    }

    if (!utrNumber || !/^[A-Za-z0-9\-]{3,50}$/.test(utrNumber.trim())) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'UTR number is required and must be 3–50 alphanumeric characters.' });
    }

    const trimmedUtr = utrNumber.trim().toUpperCase();

    // Check UTR uniqueness
    const existingUtr = await User.findOne({ utrNumber: trimmedUtr, _id: { $ne: user._id } });
    if (existingUtr) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'This UTR number has already been used.' });
    }

    const previousFilename = user.receiptFilename;

    try {
      user.receiptFilename = req.file.filename;
      user.utrNumber = trimmedUtr;
      user.paymentStatus = 'receipt_submitted';
      user.receiptStatus = 'submitted';
      user.approvalStatus = 'pending';
      user.rejectionReason = '';
      user.paymentToken = null;
      user.paymentTokenExpiry = null;
      user.reuploadToken = null;
      user.reuploadTokenExpiry = null;
      await user.save();
    } catch (dbErr) {
      fs.unlink(req.file.path, (e) => {
        if (e) console.error('[RECEIPT ROLLBACK] Could not delete new file:', e.message);
      });
      return res.status(500).json({ message: 'Failed to save receipt. Please try again.' });
    }

    // Delete old file if present
    if (previousFilename) {
      safeDeleteReceipt(previousFilename);
    }

    return res.status(200).json({ message: 'Receipt submitted successfully.', receiptStatus: 'submitted' });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: error.message });
  }
};

export const submitReuploadReceipt = async (req, res) => {
  try {
    const reuploadTokenHeader = req.headers['x-reupload-token'];
    const { utrNumber } = req.body;

    if (!reuploadTokenHeader) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ message: 'Re-upload token is required' });
    }

    const hashedIncoming = hashToken(reuploadTokenHeader);
    const user = await User.findOne({
      reuploadToken: hashedIncoming,
      reuploadTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ message: 'Invalid or expired re-upload link.' });
    }

    if (user.role !== 'influencer') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (user.approvalStatus !== 'rejected') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({ message: 'Account is not in rejected state.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required.' });
    }

    if (!utrNumber || !/^[A-Za-z0-9\-]{3,50}$/.test(utrNumber.trim())) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'UTR number is required and must be 3–50 alphanumeric characters.' });
    }

    const trimmedUtr = utrNumber.trim().toUpperCase();

    const existingUtr = await User.findOne({ utrNumber: trimmedUtr, _id: { $ne: user._id } });
    if (existingUtr) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'This UTR number has already been used.' });
    }

    const previousFilename = user.receiptFilename;

    try {
      user.receiptFilename = req.file.filename;
      user.utrNumber = trimmedUtr;
      user.paymentStatus = 'receipt_submitted';
      user.receiptStatus = 'submitted';
      user.approvalStatus = 'pending';
      user.rejectionReason = '';
      user.reuploadToken = null;
      user.reuploadTokenExpiry = null;
      await user.save();
    } catch (dbErr) {
      fs.unlink(req.file.path, (e) => {
        if (e) console.error('[REUPLOAD ROLLBACK] Could not delete new file:', e.message);
      });
      return res.status(500).json({ message: 'Failed to save receipt. Please try again.' });
    }

    if (previousFilename) {
      safeDeleteReceipt(previousFilename);
    }

    return res.status(200).json({ message: 'Replacement receipt submitted successfully.' });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: error.message });
  }
};
