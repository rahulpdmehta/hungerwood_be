/**
 * Payment Controller
 * Handles Razorpay payment integration
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');
const Order = require('../models/Order.model');
const MenuItem = require('../models/MenuItem.model');
const Restaurant = require('../models/Restaurant.model');
const { ORDER_STATUS, BILLING } = require('../utils/constants');
const walletService = require('../services/wallet.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const { isCategoryOrderable } = require('../utils/categoryWindow');

// Tolerated rounding error between client-displayed total and authoritative
// server-recomputed total. Anything bigger means the cart drifted (price
// changed, item went unavailable) — treat as fraud-or-stale and refund.
const PRICE_DRIFT_TOLERANCE = 1; // ₹1

async function refundRazorpayPayment(paymentId, amountInPaise, context) {
  if (!razorpay) {
    logger.error(`CRITICAL: Cannot auto-refund ${paymentId} — Razorpay not configured. ${context}`);
    return { refunded: false, reason: 'razorpay_not_configured' };
  }
  try {
    const refund = await razorpay.payments.refund(paymentId, { amount: amountInPaise });
    logger.info(`↩️ Razorpay auto-refund issued: ${refund.id} for payment ${paymentId}. ${context}`);
    return { refunded: true, refundId: refund.id };
  } catch (err) {
    logger.error(`CRITICAL: Razorpay auto-refund FAILED for ${paymentId}. ${context}`, err);
    return { refunded: false, reason: err.message || 'refund_api_error' };
  }
}

// Initialize Razorpay instance
// Only initialize if keys are provided (to prevent errors in development)
let razorpay;
if (config.razorpayKeyId && config.razorpayKeySecret) {
  razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  });
} else {
  logger.warn('⚠️ Razorpay keys not configured. Payment integration will not work.');
}

/**
 * Create Razorpay order
 * This creates a Razorpay order ID that will be used on the frontend
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    // Check if Razorpay is configured
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay is not configured. Please contact support.'
      });
    }

    const userId = req.user.userId;
    const { amount, orderData } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Check restaurant status
    const restaurant = await Restaurant.getRestaurant();
    if (!restaurant.isOpen) {
      const message = restaurant.closingMessage || 'Restaurant is currently closed. Please try again later.';
      return res.status(403).json({
        success: false,
        message: message
      });
    }

    // Convert amount to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create a short receipt (Razorpay requires max 40 characters)
    // Format: HW + last 10 digits of timestamp + last 8 chars of userId = ~20 chars
    const timestamp = Date.now().toString();
    const userIdStr = userId.toString();
    const receipt = `HW${timestamp.slice(-10)}${userIdStr.slice(-8)}`;

    // Create Razorpay order
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt,
      notes: {
        userId: userId.toString(),
        orderData: JSON.stringify(orderData) // Store order data for later use
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    logger.info(`✅ Razorpay order created: ${razorpayOrder.id} for user ${userId}, amount: ₹${amount}`);

    res.json({
      success: true,
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt
    });
  } catch (error) {
    logger.error('❌ Failed to create Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: config.nodeEnv === 'development' ? (error.message || 'Failed to create payment order') : 'Failed to create payment order'
    });
  }
};

/**
 * Verify Razorpay payment and create order
 * This verifies the payment signature and creates the order in the database
 */
exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: 'Order data is required'
      });
    }

    // Verify payment signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      logger.error(`❌ Payment signature verification failed for order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    logger.info(`✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);

    // Idempotency: a Razorpay payment maps to exactly one Order. If this
    // verify endpoint is called twice (network retry, Razorpay handler
    // re-fired, page refresh) the second call returns the existing order
    // instead of creating a duplicate + double-debiting wallet.
    const existingOrder = await Order.findOne({
      'paymentDetails.razorpayPaymentId': razorpay_payment_id,
    });
    if (existingOrder) {
      logger.info(`↩️ Idempotent verify hit — existing order ${existingOrder.orderId} for payment ${razorpay_payment_id}`);
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: { orderId: existingOrder.orderId, _id: existingOrder._id, status: existingOrder.status },
      });
    }

    // Client-supplied order data is treated as a hint only. Items + addons
    // come from the cart, but every price/tax/fee is recomputed below from
    // the authoritative MenuItem records before we commit anything.
    const {
      items,
      orderType,
      deliveryAddress,
      specialInstructions,
      walletUsed,
      totalAmount: clientTotal,
    } = orderData;

    const refundAmountInPaise = Math.round((clientTotal || 0) * 100);

    // Check restaurant status again (in case it closed during payment)
    const restaurant = await Restaurant.getRestaurant();
    if (!restaurant.isOpen) {
      const message = restaurant.closingMessage || 'Restaurant is currently closed. Please try again later.';
      const refundResult = await refundRazorpayPayment(
        razorpay_payment_id,
        refundAmountInPaise,
        `Restaurant closed during payment verification. User ${userId}.`
      );
      return res.status(403).json({
        success: false,
        message,
        paymentId: razorpay_payment_id,
        refund: refundResult
      });
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Fetch authoritative MenuItem records once and reuse for both the
    // time-window check and the price recomputation below.
    const itemIds = items.map(i => i.menuItem || i.id).filter(Boolean);
    if (itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid menu item IDs in order' });
    }
    const menuItemDocs = await MenuItem.find({ _id: { $in: itemIds } }).populate('category');
    const menuById = new Map(menuItemDocs.map(m => [m._id.toString(), m]));

    // Time-window enforcement: lunch (or any time-restricted category) must
    // still be in its serving window at payment settlement.
    const now = new Date();
    for (const mi of menuItemDocs) {
      const cat = mi.category;
      if (cat && cat.isTimeRestricted && !isCategoryOrderable(cat, now)) {
        logger.warn(`Razorpay order rejected — "${cat.name}" outside window for user ${userId}, payment ${razorpay_payment_id}`);
        const refundResult = await refundRazorpayPayment(
          razorpay_payment_id,
          refundAmountInPaise,
          `Category "${cat.name}" outside window at verification. User ${userId}.`
        );
        return res.status(403).json({
          success: false,
          message: `${cat.name} is only orderable between ${cat.availableFrom} and ${cat.availableTo} (IST). Your payment is being refunded.`,
          paymentId: razorpay_payment_id,
          refund: refundResult
        });
      }
    }

    // Authoritative price recomputation. Never trust client-supplied prices,
    // tax, delivery, or total. Build the order from MenuItem records on the
    // server. If anything is missing/unavailable, refund and bail out.
    const serverItems = [];
    let serverItemTotal = 0;
    for (const item of items) {
      const mi = menuById.get(String(item.menuItem || item.id));
      if (!mi) {
        const refundResult = await refundRazorpayPayment(
          razorpay_payment_id,
          refundAmountInPaise,
          `Unknown menu item in order at verify. User ${userId}.`,
        );
        return res.status(400).json({
          success: false,
          message: 'One or more items in your cart are no longer available. Your payment is being refunded.',
          paymentId: razorpay_payment_id,
          refund: refundResult,
        });
      }
      if (mi.isAvailable === false) {
        const refundResult = await refundRazorpayPayment(
          razorpay_payment_id,
          refundAmountInPaise,
          `Item "${mi.name}" unavailable at verify. User ${userId}.`,
        );
        return res.status(400).json({
          success: false,
          message: `"${mi.name}" is currently unavailable. Your payment is being refunded.`,
          paymentId: razorpay_payment_id,
          refund: refundResult,
        });
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(mi.price) * (1 - (Number(mi.discount) || 0) / 100);
      const lineTotal = Math.round(unitPrice * qty);
      // Re-validate addons against MenuItem.addons (don't accept arbitrary client addons).
      const validAddons = (mi.addons || []).map(a => ({ name: a.name, price: Number(a.price) || 0 }));
      const validAddonNames = new Set(validAddons.map(a => a.name));
      const orderAddons = (item.addons || [])
        .filter(a => validAddonNames.has(a.name))
        .map(a => validAddons.find(va => va.name === a.name));
      const addonTotal = orderAddons.reduce((s, a) => s + a.price, 0) * qty;
      serverItemTotal += lineTotal + addonTotal;
      serverItems.push({
        menuItem: mi._id,
        name: mi.name,
        price: Math.round(unitPrice),
        quantity: qty,
        addons: orderAddons,
      });
    }

    const serverTax = Math.round(serverItemTotal * BILLING.TAX_RATE);
    const serverDelivery = orderType?.toUpperCase() === 'DELIVERY' ? BILLING.DELIVERY_FEE : 0;
    const serverPackaging = BILLING.PACKAGING_FEE || 0;
    const serverTotal = serverItemTotal + serverTax + serverDelivery + serverPackaging;

    // Sanity-check: client total should be within ₹1 of server total. Bigger
    // drift means the cart changed mid-flow (price update, item removed) or
    // someone is tampering — refund either way.
    if (typeof clientTotal === 'number' && Math.abs(clientTotal - serverTotal) > PRICE_DRIFT_TOLERANCE) {
      logger.warn(`Price drift on payment verify: client=${clientTotal} server=${serverTotal} user=${userId} payment=${razorpay_payment_id}`);
      const refundResult = await refundRazorpayPayment(
        razorpay_payment_id,
        Math.round(clientTotal * 100),
        `Price mismatch — client ${clientTotal}, server ${serverTotal}. User ${userId}.`,
      );
      return res.status(409).json({
        success: false,
        message: 'The total has changed since you started checkout. Your payment is being refunded — please re-add the items.',
        paymentId: razorpay_payment_id,
        refund: refundResult,
      });
    }

    // Wallet usage — capped at MAX_WALLET_USAGE_PERCENT of server total.
    let walletAmount = Math.max(0, Number(walletUsed) || 0);
    let amountPayable = serverTotal;
    if (walletAmount > 0) {
      try {
        await walletService.validateWalletUsage(
          userId,
          walletAmount,
          serverTotal,
          config.maxWalletUsagePercent,
        );
        const debitResult = await walletService.debitWallet(
          userId,
          walletAmount,
          TRANSACTION_REASONS.ORDER_PAYMENT,
          {
            description: 'Payment for order',
            metadata: { orderType, itemCount: items.length, source: 'restaurant' },
          },
        );
        amountPayable = serverTotal - walletAmount;
        logger.info(`✅ Wallet debited ₹${walletAmount}, new balance ₹${debitResult.newBalance}`);
      } catch (walletError) {
        logger.error('❌ Wallet payment failed:', walletError);
        const refundResult = await refundRazorpayPayment(
          razorpay_payment_id,
          Math.round(serverTotal * 100),
          `Wallet validation failed at verify. User ${userId}.`,
        );
        return res.status(400).json({
          success: false,
          message: walletError.message || 'Wallet payment failed',
          paymentId: razorpay_payment_id,
          refund: refundResult,
        });
      }
    }

    // Generate order ID
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const todayOrderCount = await Order.countDocuments({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    const randomSuffix = require('crypto').randomInt(10, 99);
    const orderId = `${todayDate}${String(todayOrderCount + 1).padStart(3, '0')}${randomSuffix}`;

    // Create order using authoritative server-recomputed values.
    const order = new Order({
      orderId,
      user: userId,
      items: serverItems,
      orderType: orderType.toUpperCase(),
      deliveryAddress: orderType?.toUpperCase() === 'DELIVERY' && deliveryAddress ? {
        street: deliveryAddress.street,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        pincode: deliveryAddress.pincode
      } : null,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'COMPLETED',
      paymentDetails: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      },
      subtotal: serverItemTotal,
      tax: serverTax,
      packaging: serverPackaging,
      delivery: serverDelivery,
      totalAmount: serverTotal,
      walletUsed: walletAmount,
      instructions: specialInstructions || '',
      status: ORDER_STATUS.RECEIVED,
      statusHistory: [{
        status: ORDER_STATUS.RECEIVED,
        timestamp: new Date(),
        updatedBy: userId
      }]
    });

    try {
      await order.save();
    } catch (saveError) {
      // Race: a concurrent verify hit beat us to the save, the unique index
      // on paymentDetails.razorpayPaymentId triggered E11000. Look up the
      // winning order and return it instead of refunding.
      if (saveError?.code === 11000 && /razorpayPaymentId/.test(saveError?.message || '')) {
        const winner = await Order.findOne({ 'paymentDetails.razorpayPaymentId': razorpay_payment_id });
        if (winner) {
          logger.info(`↩️ Idempotent verify race — losing thread for payment ${razorpay_payment_id}, returning order ${winner.orderId}`);
          // Wallet was already debited by the winning thread (or we just
          // double-debited and need to refund our own debit).
          if (walletAmount > 0) {
            try {
              await walletService.refundToWallet(userId, walletAmount, winner._id, 'Race-loser refund — duplicate verify');
            } catch (e) {
              logger.error('CRITICAL: Race-loser wallet refund failed:', e);
            }
          }
          return res.status(200).json({
            success: true,
            idempotent: true,
            data: { orderId: winner.orderId, _id: winner._id, status: winner.status },
          });
        }
      }
      if (walletAmount > 0) {
        try {
          await walletService.refundToWallet(userId, walletAmount, null, 'Order creation failed - automatic refund');
          logger.info(`Wallet refund processed for failed order: User ${userId}, Amount: ₹${walletAmount}`);
        } catch (refundError) {
          logger.error('CRITICAL: Wallet refund failed after order creation failure:', refundError);
        }
      }
      throw saveError;
    }

    logger.info(`✅ Order created after payment: ${orderId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Payment verified and order created successfully',
      data: {
        orderId: order.orderId,
        order: order,
        paymentId: razorpay_payment_id
      }
    });
  } catch (error) {
    logger.error('❌ Failed to verify payment and create order:', error);
    res.status(500).json({
      success: false,
      message: config.nodeEnv === 'development' ? (error.message || 'Failed to verify payment') : 'Failed to verify payment'
    });
  }
};
