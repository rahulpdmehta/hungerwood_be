/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 */

const User = require('../models/User.model');
const { generateOTP } = require('../utils/helpers');
const config = require('../config/env');
const logger = require('../config/logger');

/**
 * Send OTP to phone number
 * In production, integrate with SMS service (Twilio, MSG91, etc.)
 */
const sendOTP = async (phone) => {
  try {
    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + config.otpExpiry);
    
    // Find or create user
    let user = await User.findOne({ phone }).select('+otp +otpExpiry');
    
    if (!user) {
      user = new User({ phone });
    }
    
    // Store OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    // In development, log OTP
    if (config.nodeEnv === 'development') {
      logger.info(`OTP for ${phone}: ${otp}`);
      console.log(`\n🔐 OTP for ${phone}: ${otp}\n`);
    }
    
    // TODO: In production, send OTP via SMS service
    // await smsService.send(phone, `Your HungerWood OTP is: ${otp}. Valid for 5 minutes.`);
    
    return {
      success: true,
      message: 'OTP sent successfully',
      // Only return OTP in development
      ...(config.nodeEnv === 'development' && { otp })
    };
    
  } catch (error) {
    logger.error('Error sending OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP
 */
const verifyOTP = async (phone, otp) => {
  try {
    // Find user with OTP
    const user = await User.findOne({ phone }).select('+otp +otpExpiry');
    
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Check if OTP is valid
    if (!user.isOTPValid(otp)) {
      return {
        success: false,
        message: 'Invalid or expired OTP'
      };
    }
    
    // Clear OTP
    user.clearOTP();
    await user.save();
    
    return {
      success: true,
      user
    };
    
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Resend OTP
 */
const resendOTP = async (phone) => {
  return await sendOTP(phone);
};

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP
};
