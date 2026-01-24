/**
 * Category Controller
 * Handles category CRUD operations for admin
 */

const JsonDB = require('../utils/jsonDB');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const categoriesDB = new JsonDB('categories.json');
const menuItemsDB = new JsonDB('menuItems.json');

/**
 * Get all categories
 * GET /api/admin/categories
 */
exports.getAllCategories = async (req, res) => {
  try {
    const categories = categoriesDB.findAll();

    // Count menu items for each category
    const categoriesWithCount = categories.map(category => {
      const itemCount = menuItemsDB.findAll().filter(
        item => item.category === category._id
      ).length;

      return {
        ...category,
        itemCount
      };
    });

    res.json({
      success: true,
      message: 'Categories fetched successfully',
      data: categoriesWithCount
    });
  } catch (error) {
    logger.error('Get all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

/**
 * Get category by ID
 * GET /api/admin/categories/:id
 */
exports.getCategoryById = async (req, res) => {
  try {
    const category = categoriesDB.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Count menu items
    const itemCount = menuItemsDB.findAll().filter(
      item => item.category === category._id
    ).length;

    res.json({
      success: true,
      message: 'Category fetched successfully',
      data: {
        ...category,
        itemCount
      }
    });
  } catch (error) {
    logger.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category'
    });
  }
};

/**
 * Create new category
 * POST /api/admin/categories
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, imageUrl, isActive = true } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Check if category name already exists
    const existingCategory = categoriesDB.findAll().find(
      cat => cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // Handle file upload or URL
    let finalImageUrl = imageUrl || '';
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    }

    // Create category
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || '',
      image: finalImageUrl,
      isActive: Boolean(isActive),
      createdAt: getCurrentISO(),
      updatedAt: getCurrentISO()
    };

    const category = categoriesDB.create(categoryData);

    logger.info(`Category created by admin ${req.user.userId}: ${category.name}`);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
};

/**
 * Update category
 * PUT /api/admin/categories/:id
 */
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, imageUrl, isActive } = req.body;

    const category = categoriesDB.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = categoriesDB.findAll().find(
        cat => cat.name.toLowerCase() === name.toLowerCase() && cat._id !== req.params.id
      );

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Handle file upload or URL
    let finalImageUrl = category.image;
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    } else if (imageUrl !== undefined) {
      finalImageUrl = imageUrl;
    }

    // Update category
    const updateData = {
      updatedAt: getCurrentISO()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (finalImageUrl !== category.image) updateData.image = finalImageUrl;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updatedCategory = categoriesDB.update(req.params.id, updateData);

    logger.info(`Category updated by admin ${req.user.userId}: ${updatedCategory.name}`);

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
    });
  }
};

/**
 * Delete category
 * DELETE /api/admin/categories/:id
 */
exports.deleteCategory = async (req, res) => {
  try {
    const category = categoriesDB.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has menu items
    const hasMenuItems = menuItemsDB.findAll().some(
      item => item.category === req.params.id
    );

    if (hasMenuItems) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing menu items. Please remove or reassign menu items first.'
      });
    }

    categoriesDB.delete(req.params.id);

    logger.info(`Category deleted by admin ${req.user.userId}: ${category.name}`);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
};

/**
 * Toggle category status
 * PATCH /api/admin/categories/:id/toggle
 */
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const category = categoriesDB.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const updatedCategory = categoriesDB.update(req.params.id, {
      isActive: !category.isActive,
      updatedAt: getCurrentISO()
    });

    logger.info(`Category status toggled by admin ${req.user.userId}: ${updatedCategory.name} - ${updatedCategory.isActive ? 'Active' : 'Inactive'}`);

    res.json({
      success: true,
      message: `Category ${updatedCategory.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedCategory
    });
  } catch (error) {
    logger.error('Toggle category status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle category status'
    });
  }
};
