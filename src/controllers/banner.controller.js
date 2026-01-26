/**
 * Banner Controller
 * Handles HTTP requests for banner management
 */

const bannerService = require('../services/banner.service');
const logger = require('../config/logger');
const { transformEntity, transformEntities } = require('../utils/transformers');

// Get all active banners (public)
const getActiveBanners = async (req, res) => {
  try {
    const banners = await bannerService.getActiveBanners();
    // Transform banners: set id to _id value
    const transformedBanners = transformEntities(banners);
    res.status(200).json({
      success: true,
      data: transformedBanners,
      count: transformedBanners.length,
    });
  } catch (error) {
    logger.error('Error fetching active banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active banners',
      error: error.message,
    });
  }
};

// Get all banners (admin)
const getAllBanners = async (req, res) => {
  try {
    const { includeDisabled = true } = req.query;
    const banners = await bannerService.getAllBanners(includeDisabled === 'true');
    // Transform banners: set id to _id value
    const transformedBanners = transformEntities(banners);
    res.status(200).json({
      success: true,
      data: transformedBanners,
      count: transformedBanners.length,
    });
  } catch (error) {
    logger.error('Error fetching all banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message,
    });
  }
};

// Get banner by ID
const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await bannerService.getBannerById(id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    // Transform banner: set id to _id value
    const transformedBanner = transformEntity(banner);

    res.status(200).json({
      success: true,
      data: transformedBanner,
    });
  } catch (error) {
    logger.error('Error fetching banner by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner',
      error: error.message,
    });
  }
};

// Create new banner (admin)
const createBanner = async (req, res) => {
  try {
    const bannerData = req.body;
    const newBanner = await bannerService.createBanner(bannerData);
    
    logger.info(`Banner created: ${newBanner.id} by admin: ${req.user.id}`);
    
    // Transform banner: set id to _id value
    const transformedBanner = transformEntity(newBanner);

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: transformedBanner,
    });
  } catch (error) {
    logger.error('Error creating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
      error: error.message,
    });
  }
};

// Update banner (admin)
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedBanner = await bannerService.updateBanner(id, updateData);
    
    if (!updatedBanner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    logger.info(`Banner updated: ${id} by admin: ${req.user.id}`);
    
    // Transform banner: set id to _id value
    const transformedBanner = transformEntity(updatedBanner);

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: transformedBanner,
    });
  } catch (error) {
    logger.error('Error updating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error: error.message,
    });
  }
};

// Toggle banner status (admin)
const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBanner = await bannerService.toggleBannerStatus(id);
    
    if (!updatedBanner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    logger.info(`Banner status toggled: ${id} (enabled: ${updatedBanner.enabled}) by admin: ${req.user.id}`);
    
    // Transform banner: set id to _id value
    const transformedBanner = transformEntity(updatedBanner);

    res.status(200).json({
      success: true,
      message: `Banner ${updatedBanner.enabled ? 'enabled' : 'disabled'} successfully`,
      data: transformedBanner,
    });
  } catch (error) {
    logger.error('Error toggling banner status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle banner status',
      error: error.message,
    });
  }
};

// Delete banner (admin)
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await bannerService.deleteBanner(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    logger.info(`Banner deleted: ${id} by admin: ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner',
      error: error.message,
    });
  }
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
};
