/**
 * Version Controller
 * Handles version checking for menu, categories, and banners
 */

const MenuItem = require('../models/MenuItem.model');
const Category = require('../models/Category.model');
const { Banner } = require('../models/banner.model');
const logger = require('../config/logger');

/**
 * Get all data versions (unified endpoint)
 * GET /api/versions
 */
exports.getAllVersions = async (req, res) => {
  try {
    // Calculate versions in parallel for better performance
    const [menuItems, categories, banners] = await Promise.all([
      MenuItem.find({ isAvailable: true }),
      Category.find({ isActive: true }),
      Banner.find({ enabled: true })
    ]);

    // Calculate menu version from max updatedAt timestamp
    const menuTimestamps = menuItems.map(item => 
      new Date(item.updatedAt || item.createdAt).getTime()
    );
    const menuVersion = menuTimestamps.length > 0
      ? Math.max(...menuTimestamps)
      : Date.now();

    // Calculate categories version from max updatedAt timestamp
    const categoryTimestamps = categories.map(cat => 
      new Date(cat.updatedAt || cat.createdAt).getTime()
    );
    const categoriesVersion = categoryTimestamps.length > 0
      ? Math.max(...categoryTimestamps)
      : Date.now();

    // Calculate banners version from max updatedAt timestamp
    const bannerTimestamps = banners.map(banner => 
      new Date(banner.updatedAt || banner.createdAt).getTime()
    );
    const bannersVersion = bannerTimestamps.length > 0
      ? Math.max(...bannerTimestamps)
      : Date.now();

    res.json({
      success: true,
      data: {
        menu: menuVersion,
        categories: categoriesVersion,
        banners: bannersVersion
      }
    });
  } catch (error) {
    logger.error('Get all versions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch versions'
    });
  }
};
