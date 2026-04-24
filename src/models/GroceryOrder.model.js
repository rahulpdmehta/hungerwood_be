const mongoose = require('mongoose');
const { GROCERY_ORDER_STATUS } = require('../utils/groceryOrderStatusValidator');
const { PAYMENT_METHODS } = require('../utils/constants');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryProduct', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  variantLabel: String,
  mrp: Number,
  sellingPrice: Number,
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const groceryOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // "HG_YYYYMMDD_XXX..."
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], validate: [v => v.length > 0, 'At least one item required'] },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  delivery: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  orderType: { type: String, enum: ['DELIVERY', 'PICKUP'], required: true },
  deliveryAddress: {
    street: String, city: String, state: String, pincode: String
  },
  paymentMethod: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  paymentDetails: {
    razorpayOrderId: String, razorpayPaymentId: String, razorpaySignature: String
  },
  walletUsed: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: Object.values(GROCERY_ORDER_STATUS),
    default: GROCERY_ORDER_STATUS.RECEIVED
  },
  statusHistory: [{
    status: String,
    timestamp: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  instructions: { type: String, default: '', maxlength: 500 },
  couponApplied: {
    code: String,
    discount: { type: Number, default: 0 },
    freeDelivery: { type: Boolean, default: false },
    type: { type: String, enum: ['PERCENTAGE', 'FLAT', 'FREE_DELIVERY'] },
  },
  cancellationReason: { type: String, default: null, maxlength: 200 },
  cancelledAt: { type: Date, default: null },
  rating: {
    stars: { type: Number, min: 1, max: 5 },
    tags: [String],
    comment: String,
    submittedAt: Date,
  },
}, { timestamps: true });

groceryOrderSchema.index({ user: 1, createdAt: -1 });
groceryOrderSchema.index({ status: 1 });

module.exports = mongoose.model('GroceryOrder', groceryOrderSchema);
