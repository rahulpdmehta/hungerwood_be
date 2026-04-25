/**
 * Banner Routes
 * API endpoints for managing promotional banners
 */

const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');

// Restaurant admins manage food banners; grocery admins manage grocery banners.
// Section-level enforcement happens inside the controller.
const canManageBanners = hasRole(ROLES.RESTAURANT_ADMIN, ROLES.GROCERY_ADMIN);

// Public routes (for customers)
router.get('/active', bannerController.getActiveBanners);
router.get('/all', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);

// Admin routes (protected)
router.post('/', authenticate, canManageBanners, bannerController.createBanner);
router.put('/:id', authenticate, canManageBanners, bannerController.updateBanner);
router.patch('/:id/toggle', authenticate, canManageBanners, bannerController.toggleBannerStatus);
router.delete('/:id', authenticate, canManageBanners, bannerController.deleteBanner);

module.exports = router;
