const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');
const GroceryOrder = require('../models/GroceryOrder.model');
const GrocerySettings = require('../models/GrocerySettings.model');
const walletService = require('../services/wallet.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const { GROCERY_ORDER_STATUS } = require('../utils/groceryOrderStatusValidator');
const { _internals } = require('./groceryOrderCustomer.controller');

const { generateOrderId, resolveAndSnapshotItems, computeBill } = _internals;

let razorpay;
if (config.razorpayKeyId && config.razorpayKeySecret) {
  razorpay = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
} else {
  logger.warn('⚠️ Razorpay keys not configured. Grocery payment integration will not work.');
}

async function refundRazorpayPayment(paymentId, amountInPaise, context) {
  if (!razorpay) {
    logger.error(`CRITICAL: Cannot auto-refund grocery payment ${paymentId} — Razorpay not configured. ${context}`);
    return { refunded: false, reason: 'razorpay_not_configured' };
  }
  try {
    const refund = await razorpay.payments.refund(paymentId, { amount: amountInPaise });
    logger.info(`↩️ Razorpay grocery auto-refund: ${refund.id} for payment ${paymentId}. ${context}`);
    return { refunded: true, refundId: refund.id };
  } catch (err) {
    logger.error(`CRITICAL: Razorpay grocery auto-refund FAILED for ${paymentId}. ${context}`, err);
    return { refunded: false, reason: err.message || 'refund_api_error' };
  }
}

/** POST /api/grocery/payment/create-razorpay-order */
exports.createRazorpayOrder = async (req, res) => {
  try {
    if (!razorpay) return res.status(500).json({ success: false, message: 'Razorpay is not configured.' });
    const userId = req.user.userId;
    const { amount, orderData } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const settings = await GrocerySettings.get();
    if (!settings.isOpen) {
      return res.status(403).json({ success: false, message: settings.closingMessage || 'Grocery shop is closed.' });
    }

    const amountInPaise = Math.round(amount * 100);
    const timestamp = Date.now().toString();
    const receipt = `HG${timestamp.slice(-10)}${String(userId).slice(-8)}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: { userId: String(userId), section: 'grocery', orderData: JSON.stringify(orderData) },
    });

    logger.info(`✅ Grocery Razorpay order created: ${razorpayOrder.id} for user ${userId}, amount: ₹${amount}`);

    res.json({
      success: true,
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
    });
  } catch (e) {
    logger.error('grocery.payment.createRazorpayOrder', e);
    res.status(500).json({ success: false, message: config.nodeEnv === 'development' ? e.message : 'Failed to create payment order' });
  }
};

/** POST /api/grocery/payment/verify — verifies signature, re-validates order, persists GroceryOrder, auto-refunds on any rejection path. */
exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification data' });
    }
    if (!orderData) {
      return res.status(400).json({ success: false, message: 'Order data is required' });
    }

    // Signature verification (pre-capture check; failure here doesn't need refund)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated = crypto.createHmac('sha256', config.razorpayKeySecret).update(text).digest('hex');
    if (generated !== razorpay_signature) {
      logger.error(`❌ Grocery payment signature failed for ${razorpay_order_id}`);
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
    logger.info(`✅ Grocery payment verified: ${razorpay_payment_id}`);

    const { items, orderType, deliveryAddress, instructions, walletUsed = 0, totalAmount } = orderData;
    const refundAmountInPaise = Math.round((totalAmount || 0) * 100);

    // Shop-closed re-check (post-capture — refund required if reject)
    const settings = await GrocerySettings.get();
    if (!settings.isOpen) {
      const refundResult = await refundRazorpayPayment(
        razorpay_payment_id,
        refundAmountInPaise,
        `Grocery shop closed during verification. User ${userId}.`
      );
      return res.status(403).json({
        success: false,
        message: settings.closingMessage || 'Grocery shop is currently closed.',
        paymentId: razorpay_payment_id,
        refund: refundResult,
      });
    }

    // Re-hydrate items (post-capture — refund required if item unavailable)
    let resolved, subtotal;
    try {
      ({ resolved, subtotal } = await resolveAndSnapshotItems(items));
    } catch (err) {
      const refundResult = await refundRazorpayPayment(razorpay_payment_id, refundAmountInPaise, `Grocery item unavailable: ${err.message}. User ${userId}.`);
      return res.status(400).json({ success: false, message: err.message, paymentId: razorpay_payment_id, refund: refundResult });
    }

    // Min-order re-check
    if (settings.minOrderValue != null && subtotal < settings.minOrderValue) {
      const refundResult = await refundRazorpayPayment(razorpay_payment_id, refundAmountInPaise, `Grocery subtotal below min at verify. User ${userId}.`);
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${settings.minOrderValue}.`,
        paymentId: razorpay_payment_id,
        refund: refundResult,
      });
    }

    // Bill recomputation (authoritative — never trust client-provided totalAmount)
    const { tax, delivery, total } = computeBill(settings, subtotal, orderType);

    // Wallet debit if requested (post-capture — refund required if wallet fails)
    let walletAmount = 0;
    if (walletUsed && walletUsed > 0) {
      try {
        await walletService.validateWalletUsage(userId, walletUsed, total, config.maxWalletUsagePercent);
        await walletService.debitWallet(userId, walletUsed, TRANSACTION_REASONS.ORDER_PAYMENT, {
          description: 'Wallet part-payment for grocery order',
          metadata: { section: 'grocery' },
          section: 'grocery',
        });
        walletAmount = walletUsed;
      } catch (err) {
        const refundResult = await refundRazorpayPayment(razorpay_payment_id, refundAmountInPaise, `Wallet debit failed post-payment. User ${userId}.`);
        return res.status(400).json({ success: false, message: err.message, paymentId: razorpay_payment_id, refund: refundResult });
      }
    }

    // Persist the order
    const orderId = await generateOrderId();
    const order = new GroceryOrder({
      orderId,
      user: userId,
      items: resolved,
      subtotal,
      tax,
      delivery,
      totalAmount: total,
      orderType,
      deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress : undefined,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'COMPLETED',
      paymentDetails: { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature },
      walletUsed: walletAmount,
      instructions: instructions || '',
      status: GROCERY_ORDER_STATUS.RECEIVED,
      statusHistory: [{ status: GROCERY_ORDER_STATUS.RECEIVED, timestamp: new Date(), updatedBy: userId }],
    });

    try {
      await order.save();
    } catch (saveErr) {
      // Compensating refunds: wallet first (we debited just above), then Razorpay
      if (walletAmount > 0) {
        try { await walletService.refundToWallet(userId, walletAmount, null, 'Grocery order save failed — wallet auto-refund', { section: 'grocery' }); }
        catch (refErr) { logger.error('CRITICAL: wallet refund after save fail', refErr); }
      }
      const refundResult = await refundRazorpayPayment(razorpay_payment_id, refundAmountInPaise, `Order save failed. User ${userId}.`);
      return res.status(500).json({ success: false, message: 'Failed to save order', paymentId: razorpay_payment_id, refund: refundResult });
    }

    logger.info(`✅ Grocery order created after Razorpay payment: ${orderId} for user ${userId}`);
    res.json({
      success: true,
      message: 'Payment verified and grocery order created',
      data: { orderId: order.orderId, order: { ...order.toObject(), id: order._id.toString() }, paymentId: razorpay_payment_id },
    });
  } catch (e) {
    logger.error('grocery.payment.verifyPayment', e);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};
