/**
 * Order Model
 * Represents customer orders
 */

const mongoose = require('mongoose');
const { ORDER_TYPES, ORDER_STATUS, PAYMENT_METHODS } = require('../utils/constants');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  
  // Order items
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: String, // Store name for history
    price: Number, // Store price at order time
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    addons: [{
      name: String,
      price: Number
    }]
  }],
  
  // Pricing breakdown
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  tax: {
    type: Number,
    required: true,
    min: 0
  },
  
  packaging: {
    type: Number,
    default: 0
  },
  
  delivery: {
    type: Number,
    default: 0
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Order type
  orderType: {
    type: String,
    enum: Object.values(ORDER_TYPES),
    required: [true, 'Order type is required']
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: [true, 'Payment method is required']
  },
  
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  
  // Payment details (for Razorpay and other payment gateways)
  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String
  },
  
  // Wallet usage
  walletUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Order status
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.RECEIVED
  },
  
  // Delivery address (only for delivery orders)
  deliveryAddress: {
    street: String,
    landmark: String,
    city: String,
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Special instructions
  instructions: {
    type: String,
    trim: true,
    maxlength: [500, 'Instructions cannot exceed 500 characters']
  },
  
  // Timing
  estimatedTime: {
    type: Number, // in minutes
    default: 30
  },
  
  preparedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  
  // Cancellation reason
  cancellationReason: {
    type: String,
    trim: true
  },
  
  // Rating & Review (optional)
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  review: {
    type: String,
    trim: true
  },
  
  // Status history for tracking order status changes
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Indexes for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 }, { unique: true });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save hook to ensure delivery address for delivery orders
orderSchema.pre('save', function(next) {
  if (this.orderType === ORDER_TYPES.DELIVERY && !this.deliveryAddress) {
    return next(new Error('Delivery address is required for delivery orders'));
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
