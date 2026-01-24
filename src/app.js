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
const addressRoutes = require('./routes/address.routes');
const sseRoutes = require('./routes/sse.routes');
const bannerRoutes = require('./routes/banner.routes');

// Initialize app
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy - Required for Vercel and other proxy environments
// This allows Express to correctly identify the client's IP address
// Only enable on Vercel/production, not locally (to avoid rate limiting bypass)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
if (isVercel) {
  app.set('trust proxy', true);
} else {
  // In local development, only trust first proxy (safer for rate limiting)
  app.set('trust proxy', 1);
}

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
    
    // In development, allow all localhost origins
    if (config.nodeEnv === 'development') {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    
    // Check if origin is in allowed list
    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
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
  legacyHeaders: false
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP requests per 15 minutes
  message: 'Too many OTP requests, please try again later',
  skipSuccessfulRequests: true
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
app.use('/api/menu', menuRoutes);
app.use('/api/banners', bannerRoutes);

// SSE routes MUST be registered before /api/orders to avoid auth middleware
// (Server-Sent Events for real-time updates - no auth required)
app.use('/api', sseRoutes);

app.use('/api/orders', orderRoutes);
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/admin', adminRoutes);
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
