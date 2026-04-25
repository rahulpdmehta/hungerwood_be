/**
 * Admin: list customers who have placed grocery orders, with grocery-side
 * order stats. Mirrors /api/admin/users but scoped to the grocery section.
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const GroceryOrder = require('../models/GroceryOrder.model');
const logger = require('../config/logger');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    // 1) Aggregate grocery orders per user.
    const stats = await GroceryOrder.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ['$totalAmount', 0] } },
          lastOrderDate: { $max: '$createdAt' },
        },
      },
    ]);

    if (!stats.length) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, page, limit, pages: 0 },
      });
    }

    const statsByUser = new Map(stats.map((s) => [String(s._id), s]));
    const userIds = stats.map((s) => s._id);

    // 2) Find users; apply search across name/phone/email.
    const userQuery = { _id: { $in: userIds } };
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      userQuery.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const total = await User.countDocuments(userQuery);
    const users = await User.find(userQuery)
      .select('phone name email role isActive walletBalance referralCode createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const data = users.map((u) => {
      const s = statsByUser.get(String(u._id)) || {};
      return {
        id: u._id.toString(),
        phone: u.phone,
        name: u.name || 'N/A',
        email: u.email || 'N/A',
        role: u.role || 'USER',
        isActive: u.isActive !== false,
        walletBalance: u.walletBalance || 0,
        referralCode: u.referralCode || null,
        createdAt: u.createdAt || null,
        stats: {
          totalOrders: s.totalOrders || 0,
          totalSpent: s.totalSpent || 0,
          lastOrderDate: s.lastOrderDate || null,
        },
      };
    });

    res.json({
      success: true,
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    logger.error('grocery.customer.list', e);
    res.status(500).json({ success: false, message: 'Failed to load grocery customers' });
  }
};
