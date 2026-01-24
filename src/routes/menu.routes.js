/**
 * Menu Routes
 * Protected routes for browsing menu
 */

const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All menu routes require authentication
router.use(authenticate);

// Protected routes
router.get('/version', menuController.getMenuVersion); // Version check endpoint (lightweight)
router.get('/categories', menuController.getCategories);
router.get('/items', menuController.getMenuItems);
router.get('/items/:id', menuController.getMenuItem);

module.exports = router;
