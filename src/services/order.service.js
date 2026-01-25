/**
 * Order Service
 * Business logic for order management
 */

const Order = require('../models/Order.model');
const MenuItem = require('../models/MenuItem.model');
const { calculateOrderTotal } = require('../utils/helpers');
const { ORDER_STATUS, TAX_RATE, PACKAGING_FEE, DELIVERY_FEE } = require('../utils/constants');
const logger = require('../config/logger');

/**
 * Create new order
 */
const createOrder = async (userId, orderData) => {
  try {
    const { items, orderType, paymentMethod, deliveryAddress, instructions } = orderData;
    
    // Validate and fetch menu items
    const menuItemIds = items.map(item => item.menuItem);
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
    
    if (menuItems.length !== items.length) {
      throw new Error('Some menu items not found');
    }
    
    // Prepare order items with prices
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(mi => mi._id.toString() === item.menuItem);
      
      if (!menuItem.isAvailable) {
        throw new Error(`${menuItem.name} is currently unavailable`);
      }
      
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        addons: item.addons || []
      };
    });
    
    // Calculate total
    const { subtotal, tax, packaging, delivery, total } = calculateOrderTotal(
      orderItems,
      orderType,
      TAX_RATE,
      PACKAGING_FEE,
      DELIVERY_FEE
    );
    
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
      items: orderItems,
      subtotal,
      tax,
      packaging,
      delivery,
      totalAmount: total,
      orderType,
      paymentMethod,
      deliveryAddress,
      instructions,
      status: ORDER_STATUS.RECEIVED
    });
    
    await order.save();
    await order.populate('user', 'name phone');
    await order.populate('items.menuItem', 'name image');
    
    logger.info(`Order created: ${order.orderId} for user ${userId}`);
    
    return order;
    
  } catch (error) {
    logger.error('Error creating order:', error);
    throw error;
  }
};

/**
 * Get user orders
 */
const getUserOrders = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, status } = options;
    
    const query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .populate('items.menuItem', 'name image')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Order.countDocuments(query);
    
    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    logger.error('Error fetching user orders:', error);
    throw error;
  }
};

/**
 * Get order by ID
 */
const getOrderById = async (orderId, userId) => {
  try {
    const order = await Order.findOne({ orderId, user: userId })
      .populate('user', 'name phone')
      .populate('items.menuItem', 'name image price');
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    return order;
    
  } catch (error) {
    logger.error('Error fetching order:', error);
    throw error;
  }
};

/**
 * Update order status (Admin)
 */
const updateOrderStatus = async (orderId, status) => {
  try {
    // Try to find order by MongoDB _id first, then by orderId
    let order = null;
    
    // Check if orderId looks like a MongoDB ObjectId (24 hex characters)
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }
    
    // If not found by _id, try finding by orderId field
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    order.status = status;
    
    // Update timestamps
    if (status === ORDER_STATUS.READY) {
      order.preparedAt = new Date();
    } else if (status === ORDER_STATUS.COMPLETED) {
      order.deliveredAt = new Date();
    } else if (status === ORDER_STATUS.CANCELLED) {
      order.cancelledAt = new Date();
    }
    
    await order.save();
    await order.populate('user', 'name phone');
    await order.populate('items.menuItem', 'name image');
    
    logger.info(`Order ${orderId} status updated to ${status}`);
    
    return order;
    
  } catch (error) {
    logger.error('Error updating order status:', error);
    throw error;
  }
};

/**
 * Get all orders (Admin)
 */
const getAllOrders = async (options = {}) => {
  try {
    const { page = 1, limit = 20, status, orderType } = options;
    
    const query = {};
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;
    
    const orders = await Order.find(query)
      .populate('user', 'name phone')
      .populate('items.menuItem', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Order.countDocuments(query);
    
    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    logger.error('Error fetching all orders:', error);
    throw error;
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders
};
