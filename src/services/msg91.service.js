/**
 * MSG91 OTP Service
 * Handles MSG91 OTP widget integration, token verification, and WhatsApp OTP
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../config/logger');

const MSG91_API_BASE = 'https://control.msg91.com/api/v5';
const MSG91_WHATSAPP_API_BASE = 'https://api.msg91.com/api/v5/whatsapp';

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

/**
 * Send OTP via WhatsApp using MSG91 WhatsApp API
 * @param {string|string[]} phone - Phone number(s) to send OTP to
 * @param {string} otp - OTP to send
 * @param {string} buttonValue - Optional button value (defaults to OTP)
 * @returns {Promise<Object>} Send result
 */
const sendWhatsAppOTP = async (phone, otp, buttonValue = null) => {
  try {
    if (!config.msg91AuthKey) {
      throw new Error('MSG91 AuthKey not configured');
    }

    if (!config.msg91WhatsAppIntegratedNumber) {
      throw new Error('MSG91 WhatsApp integrated number not configured');
    }

    // if (!config.msg91WhatsAppTemplateName) {
    //   throw new Error('MSG91 WhatsApp template name not configured');
    // }

    // if (!config.msg91WhatsAppNamespace) {
    //   throw new Error('MSG91 WhatsApp namespace not configured');
    // }

    // Format phone number(s) - ensure array
    const phoneNumbers = Array.isArray(phone) ? phone : [phone];
    const formattedPhones = phoneNumbers.map(p => {
      // Remove +91 if present, ensure 10 digits, then add 91 prefix
      const cleaned = p.replace(/^\+91/, '').replace(/\D/g, '');
      if (cleaned.length !== 10) {
        throw new Error(`Invalid phone number format: ${p}`);
      }
      return `91${cleaned}`;
    });

    // Prepare payload according to MSG91 WhatsApp API structure
    const payload = {
      integrated_number: config.msg91WhatsAppIntegratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: config.msg91WhatsAppTemplateName || 'login_otp',
          language: {
            code: config.msg91WhatsAppLanguageCode || 'en',
            policy: 'deterministic'
          },
          namespace: config.msg91WhatsAppNamespace || '22f164c0_2ccc_4c00_b179_2b6870382ae3',
          to_and_components: [
            {
              to: formattedPhones,
              components: {
                body_1: {
                  type: 'text',
                  value: otp
                },
                ...(otp && {
                  button_1: {
                    subtype: 'url',
                    type: 'text',
                    value: otp
                  }
                })
              }
            }
          ]
        }
      }
    };

    const response = await axios.post(
      `${MSG91_WHATSAPP_API_BASE}/whatsapp-outbound-message/bulk/`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'authkey': config.msg91AuthKey
        }
      }
    );

    // Check response structure - MSG91 WhatsApp API may return different formats
    if (response.data && (response.data.status === 'success' || response.data.type === 'success' || response.status === 200)) {
      logger.info(`WhatsApp OTP sent successfully to ${formattedPhones.join(', ')}`);
      return {
        success: true,
        message: 'WhatsApp OTP sent successfully',
        data: response.data
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Failed to send WhatsApp OTP',
      data: response.data
    };

  } catch (error) {
    logger.error('MSG91 WhatsApp send OTP error:', error);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Failed to send WhatsApp OTP',
        error: error.response.data
      };
    }

    throw error;
  }
};

module.exports = {
  verifyAccessToken,
  sendOTP,
  verifyOTP,
  sendWhatsAppOTP
};
