/**
 * Admin Routes
 * Protected routes for admin operations
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const categoryController = require('../controllers/category.controller');
const menuController = require('../controllers/menu.controller');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/role.middleware');
const { upload } = require('../middlewares/upload.middleware');
const {
  validate,
  categorySchema,
  menuItemSchema,
  updateOrderStatusSchema
} = require('../middlewares/validate.middleware');

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

// ==================== CATEGORY MANAGEMENT ====================
router.get('/categories', categoryController.getAllCategories);
router.get('/categories/:id', categoryController.getCategoryById);
router.post('/categories', upload.single('image'), categoryController.createCategory);
router.put('/categories/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.patch('/categories/:id/toggle', categoryController.toggleCategoryStatus);

// ==================== MENU MANAGEMENT ====================
router.post('/menu', upload.single('image'), menuController.createMenuItem);
router.put('/menu/:id', upload.single('image'), menuController.updateMenuItem);
router.delete('/menu/:id', menuController.deleteMenuItem);
router.patch('/menu/:id/availability', menuController.toggleAvailability);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders', orderController.getAllOrders);
router.get('/orders/:id', orderController.getOrderById);
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), orderController.updateOrderStatus);

// ==================== WALLET MANAGEMENT ====================
router.post('/wallet/credit', adminController.creditUserWallet);
router.post('/wallet/debit', adminController.debitUserWallet);
router.get('/wallet/:userId', adminController.getUserWallet);
router.get('/wallet-stats', adminController.getWalletStats);

// ==================== USER MANAGEMENT ====================
router.get('/users', adminController.getAllUsers);

// ==================== DASHBOARD ANALYTICS ====================
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/orders-analytics', adminController.getOrdersAnalytics);
router.get('/dashboard/menu-analytics', adminController.getMenuAnalytics);
router.get('/dashboard/customer-analytics', adminController.getCustomerAnalytics);

// ==================== RESTAURANT MANAGEMENT ====================
router.get('/restaurant/status', adminController.getRestaurantStatus);
router.patch('/restaurant/status', adminController.updateRestaurantStatus);

module.exports = router;
