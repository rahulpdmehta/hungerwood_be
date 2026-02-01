/**
 * Restaurant Model
 * Singleton model for restaurant status and settings
 * Only one restaurant document should exist
 */

const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  // Fixed ID to ensure singleton pattern
  _id: {
    type: String,
    default: 'restaurant'
  },
  
  isOpen: {
    type: Boolean,
    default: true,
    required: true
  },
  
  closingMessage: {
    type: String,
    trim: true,
    maxlength: [200, 'Closing message cannot exceed 200 characters'],
    default: ''
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  _id: false // Disable auto _id since we're using custom _id
});

// Ensure only one restaurant document exists
restaurantSchema.statics.getRestaurant = async function() {
  let restaurant = await this.findById('restaurant');
  if (!restaurant) {
    restaurant = await this.create({ _id: 'restaurant', isOpen: true });
  }
  return restaurant;
};

// Index for faster queries
restaurantSchema.index({ _id: 1 }, { unique: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
