const mongoose = require('mongoose');

const bundleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryProduct', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, default: 1, min: 1 },
}, { _id: false });

const groceryBundleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 200 },

  /** Visual theme used by BundleCard. */
  theme: { type: String, enum: ['warm', 'green', 'rose'], default: 'warm' },

  items: { type: [bundleItemSchema], validate: [v => v.length > 0, 'Bundle must contain at least one item'] },

  /** Customer pays bundlePrice instead of regularPrice when adding the bundle. */
  bundlePrice: { type: Number, required: true, min: 0 },
  regularPrice: { type: Number, required: true, min: 0 },

  isActive: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('GroceryBundle', groceryBundleSchema);
