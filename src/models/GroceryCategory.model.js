const mongoose = require('mongoose');

const groceryCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  image: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

groceryCategorySchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('GroceryCategory', groceryCategorySchema);
