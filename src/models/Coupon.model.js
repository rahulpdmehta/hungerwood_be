const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 30 },
  description: { type: String, default: '', maxlength: 200 },

  /** Which section can apply this coupon. */
  section: { type: String, enum: ['food', 'grocery'], required: true, index: true },

  /** Visual theme used by the customer Coupons page. */
  theme: { type: String, enum: ['green', 'amber', 'brown'], default: 'green' },

  /** Discount mechanics. */
  type: { type: String, enum: ['PERCENTAGE', 'FLAT', 'FREE_DELIVERY'], required: true },
  value: { type: Number, required: true, min: 0 },          // percent for PERCENTAGE; rupees for FLAT
  minOrderValue: { type: Number, default: null, min: 0 },   // null = no minimum
  maxDiscount: { type: Number, default: null, min: 0 },     // cap for PERCENTAGE; null = uncapped

  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date, required: true },

  /** Per-user usage cap. null = unlimited. */
  perUserLimit: { type: Number, default: null, min: 1 },

  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

couponSchema.index({ section: 1, isActive: 1, validTo: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
