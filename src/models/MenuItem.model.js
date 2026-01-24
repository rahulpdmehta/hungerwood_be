/**
 * MenuItem Model
 * Represents individual food items in the menu
 */

const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  
  image: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  
  isVeg: {
    type: Boolean,
    default: true
  },
  
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Tags for filtering
  tags: {
    isBestseller: {
      type: Boolean,
      default: false
    },
    isRecommended: {
      type: Boolean,
      default: false
    },
    isSpecial: {
      type: Boolean,
      default: false
    }
  },
  
  // Nutritional info (optional)
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  
  // Spice levels
  spiceLevel: {
    type: String,
    enum: ['None', 'Low', 'Medium', 'High', 'Extra Hot'],
    default: 'Medium'
  },
  
  // Preparation time in minutes
  prepTime: {
    type: Number,
    default: 15
  },
  
  // Available add-ons
  addons: [{
    name: String,
    price: Number
  }]
}, {
  timestamps: true
});

// Indexes for faster queries
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ isVeg: 1 });
menuItemSchema.index({ 'tags.isBestseller': 1 });

// Virtual for full price with addons
menuItemSchema.virtual('priceWithAddons').get(function() {
  const addonsTotal = this.addons.reduce((sum, addon) => sum + addon.price, 0);
  return this.price + addonsTotal;
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
