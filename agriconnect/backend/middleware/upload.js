// ═══════════════════════════════════════════
// middleware/upload.js — File Upload (Multer + Cloudinary)
// ═══════════════════════════════════════════
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ── Local disk storage (fallback if Cloudinary not configured) ──
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// ── File filter — images only ──
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk  = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed.'), false);
  }
};

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 5;

// ── Try Cloudinary storage, fall back to local ──
let storage = localStorage;

try {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    storage = new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder:         'agriconnect',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }],
      }),
    });

    console.log('☁️   Cloudinary storage configured');
  } else {
    console.log('📁  Using local disk storage for uploads');
  }
} catch {
  console.log('📁  Cloudinary not available, using local disk storage');
}

// ── Exported multer instances ──
const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
}).single('image');

const uploadMultiple = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
}).array('images', 5);

// ── Wrap in promise for cleaner controller usage ──
const handleSingleUpload = (req, res) =>
  new Promise((resolve, reject) =>
    uploadSingle(req, res, (err) => (err ? reject(err) : resolve()))
  );

const handleMultipleUpload = (req, res) =>
  new Promise((resolve, reject) =>
    uploadMultiple(req, res, (err) => (err ? reject(err) : resolve()))
  );

// ── Get public URL from uploaded file ──
const getFileUrl = (file) => {
  if (!file) return null;
  // Cloudinary returns secure_url on path; local returns local filename
  return file.path || `/uploads/${file.filename}`;
};

module.exports = { handleSingleUpload, handleMultipleUpload, getFileUrl };