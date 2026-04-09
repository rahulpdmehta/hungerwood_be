/**
 * Menu Service
 * Business logic for menu management
 */

const MenuItem = require('../models/MenuItem.model');
const Category = require('../models/Category.model');
const logger = require('../config/logger');

/**
 * Get all categories
 */
const getCategories = async () => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 });
    
    return categories;
  } catch (error) {
    logger.error('Error fetching categories:', error);
    throw error;
  }
};

/**
 * Get menu items with filters
 */
const getMenuItems = async (filters = {}) => {
  try {
    const { category, isVeg, isBestseller, search } = filters;
    
    const query = { isAvailable: true };
    
    // Category filter
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) {
        query.category = cat._id;
      }
    }
    
    // Veg filter
    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }
    
    // Bestseller filter
    if (isBestseller === 'true') {
      query['tags.isBestseller'] = true;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const items = await MenuItem.find(query)
      .populate('category', 'name slug')
      .sort({ 'tags.isBestseller': -1, name: 1 });
    
    return items;
  } catch (error) {
    logger.error('Error fetching menu items:', error);
    throw error;
  }
};

/**
 * Get menu item by ID
 */
const getMenuItemById = async (itemId) => {
  try {
    const item = await MenuItem.findById(itemId)
      .populate('category', 'name slug');
    
    if (!item) {
      throw new Error('Menu item not found');
    }
    
    return item;
  } catch (error) {
    logger.error('Error fetching menu item:', error);
    throw error;
  }
};

/**
 * Create menu item (Admin)
 */
const createMenuItem = async (itemData) => {
  try {
    const item = new MenuItem(itemData);
    await item.save();
    await item.populate('category', 'name slug');
    
    logger.info(`Menu item created: ${item.name}`);
    
    return item;
  } catch (error) {
    logger.error('Error creating menu item:', error);
    throw error;
  }
};

/**
 * Update menu item (Admin)
 */
const updateMenuItem = async (itemId, updateData) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(
      itemId,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');
    
    if (!item) {
      throw new Error('Menu item not found');
    }
    
    logger.info(`Menu item updated: ${item.name}`);
    
    return item;
  } catch (error) {
    logger.error('Error updating menu item:', error);
    throw error;
  }
};

/**
 * Delete menu item (Admin)
 */
const deleteMenuItem = async (itemId) => {
  try {
    const item = await MenuItem.findByIdAndDelete(itemId);
    
    if (!item) {
      throw new Error('Menu item not found');
    }
    
    logger.info(`Menu item deleted: ${item.name}`);
    
    return { success: true };
  } catch (error) {
    logger.error('Error deleting menu item:', error);
    throw error;
  }
};

module.exports = {
  getCategories,
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
