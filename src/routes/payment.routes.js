/**
 * Payment Routes
 * Handles payment-related endpoints
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All payment routes require authentication
router.use(authenticate);

// Create Razorpay order
router.post('/create-order', paymentController.createRazorpayOrder);

// Verify payment and create order
router.post('/verify-payment', paymentController.verifyPayment);

module.exports = router;
