/**
 * Wallet Service
 * Handles wallet balance management and transactions
 */

const User = require('../models/User.model');
const WalletTransaction = require('../models/WalletTransaction.model');
const { TRANSACTION_TYPES, TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const logger = require('../config/logger');

class WalletService {
    /**
     * Get user's current wallet balance
     */
    async getWalletBalance(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            return user.walletBalance || 0;
        } catch (error) {
            logger.error('Error getting wallet balance:', error);
            throw error;
        }
    }

    /**
     * Credit amount to user's wallet
     * @param {string} userId - User ID
     * @param {number} amount - Amount to credit
     * @param {string} reason - Reason for credit (from TRANSACTION_REASONS)
     * @param {object} options - Additional options (orderId, description, metadata)
     */
    async creditWallet(userId, amount, reason, options = {}) {
        try {
            if (amount <= 0) {
                throw new Error('Credit amount must be positive');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Calculate new balance
            const currentBalance = user.walletBalance || 0;
            const newBalance = currentBalance + amount;

            // Update user's wallet balance
            user.walletBalance = newBalance;
            await user.save();

            // Create transaction record
            const transaction = new WalletTransaction({
                user: userId,
                type: TRANSACTION_TYPES.CREDIT,
                amount,
                reason,
                orderId: options.orderId || null,
                referralId: options.referralId || null,
                balanceAfter: newBalance,
                description: options.description || `Wallet credited: ${reason}`,
                metadata: options.metadata || {}
            });
            await transaction.save();

            logger.info(`Wallet credited: User ${userId}, Amount: ₹${amount}, Reason: ${reason}`);

            return {
                success: true,
                transaction,
                previousBalance: currentBalance,
                newBalance,
                user: updatedUser
            };
        } catch (error) {
            logger.error('Error crediting wallet:', error);
            throw error;
        }
    }

    /**
     * Debit amount from user's wallet
     * @param {string} userId - User ID
     * @param {number} amount - Amount to debit
     * @param {string} reason - Reason for debit (from TRANSACTION_REASONS)
     * @param {object} options - Additional options (orderId, description, metadata)
     */
    async debitWallet(userId, amount, reason, options = {}) {
        try {
            if (amount <= 0) {
                throw new Error('Debit amount must be positive');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const currentBalance = user.walletBalance || 0;

            // Check if sufficient balance
            if (currentBalance < amount) {
                throw new Error('Insufficient wallet balance');
            }

            // Calculate new balance
            const newBalance = currentBalance - amount;

            // Update user's wallet balance
            user.walletBalance = newBalance;
            await user.save();

            // Create transaction record
            const transaction = new WalletTransaction({
                user: userId,
                type: TRANSACTION_TYPES.DEBIT,
                amount,
                reason,
                orderId: options.orderId || null,
                balanceAfter: newBalance,
                description: options.description || `Wallet debited: ${reason}`,
                metadata: options.metadata || {}
            });
            await transaction.save();

            logger.info(`Wallet debited: User ${userId}, Amount: ₹${amount}, Reason: ${reason}`);

            return {
                success: true,
                transaction,
                previousBalance: currentBalance,
                newBalance,
                user
            };
        } catch (error) {
            logger.error('Error debiting wallet:', error);
            throw error;
        }
    }

    /**
     * Get wallet transaction history
     */
    async getTransactions(userId, options = {}) {
        try {
            const { limit = 50, offset = 0, type = null } = options;
            
            const query = { user: userId };
            if (type) query.type = type;
            
            const transactions = await WalletTransaction.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset);
            
            const balance = await this.getWalletBalance(userId);

            return {
                balance,
                transactions,
                totalTransactions: transactions.length
            };
        } catch (error) {
            logger.error('Error getting wallet transactions:', error);
            throw error;
        }
    }

    /**
     * Calculate maximum wallet amount that can be used
     */
    calculateMaxWalletUsage(orderTotal, maxPercentage = 50) {
        const maxAmount = (orderTotal * maxPercentage) / 100;
        return Math.floor(maxAmount);
    }

    /**
     * Validate wallet usage for an order
     */
    async validateWalletUsage(userId, walletAmount, orderTotal, maxPercentage = 50) {
        try {
            // Check if wallet amount is valid
            if (walletAmount < 0) {
                throw new Error('Wallet amount cannot be negative');
            }

            if (walletAmount === 0) {
                return { valid: true, message: 'No wallet amount used' };
            }

            // Get user's current balance
            const currentBalance = await this.getWalletBalance(userId);

            // Check if user has sufficient balance
            if (walletAmount > currentBalance) {
                throw new Error(`Insufficient wallet balance. Available: ₹${currentBalance}`);
            }

            // Check if wallet usage doesn't exceed maximum percentage
            const maxAllowed = this.calculateMaxWalletUsage(orderTotal, maxPercentage);
            if (walletAmount > maxAllowed) {
                throw new Error(`Wallet usage cannot exceed ${maxPercentage}% of order total (₹${maxAllowed})`);
            }

            // Check if wallet amount doesn't exceed order total
            if (walletAmount > orderTotal) {
                throw new Error('Wallet amount cannot exceed order total');
            }

            return {
                valid: true,
                message: 'Wallet usage validated successfully',
                currentBalance,
                maxAllowed
            };
        } catch (error) {
            logger.error('Error validating wallet usage:', error);
            throw error;
        }
    }

    /**
     * Refund amount to wallet (for order cancellation/refund)
     */
    async refundToWallet(userId, amount, orderId, reason = 'Order refund') {
        try {
            return await this.creditWallet(
                userId,
                amount,
                TRANSACTION_REASONS.ORDER_REFUND,
                {
                    orderId,
                    description: reason,
                    metadata: { refund: true }
                }
            );
        } catch (error) {
            logger.error('Error processing wallet refund:', error);
            throw error;
        }
    }

    /**
     * Get wallet statistics for admin
     */
    async getWalletStats() {
        try {
            const [totalCredits, totalDebits, totalTransactions, users] = await Promise.all([
                WalletTransaction.aggregate([
                    { $match: { type: TRANSACTION_TYPES.CREDIT } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                WalletTransaction.aggregate([
                    { $match: { type: TRANSACTION_TYPES.DEBIT } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                WalletTransaction.countDocuments(),
                User.find({}, 'walletBalance')
            ]);

            const credits = totalCredits[0]?.total || 0;
            const debits = totalDebits[0]?.total || 0;
            const totalWalletBalance = users.reduce((sum, user) => {
                return sum + (user.walletBalance || 0);
            }, 0);

            return {
                totalTransactions,
                totalCredits: credits,
                totalDebits: debits,
                netAmount: credits - debits,
                totalWalletBalance,
                usersWithBalance: users.filter(u => (u.walletBalance || 0) > 0).length
            };
        } catch (error) {
            logger.error('Error getting wallet stats:', error);
            throw error;
        }
    }
}

module.exports = new WalletService();
