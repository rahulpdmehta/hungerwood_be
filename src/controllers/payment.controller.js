/**
 * Payment Controller
 * Handles Razorpay payment integration
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');
const Order = require('../models/Order.model');
const Restaurant = require('../models/Restaurant.model');
const { ORDER_STATUS } = require('../utils/constants');
const walletService = require('../services/wallet.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');

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
      message: error.message || 'Failed to create payment order'
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

    // Check restaurant status again (in case it closed during payment)
    const restaurant = await Restaurant.getRestaurant();
    if (!restaurant.isOpen) {
      const message = restaurant.closingMessage || 'Restaurant is currently closed. Please try again later.';
      // Payment is already done, but we can't create the order
      // In a real scenario, you might want to refund here
      return res.status(403).json({
        success: false,
        message: message,
        paymentId: razorpay_payment_id // Return payment ID so frontend can handle refund
      });
    }

    // Extract order data
    const {
      items,
      orderType,
      deliveryAddress,
      specialInstructions,
      itemTotal,
      deliveryFee,
      tax,
      discount,
      walletUsed,
      totalAmount
    } = orderData;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Handle wallet payment if requested
    let walletAmount = walletUsed || 0;
    let amountPayable = totalAmount;

    if (walletAmount > 0) {
      try {
        logger.info(`🔍 Validating wallet usage: User ${userId}, Amount: ₹${walletAmount}`);

        // Validate wallet usage
        const validationResult = await walletService.validateWalletUsage(
          userId,
          walletAmount,
          totalAmount,
          config.maxWalletUsagePercent
        );

        logger.info(`✅ Wallet validation passed:`, validationResult);

        // Deduct from wallet
        logger.info(`💸 Debiting wallet: User ${userId}, Amount: ₹${walletAmount}`);
        const debitResult = await walletService.debitWallet(
          userId,
          walletAmount,
          TRANSACTION_REASONS.ORDER_PAYMENT,
          {
            description: `Payment for order`,
            metadata: {
              orderType,
              itemCount: items.length
            }
          }
        );

        amountPayable = totalAmount - walletAmount;

        logger.info(`✅ Wallet payment processed: User ${userId}, Amount: ₹${walletAmount}, New Balance: ₹${debitResult.newBalance}`);
      } catch (walletError) {
        logger.error('❌ Wallet payment failed:', walletError);
        return res.status(400).json({
          success: false,
          message: walletError.message || 'Wallet payment failed'
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
    
    const orderId = `${todayDate}${String(todayOrderCount + 1).padStart(3, '0')}`;

    // Create order
    const order = new Order({
      orderId,
      user: userId,
      items: items.map(item => ({
        menuItem: item.menuItem,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        addons: item.addons || []
      })),
      orderType: orderType.toUpperCase(),
      deliveryAddress: orderType === 'DELIVERY' && deliveryAddress ? {
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
      subtotal: itemTotal,
      tax: tax || 0,
      delivery: deliveryFee || 0,
      totalAmount: amountPayable,
      walletUsed: walletAmount,
      instructions: specialInstructions || '',
      status: ORDER_STATUS.RECEIVED,
      statusHistory: [{
        status: ORDER_STATUS.RECEIVED,
        timestamp: new Date(),
        updatedBy: userId
      }]
    });

    await order.save();

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
      message: error.message || 'Failed to verify payment'
    });
  }
};
