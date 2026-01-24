/**
 * Admin Controller
 * Handles admin-only operations
 */

const orderService = require('../services/order.service');
const menuService = require('../services/menu.service');
const walletService = require('../services/wallet.service');
const referralService = require('../services/referral.service');
const JsonDB = require('../utils/jsonDB');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const { successResponse, errorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

const usersDB = new JsonDB('users.json');
const ordersDB = new JsonDB('orders.json');

/**
 * Get all orders
 * GET /api/admin/orders
 * Query params: page, limit, status, orderType
 */
const getAllOrders = async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      orderType: req.query.orderType
    };

    const result = await orderService.getAllOrders(options);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Orders fetched successfully',
      result
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Update order status
 * PATCH /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await orderService.updateOrderStatus(req.params.id, status);

    logger.info(`Order ${req.params.id} status updated by admin ${req.user.userId}`);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Order status updated successfully',
      { order }
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Create menu item
 * POST /api/admin/menu
 */
const createMenuItem = async (req, res, next) => {
  try {
    const item = await menuService.createMenuItem(req.body);

    logger.info(`Menu item created by admin ${req.user.userId}: ${item.name}`);

    return successResponse(
      res,
      HTTP_STATUS.CREATED,
      'Menu item created successfully',
      { item }
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Update menu item
 * PATCH /api/admin/menu/:id
 */
const updateMenuItem = async (req, res, next) => {
  try {
    const item = await menuService.updateMenuItem(req.params.id, req.body);

    logger.info(`Menu item updated by admin ${req.user.userId}: ${item.name}`);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Menu item updated successfully',
      { item }
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Delete menu item
 * DELETE /api/admin/menu/:id
 */
const deleteMenuItem = async (req, res, next) => {
  try {
    await menuService.deleteMenuItem(req.params.id);

    logger.info(`Menu item deleted by admin ${req.user.userId}`);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Menu item deleted successfully'
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Admin credit wallet
 * POST /api/admin/wallet/credit
 */
const creditUserWallet = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return errorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'userId and amount are required'
      );
    }

    if (amount <= 0) {
      return errorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'Amount must be positive'
      );
    }

    const result = await walletService.creditWallet(
      userId,
      amount,
      TRANSACTION_REASONS.ADMIN_CREDIT,
      {
        description: description || `Admin credit by ${req.user.userId}`,
        metadata: {
          adminId: req.user.userId,
          adminAction: 'CREDIT'
        }
      }
    );

    logger.info(`Admin ${req.user.userId} credited ₹${amount} to user ${userId}`);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Wallet credited successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin debit wallet
 * POST /api/admin/wallet/debit
 */
const debitUserWallet = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return errorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'userId and amount are required'
      );
    }

    if (amount <= 0) {
      return errorResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'Amount must be positive'
      );
    }

    const result = await walletService.debitWallet(
      userId,
      amount,
      TRANSACTION_REASONS.ADMIN_DEBIT,
      {
        description: description || `Admin debit by ${req.user.userId}`,
        metadata: {
          adminId: req.user.userId,
          adminAction: 'DEBIT'
        }
      }
    );

    logger.info(`Admin ${req.user.userId} debited ₹${amount} from user ${userId}`);

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Wallet debited successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user wallet details (Admin)
 * GET /api/admin/wallet/:userId
 */
const getUserWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await walletService.getTransactions(userId, {
      limit: 100,
      offset: 0
    });

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'User wallet fetched successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get wallet statistics (Admin)
 * GET /api/admin/wallet/stats
 */
const getWalletStats = async (req, res, next) => {
  try {
    const walletStats = await walletService.getWalletStats();
    const referralStats = await referralService.getReferralStats();

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Statistics fetched successfully',
      {
        wallet: walletStats,
        referral: referralStats
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users with stats
 * GET /api/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = usersDB.findAll();
    const orders = ordersDB.findAll();

    // Add order stats for each user
    const usersWithStats = users.map(user => {
      const userOrders = orders.filter(order => order.user === user._id);
      const totalOrders = userOrders.length;
      const totalSpent = userOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const lastOrder = userOrders.length > 0
        ? userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;

      return {
        _id: user._id,
        phone: user.phone,
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        role: user.role || 'USER',
        isActive: user.isActive !== undefined ? user.isActive : true,
        walletBalance: user.walletBalance || 0,
        referralCode: user.referralCode || null,
        totalReferrals: user.totalReferrals || 0,
        createdAt: user.createdAt || null,
        stats: {
          totalOrders,
          totalSpent,
          lastOrderDate: lastOrder ? lastOrder.createdAt : null
        }
      };
    });

    // Sort by creation date (newest first)
    usersWithStats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Users fetched successfully',
      {
        users: usersWithStats,
        total: usersWithStats.length
      }
    );
  } catch (error) {
    logger.error('Error fetching users:', error);
    next(error);
  }
};

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const users = usersDB.findAll();
    const orders = ordersDB.findAll();
    const JsonDB = require('../utils/jsonDB');
    const menuDB = new JsonDB('menuItems.json');
    const menuItems = menuDB.findAll();

    const { dateFilter = 30 } = req.query;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate period start based on filter
    let periodStart, lastPeriodStart, lastPeriodEnd;

    if (dateFilter === 'thisMonth') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (dateFilter === 'lastMonth') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      lastPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
    } else if (dateFilter === 'all') {
      periodStart = new Date(0); // Beginning of time
      lastPeriodStart = new Date(0);
      lastPeriodEnd = new Date(0);
    } else {
      const days = parseInt(dateFilter) || 30;
      periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      lastPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
      lastPeriodEnd = new Date(periodStart.getTime() - 1);
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Today's orders
    const todayOrders = orders.filter(order => new Date(order.createdAt) >= todayStart);
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // This month's orders
    const thisMonthOrders = orders.filter(order => new Date(order.createdAt) >= monthStart);
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Last month's orders for comparison
    const lastMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Active menu items
    const activeMenuItems = menuItems.filter(item => item.isAvailable !== false).length;

    // Total customers (non-admin users)
    const totalCustomers = users.filter(user => user.role !== 'ADMIN').length;

    // New customers this month
    const newCustomersThisMonth = users.filter(user => {
      return user.role !== 'ADMIN' && new Date(user.createdAt) >= monthStart;
    }).length;

    // Wallet credit used
    const walletCreditUsed = orders.reduce((sum, order) => sum + (order.walletUsed || 0), 0);
    const walletCreditUsedThisMonth = thisMonthOrders.reduce((sum, order) => sum + (order.walletUsed || 0), 0);

    // Calculate percentage changes
    const ordersChange = lastMonthOrders.length > 0
      ? ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length * 100).toFixed(1)
      : 100;

    const revenueChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : 100;

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Dashboard stats fetched successfully',
      {
        orders: {
          today: todayOrders.length,
          thisMonth: thisMonthOrders.length,
          total: orders.length,
          change: ordersChange
        },
        revenue: {
          today: todayRevenue,
          thisMonth: thisMonthRevenue,
          total: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
          change: revenueChange
        },
        menuItems: {
          active: activeMenuItems,
          total: menuItems.length
        },
        customers: {
          total: totalCustomers,
          newThisMonth: newCustomersThisMonth
        },
        wallet: {
          totalUsed: walletCreditUsed,
          usedThisMonth: walletCreditUsedThisMonth
        }
      }
    );
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    next(error);
  }
};

