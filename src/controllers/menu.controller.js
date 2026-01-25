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

    // Get all categories for lookup
    const allCategories = await Category.find({ isActive: true });
    const categoryMap = {};
    allCategories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat;
      categoryMap[cat.name.toLowerCase()] = cat;
      categoryMap[cat.slug] = cat;
    });

    // Ensure category is included - handle both ObjectId references and string categories
    items = items.map(item => {
      const itemObj = item.toObject ? item.toObject() : item;
      
      // If category is a populated object with name, use it
      if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category.name) {
        // Already populated, keep it
        return itemObj;
      }
      
      // If category is a string (name or slug), look it up
      if (typeof itemObj.category === 'string') {
        const foundCategory = categoryMap[itemObj.category.toLowerCase()];
        if (foundCategory) {
          itemObj.category = {
            name: foundCategory.name,
            slug: foundCategory.slug,
            order: foundCategory.order || 0
          };
          return itemObj;
        }
      }
      
      // If category is an ObjectId that wasn't populated, try to find it
      if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category._id) {
        const foundCategory = categoryMap[itemObj.category._id.toString()];
        if (foundCategory) {
          itemObj.category = {
            name: foundCategory.name,
            slug: foundCategory.slug,
            order: foundCategory.order || 0
          };
          return itemObj;
        }
      }
      
      // Default fallback
      itemObj.category = { name: 'All', slug: 'all', order: 0 };
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

    const item = await MenuItem.findOne({ $or: [{ _id: id }, { id: id }] }).populate('category', 'name slug order');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    const itemObj = item.toObject ? item.toObject() : item;
    
    // Get all categories for lookup
    const allCategories = await Category.find({ isActive: true });
    const categoryMap = {};
    allCategories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat;
      categoryMap[cat.name.toLowerCase()] = cat;
      categoryMap[cat.slug] = cat;
    });
    
    // Handle category - support both ObjectId references and string categories
    if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category.name) {
      // Already populated, keep it
    } else if (typeof itemObj.category === 'string') {
      // Category is a string, look it up
      const foundCategory = categoryMap[itemObj.category.toLowerCase()];
      if (foundCategory) {
        itemObj.category = {
          name: foundCategory.name,
          slug: foundCategory.slug,
          order: foundCategory.order || 0
        };
      } else {
        itemObj.category = { name: 'All', slug: 'all', order: 0 };
      }
    } else if (itemObj.category && typeof itemObj.category === 'object' && itemObj.category._id) {
      // ObjectId that wasn't populated
      const foundCategory = categoryMap[itemObj.category._id.toString()];
      if (foundCategory) {
        itemObj.category = {
          name: foundCategory.name,
          slug: foundCategory.slug,
          order: foundCategory.order || 0
        };
      } else {
        itemObj.category = { name: 'All', slug: 'all', order: 0 };
      }
    } else {
      itemObj.category = { name: 'All', slug: 'all', order: 0 };
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

    const menuItem = await MenuItem.findById(id);

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

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
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

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    await MenuItem.findByIdAndDelete(id);

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
