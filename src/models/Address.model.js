/**
 * Address Model
 * Represents saved user addresses
 */

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  label: {
    type: String,
    required: [true, 'Label is required'],
    trim: true,
    maxlength: [50, 'Label cannot exceed 50 characters']
  },
  
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true
  },
  
  landmark: {
    type: String,
    trim: true
  },
  
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  
  state: {
    type: String,
    default: 'Bihar',
    trim: true
  },
  
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
  },
  
  coordinates: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
addressSchema.index({ user: 1 });

// Ensure only one default address per user
addressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('Address', addressSchema);
