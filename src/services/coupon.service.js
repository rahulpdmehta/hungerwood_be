const mongoose = require('mongoose');
const Coupon = require('../models/Coupon.model');
const Order = require('../models/Order.model');
const GroceryOrder = require('../models/GroceryOrder.model');

class CouponError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = 'CouponError';
  }
}

/**
 * Validate a coupon code against the request context and compute the
 * resulting discount. Pure (no side effects, no order mutations).
 *
 * Inputs:
 *   code         - string (case-insensitive)
 *   subtotal     - number, item-total before tax/delivery
 *   deliveryFee  - number, delivery fee that would otherwise apply
 *   userId       - ObjectId or string, used for per-user limit check
 *   section      - 'food' | 'grocery'
 *
 * Returns:
 *   { code, discount, freeDelivery, type, theme }
 *   discount = rupees off the bill (excluding delivery)
 *   freeDelivery = true when the coupon waives the delivery fee instead
 *
 * Throws CouponError with status code on any validation failure.
 */
async function validateAndCompute({ code, subtotal, deliveryFee = 0, userId, section }) {
  if (!code) throw new CouponError('Coupon code required');
  if (!section) throw new CouponError('Section required');

  const c = await Coupon.findOne({
    code: String(code).toUpperCase().trim(),
    section,
    isActive: true,
  }).lean();
  if (!c) throw new CouponError('Invalid coupon code', 404);

  const now = new Date();
  if (c.validFrom && now < new Date(c.validFrom)) {
    throw new CouponError('Coupon is not yet active');
  }
  if (now > new Date(c.validTo)) {
    throw new CouponError('Coupon has expired');
  }
  if (c.minOrderValue && subtotal < c.minOrderValue) {
    throw new CouponError(`Minimum order value of ₹${c.minOrderValue} required`);
  }

  if (c.perUserLimit && userId) {
    const Model = section === 'grocery' ? GroceryOrder : Order;
    const used = await Model.countDocuments({
      user: new mongoose.Types.ObjectId(String(userId)),
      'couponApplied.code': c.code,
    });
    if (used >= c.perUserLimit) {
      throw new CouponError('You have already used this coupon');
    }
  }

  let discount = 0;
  let freeDelivery = false;

  if (c.type === 'PERCENTAGE') {
    discount = (subtotal * c.value) / 100;
    if (c.maxDiscount != null) discount = Math.min(discount, c.maxDiscount);
  } else if (c.type === 'FLAT') {
    discount = Math.min(c.value, subtotal);
  } else if (c.type === 'FREE_DELIVERY') {
    freeDelivery = true;
    discount = deliveryFee;
  }

  return {
    code: c.code,
    discount: Math.round(discount * 100) / 100,
    freeDelivery,
    type: c.type,
    theme: c.theme,
  };
}

module.exports = { validateAndCompute, CouponError };
