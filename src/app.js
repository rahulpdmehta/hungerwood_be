/**
 * Express Application Configuration
 * Using MongoDB for data persistence
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { getCurrentISO } = require('./utils/dateFormatter');

// Connect to MongoDB
// Always attempt connection - if MongoDB is not available, Mongoose will buffer operations
connectDB().catch(err => {
  logger.error('Failed to connect to MongoDB:', err);
  logger.warn('MongoDB connection failed. Make sure MongoDB is running or set MONGO_URI environment variable.');
  // Don't exit - allow app to run, but operations will fail until connection is established
});

// Import routes
const authRoutes = require('./routes/auth.routes');
const menuRoutes = require('./routes/menu.routes');
const orderRoutes = require('./routes/order.routes');
const adminRoutes = require('./routes/admin.routes');
const adminUserRoutes = require('./routes/adminUser.routes');
const groceryCategoryRoutes = require('./routes/groceryCategory.routes');
const groceryProductRoutes = require('./routes/groceryProduct.routes');
const grocerySettingsRoutes = require('./routes/grocerySettings.routes');
const groceryOrderAdminRoutes = require('./routes/groceryOrder.routes');
const groceryCatalogRoutes = require('./routes/groceryCatalog.routes');
const groceryOrderCustomerRoutes = require('./routes/groceryOrderCustomer.routes');
const groceryMeRoutes = require('./routes/groceryMe.routes');
const groceryPaymentRoutes = require('./routes/groceryPayment.routes');
const groceryCouponRoutes = require('./routes/coupon.routes');
const adminCouponRoutes = require('./routes/adminCoupon.routes');
const groceryBundleRoutes = require('./routes/groceryBundle.routes');
const adminGroceryBundleRoutes = require('./routes/adminGroceryBundle.routes');
const grocerySearchRoutes = require('./routes/grocerySearch.routes');
const addressRoutes = require('./routes/address.routes');
const bannerRoutes = require('./routes/banner.routes');
const paymentRoutes = require('./routes/payment.routes');

// Initialize app
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy configuration
// On Vercel, we use a custom keyGenerator for rate limiting instead of trust proxy
// This avoids the express-rate-limit validation error while still getting correct IPs
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
if (isVercel) {
  // Don't set trust proxy on Vercel - we'll extract IP manually in keyGenerator
  // This prevents express-rate-limit validation errors
} else {
  // In local development, trust first proxy (safer for rate limiting)
  app.set('trust proxy', 1);
}

// Custom key generator for rate limiting that works with Vercel's proxy
// This extracts the real client IP from headers without needing trust proxy
const getClientIP = (req) => {
  // On Vercel, use X-Forwarded-For header directly
  if (isVercel) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first one (original client)
      return forwarded.split(',')[0].trim();
    }
    // Fallback to other Vercel headers
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return realIP;
    }
  }
  // Fallback to standard IP detection (works with trust proxy in local dev)
  return req.ip || req.connection.remoteAddress || 'unknown';
};

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalize origin by removing trailing slash and converting to lowercase for comparison
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();
    
    // In development, allow all localhost + private LAN (RFC1918) origins so
    // a phone/tablet on the same Wi-Fi can hit the local backend.
    if (config.nodeEnv === 'development') {
      const isLocalhost =
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:');
      const isPrivateLan =
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(normalizedOrigin) ||
        /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(normalizedOrigin) ||
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/.test(normalizedOrigin);
      if (isLocalhost || isPrivateLan) {
        return callback(null, true);
      }
    }
    
    // Normalize allowed origins for comparison (remove trailing slashes, lowercase)
    const normalizedAllowedOrigins = config.allowedOrigins.map(o => o.replace(/\/$/, '').toLowerCase());
    
    // Check if origin is in allowed list (exact match, case-insensitive)
    if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    
    // Allow Vercel preview deployments (e.g., hungerwood-fe-git-main.vercel.app)
    // If we have any .vercel.app domain in allowed origins, allow matching base domains
    if (normalizedOrigin.includes('.vercel.app')) {
      // Check if we have any .vercel.app domain in allowed origins
      const hasVercelDomain = normalizedAllowedOrigins.some(origin => origin.includes('.vercel.app'));
      
      if (hasVercelDomain) {
        // Extract base name for matching (e.g., hungerwood-fe from hungerwood-fe-git-main.vercel.app)
        const vercelMatch = normalizedOrigin.match(/https?:\/\/([^.]+)\.vercel\.app/);
        if (vercelMatch) {
          const requestDomain = vercelMatch[1];
          // Remove -git-* suffix if present, otherwise use the full domain name
          const requestBaseName = requestDomain.includes('-git-') 
            ? requestDomain.split('-git-')[0] 
            : requestDomain;
          
          // Check if any allowed origin matches this base domain
          const isAllowedVercelDomain = normalizedAllowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('.vercel.app')) {
              const allowedMatch = allowedOrigin.match(/https?:\/\/([^.]+)\.vercel\.app/);
              if (allowedMatch) {
                const allowedDomain = allowedMatch[1];
                // Remove -git-* suffix if present, otherwise use the full domain name
                const allowedBaseName = allowedDomain.includes('-git-') 
                  ? allowedDomain.split('-git-')[0] 
                  : allowedDomain;
                // Allow if base names match (e.g., hungerwood-fe matches hungerwood-fe-git-main)
                return allowedBaseName === requestBaseName;
              }
            }
            return false;
          });
          
          if (isAllowedVercelDomain) {
            logger.info(`CORS: Allowed Vercel domain: ${normalizedOrigin} (matches base: ${requestBaseName})`);
            return callback(null, true);
          }
        }
      }
    }
    
    // Log rejected origin for debugging
    logger.warn(`CORS: Rejected origin: ${normalizedOrigin}`);
    logger.warn(`CORS: Allowed origins: ${normalizedAllowedOrigins.join(', ')}`);
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  // Use custom key generator to work with Vercel's proxy
  // This extracts the real client IP from X-Forwarded-For header
  keyGenerator: (req) => getClientIP(req),
  // Skip the trust proxy validation by providing our own IP extraction
  skip: () => false
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP requests per 15 minutes
  message: 'Too many OTP requests, please try again later',
  skipSuccessfulRequests: true,
  // Use custom key generator to work with Vercel's proxy
  // This extracts the real client IP from X-Forwarded-For header
  keyGenerator: (req) => getClientIP(req)
});

app.use('/api/auth/send-otp', authLimiter);

// Request logging middleware (development only)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'HungerWood API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      menu: '/api/menu',
      orders: '/api/orders',
      wallet: '/api/wallet',
      banners: '/api/banners',
      admin: '/api/admin'
    },
    documentation: '/api',
    timestamp: getCurrentISO()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'HungerWood API is running',
    timestamp: getCurrentISO(),
    environment: config.nodeEnv
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/versions', require('./routes/version.routes')); // Public version checking endpoint
app.use('/api/menu', menuRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/restaurant', require('./routes/restaurant.routes')); // Public restaurant status endpoint

app.use('/api/orders', orderRoutes);
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/payment', paymentRoutes);
app.use('/api/photos', require('./routes/photo.routes')); // Public photo library endpoint
app.use('/api/admin', adminRoutes);
app.use('/api/super/users', adminUserRoutes);
app.use('/api/grocery', groceryCatalogRoutes);
app.use('/api/admin/grocery/categories', groceryCategoryRoutes);
app.use('/api/admin/grocery/products', groceryProductRoutes);
app.use('/api/admin/grocery/settings', grocerySettingsRoutes);
app.use('/api/admin/grocery/orders', groceryOrderAdminRoutes);
app.use('/api/grocery/orders', groceryOrderCustomerRoutes);
app.use('/api/grocery/me', groceryMeRoutes);
app.use('/api/grocery/coupons', groceryCouponRoutes);
app.use('/api/grocery/bundles', groceryBundleRoutes);
app.use('/api/grocery/search', grocerySearchRoutes);
app.use('/api/admin/grocery/coupons', adminCouponRoutes);
app.use('/api/admin/grocery/bundles', adminGroceryBundleRoutes);
app.use('/api/grocery/payment', groceryPaymentRoutes);
app.use('/api/addresses', addressRoutes);

// API documentation (simple)
app.get('/api', (req, res) => {
  res.json({
    name: 'HungerWood API',
    version: '1.0.0',
    description: 'Restaurant Food Ordering API',
    endpoints: {
      auth: '/api/auth',
      menu: '/api/menu',
      orders: '/api/orders',
      wallet: '/api/wallet',
      banners: '/api/banners',
      admin: '/api/admin'
    },
    documentation: {
      health: 'GET /health',
      auth: {
        sendOTP: 'POST /api/auth/send-otp',
        verifyOTP: 'POST /api/auth/verify-otp',
        profile: 'GET /api/auth/me',
        updateProfile: 'PATCH /api/auth/profile'
      },
      menu: {
        categories: 'GET /api/menu/categories',
        items: 'GET /api/menu/items',
        item: 'GET /api/menu/items/:id'
      },
      orders: {
        create: 'POST /api/orders',
        myOrders: 'GET /api/orders/my',
        order: 'GET /api/orders/:id'
      },
      banners: {
        active: 'GET /api/banners/active',
        all: 'GET /api/banners/all',
        banner: 'GET /api/banners/:id',
        create: 'POST /api/banners (admin)',
        update: 'PUT /api/banners/:id (admin)',
        toggle: 'PATCH /api/banners/:id/toggle (admin)',
        delete: 'DELETE /api/banners/:id (admin)'
      },
      admin: {
        orders: 'GET /api/admin/orders',
        updateStatus: 'PATCH /api/admin/orders/:id/status',
        createMenuItem: 'POST /api/admin/menu',
        updateMenuItem: 'PATCH /api/admin/menu/:id',
        deleteMenuItem: 'DELETE /api/admin/menu/:id'
      }
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
