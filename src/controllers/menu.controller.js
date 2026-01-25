/**
 * Menu Controller
 * Handles menu-related operations using MongoDB
 */

const Category = require('../models/Category.model');
const MenuItem = require('../models/MenuItem.model');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

/**
 * Get all categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Get categories error:', error);
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

    // Build query
    const query = { isAvailable: true };
    
    if (category && category !== 'All') {
      // Try to find category by name or slug first
      const categoryDoc = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${category}$`, 'i') } },
          { slug: { $regex: new RegExp(`^${category}$`, 'i') } }
        ]
      });
      
      if (categoryDoc) {
        // Category found - query by ObjectId or string match
        query.$or = [
          { category: categoryDoc._id },
          { category: categoryDoc.name },
          { category: categoryDoc.slug }
        ];
      } else {
        // Category not found in Category collection, try direct string match
        query.$or = [
          { category: { $regex: new RegExp(`^${category}$`, 'i') } }
        ];
      }
    }
    
    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    let items = await MenuItem.find(query).populate({
      path: 'category',
      select: 'name slug order',
      model: 'Category'
    }).sort({ createdAt: -1 });

    // Convert category to string format for API response
    items = items.map(item => {
      const itemObj = item.toObject ? item.toObject() : item;
      
      // If category is a populated object, extract the name as string
      if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category.name) {
        itemObj.category = itemObj.category.name;
      }
      // If category is already a string, keep it
      // If category is an ObjectId that wasn't populated, set to empty string (shouldn't happen)
      else if (itemObj.category && typeof itemObj.category === 'object' && !itemObj.category.name) {
        itemObj.category = '';
      }
      // If category is null/undefined, set empty string
      else if (!itemObj.category) {
        itemObj.category = '';
      }
      
      return itemObj;
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

    // Try to find by string id field first (since items use string IDs like "item9")
    // Then try by MongoDB _id if that fails
    let item = await MenuItem.findOne({ id: id });
    if (!item) {
      // Only try findById if the id looks like a valid ObjectId (24 hex characters)
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        item = await MenuItem.findById(id);
      }
    }
    if (item) {
      await item.populate('category', 'name slug order');
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    const itemObj = item.toObject ? item.toObject() : item;
    
    // Convert category to string format for API response
    // If category is a populated object, extract the name as string
    if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category.name) {
      itemObj.category = itemObj.category.name;
    }
    // If category is already a string, keep it
    // If category is an ObjectId that wasn't populated, set to empty string
    else if (itemObj.category && typeof itemObj.category === 'object' && !itemObj.category.name) {
      itemObj.category = '';
    }
    // If category is null/undefined, set empty string
    else if (!itemObj.category) {
      itemObj.category = '';
    }

    res.json({
      success: true,
      data: itemObj
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
    const [items, categories] = await Promise.all([
      MenuItem.find({ isAvailable: true }),
      Category.find({ isActive: true })
    ]);

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
    const categoryExists = await Category.findById(category);
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
    const menuItem = new MenuItem({
      name: name.trim(),
      description: description?.trim() || '',
      price: parseFloat(price),
      category,
      image: finalImageUrl,
      isVeg: Boolean(isVeg),
      isAvailable: Boolean(isAvailable),
      'tags.isBestseller': Boolean(isBestSeller),
      discount: parseFloat(discount) || 0
    });
    
    await menuItem.save();
    await menuItem.populate('category', 'name slug');

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

    // Try to find by string id field first (since items use string IDs like "item9")
    // Then try by MongoDB _id if that fails
    let menuItem = await MenuItem.findOne({ id: id });
    if (!menuItem) {
      // Only try findById if the id looks like a valid ObjectId (24 hex characters)
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        menuItem = await MenuItem.findById(id);
      }
    }

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Validate category if provided
    if (category) {
      const categoryExists = await Category.findById(category);
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
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (category !== undefined) updateData.category = category;
    if (finalImageUrl !== menuItem.image) updateData.image = finalImageUrl;
    if (isVeg !== undefined) updateData.isVeg = Boolean(isVeg);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (isBestSeller !== undefined) updateData['tags.isBestseller'] = Boolean(isBestSeller);
    if (discount !== undefined) updateData.discount = parseFloat(discount);

    // Use the MongoDB _id for the update
    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      menuItem._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');

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

    // Try to find by string id field first (since items use string IDs like "item9")
    // Then try by MongoDB _id if that fails
    let menuItem = await MenuItem.findOne({ id: id });
    if (!menuItem) {
      // Only try findById if the id looks like a valid ObjectId (24 hex characters)
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        menuItem = await MenuItem.findById(id);
      }
    }

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Delete using the MongoDB _id
    await MenuItem.findByIdAndDelete(menuItem._id);

    logger.info(`Menu item deleted by admin ${req.user.userId}: ${menuItem.name}`);

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    logger.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete menu item'
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
