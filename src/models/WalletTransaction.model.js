/**
 * WalletTransaction Model
 * Manages wallet credit/debit transactions for audit trail
 */

const JsonDB = require('../utils/jsonDB');
const { getCurrentISO } = require('../utils/dateFormatter');

const TRANSACTION_TYPES = {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT'
};

const TRANSACTION_REASONS = {
    ORDER_PAYMENT: 'ORDER_PAYMENT',
    ORDER_REFUND: 'ORDER_REFUND',
    REFERRAL_BONUS_REFERRER: 'REFERRAL_BONUS_REFERRER',
    REFERRAL_BONUS_NEW_USER: 'REFERRAL_BONUS_NEW_USER',
    CASHBACK: 'CASHBACK',
    ADMIN_CREDIT: 'ADMIN_CREDIT',
    ADMIN_DEBIT: 'ADMIN_DEBIT',
    PROMOTIONAL_BONUS: 'PROMOTIONAL_BONUS'
};

class WalletTransactionModel {
    constructor() {
        this.db = new JsonDB('walletTransactions.json');
    }

    /**
     * Create a new wallet transaction
     */
    create(data) {
        const transaction = {
            _id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: data.userId,
            type: data.type, // CREDIT or DEBIT
            amount: data.amount,
            reason: data.reason,
            orderId: data.orderId || null,
            referralId: data.referralId || null,
            balanceAfter: data.balanceAfter,
            description: data.description || '',
            metadata: data.metadata || {},
            createdAt: getCurrentISO()
        };

        return this.db.create(transaction);
    }

    /**
     * Find all transactions for a user
     */
    findByUserId(userId, options = {}) {
        const { limit = 50, offset = 0, type = null } = options;

        let transactions = this.db.findAll()
            .filter(t => t.userId === userId);

        // Filter by type if specified
        if (type) {
            transactions = transactions.filter(t => t.type === type);
        }

        // Sort by newest first
        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        return transactions.slice(offset, offset + limit);
    }

    /**
     * Find transactions by order ID
     */
    findByOrderId(orderId) {
        return this.db.findAll().filter(t => t.orderId === orderId);
    }

    /**
     * Find transaction by ID
     */
    findById(id) {
        return this.db.findById(id);
    }

    /**
     * Get total credits for a user
     */
    getTotalCredits(userId) {
        return this.db.findAll()
            .filter(t => t.userId === userId && t.type === TRANSACTION_TYPES.CREDIT)
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /**
     * Get total debits for a user
     */
    getTotalDebits(userId) {
        return this.db.findAll()
            .filter(t => t.userId === userId && t.type === TRANSACTION_TYPES.DEBIT)
            .reduce((sum, t) => sum + t.amount, 0);
    }

    /**
     * Check if referral reward already given
     */
    hasReferralReward(userId, reason) {
        return this.db.findAll().some(
            t => t.userId === userId &&
                t.reason === reason &&
                t.type === TRANSACTION_TYPES.CREDIT
        );
    }

    /**
     * Get wallet statistics for admin
     */
    getStats() {
        const transactions = this.db.findAll();

        const totalCredits = transactions
            .filter(t => t.type === TRANSACTION_TYPES.CREDIT)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalDebits = transactions
            .filter(t => t.type === TRANSACTION_TYPES.DEBIT)
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            totalTransactions: transactions.length,
            totalCredits,
            totalDebits,
            netAmount: totalCredits - totalDebits
        };
    }
}

module.exports = {
    WalletTransactionModel,
    TRANSACTION_TYPES,
    TRANSACTION_REASONS
};
