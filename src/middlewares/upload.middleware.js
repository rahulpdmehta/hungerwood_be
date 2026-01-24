/**
 * Upload Middleware
 * Handles file uploads using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Detect Vercel environment more reliably
const isVercel = process.env.VERCEL === '1' || 
                 process.env.VERCEL_ENV || 
                 process.env.AWS_LAMBDA_FUNCTION_NAME || // Also works on Lambda
                 __dirname.includes('/var/task'); // Vercel uses /var/task

// Get uploads directory - use /tmp on Vercel, local directory otherwise
const getUploadsDir = () => {
  if (isVercel) {
    return '/tmp/hungerwood-uploads';
  }
  return path.join(__dirname, '../../uploads');
};

// Lazy directory creation
let uploadsDirInitialized = false;
const ensureUploadsDir = (dir) => {
  if (!uploadsDirInitialized) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      uploadsDirInitialized = true;
    } catch (error) {
      console.error(`Failed to create uploads directory ${dir}:`, error);
      // Don't throw - will use memory storage as fallback
    }
  }
};

// Configure storage with lazy directory creation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = getUploadsDir();
    ensureUploadsDir(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max file size
  }
});

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 2MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'An error occurred during file upload.'
    });
  }
  next();
};

module.exports = {
  upload,
  handleUploadError,
  uploadSingle: (fieldName) => [
    upload.single(fieldName),
    handleUploadError
  ]
};
