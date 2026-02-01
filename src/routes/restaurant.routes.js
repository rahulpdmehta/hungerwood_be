/**
 * Restaurant Routes
 * Public routes for restaurant status
 */

const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurant.controller');

// Public routes (no authentication required)
router.get('/status', restaurantController.getRestaurantStatus);

module.exports = router;
