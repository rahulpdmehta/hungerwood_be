/**
 * Upload Middleware
 * Handles file uploads using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Detect Vercel/Lambda environment more reliably
const detectVercel = () => {
  // Check environment variables first
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  
  // Check __dirname path (Vercel uses /var/task, Lambda uses /var/task or /var/runtime)
  const dirname = __dirname || '';
  if (dirname.includes('/var/task') || dirname.includes('/var/runtime')) {
    return true;
  }
  
  // Check if we're in a serverless environment by checking if /tmp exists and is writable
  // This is a fallback check
  try {
    if (fs.existsSync('/tmp') && !fs.existsSync(path.join(__dirname, '../../uploads'))) {
      // If /tmp exists but local uploads doesn't, likely serverless
      return true;
    }
  } catch (e) {
    // Ignore errors
  }
  
  return false;
};

const isVercel = detectVercel();

// Log for debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Upload middleware - Vercel detected:', isVercel, '__dirname:', __dirname);
}

// Get uploads directory - use /tmp on Vercel, local directory otherwise
const getUploadsDir = () => {
  if (isVercel) {
    return '/tmp/hungerwood-uploads';
  }
  const localDir = path.join(__dirname, '../../uploads');
  // Safety check: never use /var/task
  if (localDir.includes('/var/task')) {
    console.warn('Detected /var/task in path, forcing /tmp');
    return '/tmp/hungerwood-uploads';
  }
  return localDir;
};

// Use memory storage on Vercel (no file system access needed)
// Use disk storage locally for persistence
let storage;

if (isVercel) {
  // Memory storage for Vercel - files are stored in memory
  console.log('Using memory storage for uploads (Vercel detected)');
  storage = multer.memoryStorage();
} else {
  // Lazy directory creation for local development
  let uploadsDirInitialized = false;
  const ensureUploadsDir = (dir) => {
    if (!uploadsDirInitialized) {
      try {
        // Safety check: never try to create directories in /var/task
        if (dir.includes('/var/task')) {
          console.error('Attempted to create directory in /var/task, aborting');
          throw new Error('Cannot create directory in /var/task');
        }
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        uploadsDirInitialized = true;
      } catch (error) {
        console.error(`Failed to create uploads directory ${dir}:`, error);
        throw error; // Re-throw to prevent using invalid directory
      }
    }
  };

  // Disk storage for local development
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      try {
        const uploadsDir = getUploadsDir();
        ensureUploadsDir(uploadsDir);
        cb(null, uploadsDir);
      } catch (error) {
        cb(error); // Pass error to multer
      }
    },
    filename: function (req, file, cb) {
      // Generate unique filename: timestamp-randomstring-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
  });
}

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
