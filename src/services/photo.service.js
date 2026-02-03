/**
 * Photo Service
 * Business logic for photo library management
 */

const photoModel = require('../models/Photo.model');
const logger = require('../config/logger');

/**
 * Get all active photos for public display
 */
const getActivePhotos = async () => {
  try {
    return await photoModel.getAllActive();
  } catch (error) {
    logger.error('Error fetching active photos:', error);
    throw error;
  }
};

/**
 * Get all photos (admin)
 */
const getAllPhotos = async (includeInactive = false) => {
  try {
    return await photoModel.getAll(includeInactive);
  } catch (error) {
    logger.error('Error fetching all photos:', error);
    throw error;
  }
};

/**
 * Get photo by ID
 */
const getPhotoById = async (id) => {
  try {
    const photo = await photoModel.getById(id);
    if (!photo) {
      throw new Error('Photo not found');
    }
    return photo;
  } catch (error) {
    logger.error('Error fetching photo by ID:', error);
    throw error;
  }
};

/**
 * Create a new photo
 */
const createPhoto = async (photoData) => {
  try {
    // If setting as featured, unfeature other photos
    if (photoData.isFeatured) {
      await photoModel.Photo.updateMany(
        { isFeatured: true },
        { isFeatured: false }
      );
    }
    return await photoModel.create(photoData);
  } catch (error) {
    logger.error('Error creating photo:', error);
    throw error;
  }
};

/**
 * Update a photo
 */
const updatePhoto = async (id, photoData) => {
  try {
    // If setting as featured, unfeature other photos
    if (photoData.isFeatured) {
      await photoModel.Photo.updateMany(
        { isFeatured: true, _id: { $ne: id } },
        { isFeatured: false }
      );
    }
    return await photoModel.update(id, photoData);
  } catch (error) {
    logger.error('Error updating photo:', error);
    throw error;
  }
};

/**
 * Delete a photo
 */
const deletePhoto = async (id) => {
  try {
    const deleted = await photoModel.delete(id);
    if (!deleted) {
      throw new Error('Photo not found');
    }
    return deleted;
  } catch (error) {
    logger.error('Error deleting photo:', error);
    throw error;
  }
};

module.exports = {
  getActivePhotos,
  getAllPhotos,
  getPhotoById,
  createPhoto,
  updatePhoto,
  deletePhoto,
};
