const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },       // "1 kg"
  mrp: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true }
}, { _id: true });

variantSchema.pre('validate', function (next) {
  if (this.sellingPrice > this.mrp) {
    return next(new Error('Variant sellingPrice cannot exceed mrp'));
  }
  next();
});

const groceryProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: 'text' },
  brand: { type: String, trim: true, default: '', index: 'text' },
  description: { type: String, trim: true, default: '' },
  image: { type: String, required: true, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryCategory', required: true },
  variants: {
    type: [variantSchema],
    validate: [v => v.length > 0, 'At least one variant is required']
  },
  isAvailable: { type: Boolean, default: true },
  tags: {
    isBestseller: { type: Boolean, default: false },
    isNew: { type: Boolean, default: false }
  }
}, { timestamps: true });

groceryProductSchema.index({ category: 1, isAvailable: 1 });

module.exports = mongoose.model('GroceryProduct', groceryProductSchema);
