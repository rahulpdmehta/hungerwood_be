/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, sendOTPSchema, verifyOTPSchema } = require('../middlewares/validate.middleware');

// Public routes
router.post('/send-otp', validate(sendOTPSchema), authController.sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyOTP);

// Protected routes
router.get('/me', authenticate, authController.getProfile);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/complete-profile', authenticate, authController.completeProfile);

module.exports = router;
