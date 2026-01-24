/**
 * Order Controller
 * Handles order operations using JSON files
 */

const JsonDB = require('../utils/jsonDB');
const logger = require('../config/logger');
const walletService = require('../services/wallet.service');
const referralService = require('../services/referral.service');
const orderEventManager = require('../services/event.service');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const config = require('../config/env');
const { validateStatusTransition, getAllowedNextStatuses } = require('../utils/orderStatusValidator');
const { ORDER_STATUS } = require('../utils/constants');
const { getCurrentISO, addTime } = require('../utils/dateFormatter');

const ordersDB = new JsonDB('orders.json');
const menuItemsDB = new JsonDB('menuItems.json');
const usersDB = new JsonDB('users.json');

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

    // Create order
    const order = ordersDB.create({
      user: userId,
      items: items.map(item => ({
        //menuItem: item.menuItem,
        quantity: item.quantity,
        id: item.id,
        name: item.name,
        image: item.image,
        discount: item.discount,
        price: item.price
      })),
      orderType: orderType || 'delivery',
      deliveryAddress: deliveryAddress || null,
      paymentMethod: paymentMethod || 'cash',
      specialInstructions: specialInstructions || '',
      itemTotal: itemTotal || 0,
      discount: discount || 0,
      deliveryFee: deliveryFee || 0,
      tax: tax || 0,
      walletUsed: walletAmount,
      amountPayable: amountPayable,
      totalAmount: totalAmount || 0,
      status: ORDER_STATUS.RECEIVED,
      orderNumber: `HW${Date.now().toString().slice(-6)}`,
      estimatedDeliveryTime: addTime(new Date(), 45, 'minute') // 45 mins
    });

    logger.info(`Order created: ${order._id} by user ${userId}, Wallet used: ₹${walletAmount}`);

    // Process referral rewards asynchronously (don't wait)
    referralService.processReferralReward(order).catch(err => {
      logger.error('Error processing referral reward:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        ...order,
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

    const orders = ordersDB.find({ user: userId });

    // Populate menu item details
    const populatedOrders = orders.map(order => {
      const populatedItems = order.items.map(item => {
        const menuItem = menuItemsDB.findById(item.menuItem);
        return {
          ...item,
          name: menuItem?.name || 'Unknown Item',
          image: menuItem?.image || '',
        };
      });

      return {
        ...order,
        items: populatedItems
      };
    });

    // Sort by creation date (newest first)
    populatedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      count: populatedOrders.length,
      data: populatedOrders
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

    const order = ordersDB.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order belongs to user (unless admin)
    if (order.user !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Populate menu item details
    const populatedItems = order.items.map(item => {
      const menuItem = menuItemsDB.findById(item.menuItem);
      return {
        ...item,
        name: menuItem?.name || 'Unknown Item',
        image: menuItem?.image || '',
      };
    });

    const populatedOrder = {
      ...order,
      items: populatedItems
    };

    res.json({
      success: true,
      data: populatedOrder
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

    let orders = ordersDB.findAll();

    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    // Filter by order type if provided
    if (orderType) {
      orders = orders.filter(order => order.orderType === orderType);
    }

    // Sort by creation date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Populate user details
    const populatedOrders = orders.map(order => {
      const user = usersDB.findById(order.user);
      return {
        ...order,
        customerName: user?.name || 'Unknown',
        customerPhone: user?.phone || 'N/A'
      };
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedOrders = populatedOrders.slice(startIndex, endIndex);

    res.json({
      success: true,
      message: 'Orders fetched successfully',
      data: paginatedOrders,
      pagination: {
        total: populatedOrders.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(populatedOrders.length / limit)
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

    const order = ordersDB.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Populate user details
    const user = usersDB.findById(order.user);

    // Populate menu item details
    const populatedItems = order.items.map(item => {
      const menuItem = menuItemsDB.findById(item.menuItem);
      return {
        ...item,
        menuItemDetails: menuItem || null
      };
    });

    const populatedOrder = {
      ...order,
      items: populatedItems,
      customerDetails: {
        id: user?._id,
        name: user?.name || 'Unknown',
        phone: user?.phone || 'N/A',
        email: user?.email || 'N/A'
      }
    };

    res.json({
      success: true,
      data: populatedOrder
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

    const order = ordersDB.findById(id);

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
    const updatedOrder = ordersDB.update(id, {
      status: newStatus,
      statusHistory: [
        ...order.statusHistory,
        {
          status: newStatus,
          timestamp: getCurrentISO(),
          updatedBy: adminId
        }
      ],
      updatedAt: getCurrentISO()
    });

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
