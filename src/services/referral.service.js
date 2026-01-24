/**
 * Referral Service
 * Handles referral code generation and reward processing
 */

const JsonDB = require('../utils/jsonDB');
const walletService = require('./wallet.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const { WalletTransactionModel } = require('../models/WalletTransaction.model');
const config = require('../config/env');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

const usersDB = new JsonDB('users.json');
const walletTransactionDB = new WalletTransactionModel();

class ReferralService {
    /**
     * Generate a unique referral code for a user
     */
    generateReferralCode(userName, userId) {
        // Create code from name + random string
        const namePrefix = userName
            .substring(0, 4)
            .toUpperCase()
            .replace(/[^A-Z]/g, 'X');

        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `${namePrefix}${randomSuffix}`;

        // Check if code already exists, if so, regenerate
        const existingUser = usersDB.findAll().find(u => u.referralCode === code);
        if (existingUser) {
            return this.generateReferralCode(userName, userId);
        }

        return code;
    }

    /**
     * Get or create referral code for user
     */
    async getUserReferralCode(userId) {
        try {
            const user = usersDB.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // If user already has a referral code, return it
            if (user.referralCode) {
                return {
                    code: user.referralCode,
                    referralCount: this.getReferralCount(userId),
                    earnings: this.getReferralEarnings(userId)
                };
            }

            // Generate new referral code
            const referralCode = this.generateReferralCode(user.name || 'USER', userId);

            // Update user with referral code
            const updatedUser = usersDB.update(userId, {
                referralCode,
                referralCount: 0,
                referralEarnings: 0
            });

            logger.info(`Generated referral code for user ${userId}: ${referralCode}`);

            return {
                code: referralCode,
                referralCount: 0,
                earnings: 0
            };
        } catch (error) {
            logger.error('Error getting referral code:', error);
            throw error;
        }
    }

    /**
     * Apply a referral code for a new user
     */
    async applyReferralCode(newUserId, referralCode) {
        try {
            const newUser = usersDB.findById(newUserId);
            if (!newUser) {
                throw new Error('User not found');
            }

            // Check if user already used a referral code
            if (newUser.referredBy) {
                throw new Error('Referral code already applied');
            }

            // Validate referral code format
            if (!referralCode || referralCode.length < 5) {
                throw new Error('Invalid referral code format');
            }

            // Find referrer by code
            const referrer = usersDB.findAll().find(u => u.referralCode === referralCode.toUpperCase());
            if (!referrer) {
                throw new Error('Invalid referral code');
            }

            // Prevent self-referral
            if (referrer._id === newUserId) {
                throw new Error('Cannot use your own referral code');
            }

            // Update new user with referrer information
            usersDB.update(newUserId, {
                referredBy: referrer._id,
                hasUsedReferral: true,
                referralAppliedAt: getCurrentISO()
            });

            logger.info(`Referral code ${referralCode} applied: New user ${newUserId} referred by ${referrer._id}`);

            return {
                success: true,
                message: 'Referral code applied successfully',
                referrerName: referrer.name,
                bonusInfo: {
                    newUserBonus: config.referralBonusNewUser,
                    referrerBonus: config.referralBonusReferrer,
                    note: 'Bonuses will be credited after your first successful order'
                }
            };
        } catch (error) {
            logger.error('Error applying referral code:', error);
            throw error;
        }
    }

    /**
     * Process referral rewards after first successful order
     */
    async processReferralReward(order) {
        try {
            const newUser = usersDB.findById(order.user);
            if (!newUser) {
                logger.error('User not found for order:', order._id);
                return;
            }

            // Check if user was referred
            if (!newUser.referredBy || !newUser.hasUsedReferral) {
                logger.info('No referral to process for this order');
                return;
            }

            // Check if rewards already given
            const hasNewUserReward = walletTransactionDB.hasReferralReward(
                newUser._id,
                TRANSACTION_REASONS.REFERRAL_BONUS_NEW_USER
            );

            if (hasNewUserReward) {
                logger.info('Referral rewards already processed for this user');
                return;
            }

            // Check minimum order amount
            if (order.totalAmount < config.minOrderAmountForReferral) {
                logger.info(`Order amount ₹${order.totalAmount} is below minimum ₹${config.minOrderAmountForReferral} for referral`);
                return;
            }

            const referrer = usersDB.findById(newUser.referredBy);
            if (!referrer) {
                logger.error('Referrer not found:', newUser.referredBy);
                return;
            }

            // Credit bonus to new user
            await walletService.creditWallet(
                newUser._id,
                config.referralBonusNewUser,
                TRANSACTION_REASONS.REFERRAL_BONUS_NEW_USER,
                {
                    orderId: order._id,
                    referralId: referrer._id,
                    description: `Referral bonus for using code ${referrer.referralCode}`,
                    metadata: {
                        referrerCode: referrer.referralCode,
                        firstOrderAmount: order.totalAmount
                    }
                }
            );

            // Credit bonus to referrer
            await walletService.creditWallet(
                referrer._id,
                config.referralBonusReferrer,
                TRANSACTION_REASONS.REFERRAL_BONUS_REFERRER,
                {
                    orderId: order._id,
                    referralId: newUser._id,
                    description: `Referral bonus for referring ${newUser.name || 'user'}`,
                    metadata: {
                        referredUserName: newUser.name,
                        referredUserPhone: newUser.phone,
                        firstOrderAmount: order.totalAmount
                    }
                }
            );

            // Update referrer's referral stats
            const currentCount = referrer.referralCount || 0;
            const currentEarnings = referrer.referralEarnings || 0;
            usersDB.update(referrer._id, {
                referralCount: currentCount + 1,
                referralEarnings: currentEarnings + config.referralBonusReferrer
            });

            // Mark referral as rewarded
            usersDB.update(newUser._id, {
                referralRewarded: true,
                referralRewardedAt: getCurrentISO()
            });

            logger.info(`Referral rewards processed successfully:`, {
                newUser: newUser._id,
                referrer: referrer._id,
                newUserBonus: config.referralBonusNewUser,
                referrerBonus: config.referralBonusReferrer
            });

            return {
                success: true,
                newUserBonus: config.referralBonusNewUser,
                referrerBonus: config.referralBonusReferrer
            };
        } catch (error) {
            logger.error('Error processing referral reward:', error);
            throw error;
        }
    }

    /**
     * Get count of successful referrals for a user
     */
    getReferralCount(userId) {
        const user = usersDB.findById(userId);
        return user?.referralCount || 0;
    }

    /**
     * Get total earnings from referrals
     */
    getReferralEarnings(userId) {
        const user = usersDB.findById(userId);
        return user?.referralEarnings || 0;
    }

    /**
     * Get list of users referred by a user
     */
    getReferredUsers(userId) {
        const referredUsers = usersDB.findAll()
            .filter(u => u.referredBy === userId)
            .map(u => ({
                id: u._id,
                name: u.name,
                phone: u.phone,
                referralAppliedAt: u.referralAppliedAt,
                referralRewarded: u.referralRewarded || false,
                referralRewardedAt: u.referralRewardedAt
            }));

        return referredUsers;
    }

    /**
     * Get referral statistics for admin
     */
    async getReferralStats() {
        try {
            const users = usersDB.findAll();

            const totalReferrals = users.filter(u => u.referredBy).length;
            const rewardedReferrals = users.filter(u => u.referralRewarded).length;
            const pendingReferrals = totalReferrals - rewardedReferrals;

            const totalReferralEarnings = users.reduce((sum, u) => {
                return sum + (u.referralEarnings || 0);
            }, 0);

            const topReferrers = users
                .filter(u => (u.referralCount || 0) > 0)
                .sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0))
                .slice(0, 10)
                .map(u => ({
                    id: u._id,
                    name: u.name,
                    phone: u.phone,
                    referralCode: u.referralCode,
                    referralCount: u.referralCount || 0,
                    earnings: u.referralEarnings || 0
                }));

            return {
                totalReferrals,
                rewardedReferrals,
                pendingReferrals,
                totalReferralEarnings,
                averageReferralsPerUser: totalReferrals / (users.length || 1),
                topReferrers
            };
        } catch (error) {
            logger.error('Error getting referral stats:', error);
            throw error;
        }
    }
}

module.exports = new ReferralService();
