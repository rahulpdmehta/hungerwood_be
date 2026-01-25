/**
 * Order Controller
 * Handles order operations using MongoDB
 */

const Order = require('../models/Order.model');
const MenuItem = require('../models/MenuItem.model');
const User = require('../models/User.model');
const logger = require('../config/logger');
const walletService = require('../services/wallet.service');
const referralService = require('../services/referral.service');
const orderEventManager = require('../services/event.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const config = require('../config/env');
const { validateStatusTransition, getAllowedNextStatuses } = require('../utils/orderStatusValidator');
const { ORDER_STATUS } = require('../utils/constants');
const { getCurrentISO, addTime } = require('../utils/dateFormatter');

/**
 * Create new order
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      items,
      orderType,
      deliveryAddress,
      paymentMethod,
      specialInstructions,
      itemTotal,
      deliveryFee,
      tax,
      discount,
      walletUsed,
      totalAmount
    } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Validate each item has required fields
    const invalidItems = items.filter(item => !item.menuItem || !item.quantity || !item.price);
    if (invalidItems.length > 0) {
      logger.error('Invalid order items:', invalidItems);
      return res.status(400).json({
        success: false,
        message: 'All items must have menuItem ID, quantity, and price',
        invalidItems
      });
    }

    // Handle wallet payment if requested
    let walletAmount = 0;
    let amountPayable = totalAmount;

    logger.info(`💰 Wallet check: walletUsed=${walletUsed}, totalAmount=${totalAmount}`);

    if (walletUsed && walletUsed > 0) {
      try {
        logger.info(`🔍 Validating wallet usage: User ${userId}, Amount: ₹${walletUsed}`);

        // Validate wallet usage
        const validationResult = await walletService.validateWalletUsage(
          userId,
          walletUsed,
          totalAmount,
          config.maxWalletUsagePercent
        );

        logger.info(`✅ Wallet validation passed:`, validationResult);

        // Deduct from wallet
        logger.info(`💸 Debiting wallet: User ${userId}, Amount: ₹${walletUsed}`);
        const debitResult = await walletService.debitWallet(
          userId,
          walletUsed,
          TRANSACTION_REASONS.ORDER_PAYMENT,
          {
            description: `Payment for order`,
            metadata: {
              orderType,
              itemCount: items.length
            }
          }
        );

        walletAmount = walletUsed;
        amountPayable = totalAmount - walletUsed;

        logger.info(`✅ Wallet payment processed: User ${userId}, Amount: ₹${walletUsed}, New Balance: ₹${debitResult.newBalance}`);
      } catch (walletError) {
        logger.error('❌ Wallet payment failed:', walletError);
        return res.status(400).json({
          success: false,
          message: walletError.message || 'Wallet payment failed'
        });
      }
    } else {
      logger.info(`ℹ️  No wallet payment requested (walletUsed=${walletUsed})`);
    }

    // Generate order ID: HW_YYYYMMDD_XXX (where XXX is today's order count)
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
    
    // Count orders created today
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
      orderId: orderId,
      user: userId,
      items: items.map(item => ({
        menuItem: item.menuItem || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        addons: item.addons || []
      })),
      orderType: orderType || 'delivery',
      deliveryAddress: deliveryAddress || undefined,
      paymentMethod: paymentMethod || 'cash',
      instructions: specialInstructions || '',
      subtotal: itemTotal || 0,
      discount: discount || 0,
      delivery: deliveryFee || 0,
      tax: tax || 0,
      totalAmount: totalAmount || 0,
      status: ORDER_STATUS.RECEIVED,
      estimatedTime: 45 // 45 mins
    });
    
    await order.save();
    await order.populate('user', 'phone name');
    await order.populate('items.menuItem', 'name image');

    logger.info(`Order created: ${order._id} by user ${userId}, Wallet used: ₹${walletAmount}`);

    // Process referral rewards asynchronously (don't wait)
    // Pass the saved order document to ensure all fields are available
    referralService.processReferralReward(order).catch(err => {
      logger.error('Error processing referral reward:', err);
      // Log more details for debugging
      logger.error('Order details:', {
        orderId: order.orderId,
        order_id: order._id,
        userId: order.user?._id || order.user,
        totalAmount: order.totalAmount
      });
    });

    // Convert Mongoose document to plain object and ensure ID is included
    const orderObj = order.toObject();
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        ...orderObj,
        id: orderObj._id, // Ensure id field is present for frontend
        paymentBreakdown: {
          total: totalAmount,
          walletUsed: walletAmount,
          amountPayable: amountPayable
        }
      }
    });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    });
  }
};

/**
 * Get user's orders
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const orders = await Order.find({ user: userId })
      .populate('items.menuItem', 'name image')
      .populate('user', 'phone name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    logger.error('Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

/**
 * Get single order
 */
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Try to find order by MongoDB _id first, then by orderId
    let order = null;
    
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(id)
        .populate('items.menuItem', 'name image')
        .populate('user', 'phone name');
    }
    
    // If not found by _id, try finding by orderId
    if (!order) {
      order = await Order.findOne({ orderId: id })
        .populate('items.menuItem', 'name image')
        .populate('user', 'phone name');
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order belongs to user (unless admin)
    // Handle both populated and non-populated user field
    const orderUserId = order.user._id ? order.user._id.toString() : order.user.toString();
    if (orderUserId !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
};

/**
 * Get all orders (Admin only)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const { status, orderType, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .populate('user', 'phone name')
      .populate('items.menuItem', 'name image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Order.countDocuments(query);

    // Format response
    const populatedOrders = orders.map(order => ({
      ...order.toObject(),
      customerName: order.user?.name || 'Unknown',
      customerPhone: order.user?.phone || 'N/A'
    }));

    res.json({
      success: true,
      message: 'Orders fetched successfully',
      data: populatedOrders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

/**
 * Get order by ID (Admin)
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find order by MongoDB _id first, then by orderId
    let order = null;
    
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(id)
        .populate('items.menuItem', 'name image')
        .populate('user', 'phone name');
    }
    
    // If not found by _id, try finding by orderId
    if (!order) {
      order = await Order.findOne({ orderId: id })
        .populate('items.menuItem', 'name image')
        .populate('user', 'phone name');
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
};

/**
 * Update order status (Admin only)
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const adminId = req.user.userId;

    // Validate new status
    if (!newStatus || !Object.values(ORDER_STATUS).includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    // Try to find order by MongoDB _id first, then by orderId
    let order = null;
    
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(id);
    }
    
    // If not found by _id, try finding by orderId
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const currentStatus = order.status;

    // Check if status transition is valid
    if (!validateStatusTransition(currentStatus, newStatus)) {
      const allowedStatuses = getAllowedNextStatuses(currentStatus);
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        allowedStatuses
      });
    }

    // Initialize statusHistory if not exists
    if (!order.statusHistory) {
      order.statusHistory = [{
        status: currentStatus,
        timestamp: order.createdAt,
        updatedBy: order.user
      }];
    }

    // Update order status and add to history
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      timestamp: getCurrentISO(),
      updatedBy: adminId
    });
    
    const updatedOrder = await order.save();
    await updatedOrder.populate('user', 'phone name');
    await updatedOrder.populate('items.menuItem', 'name image');

    logger.info(`Order ${id} status updated from ${currentStatus} to ${newStatus} by admin ${adminId}`);

    // Broadcast update to connected SSE clients
    orderEventManager.broadcastOrderUpdate(id, {
      type: 'statusUpdate',
      orderId: id,
      status: newStatus,
      previousStatus: currentStatus,
      statusHistory: updatedOrder.statusHistory,
      updatedAt: updatedOrder.updatedAt,
      updatedBy: adminId
    });

    res.json({
      success: true,
      message: `Order status updated to ${newStatus}`,
      data: updatedOrder
    });
  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
};
