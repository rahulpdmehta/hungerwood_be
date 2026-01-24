/**
 * Banner Service
 * Business logic for banner management
 */

const Banner = require('../models/banner.model');
const logger = require('../config/logger');

const BANNER_TYPES = {
  OFFER: 'OFFER',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PROMOTION: 'PROMOTION',
  EVENT: 'EVENT',
};

// Get all active banners (for customers)
const getActiveBanners = async () => {
  try {
    const allBanners = await Banner.getAll();
    const now = new Date();

    const activeBanners = allBanners
      .filter(banner => {
        // Must be enabled
        if (!banner.enabled) return false;

        // Check date validity
        if (banner.validFrom) {
          const validFrom = new Date(banner.validFrom);
          if (now < validFrom) return false;
        }

        if (banner.validUntil) {
          const validUntil = new Date(banner.validUntil);
          if (now > validUntil) return false;
        }

        // Check day restrictions
        if (banner.applicableOn && banner.applicableOn.length > 0) {
          const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const currentDay = days[now.getDay()];
          if (!banner.applicableOn.includes(currentDay)) return false;
        }

        return true;
      })
      .sort((a, b) => a.priority - b.priority); // Sort by priority

    return activeBanners;
  } catch (error) {
    logger.error('Error in getActiveBanners service:', error);
    throw error;
  }
};

// Get all banners (for admin)
const getAllBanners = async (includeDisabled = true) => {
  try {
    const banners = await Banner.getAll();
    
    if (!includeDisabled) {
      return banners.filter(banner => banner.enabled);
    }

    return banners.sort((a, b) => a.priority - b.priority);
  } catch (error) {
    logger.error('Error in getAllBanners service:', error);
    throw error;
  }
};

// Get banner by ID
const getBannerById = async (id) => {
  try {
    return await Banner.getById(id);
  } catch (error) {
    logger.error('Error in getBannerById service:', error);
    throw error;
  }
};

// Create new banner
const createBanner = async (bannerData) => {
  try {
    // Validate banner type
    if (!Object.values(BANNER_TYPES).includes(bannerData.type)) {
      throw new Error(`Invalid banner type. Must be one of: ${Object.values(BANNER_TYPES).join(', ')}`);
    }

    // Generate unique ID
    const id = `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newBanner = {
      id,
      type: bannerData.type || BANNER_TYPES.OFFER,
      enabled: bannerData.enabled !== undefined ? bannerData.enabled : true,
      priority: bannerData.priority || 999,
      title: bannerData.title,
      subtitle: bannerData.subtitle || '',
      description: bannerData.description || '',
      badge: bannerData.badge || '',
      badgeColor: bannerData.badgeColor || '#cf6317',
      image: bannerData.image,
      backgroundColor: bannerData.backgroundColor || 'linear-gradient(135deg, #181411 0%, #2d221a 100%)',
      textColor: bannerData.textColor || '#ffffff',
      ctaText: bannerData.ctaText || 'Order Now',
      ctaLink: bannerData.ctaLink || '/menu',
      validFrom: bannerData.validFrom || null,
      validUntil: bannerData.validUntil || null,
      minOrderAmount: bannerData.minOrderAmount || 0,
      discountPercent: bannerData.discountPercent || 0,
      applicableCategories: bannerData.applicableCategories || [],
      applicableOn: bannerData.applicableOn || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await Banner.create(newBanner);
    return newBanner;
  } catch (error) {
    logger.error('Error in createBanner service:', error);
    throw error;
  }
};

// Update banner
const updateBanner = async (id, updateData) => {
  try {
    const existingBanner = await Banner.getById(id);
    if (!existingBanner) {
      return null;
    }

    // Validate type if provided
    if (updateData.type && !Object.values(BANNER_TYPES).includes(updateData.type)) {
      throw new Error(`Invalid banner type. Must be one of: ${Object.values(BANNER_TYPES).join(', ')}`);
    }

    const updatedBanner = {
      ...existingBanner,
      ...updateData,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    await Banner.update(id, updatedBanner);
    return updatedBanner;
  } catch (error) {
    logger.error('Error in updateBanner service:', error);
    throw error;
  }
};

// Toggle banner status
const toggleBannerStatus = async (id) => {
  try {
    const banner = await Banner.getById(id);
    if (!banner) {
      return null;
    }

    const updatedBanner = {
      ...banner,
      enabled: !banner.enabled,
      updatedAt: new Date().toISOString(),
    };

    await Banner.update(id, updatedBanner);
    return updatedBanner;
  } catch (error) {
    logger.error('Error in toggleBannerStatus service:', error);
    throw error;
  }
};

// Delete banner
const deleteBanner = async (id) => {
  try {
    const banner = await Banner.getById(id);
    if (!banner) {
      return false;
    }

    await Banner.delete(id);
    return true;
  } catch (error) {
    logger.error('Error in deleteBanner service:', error);
    throw error;
  }
};

// Check if banner is currently valid
const isBannerValid = (banner) => {
  if (!banner.enabled) return false;

  const now = new Date();

  if (banner.validFrom) {
    const validFrom = new Date(banner.validFrom);
    if (now < validFrom) return false;
  }

  if (banner.validUntil) {
    const validUntil = new Date(banner.validUntil);
    if (now > validUntil) return false;
  }

  if (banner.applicableOn && banner.applicableOn.length > 0) {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[now.getDay()];
    if (!banner.applicableOn.includes(currentDay)) return false;
  }

  return true;
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
  isBannerValid,
  BANNER_TYPES,
};
