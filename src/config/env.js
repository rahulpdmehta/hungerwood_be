/**
 * Environment Configuration
 * Centralized configuration for all environment variables
 */

require('dotenv').config();

module.exports = {
  // Server
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/hungerwood',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // OTP
  otpExpiry: parseInt(process.env.OTP_EXPIRY) || 300000, // 5 minutes

  // Admin
  adminPhone: process.env.ADMIN_PHONE || '9999999999',
  adminName: process.env.ADMIN_NAME || 'Admin',

  // Restaurant
  restaurantName: process.env.RESTAURANT_NAME || 'HungerWood',
  restaurantLocation: process.env.RESTAURANT_LOCATION || 'Gaya, Bihar',
  restaurantPhone: process.env.RESTAURANT_PHONE || '1800-HUNGER',

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://hungerwood-fe.vercel.app'
      ],

  // Wallet & Referral
  referralBonusReferrer: parseInt(process.env.REFERRAL_BONUS_REFERRER) || 50,
  referralBonusNewUser: parseInt(process.env.REFERRAL_BONUS_NEW_USER) || 50, // Changed from 25 to 50
  maxWalletUsagePercent: parseInt(process.env.MAX_WALLET_USAGE_PERCENT) || 50,
  minOrderAmountForReferral: parseInt(process.env.MIN_ORDER_AMOUNT_FOR_REFERRAL) || 199,

  // SSE (Server-Sent Events)
  sseHeartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL) || 30000, // 30 seconds
  sseMaxConnections: parseInt(process.env.SSE_MAX_CONNECTIONS) || 100
};
