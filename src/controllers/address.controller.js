/**
 * Address Controller
 * Handles address management for users
 */

const Address = require('../models/Address.model');
const User = require('../models/User.model');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const MAX_ADDRESSES = 5;

/**
 * Get all addresses for current user
 */
exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.userId }).sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    logger.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses'
    });
  }
};

/**
 * Add new address
 */
exports.addAddress = async (req, res) => {
  try {
    const { label, street, city, state, pincode } = req.body;

    // Validate required fields
    if (!label || !street || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: label, street, city, state, pincode'
      });
    }

    // Validate pincode (6 digits)
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 6 digits'
      });
    }

    // Check max addresses limit
    const addressCount = await Address.countDocuments({ user: req.user.userId });
    if (addressCount >= MAX_ADDRESSES) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_ADDRESSES} addresses allowed`
      });
    }

    // Create new address
    const newAddress = new Address({
      user: req.user.userId,
      label,
      street,
      city,
      state,
      pincode,
      isDefault: addressCount === 0 // First address is default
    });

    await newAddress.save();

    // Update user's addresses array
    await User.findByIdAndUpdate(req.user.userId, {
      $push: { addresses: newAddress._id }
    });

    logger.info(`Address added for user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
    });
  } catch (error) {
    logger.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address'
    });
  }
};

/**
 * Update existing address
 */
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, street, city, state, pincode } = req.body;

    // Find address belonging to user
    const address = await Address.findOne({ _id: id, user: req.user.userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Validate pincode if provided
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Pincode must be 6 digits'
      });
    }

    // Update address fields
    if (label) address.label = label;
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;

    await address.save();

    logger.info(`Address updated for user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: address
    });
  } catch (error) {
    logger.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address'
    });
  }
};

/**
 * Delete address
 */
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    // Find address belonging to user
    const address = await Address.findOne({ _id: id, user: req.user.userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const wasDefault = address.isDefault;

    // Delete address
    await Address.findByIdAndDelete(id);

    // Remove from user's addresses array
    await User.findByIdAndUpdate(req.user.userId, {
      $pull: { addresses: id }
    });

    // If deleted address was default, set first address as default
    if (wasDefault) {
      const firstAddress = await Address.findOne({ user: req.user.userId }).sort({ createdAt: 1 });
      if (firstAddress) {
        firstAddress.isDefault = true;
        await firstAddress.save();
      }
    }

    logger.info(`Address deleted for user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    logger.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address'
    });
  }
};

/**
 * Set default address
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;

    // Find address belonging to user
    const address = await Address.findOne({ _id: id, user: req.user.userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Set all addresses to non-default
    await Address.updateMany(
      { user: req.user.userId },
      { isDefault: false }
    );

    // Set selected address as default
    address.isDefault = true;
    await address.save();

    logger.info(`Default address set for user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Default address updated successfully',
      data: address
    });
  } catch (error) {
    logger.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address'
    });
  }
};
