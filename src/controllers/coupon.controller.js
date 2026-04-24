const Coupon = require('../models/Coupon.model');
const couponService = require('../services/coupon.service');
const logger = require('../config/logger');

/** GET /api/grocery/coupons — list active grocery coupons usable today */
exports.listAvailable = async (req, res) => {
  try {
    const now = new Date();
    const list = await Coupon.find({
      section: 'grocery',
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: list });
  } catch (e) {
    logger.error('coupon.listAvailable', e);
    res.status(500).json({ success: false });
  }
};

/**
 * POST /api/grocery/coupons/apply
 * Body: { code, subtotal, deliveryFee }
 * Validates code against the caller and returns the computed discount.
 * Does NOT mutate any order — that happens at order-creation time.
 */
exports.apply = async (req, res) => {
  try {
    const { code, subtotal, deliveryFee = 0 } = req.body || {};
    const result = await couponService.validateAndCompute({
      code,
      subtotal: Number(subtotal) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      userId: req.user.userId,
      section: 'grocery',
    });
    res.json({ success: true, data: result });
  } catch (e) {
    if (e?.name === 'CouponError') {
      return res.status(e.status || 400).json({ success: false, message: e.message });
    }
    logger.error('coupon.apply', e);
    res.status(500).json({ success: false, message: 'Failed to apply coupon' });
  }
};