/**
 * Get orders analytics for dashboard
 * GET /api/admin/dashboard/orders-analytics
 */
const getOrdersAnalytics = async (req, res, next) => {
  try {
    const orders = ordersDB.findAll();
    const { days = 30 } = req.query;

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Orders per day
    const ordersPerDay = {};
    const revenuePerDay = {};

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= startDate) {
        const dateKey = orderDate.toISOString().split('T')[0];
        ordersPerDay[dateKey] = (ordersPerDay[dateKey] || 0) + 1;
        revenuePerDay[dateKey] = (revenuePerDay[dateKey] || 0) + (order.totalAmount || 0);
      }
    });

    // Fill in missing dates
    const ordersPerDayArray = [];
    const revenuePerDayArray = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      ordersPerDayArray.push({
        date: dateKey,
        count: ordersPerDay[dateKey] || 0
      });
      revenuePerDayArray.push({
        date: dateKey,
        revenue: revenuePerDay[dateKey] || 0
      });
    }

    // Status distribution
    const statusDistribution = {};
    orders.forEach(order => {
      const status = order.status || 'RECEIVED';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Orders analytics fetched successfully',
      {
        ordersPerDay: ordersPerDayArray,
        revenuePerDay: revenuePerDayArray,
        statusDistribution: Object.keys(statusDistribution).map(status => ({
          status,
          count: statusDistribution[status]
        }))
      }
    );
  } catch (error) {
    logger.error('Error fetching orders analytics:', error);
    next(error);
  }
};

/**
 * Get menu analytics for dashboard
 * GET /api/admin/dashboard/menu-analytics
 */
