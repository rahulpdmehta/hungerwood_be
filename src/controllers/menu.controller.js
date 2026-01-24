/**
 * Menu Controller
 * Handles menu-related operations using JSON files
 */

const JsonDB = require('../utils/jsonDB');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const categoriesDB = new JsonDB('categories.json');
const menuItemsDB = new JsonDB('menuItems.json');

/**
 * Get all categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = categoriesDB.findAll();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

/**
 * Get all menu items with optional filters
 */
exports.getMenuItems = async (req, res) => {
  try {
    const { category, isVeg, search } = req.query;

    let items = menuItemsDB.findAll();

    // Filter by category
    if (category) {
      items = items.filter(item => item.category === category);
    }

    // Filter by veg/non-veg
    if (isVeg !== undefined) {
      const vegFilter = isVeg === 'true';
      items = items.filter(item => item.isVeg === vegFilter);
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // Populate category details
    const categories = categoriesDB.findAll();
    items = items.map(item => {
      const category = categories.find(cat => cat._id === item.category);
      return {
        ...item,
        category: category || { _id: item.category, name: 'Unknown' }
      };
    });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items'
    });
  }
};

/**
 * Get single menu item by ID
 */
exports.getMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = menuItemsDB.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Populate category details
    const category = categoriesDB.findById(item.category);
    const itemWithCategory = {
      ...item,
      category: category || { _id: item.category, name: 'Unknown' }
    };

    res.json({
      success: true,
      data: itemWithCategory
    });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu item'
    });
  }
};

/**
 * Get menu version (lightweight check for updates)
 * GET /api/menu/version
 */
exports.getMenuVersion = async (req, res) => {
  try {
    const items = menuItemsDB.findAll();
    const categories = categoriesDB.findAll();

    // Calculate version based on last modified timestamp
    const allTimestamps = [
      ...items.map(item => new Date(item.updatedAt || item.createdAt).getTime()),
      ...categories.map(cat => new Date(cat.updatedAt || cat.createdAt).getTime())
    ];

    const lastModified = allTimestamps.length > 0
      ? Math.max(...allTimestamps)
      : Date.now();

    res.json({
      success: true,
      data: {
        version: lastModified,
        itemCount: items.length,
        categoryCount: categories.length
      }
    });
  } catch (error) {
    console.error('Get menu version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu version'
    });
  }
};

/**
 * Create menu item (Admin only)
 * POST /api/admin/menu
 */
exports.createMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      isVeg = true,
      isAvailable = true,
      isBestSeller = false,
      discount = 0
    } = req.body;

    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and category are required'
      });
    }

    // Validate category exists
    const categoryExists = categoriesDB.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Handle file upload or URL
    let finalImageUrl = imageUrl || '';
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    }

    // Create menu item
    const menuItemData = {
      name: name.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      category,
      image: finalImageUrl,
      isVeg: Boolean(isVeg),
      isAvailable: Boolean(isAvailable),
      isBestSeller: Boolean(isBestSeller),
      discount: parseFloat(discount) || 0,
      createdAt: getCurrentISO(),
      updatedAt: getCurrentISO()
    };

    const menuItem = menuItemsDB.create(menuItemData);

    logger.info(`Menu item created by admin ${req.user.userId}: ${menuItem.name}`);

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: menuItem
    });
  } catch (error) {
    logger.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create menu item'
    });
  }
};

/**
 * Update menu item (Admin only)
 * PUT /api/admin/menu/:id
 */
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      isVeg,
      isAvailable,
      isBestSeller,
      discount
    } = req.body;

    const menuItem = menuItemsDB.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Validate category if provided
    if (category) {
      const categoryExists = categoriesDB.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID'
        });
      }
    }

    // Handle file upload or URL
    let finalImageUrl = menuItem.image;
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    } else if (imageUrl !== undefined) {
      finalImageUrl = imageUrl;
    }

    // Update menu item
    const updateData = {
      updatedAt: getCurrentISO()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category !== undefined) updateData.category = category;
    if (finalImageUrl !== menuItem.image) updateData.image = finalImageUrl;
    if (isVeg !== undefined) updateData.isVeg = Boolean(isVeg);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (isBestSeller !== undefined) updateData.isBestSeller = Boolean(isBestSeller);
    if (discount !== undefined) updateData.discount = parseFloat(discount);

    const updatedMenuItem = menuItemsDB.update(id, updateData);

    logger.info(`Menu item updated by admin ${req.user.userId}: ${updatedMenuItem.name}`);

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: updatedMenuItem
    });
  } catch (error) {
    logger.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update menu item'
    });
  }
};

/**
 * Delete menu item (Admin only)
 * DELETE /api/admin/menu/:id
 */
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = menuItemsDB.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    menuItemsDB.delete(id);

    logger.info(`Menu item deleted by admin ${req.user.userId}: ${menuItem.name}`);

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    logger.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item'
    });
  }
};

/**
 * Toggle menu item availability (Admin only)
 * PATCH /api/admin/menu/:id/availability
 */
exports.toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = menuItemsDB.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    const updatedMenuItem = menuItemsDB.update(id, {
      isAvailable: !menuItem.isAvailable,
      updatedAt: getCurrentISO()
    });

    logger.info(`Menu item availability toggled by admin ${req.user.userId}: ${updatedMenuItem.name} - ${updatedMenuItem.isAvailable ? 'Available' : 'Unavailable'}`);

    res.json({
      success: true,
      message: `Menu item ${updatedMenuItem.isAvailable ? 'is now available' : 'is now unavailable'}`,
      data: updatedMenuItem
    });
  } catch (error) {
    logger.error('Toggle availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle availability'
    });
  }
};
