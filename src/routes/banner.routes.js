/**
 * Banner Routes
 * API endpoints for managing promotional banners
 */

const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/role.middleware');

// Public routes (for customers)
router.get('/active', bannerController.getActiveBanners);
router.get('/all', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);

// Admin routes (protected)
router.post('/', authenticate, isAdmin, bannerController.createBanner);
router.put('/:id', authenticate, isAdmin, bannerController.updateBanner);
router.patch('/:id/toggle', authenticate, isAdmin, bannerController.toggleBannerStatus);
router.delete('/:id', authenticate, isAdmin, bannerController.deleteBanner);

module.exports = router;
