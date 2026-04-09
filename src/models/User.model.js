/**
 * User Model
 * Represents customers and admin users
 */

const mongoose = require('mongoose');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number']
  },
  
  name: {
    type: String,
    trim: true,
    default: 'Guest User'
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.USER
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // OTP fields
  otp: {
    type: String,
    select: false // Don't include in queries by default
  },
  
  otpExpiry: {
    type: Date,
    select: false
  },
  
  // Saved addresses
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  }],
  
  // User preferences
  preferences: {
    dietaryPreference: {
      type: String,
      enum: ['All', 'Veg', 'Non-Veg'],
      default: 'All'
    }
  },
  
  // Wallet
  walletBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Referral system
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  hasUsedReferral: {
    type: Boolean,
    default: false
  },
  referralAppliedAt: {
    type: Date,
    default: null
  },
  referralRewarded: {
    type: Boolean,
    default: false
  },
  referralRewardedAt: {
    type: Date,
    default: null
  },
  referralCount: {
    type: Number,
    default: 0
  },
  referralEarnings: {
    type: Number,
    default: 0
  },
  
  // Profile
  profilePic: {
    type: String,
    default: null
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster phone lookups (unique)
userSchema.index({ phone: 1 }, { unique: true });

// Method to check if OTP is valid
userSchema.methods.isOTPValid = function(otp) {
  return this.otp === otp && this.otpExpiry > new Date();
};

// Method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = undefined;
  this.otpExpiry = undefined;
};

module.exports = mongoose.model('User', userSchema);
