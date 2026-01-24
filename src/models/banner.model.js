/**
 * Banner Model
 * Data access layer for banners using MongoDB
 */

const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['OFFER', 'PROMOTION', 'ANNOUNCEMENT'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  badge: {
    type: String,
    default: ''
  },
  badgeColor: {
    type: String,
    default: '#000000'
  },
  image: {
    type: String,
    required: true
  },
  backgroundColor: {
    type: String,
    default: '#ffffff'
  },
  textColor: {
    type: String,
    default: '#000000'
  },
  ctaText: {
    type: String,
    default: 'Learn More'
  },
  ctaLink: {
    type: String,
    default: '/'
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: null
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  discountPercent: {
    type: Number,
    default: 0
  },
  applicableCategories: {
    type: [String],
    default: []
  },
  applicableOn: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Indexes
bannerSchema.index({ enabled: 1, priority: -1 });
bannerSchema.index({ validFrom: 1, validUntil: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

// Helper functions to match the old API
const getAll = async () => {
  return await Banner.find({ enabled: true })
    .sort({ priority: 1, createdAt: -1 });
};

const getById = async (id) => {
  return await Banner.findOne({ id });
};

const create = async (bannerData) => {
  const banner = new Banner(bannerData);
  await banner.save();
  return banner;
};

const update = async (id, bannerData) => {
  return await Banner.findOneAndUpdate(
    { id },
    bannerData,
    { new: true, runValidators: true }
  );
};

const deleteBanner = async (id) => {
  const result = await Banner.findOneAndDelete({ id });
  return !!result;
};

module.exports = {
  Banner,
  getAll,
  getById,
  create,
  update,
  delete: deleteBanner,
};
