/**
 * Photo Controller
 * Handles HTTP requests for photo library management
 */

const photoService = require('../services/photo.service');
const logger = require('../config/logger');
const { transformEntity, transformEntities } = require('../utils/transformers');
const { successResponse, errorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');

// Get all active photos (public)
const getActivePhotos = async (req, res, next) => {
  try {
    const photos = await photoService.getActivePhotos();
    const transformedPhotos = transformEntities(photos);
    
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Photos fetched successfully',
      transformedPhotos
    );
  } catch (error) {
    logger.error('Error fetching active photos:', error);
    next(error);
  }
};

// Get all photos (admin)
const getAllPhotos = async (req, res, next) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const photos = await photoService.getAllPhotos(includeInactive === 'true');
    const transformedPhotos = transformEntities(photos);
    
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Photos fetched successfully',
      transformedPhotos
    );
  } catch (error) {
    logger.error('Error fetching all photos:', error);
    next(error);
  }
};

// Get photo by ID
const getPhotoById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const photo = await photoService.getPhotoById(id);
    const transformedPhoto = transformEntity(photo);
    
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Photo fetched successfully',
      transformedPhoto
    );
  } catch (error) {
    logger.error('Error fetching photo by ID:', error);
    next(error);
  }
};

// Create a new photo
const createPhoto = async (req, res, next) => {
  try {
    const photoData = {
      title: req.body.title,
      category: req.body.category,
      url: req.body.url,
      isFeatured: req.body.isFeatured || false,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      displayOrder: req.body.displayOrder || 0,
      description: req.body.description || ''
    };

    const photo = await photoService.createPhoto(photoData);
    const transformedPhoto = transformEntity(photo);
    
    return successResponse(
      res,
      HTTP_STATUS.CREATED,
      'Photo created successfully',
      transformedPhoto
    );
  } catch (error) {
    logger.error('Error creating photo:', error);
    next(error);
  }
};

// Update a photo
const updatePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const photoData = {
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.category !== undefined && { category: req.body.category }),
      ...(req.body.url !== undefined && { url: req.body.url }),
      ...(req.body.isFeatured !== undefined && { isFeatured: req.body.isFeatured }),
      ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
      ...(req.body.displayOrder !== undefined && { displayOrder: req.body.displayOrder }),
      ...(req.body.description !== undefined && { description: req.body.description })
    };

    const photo = await photoService.updatePhoto(id, photoData);
    const transformedPhoto = transformEntity(photo);
    
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Photo updated successfully',
      transformedPhoto
    );
  } catch (error) {
    logger.error('Error updating photo:', error);
    next(error);
  }
};

// Delete a photo
const deletePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    await photoService.deletePhoto(id);
    
    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Photo deleted successfully'
    );
  } catch (error) {
    logger.error('Error deleting photo:', error);
    next(error);
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
