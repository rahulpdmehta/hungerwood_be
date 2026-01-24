/**
 * Authentication Controller
 * Handles OTP-based authentication using MongoDB
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Address = require('../models/Address.model');
const { sendOTP, verifyOTP: verifyOTPService } = require('../services/otp.service');
const config = require('../config/env');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

/**
 * Generate and send OTP
 */
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    const result = await sendOTP(phone);

    res.json({
      success: true,
      message: result.message,
      data: {
        phone,
        expiresIn: config.otpExpiry / 1000, // seconds
        ...(result.otp && { otp: result.otp }) // Only in development
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

    // Verify OTP using service
    const verifyResult = await verifyOTPService(phone, otp);

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message
      });
    }

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      // Create new user
      const role = phone === config.adminPhone ? 'admin' : 'customer';
      const name = phone === config.adminPhone ? config.adminName : 'Customer';

      user = new User({
        phone,
        name,
        role,
        isActive: true
      });
      await user.save();

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

    // Populate addresses if they exist
    if (user.addresses && user.addresses.length > 0) {
      await user.populate('addresses');
    }

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
    const user = await User.findById(req.user.userId).populate('addresses');

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
        email: user.email,
        role: user.role,
        addresses: user.addresses,
        profilePic: user.profilePic,
        isProfileComplete: !!(user.email && user.addresses && user.addresses.length > 0 && user.profilePic)
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
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    );

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

    // Create first address
    const firstAddress = new Address({
      user: req.user.userId,
      label: address.label || 'Home',
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: true
    });
    await firstAddress.save();

    // Update user profile
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name,
        email,
        addresses: [firstAddress._id],
        profilePic,
        isProfileComplete: true
      },
      { new: true }
    ).populate('addresses');

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
