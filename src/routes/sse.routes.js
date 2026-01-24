/**
 * SSE Routes
 * Server-Sent Events endpoints for real-time updates
 */

const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sse.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/role.middleware');

/**
 * @route   GET /api/orders/:id/stream
 * @desc    Stream real-time order status updates
 * @access  Public (no authentication required for better UX)
 * @note    Order ID validation provides security
 */
router.get('/orders/:id/stream', sseController.streamOrderStatus);

/**
 * @route   GET /api/sse/stats
 * @desc    Get SSE connection statistics
 * @access  Private (Admin only)
 */
router.get('/sse/stats', authenticate, isAdmin, sseController.getSSEStats);

module.exports = router;
