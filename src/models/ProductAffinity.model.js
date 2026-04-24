const mongoose = require('mongoose');

/**
 * Pair-wise product co-occurrence in completed grocery orders.
 * Recomputed nightly by `scripts/aggregate-affinity.js` (rolling 30-day
 * window). One document per directed (a, b) pair.
 */
const productAffinitySchema = new mongoose.Schema({
  productA: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryProduct', required: true, index: true },
  productB: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryProduct', required: true },
  score: { type: Number, default: 0 },
}, { timestamps: true });

productAffinitySchema.index({ productA: 1, score: -1 });

module.exports = mongoose.model('ProductAffinity', productAffinitySchema);
