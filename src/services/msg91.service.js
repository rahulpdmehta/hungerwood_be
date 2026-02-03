/**
 * MSG91 OTP Service
 * Handles MSG91 OTP widget integration and token verification
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

const MSG91_API_BASE = 'https://control.msg91.com/api/v5';

/**
 * Verify MSG91 access token from OTP widget
 * @param {string} accessToken - JWT token from MSG91 OTP widget
 * @returns {Promise<Object>} Verification result with phone number
 */
const verifyAccessToken = async (accessToken) => {
  try {
    if (!config.msg91AuthKey) {
      throw new Error('MSG91 AuthKey not configured');
    }

    const response = await axios.post(
      `${MSG91_API_BASE}/widget/verifyAccessToken`,
      {
        authkey: config.msg91AuthKey,
        'access-token': accessToken
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // MSG91 response structure
    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        phone: response.data.phone || response.data.mobile,
        message: 'Token verified successfully'
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Token verification failed'
    };

  } catch (error) {
    logger.error('MSG91 token verification error:', error);
    
    if (error.response) {
      // MSG91 API error response
      return {
        success: false,
        message: error.response.data?.message || 'Token verification failed',
        error: error.response.data
      };
    }

    throw error;
  }
};

/**
 * Send OTP via MSG91 (alternative method if not using widget)
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to send
 * @returns {Promise<Object>} Send result
 */
const sendOTP = async (phone, otp) => {
  try {
    if (!config.msg91AuthKey) {
      throw new Error('MSG91 AuthKey not configured');
    }

    // Format phone number (remove +91 if present, ensure 10 digits)
    const formattedPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    
    if (formattedPhone.length !== 10) {
      throw new Error('Invalid phone number format');
    }

    const response = await axios.get(
      `${MSG91_API_BASE}/otp`,
      {
        params: {
          authkey: config.msg91AuthKey,
          mobile: `91${formattedPhone}`, // MSG91 requires country code
          message: `Your HungerWood OTP is ${otp}. Valid for 5 minutes.`,
          sender: config.msg91SenderId || 'HUNGER',
          otp: otp,
          otp_length: otp.length,
          otp_expiry: 5 // minutes
        }
      }
    );

    if (response.data && response.data.type === 'success') {
      return {
        success: true,
        message: 'OTP sent successfully'
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Failed to send OTP'
    };

  } catch (error) {
    logger.error('MSG91 send OTP error:', error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Failed to send OTP',
        error: error.response.data
      };
    }

    throw error;
  }
};

/**
 * Verify OTP via MSG91 (alternative method if not using widget)
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object>} Verification result
 */
const verifyOTP = async (phone, otp) => {
  try {
    if (!config.msg91AuthKey) {
      throw new Error('MSG91 AuthKey not configured');
    }

    // Format phone number
    const formattedPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    const response = await axios.get(
      `${MSG91_API_BASE}/otp/verify`,
      {
        params: {
          authkey: config.msg91AuthKey,
          mobile: `91${formattedPhone}`,
          otp: otp
        }
      }
    );

    if (response.data && response.data.type === 'success') {
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Invalid OTP'
    };

  } catch (error) {
    logger.error('MSG91 verify OTP error:', error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'OTP verification failed',
        error: error.response.data
      };
    }

    throw error;
  }
};

module.exports = {
  verifyAccessToken,
  sendOTP,
  verifyOTP
};
