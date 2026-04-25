/**
 * Banner Controller
 * Handles HTTP requests for banner management
 */

const bannerService = require('../services/banner.service');
const logger = require('../config/logger');
const { transformEntity, transformEntities } = require('../utils/transformers');
const { ROLES } = require('../utils/constants');

/**
 * Returns the section a non-super admin is allowed to manage, or null
 * if the user can manage any section (SUPER_ADMIN).
 */
const allowedSectionForUser = (user) => {
  if (!user) return null;
  if (user.role === ROLES.SUPER_ADMIN) return null;
  if (user.role === ROLES.GROCERY_ADMIN) return 'grocery';
  if (user.role === ROLES.RESTAURANT_ADMIN) return 'food';
  return null;
};

// Get all active banners (public)
const getActiveBanners = async (req, res) => {
  try {
    const { section } = req.query;
    const banners = await bannerService.getActiveBanners();
    // Filter by section when provided
    const filtered = section ? banners.filter(b => b.section === section) : banners;
    // Transform banners: set id to _id value
    const transformedBanners = transformEntities(filtered);
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
    });
  }
};

// Get all banners (admin)
const getAllBanners = async (req, res) => {
  try {
    const { includeDisabled = true, section } = req.query;
    const banners = await bannerService.getAllBanners(includeDisabled === 'true');
    // Filter by section when provided
    const filtered = section ? banners.filter(b => b.section === section) : banners;
    // Transform banners: set id to _id value
    const transformedBanners = transformEntities(filtered);
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
    });
  }
};

// Create new banner (admin)
const createBanner = async (req, res) => {
  try {
    const requestedSection = req.body.section === 'grocery' ? 'grocery' : 'food';
    const lockedSection = allowedSectionForUser(req.user);
    if (lockedSection && requestedSection !== lockedSection) {
      return res.status(403).json({
        success: false,
        message: `Your role can only manage banners in section "${lockedSection}"`,
      });
    }
    const bannerData = { ...req.body, section: requestedSection };
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
    });
  }
};

// Update banner (admin)
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.section !== undefined && !['food', 'grocery'].includes(updateData.section)) {
      delete updateData.section;
    }

    const lockedSection = allowedSectionForUser(req.user);
    if (lockedSection) {
      const existing = await bannerService.getBannerById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      if (existing.section !== lockedSection) {
        return res.status(403).json({
          success: false,
          message: `Your role can only manage banners in section "${lockedSection}"`,
        });
      }
      if (updateData.section && updateData.section !== lockedSection) {
        return res.status(403).json({
          success: false,
          message: `Cannot move a banner out of section "${lockedSection}"`,
        });
      }
    }

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
    });
  }
};

// Toggle banner status (admin)
const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const lockedSection = allowedSectionForUser(req.user);
    if (lockedSection) {
      const existing = await bannerService.getBannerById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      if (existing.section !== lockedSection) {
        return res.status(403).json({
          success: false,
          message: `Your role can only manage banners in section "${lockedSection}"`,
        });
      }
    }

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
    });
  }
};

// Delete banner (admin)
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const lockedSection = allowedSectionForUser(req.user);
    if (lockedSection) {
      const existing = await bannerService.getBannerById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      if (existing.section !== lockedSection) {
        return res.status(403).json({
          success: false,
          message: `Your role can only manage banners in section "${lockedSection}"`,
        });
      }
    }

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
