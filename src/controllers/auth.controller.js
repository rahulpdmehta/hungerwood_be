/**
 * Authentication Controller
 * Handles OTP-based authentication using MongoDB
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Address = require('../models/Address.model');
const { sendOTP, verifyOTP: verifyOTPService } = require('../services/otp.service');
const msg91Service = require('../services/msg91.service');
const config = require('../config/env');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');
const { transformEntity, transformEntities, transformEntityWithNested } = require('../utils/transformers');
const { ROLES } = require('../utils/constants');

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
 * Verify MSG91 widget access token and login/register user
 * This endpoint is used when MSG91 widget is integrated on frontend
 */
exports.verifyMSG91Token = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token with MSG91
    const verifyResult = await msg91Service.verifyAccessToken(accessToken);
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message || 'Token verification failed'
      });
    }

    const phone = verifyResult.phone;

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      // Create new user
      const role = phone === config.adminPhone ? ROLES.SUPER_ADMIN : ROLES.USER;
      const name = phone === config.adminPhone ? config.adminName : 'Customer';

      user = new User({
        phone,
        name,
        role,
        isActive: true
      });
      await user.save();

      logger.info(`New user created via MSG91: ${phone}`);
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

    logger.info(`User logged in via MSG91: ${phone}`);

    // Populate addresses if they exist
    if (user.addresses && user.addresses.length > 0) {
      await user.populate('addresses');
    }

    // Check if profile is complete
    const isProfileComplete = !!(user.addresses && user.addresses.length > 0 && user.profilePic);

    // Transform user: set id to _id value
    const userObj = transformEntity(user);
    const transformedUser = {
      id: userObj.id,
      phone: userObj.phone,
      name: userObj.name,
      email: userObj.email,
      role: userObj.role
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: transformedUser,
        token,
        isProfileComplete
      }
    });
  } catch (error) {
    logger.error('Verify MSG91 token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify token'
    });
  }
};

/**
 * Verify OTP and login/register user
 * This endpoint is used for manual OTP verification (fallback)
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // E2E bypass — strictly gated:
    //   1. NODE_ENV !== 'production' AND VERCEL_ENV !== 'production'
    //      (so a Vercel preview/prod build can never enable it)
    //   2. E2E_BYPASS_OTP env flag explicitly true
    //   3. Phone is on a hardcoded allowlist of seeded test accounts
    //   4. OTP equals '000000'
    // Even if all four hold, this branch only mints a token for the test
    // accounts created by scripts/seed-e2e.js — never an arbitrary phone.
    const E2E_TEST_PHONES = new Set(['9999900001', '9999900002', '9999900003', '9999900004']);
    const e2eEnabled =
      process.env.E2E_BYPASS_OTP === 'true' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.VERCEL_ENV !== 'production';
    if (e2eEnabled && otp === '000000' && E2E_TEST_PHONES.has(String(phone))) {
      const user = await User.findOne({ phone });
      if (user && user.isActive) {
        const token = jwt.sign(
          { userId: user._id, phone: user.phone, role: user.role },
          config.jwtSecret,
          { expiresIn: config.jwtExpiresIn }
        );
        const userObj = transformEntity(user);
        return res.json({
          success: true,
          message: 'E2E bypass login',
          data: {
            user: { id: userObj.id, phone: userObj.phone, name: userObj.name, email: userObj.email, role: userObj.role },
            token,
            isProfileComplete: true,
          },
        });
      }
    }

    // If MSG91 is enabled, try MSG91 verification first
    if (config.msg91Enabled && config.msg91AuthKey) {
      try {
        const msg91Result = await msg91Service.verifyOTP(phone, otp);
        if (msg91Result.success) {
          // MSG91 verification successful, proceed with login
          // Find or create user
          let user = await User.findOne({ phone });

          if (!user) {
            const role = phone === config.adminPhone ? ROLES.SUPER_ADMIN : ROLES.USER;
            const name = phone === config.adminPhone ? config.adminName : 'Customer';

            user = new User({
              phone,
              name,
              role,
              isActive: true
            });
            await user.save();

            logger.info(`New user created via MSG91 OTP: ${phone}`);
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

          logger.info(`User logged in via MSG91 OTP: ${phone}`);

          // Populate addresses if they exist
          if (user.addresses && user.addresses.length > 0) {
            await user.populate('addresses');
          }

          // Check if profile is complete
          const isProfileComplete = !!(user.addresses && user.addresses.length > 0 && user.profilePic);

          // Transform user
          const userObj = transformEntity(user);
          const transformedUser = {
            id: userObj.id,
            phone: userObj.phone,
            name: userObj.name,
            email: userObj.email,
            role: userObj.role
          };

          return res.json({
            success: true,
            message: 'Login successful',
            data: {
              user: transformedUser,
              token,
              isProfileComplete
            }
          });
        }
        // If MSG91 verification fails, fall back to local verification
      } catch (error) {
        logger.warn('MSG91 OTP verification failed, falling back to local verification:', error);
        // Fall through to local verification
      }
    }

    // Verify OTP using local service (fallback)
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
      const role = phone === config.adminPhone ? ROLES.SUPER_ADMIN : ROLES.USER;
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
    const isProfileComplete = !!(user.addresses && user.addresses.length > 0 && user.profilePic);

    // Transform user: set id to _id value
    const userObj = transformEntity(user);
    const transformedUser = {
      id: userObj.id,
      phone: userObj.phone,
      name: userObj.name,
      email: userObj.email,
      role: userObj.role
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: transformedUser,
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

    // Transform user and addresses: set id to _id value
    const userObj = transformEntityWithNested(user, ['addresses']);
    const transformedAddresses = user.addresses ? transformEntities(user.addresses) : [];

    res.json({
      success: true,
      data: {
        id: userObj.id,
        phone: userObj.phone,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        addresses: transformedAddresses,
        profilePic: userObj.profilePic,
        isProfileComplete: !!(user.addresses && user.addresses.length > 0 && user.profilePic)
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

    // Transform user: set id to _id value
    const transformedUser = transformEntity(user);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: transformedUser.id,
        phone: transformedUser.phone,
        name: transformedUser.name,
        email: transformedUser.email,
        profilePic: transformedUser.profilePic,
        role: transformedUser.role
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

    // Validate required fields (email is optional)
    if (!name || !address || !profilePic) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: name, address, profilePic'
      });
    }

    // Only street is required from the user; city/state/pincode default to Gaya/Bihar/824201
    if (!address.street) {
      return res.status(400).json({
        success: false,
        message: 'Address street is required'
      });
    }

    // Validate email format only if provided
    if (email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
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
      city: address.city || 'Gaya',
      state: address.state || 'Bihar',
      pincode: address.pincode || '824201',
      isDefault: true
    });
    await firstAddress.save();

    // Update user profile
    const userUpdate = {
      name,
      addresses: [firstAddress._id],
      profilePic,
      isProfileComplete: true
    };
    if (email) userUpdate.email = email;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      userUpdate,
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

    // Transform user and addresses: set id to _id value
    const userObj = transformEntityWithNested(user, ['addresses']);
    const transformedAddresses = user.addresses ? transformEntities(user.addresses) : [];

    res.json({
      success: true,
      message: responseMessage,
      referralApplied: !!referralMessage,
      data: {
        id: userObj.id,
        phone: userObj.phone,
        name: userObj.name,
        email: userObj.email,
        addresses: transformedAddresses,
        profilePic: userObj.profilePic,
        role: userObj.role,
        isProfileComplete: userObj.isProfileComplete
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

/**
 * GET /api/auth/export
 * DPDP Act compliance — let the user download a copy of everything we hold
 * about them as JSON. Includes profile, addresses, orders (food + grocery),
 * and wallet transactions. Excludes hashed/sensitive fields.
 */
