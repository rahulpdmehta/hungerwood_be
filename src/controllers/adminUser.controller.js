/**
 * Admin User Management Controller
 * Used by super-admin only.
 */

const User = require('../models/User.model');
const logger = require('../config/logger');
const { ROLES, HTTP_STATUS } = require('../utils/constants');

const ADMIN_ROLES = [ROLES.RESTAURANT_ADMIN, ROLES.GROCERY_ADMIN, ROLES.SUPER_ADMIN];

/** List all admin users (excludes USER role). */
exports.listAdmins = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ADMIN_ROLES } })
      .select('phone name role isActive lastLoginAt createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (e) {
    logger.error('listAdmins error', e);
    res.status(500).json({ success: false, message: 'Failed to list admins' });
  }
};

/** Create a new admin user. Returns 400 if phone already taken. */
exports.createAdmin = async (req, res) => {
  try {
    const { phone, name, role } = req.body;
    if (!phone || !name || !role) {
      return res.status(400).json({ success: false, message: 'phone, name, role are required' });
    }
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid admin role' });
    }
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Phone already registered' });
    }
    const user = await User.create({ phone, name, role, isActive: true });
    logger.info(`[admin] super-admin ${req.user.userId} created admin ${user._id} (${role})`);
    res.status(201).json({ success: true, data: user });
  } catch (e) {
    logger.error('createAdmin error', e);
    res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

/** Update an admin's role or name. Protects the last super-admin. */
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name } = req.body;
    const target = await User.findById(id);
    if (!target || !ADMIN_ROLES.includes(target.role)) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }
    if (target.role === ROLES.SUPER_ADMIN && role && role !== ROLES.SUPER_ADMIN) {
      const count = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (count <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the only super-admin' });
      }
    }
    if (role) {
      if (!ADMIN_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid admin role' });
      }
      target.role = role;
    }
    if (name !== undefined) target.name = name;
    await target.save();
    logger.info(`[admin] super-admin ${req.user.userId} updated admin ${id}`);
    res.json({ success: true, data: target });
  } catch (e) {
    logger.error('updateAdmin error', e);
    res.status(500).json({ success: false, message: 'Failed to update admin' });
  }
};

/** Deactivate an admin. Protects the last super-admin and self-deactivation. */
exports.deactivateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user.userId) === String(id)) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate yourself' });
    }
    const target = await User.findById(id);
    if (!target || !ADMIN_ROLES.includes(target.role)) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }
    if (target.role === ROLES.SUPER_ADMIN) {
      const activeSupers = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (activeSupers <= 1 && target.isActive) {
        return res.status(400).json({ success: false, message: 'Cannot deactivate the only active super-admin' });
      }
    }
    target.isActive = false;
    await target.save();
    logger.info(`[admin] super-admin ${req.user.userId} deactivated admin ${id}`);
    res.json({ success: true, data: target });
  } catch (e) {
    logger.error('deactivateAdmin error', e);
    res.status(500).json({ success: false, message: 'Failed to deactivate admin' });
  }
};
