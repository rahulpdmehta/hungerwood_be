/**
 * Authentication Controller
 * Handles OTP-based authentication using JSON files
 */

const jwt = require('jsonwebtoken');
const JsonDB = require('../utils/jsonDB');
const config = require('../config/env');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const usersDB = new JsonDB('users.json');
const otpsDB = new JsonDB('otps.json');

/**
 * Generate and send OTP
 */
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + config.otpExpiry;

    // Store OTP in JSON file
    const otpData = otpsDB.read();
    otpData[phone] = { otp, expiresAt };
    otpsDB.write(otpData);

    // Log OTP to console (in production, send via SMS)
    logger.info(`📱 OTP for ${phone}: ${otp}`);
    console.log(`\n🔐 OTP Code: ${otp}\n📱 Phone: ${phone}\n⏰ Valid for: 5 minutes\n`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: config.otpExpiry / 1000 // seconds
      }
    });
  } catch (error) {
    logger.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

/**
 * Verify OTP and login/register user
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Get stored OTP
    const otpData = otpsDB.read();
    const storedOTP = otpData[phone];

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found. Please request a new one.'
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedOTP.expiresAt) {
      delete otpData[phone];
      otpsDB.write(otpData);

      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new one.'
      });
    }

    // Verify OTP
    if (storedOTP.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid, delete it
    delete otpData[phone];
    otpsDB.write(otpData);

    // Find or create user
    let user = usersDB.findOne({ phone });

    if (!user) {
      // Create new user
      const role = phone === config.adminPhone ? 'admin' : 'customer';
      const name = phone === config.adminPhone ? config.adminName : 'Customer';

      user = usersDB.create({
        phone,
        name,
        role,
        isActive: true
      });

      logger.info(`New user created: ${phone}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        phone: user.phone,
        role: user.role
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    logger.info(`User logged in: ${phone}`);

    // Check if profile is complete
    const isProfileComplete = !!(user.email && user.addresses && user.addresses.length > 0 && user.profilePic);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token,
        isProfileComplete
      }
    });
  } catch (error) {
    logger.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
};

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = usersDB.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, profilePic } = req.body;

    // Validate email format if provided
    if (email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (profilePic) updateData.profilePic = profilePic;

    // Update user
    const user = usersDB.update(req.user.userId, updateData);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`Profile updated for user: ${user.phone}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

/**
 * Complete user profile
 */
exports.completeProfile = async (req, res) => {
  try {
    const { name, email, address, profilePic, referralCode } = req.body;

    // Validate required fields
    if (!name || !email || !address || !profilePic) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, address, profilePic'
      });
    }

    // Validate address fields
    if (!address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Address must include: street, city, state, pincode'
      });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Apply referral code if provided (optional)
    let referralMessage = null;
    if (referralCode && referralCode.trim()) {
      try {
        const referralService = require('../services/referral.service');
        const referralResult = await referralService.applyReferralCode(req.user.userId, referralCode.trim());
        referralMessage = referralResult.message;
        logger.info(`Referral code ${referralCode} applied during profile completion for user ${req.user.userId}`);
      } catch (referralError) {
        logger.warn(`Failed to apply referral code during profile completion: ${referralError.message}`);
        // Don't block profile completion if referral code fails
        // Just log the error
      }
    }

    // Create first address with default label and set as default
    const firstAddress = {
      id: Date.now().toString(),
      label: address.label || 'Home',
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: true,
      createdAt: getCurrentISO()
    };

    // Update user profile with addresses array
    const user = usersDB.update(req.user.userId, {
      name,
      email,
      addresses: [firstAddress],
      profilePic,
      isProfileComplete: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`Profile completed for user: ${user.phone}`);

    const responseMessage = referralMessage
      ? `Profile completed successfully. ${referralMessage}`
      : 'Profile completed successfully';

    res.json({
      success: true,
      message: responseMessage,
      referralApplied: !!referralMessage,
      data: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        addresses: user.addresses,
        profilePic: user.profilePic,
        role: user.role,
        isProfileComplete: user.isProfileComplete
      }
    });
  } catch (error) {
    logger.error('Complete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete profile'
    });
  }
};