exports.exportMyData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const Order = require('../models/Order.model');
    const GroceryOrder = require('../models/GroceryOrder.model');
    const { WalletTransaction } = require('../models/WalletTransaction.model');

    const [user, addresses, foodOrders, groceryOrders, walletTxns] = await Promise.all([
      User.findById(userId).select('-otp -otpExpiry').lean(),
      Address.find({ user: userId }).lean(),
      Order.find({ user: userId }).lean(),
      GroceryOrder.find({ user: userId }).lean(),
      WalletTransaction.find({ user: userId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="hungerwood-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      addresses,
      foodOrders,
      groceryOrders,
      walletTransactions: walletTxns,
    });
  } catch (error) {
    logger.error('Data export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export data' });
  }
};

/**
 * DELETE /api/auth/account
 * DPDP Act compliance — soft-delete the account. PII is anonymized; the
 * User row is kept (with deletedAt set) so foreign keys on past orders
 * remain valid for accounting/refund disputes. The account can no longer
 * log in (isActive = false) and the phone number is freed for future
 * reuse by suffixing the stored value so the unique-phone index doesn't
 * block re-signup.
 */
exports.deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role && user.role !== 'USER') {
      return res.status(403).json({
        success: false,
        message: 'Admin/staff accounts cannot self-delete. Please contact support.',
      });
    }

    // Refuse if there's an open order — the operations team needs the link.
    const Order = require('../models/Order.model');
    const GroceryOrder = require('../models/GroceryOrder.model');
    const ACTIVE = ['RECEIVED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'PACKED', 'READY_FOR_PICKUP'];
    const [openFood, openGrocery] = await Promise.all([
      Order.countDocuments({ user: userId, status: { $in: ACTIVE } }),
      GroceryOrder.countDocuments({ user: userId, status: { $in: ACTIVE } }),
    ]);
    if (openFood + openGrocery > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have an order in progress. Please wait for it to complete before deleting your account.',
      });
    }

    const ts = Date.now();
    user.phone = `deleted_${ts}_${user.phone}`.slice(0, 20);
    user.name = 'Deleted user';
    user.email = undefined;
    user.profilePic = undefined;
    user.isActive = false;
    user.deletedAt = new Date();
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.referralCode = undefined;
    await user.save();

    // Detach saved addresses so future scans don't surface the user's data.
    await Address.updateMany({ user: userId }, { $set: { isDeleted: true } });

    logger.info(`User self-deleted: ${userId}`);
    res.json({ success: true, message: 'Account deleted. Goodbye!' });
  } catch (error) {
    logger.error('Account deletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
};
