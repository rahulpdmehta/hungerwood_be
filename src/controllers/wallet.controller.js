/**
 * Wallet Controller
 * Handles wallet-related HTTP requests
 */

const walletService = require('../services/wallet.service');
const referralService = require('../services/referral.service');
const logger = require('../config/logger');
const { transformEntities } = require('../utils/transformers');

class WalletController {
    /**
     * Get wallet balance
     * GET /api/wallet
     */
    async getWalletBalance(req, res) {
        try {
            const userId = req.user.userId;

            const balance = await walletService.getWalletBalance(userId);

            res.json({
                success: true,
                data: {
                    balance,
                    currency: 'INR'
                }
            });
        } catch (error) {
            logger.error('Error in getWalletBalance:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get wallet balance'
            });
        }
    }

    /**
     * Get wallet transaction history
     * GET /api/wallet/transactions
     */
    async getTransactions(req, res) {
        try {
            const userId = req.user.userId;
            const { limit = 50, offset = 0, type } = req.query;

            const result = await walletService.getTransactions(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                type
            });

            // Transform transactions: set id to _id value
            const transformedTransactions = transformEntities(result.transactions || []);

            res.json({
                success: true,
                data: {
                    ...result,
                    transactions: transformedTransactions
                }
            });
        } catch (error) {
            logger.error('Error in getTransactions:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get transactions'
            });
        }
    }

    /**
     * Get referral code
     * GET /api/wallet/referral/code
     */
    async getReferralCode(req, res) {
        try {
            const userId = req.user.userId;

            const result = await referralService.getUserReferralCode(userId);
            const referredUsers = referralService.getReferredUsers(userId);

            res.json({
                success: true,
                data: {
                    ...result,
                    referredUsers
                }
            });
        } catch (error) {
            logger.error('Error in getReferralCode:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get referral code'
            });
        }
    }

    /**
     * Apply referral code
     * POST /api/wallet/referral/apply
     */
    async applyReferralCode(req, res) {
        try {
            const userId = req.user.userId;
            const { referralCode } = req.body;

            if (!referralCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Referral code is required'
                });
            }

            const result = await referralService.applyReferralCode(userId, referralCode);

            res.json({
                success: true,
                message: result.message,
                data: result
            });
        } catch (error) {
            logger.error('Error in applyReferralCode:', error);
            const statusCode = error.message.includes('already applied') ||
                error.message.includes('Invalid') ||
                error.message.includes('Cannot use') ? 400 : 500;

            res.status(statusCode).json({
                success: false,
                message: error.message || 'Failed to apply referral code'
            });
        }
    }

    /**
     * Get wallet summary (balance + referral info)
     * GET /api/wallet/summary
     */
    async getWalletSummary(req, res) {
        try {
            const userId = req.user.userId;

            const balance = await walletService.getWalletBalance(userId);
            const referralInfo = await referralService.getUserReferralCode(userId);
            const referredUsers = await referralService.getReferredUsers(userId);

            res.json({
                success: true,
                data: {
                    wallet: {
                        balance,
                        currency: 'INR'
                    },
                    referral: {
                        code: referralInfo.code,
                        referralCount: referralInfo.referralCount,
                        earnings: referralInfo.earnings,
                        referredUsers
                    }
                }
            });
        } catch (error) {
            logger.error('Error in getWalletSummary:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get wallet summary'
            });
        }
    }
}

module.exports = new WalletController();
