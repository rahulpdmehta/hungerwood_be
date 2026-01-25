/**
 * Referral Service
 * Handles referral code generation and reward processing
 */

const User = require('../models/User.model');
const Order = require('../models/Order.model');
const { WalletTransaction, TRANSACTION_REASONS, TRANSACTION_TYPES } = require('../models/WalletTransaction.model');
const walletService = require('./wallet.service');
const config = require('../config/env');
const logger = require('../config/logger');
const { getCurrentISO } = require('../utils/dateFormatter');

class ReferralService {
    /**
     * Generate a unique referral code for a user
     */
    async generateReferralCode(userName, userId) {
        // Create code from name + random string
        const namePrefix = userName
            .substring(0, 4)
            .toUpperCase()
            .replace(/[^A-Z]/g, 'X');

        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `${namePrefix}${randomSuffix}`;

        // Check if code already exists, if so, regenerate
        const existingUser = await User.findOne({ referralCode: code });
        if (existingUser) {
            return await this.generateReferralCode(userName, userId);
        }

        return code;
    }

    /**
     * Get or create referral code for user
     */
    async getUserReferralCode(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // If user already has a referral code, return it
            if (user.referralCode) {
                return {
                    code: user.referralCode,
                    referralCount: await this.getReferralCount(userId),
                    earnings: await this.getReferralEarnings(userId)
                };
            }

            // Generate new referral code
            const referralCode = await this.generateReferralCode(user.name || 'USER', userId);

            // Update user with referral code
            user.referralCode = referralCode;
            user.referralCount = 0;
            user.referralEarnings = 0;
            await user.save();

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
            const newUser = await User.findById(newUserId);
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
            const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
            if (!referrer) {
                throw new Error('Invalid referral code');
            }

            // Prevent self-referral
            if (referrer._id.toString() === newUserId) {
                throw new Error('Cannot use your own referral code');
            }

            // Update new user with referrer information
            newUser.referredBy = referrer._id;
            newUser.hasUsedReferral = true;
            newUser.referralAppliedAt = getCurrentISO();
            await newUser.save();

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
            // Handle both ObjectId and populated user field
            const userId = order.user?._id ? order.user._id : order.user;
            
            if (!userId) {
                logger.error('Order user ID not found for order:', order._id || order.orderId);
                return;
            }

            const newUser = await User.findById(userId);
            if (!newUser) {
                logger.error('User not found for order:', order._id || order.orderId, 'userId:', userId);
                return;
            }

            logger.info(`Processing referral reward for order ${order.orderId || order._id}, user: ${newUser.phone}, referredBy: ${newUser.referredBy}, hasUsedReferral: ${newUser.hasUsedReferral}`);

            // Check if user was referred
            if (!newUser.referredBy || !newUser.hasUsedReferral) {
                logger.info(`No referral to process - referredBy: ${newUser.referredBy}, hasUsedReferral: ${newUser.hasUsedReferral}`);
                return;
            }

            // Check if rewards already given (for this user's first order only)
            const hasNewUserReward = await WalletTransaction.exists({
                user: newUser._id,
                reason: TRANSACTION_REASONS.REFERRAL_BONUS_NEW_USER,
                type: TRANSACTION_TYPES.CREDIT
            });

            if (hasNewUserReward) {
                logger.info('Referral rewards already processed for this user (first order bonus already given)');
                return;
            }

            // Verify this is the user's first order (count orders before this one)
            const previousOrderCount = await Order.countDocuments({
                user: newUser._id,
                _id: { $ne: order._id }, // Exclude current order
                status: { $nin: ['CANCELLED'] } // Don't count cancelled orders
            });

            if (previousOrderCount > 0) {
                logger.info(`User has ${previousOrderCount} previous order(s). Referral rewards only apply to first order.`);
                return;
            }

            // Check minimum order amount
            if (order.totalAmount < config.minOrderAmountForReferral) {
                logger.info(`Order amount ₹${order.totalAmount} is below minimum ₹${config.minOrderAmountForReferral} for referral`);
                return;
            }

            const referrer = await User.findById(newUser.referredBy);
            if (!referrer) {
                logger.error('Referrer not found:', newUser.referredBy);
                return;
            }

            logger.info(`Crediting referral bonuses - New User: ₹${config.referralBonusNewUser}, Referrer: ₹${config.referralBonusReferrer}`);

            // Credit bonus to new user
            try {
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
                logger.info(`✅ Successfully credited ₹${config.referralBonusNewUser} to new user ${newUser._id}`);
            } catch (creditError) {
                logger.error(`❌ Failed to credit new user wallet:`, creditError);
                throw creditError; // Re-throw to prevent referrer from getting bonus if new user fails
            }

            // Credit bonus to referrer
            try {
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
                logger.info(`✅ Successfully credited ₹${config.referralBonusReferrer} to referrer ${referrer._id}`);
            } catch (creditError) {
                logger.error(`❌ Failed to credit referrer wallet:`, creditError);
                throw creditError;
            }

            // Update referrer's referral stats
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            referrer.referralEarnings = (referrer.referralEarnings || 0) + config.referralBonusReferrer;
            await referrer.save();

            // Mark referral as rewarded
            newUser.referralRewarded = true;
            newUser.referralRewardedAt = getCurrentISO();
            await newUser.save();

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
    async getReferralCount(userId) {
        const user = await User.findById(userId);
        return user?.referralCount || 0;
    }

    /**
     * Get total earnings from referrals
     */
    async getReferralEarnings(userId) {
        const user = await User.findById(userId);
        return user?.referralEarnings || 0;
    }

    /**
     * Get list of users referred by a user
     */
    async getReferredUsers(userId) {
        const referredUsers = await User.find({ referredBy: userId })
            .select('name phone referralAppliedAt referralRewarded referralRewardedAt')
            .sort({ referralAppliedAt: -1 });

        return referredUsers.map(u => ({
            id: u._id,
            name: u.name,
            phone: u.phone,
            referralAppliedAt: u.referralAppliedAt,
            referralRewarded: u.referralRewarded || false,
            referralRewardedAt: u.referralRewardedAt
        }));
    }

    /**
     * Get referral statistics for admin
     */
    async getReferralStats() {
        try {
            const [totalReferrals, rewardedReferrals, users, totalEarnings] = await Promise.all([
                User.countDocuments({ referredBy: { $exists: true } }),
                User.countDocuments({ referralRewarded: true }),
                User.find({}, 'name phone referralCode referralCount referralEarnings'),
                User.aggregate([
                    { $group: { _id: null, total: { $sum: '$referralEarnings' } } }
                ])
            ]);

            const pendingReferrals = totalReferrals - rewardedReferrals;
            const totalReferralEarnings = totalEarnings[0]?.total || 0;

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
