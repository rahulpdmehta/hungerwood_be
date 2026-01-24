/**
 * Address Controller
 * Handles address management for users
 */

const JsonDB = require('../utils/jsonDB');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const usersDB = new JsonDB('users.json');
const MAX_ADDRESSES = 5;

/**
 * Get all addresses for current user
 */
exports.getAddresses = async (req, res) => {
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
      data: user.addresses || []
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

    const user = usersDB.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const addresses = user.addresses || [];

    // Check max addresses limit
    if (addresses.length >= MAX_ADDRESSES) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_ADDRESSES} addresses allowed`
      });
    }

    // Create new address
    const newAddress = {
      id: Date.now().toString(),
      label,
      street,
      city,
      state,
      pincode,
      isDefault: addresses.length === 0, // First address is default
      createdAt: getCurrentISO()
    };

    addresses.push(newAddress);

    // Update user
    const updatedUser = usersDB.update(req.user.userId, { addresses });

    logger.info(`Address added for user: ${user.phone}`);

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

    const user = usersDB.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const addresses = user.addresses || [];
    const addressIndex = addresses.findIndex(addr => addr.id === id);

    if (addressIndex === -1) {
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
    if (label) addresses[addressIndex].label = label;
    if (street) addresses[addressIndex].street = street;
    if (city) addresses[addressIndex].city = city;
    if (state) addresses[addressIndex].state = state;
    if (pincode) addresses[addressIndex].pincode = pincode;
    addresses[addressIndex].updatedAt = getCurrentISO();

    // Update user
    usersDB.update(req.user.userId, { addresses });

    logger.info(`Address updated for user: ${user.phone}`);

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: addresses[addressIndex]
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

    const user = usersDB.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const addresses = user.addresses || [];
    const addressIndex = addresses.findIndex(addr => addr.id === id);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const deletedAddress = addresses[addressIndex];
    const wasDefault = deletedAddress.isDefault;

    // Remove address
    addresses.splice(addressIndex, 1);

    // If deleted address was default, set first address as default
    if (wasDefault && addresses.length > 0) {
      addresses[0].isDefault = true;
    }

    // Update user
    usersDB.update(req.user.userId, { addresses });

    logger.info(`Address deleted for user: ${user.phone}`);

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

    const user = usersDB.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const addresses = user.addresses || [];
    const addressIndex = addresses.findIndex(addr => addr.id === id);

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Set all addresses to non-default
    addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set selected address as default
    addresses[addressIndex].isDefault = true;

    // Update user
    usersDB.update(req.user.userId, { addresses });

    logger.info(`Default address set for user: ${user.phone}`);

    res.json({
      success: true,
      message: 'Default address updated successfully',
      data: addresses[addressIndex]
    });
  } catch (error) {
    logger.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address'
    });
  }
};
