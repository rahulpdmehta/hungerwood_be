const mongoose = require('mongoose');

/**
 * One row per grocery search submission. Used to compute "trending in
 * Gaya" tags on the search overlay. Pruned by the (createdAt 30d TTL)
 * index — Mongo will auto-delete old rows.
 */
const searchLogSchema = new mongoose.Schema({
  term: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

searchLogSchema.index({ term: 1, createdAt: -1 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
