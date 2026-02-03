/**
 * Photo Routes
 * Public routes for photo library
 */

const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photo.controller');

// Get all active photos (public)
router.get('/', photoController.getActivePhotos);

module.exports = router;
