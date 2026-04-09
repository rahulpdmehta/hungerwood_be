/**
 * Order Routes
 * Protected routes for customer orders
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, createOrderSchema } = require('../middlewares/validate.middleware');

// All order routes require authentication
router.use(authenticate);

// Create new order
router.post('/', validate(createOrderSchema), orderController.createOrder);

// Get user's orders
router.get('/my', orderController.getMyOrders);

// Get single order
router.get('/:id', orderController.getOrder);

module.exports = router;
