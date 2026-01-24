/**
 * Wallet Routes
 * Handles wallet and referral related endpoints
 */

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/wallet
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/', walletController.getWalletBalance);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get wallet transaction history
 * @access  Private
 */
router.get('/transactions', walletController.getTransactions);

/**
 * @route   GET /api/wallet/summary
 * @desc    Get wallet summary (balance + referral info)
 * @access  Private
 */
router.get('/summary', walletController.getWalletSummary);

/**
 * @route   GET /api/wallet/referral/code
 * @desc    Get user's referral code
 * @access  Private
 */
router.get('/referral/code', walletController.getReferralCode);

/**
 * @route   POST /api/wallet/referral/apply
 * @desc    Apply a referral code
 * @access  Private
 */
router.post('/referral/apply', walletController.applyReferralCode);

module.exports = router;