const getMenuAnalytics = async (req, res, next) => {
  try {
    const allOrders = ordersDB.findAll();
    const JsonDB = require('../utils/jsonDB');
    const menuDB = new JsonDB('menuItems.json');
    const categoryDB = new JsonDB('categories.json');
    const menuItems = menuDB.findAll();
    const categories = categoryDB.findAll();

    const { dateFilter = 30 } = req.query;
    const now = new Date();

    // Calculate period start based on filter
    let periodStart;
    if (dateFilter === 'thisMonth') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === 'lastMonth') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (dateFilter === 'all') {
      periodStart = new Date(0);
    } else {
      const days = parseInt(dateFilter) || 30;
      periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Filter orders by date
    const orders = allOrders.filter(order => new Date(order.createdAt) >= periodStart);

    // Count orders per menu item
    const itemSales = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const itemId = item.menuItem || item.id;
        if (itemId) {
          itemSales[itemId] = (itemSales[itemId] || 0) + (item.quantity || 1);
        }
      });
    });

    // Top selling items
    const topSellingItems = menuItems
      .map(item => ({
        name: item.name,
        sales: itemSales[item._id] || 0,
        revenue: (itemSales[item._id] || 0) * (item.price || 0)
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Category-wise sales
    const categorySales = {};
    menuItems.forEach(item => {
      const categoryId = item.category;
      const sales = itemSales[item._id] || 0;
      if (categoryId) {
        categorySales[categoryId] = (categorySales[categoryId] || 0) + sales;
      }
    });

    const categoryWiseSales = categories.map(cat => ({
      name: cat.name,
      sales: categorySales[cat._id] || 0
    }));

    // Veg vs Non-Veg
    let vegSales = 0;
    let nonVegSales = 0;
    menuItems.forEach(item => {
      const sales = itemSales[item._id] || 0;
      if (item.isVeg) {
        vegSales += sales;
      } else {
        nonVegSales += sales;
      }
    });

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Menu analytics fetched successfully',
      {
        topSellingItems,
        categoryWiseSales,
        vegVsNonVeg: [
          { type: 'Veg', sales: vegSales },
          { type: 'Non-Veg', sales: nonVegSales }
        ]
      }
    );
  } catch (error) {
    logger.error('Error fetching menu analytics:', error);
    next(error);
  }
};

/**
 * Get customer analytics for dashboard
 * GET /api/admin/dashboard/customer-analytics
 */
const getCustomerAnalytics = async (req, res, next) => {
  try {
    const users = usersDB.findAll();
    const orders = ordersDB.findAll();
    const { days = 30 } = req.query;

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // New customers over time
    const customersPerDay = {};
    users.forEach(user => {
      if (user.role !== 'ADMIN') {
        const userDate = new Date(user.createdAt);
        if (userDate >= startDate) {
          const dateKey = userDate.toISOString().split('T')[0];
          customersPerDay[dateKey] = (customersPerDay[dateKey] || 0) + 1;
        }
      }
    });

    const customersOverTime = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      customersOverTime.push({
        date: dateKey,
        count: customersPerDay[dateKey] || 0
      });
    }

    // Repeat vs New users
    const userOrderCounts = {};
    orders.forEach(order => {
      userOrderCounts[order.user] = (userOrderCounts[order.user] || 0) + 1;
    });

    const repeatUsers = Object.values(userOrderCounts).filter(count => count > 1).length;
    const newUsers = Object.values(userOrderCounts).filter(count => count === 1).length;

    // Wallet usage distribution
    const walletsWithBalance = users.filter(user => (user.walletBalance || 0) > 0).length;
    const walletsWithoutBalance = users.filter(user => user.role !== 'ADMIN').length - walletsWithBalance;

    return successResponse(
      res,
      HTTP_STATUS.OK,
      'Customer analytics fetched successfully',
      {
        customersOverTime,
        repeatVsNew: [
          { type: 'Repeat Users', count: repeatUsers },
          { type: 'New Users', count: newUsers }
        ],
        walletUsage: [
          { type: 'With Balance', count: walletsWithBalance },
          { type: 'Empty Wallet', count: walletsWithoutBalance }
        ]
      }
    );
  } catch (error) {
    logger.error('Error fetching customer analytics:', error);
    next(error);
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  creditUserWallet,
  debitUserWallet,
  getUserWallet,
  getWalletStats,
  getAllUsers,
  getDashboardStats,
  getOrdersAnalytics,
  getMenuAnalytics,
  getCustomerAnalytics
};
