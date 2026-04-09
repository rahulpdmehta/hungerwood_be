/**
 * WalletTransaction Model
 * Manages wallet credit/debit transactions for audit trail
 */

const mongoose = require('mongoose');

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

const walletTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: Object.values(TRANSACTION_TYPES),
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        enum: Object.values(TRANSACTION_REASONS),
        required: true
    },
    orderId: {
        type: String,
        default: null
    },
    referralId: {
        type: String,
        default: null
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes for faster queries
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ type: 1, reason: 1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

module.exports = {
    WalletTransaction,
    TRANSACTION_TYPES,
    TRANSACTION_REASONS
};
