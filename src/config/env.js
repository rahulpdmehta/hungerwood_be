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
  allowedOrigins: (() => {
    const defaultOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://hungerwood-fe.vercel.app'
    ];
    
    if (process.env.ALLOWED_ORIGINS) {
      const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
      // Merge environment origins with defaults, removing duplicates
      return [...new Set([...envOrigins, ...defaultOrigins])];
    }
    
    return defaultOrigins;
  })(),

  // Wallet & Referral
  referralBonusReferrer: parseInt(process.env.REFERRAL_BONUS_REFERRER) || 50,
  referralBonusNewUser: parseInt(process.env.REFERRAL_BONUS_NEW_USER) || 50, // Changed from 25 to 50
  maxWalletUsagePercent: parseInt(process.env.MAX_WALLET_USAGE_PERCENT) || 50,
  minOrderAmountForReferral: parseInt(process.env.MIN_ORDER_AMOUNT_FOR_REFERRAL) || 199,

  // Razorpay
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',

  // MSG91 OTP Service
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  msg91SenderId: process.env.MSG91_SENDER_ID || 'HUNGER',
  msg91Enabled: process.env.MSG91_ENABLED === 'true' || false,

  // MSG91 WhatsApp OTP Service
  msg91WhatsAppEnabled: process.env.MSG91_WHATSAPP_ENABLED === 'true' || false,
  msg91WhatsAppIntegratedNumber: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || '',
  msg91WhatsAppTemplateName: process.env.MSG91_WHATSAPP_TEMPLATE_NAME || 'login_otp',
  msg91WhatsAppNamespace: process.env.MSG91_WHATSAPP_NAMESPACE || '',
  msg91WhatsAppLanguageCode: process.env.MSG91_WHATSAPP_LANGUAGE_CODE || 'en',

};
