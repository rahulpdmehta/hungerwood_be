/**
 * Category Model
 * Represents menu categories (Tandoor, Chinese, etc.)
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  image: {
    type: String,
    trim: true
  },
  
  order: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create slug before saving
categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }
  next();
});

// Index for faster queries
categorySchema.index({ slug: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
