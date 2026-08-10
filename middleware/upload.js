import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|pdf|doc|docx|mp4/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images, PDFs, Word docs, and MP4 videos are allowed!'));
  }
}

export const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ── NEW: Receipt-specific uploader ──────────────────────────────────────────
// Stored in private_uploads/receipts/ — completely OUTSIDE the public uploads/ tree.
const receiptsDir = path.join(__dirname, '../private_uploads/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const receiptsStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, receiptsDir);
  },
  filename(req, file, cb) {
    cb(null, `receipt-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function checkReceiptFileType(file, cb) {
  const allowedExts = /\.(jpg|jpeg|png|pdf)$/i;
  const allowedMimes = /^(image\/(jpeg|png)|application\/pdf)$/;
  const extOk = allowedExts.test(path.extname(file.originalname));
  const mimeOk = allowedMimes.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error('Only JPG, JPEG, PNG, and PDF files are allowed for payment receipts.'));
}

export const uploadReceipt = multer({
  storage: receiptsStorage,
  fileFilter(req, file, cb) {
    checkReceiptFileType(file, cb);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

