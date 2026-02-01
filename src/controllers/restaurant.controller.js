/**
 * Restaurant Controller
 * Handles public restaurant status operations
 */

const Restaurant = require('../models/Restaurant.model');
const { successResponse, errorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Get restaurant status (Public)
 * GET /api/restaurant/status
 */
exports.getRestaurantStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.getRestaurant();
    
    const { transformEntity } = require('../utils/transformers');
    const transformedRestaurant = transformEntity(restaurant);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Restaurant status fetched successfully',
      {
        isOpen: transformedRestaurant.isOpen,
        closingMessage: transformedRestaurant.closingMessage || ''
      }
    );
  } catch (error) {
    logger.error('Error fetching restaurant status:', error);
    return errorResponse(
      res,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'Failed to fetch restaurant status'
    );
  }
};
