const GroceryOrder = require('../models/GroceryOrder.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const GrocerySettings = require('../models/GrocerySettings.model');
const walletService = require('../services/wallet.service');
const logger = require('../config/logger');
const config = require('../config/env');
const crypto = require('crypto');
const { TRANSACTION_REASONS } = require('../models/WalletTransaction.model');
const { GROCERY_ORDER_STATUS } = require('../utils/groceryOrderStatusValidator');

/** Generate grocery order ID: HG + YYYYMMDD + NNN (daily count) + RR (random) */
async function generateOrderId() {
  const today = new Date();
  const todayDate = today.toISOString().split('T')[0].replace(/-/g, '');
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end = new Date(today); end.setHours(23, 59, 59, 999);
  const count = await GroceryOrder.countDocuments({ createdAt: { $gte: start, $lte: end } });
  const suffix = crypto.randomInt(10, 99);
  return `HG${todayDate}${String(count + 1).padStart(3, '0')}${suffix}`;
}

/**
 * Re-hydrate items against the live catalog. Snapshots current name/prices
 * into the stored order items, rejects if any product is no longer available
 * or any variant has been disabled.
 *
 * Input:  [{ productId, variantId, quantity }]
 * Output: { resolved: [GroceryOrderItem], subtotal: number }
 */
async function resolveAndSnapshotItems(rawItems) {
  const productIds = [...new Set(rawItems.map(i => i.productId))];
  const products = await GroceryProduct.find({ _id: { $in: productIds }, isAvailable: true });
  const byId = new Map(products.map(p => [p._id.toString(), p]));

  const resolved = [];
  let subtotal = 0;
  for (const raw of rawItems) {
    const p = byId.get(String(raw.productId));
    if (!p) throw new Error(`Product ${raw.productId} is no longer available`);
    const v = (p.variants || []).find(x => String(x._id) === String(raw.variantId));
    if (!v || !v.isAvailable) throw new Error(`Variant for "${p.name}" is no longer available`);
    if (!Number.isInteger(raw.quantity) || raw.quantity < 1) {
      throw new Error(`Invalid quantity for "${p.name}"`);
    }
    resolved.push({
      product: p._id,
      variantId: v._id,
      name: p.name,
      variantLabel: v.label,
      mrp: v.mrp,
      sellingPrice: v.sellingPrice,
      quantity: raw.quantity,
    });
    subtotal += v.sellingPrice * raw.quantity;
  }
  return { resolved, subtotal };
}

/** Compute tax, delivery fee, and grand total from settings + subtotal + orderType. */
function computeBill(settings, subtotal, orderType) {
  const tax = Math.round(subtotal * (settings.taxRate || 0));
  const freeDeliveryThreshold = settings.freeDeliveryThreshold;
  const deliveryFlat = settings.deliveryFee || 0;
  const delivery = orderType === 'DELIVERY'
    ? (freeDeliveryThreshold != null && subtotal >= freeDeliveryThreshold ? 0 : deliveryFlat)
    : 0;
  return { tax, delivery, total: subtotal + tax + delivery };
}

/**
 * POST /api/grocery/orders
 * Cash/wallet-only path. Razorpay flow lives in groceryPayment.controller.js (Task 1.3).
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, orderType, deliveryAddress, paymentMethod, instructions, walletUsed = 0 } = req.body;

    const settings = await GrocerySettings.get();
    if (!settings.isOpen) {
      return res.status(403).json({ success: false, message: settings.closingMessage || 'Grocery shop is currently closed.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }
    if (!['DELIVERY', 'PICKUP'].includes(orderType)) {
      return res.status(400).json({ success: false, message: 'Invalid orderType' });
    }
    if (orderType === 'DELIVERY' && !deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Delivery address required for delivery orders' });
    }

    let resolved, subtotal;
    try {
      ({ resolved, subtotal } = await resolveAndSnapshotItems(items));
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (settings.minOrderValue != null && subtotal < settings.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${settings.minOrderValue}. Your subtotal is ₹${subtotal}.`,
      });
    }

    const { tax, delivery, total } = computeBill(settings, subtotal, orderType);

    let walletAmount = 0;
    if (walletUsed && walletUsed > 0) {
      try {
        await walletService.validateWalletUsage(userId, walletUsed, total, config.maxWalletUsagePercent);
        await walletService.debitWallet(userId, walletUsed, TRANSACTION_REASONS.ORDER_PAYMENT, {
          description: 'Payment for grocery order',
          metadata: { section: 'grocery' },
          section: 'grocery',
        });
        walletAmount = walletUsed;
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Wallet payment failed' });
      }
    }

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
      paymentMethod: paymentMethod || 'CASH',
      paymentStatus: paymentMethod === 'WALLET' && walletAmount >= total ? 'COMPLETED' : 'PENDING',
      walletUsed: walletAmount,
      instructions: instructions || '',
      status: GROCERY_ORDER_STATUS.RECEIVED,
      statusHistory: [{ status: GROCERY_ORDER_STATUS.RECEIVED, timestamp: new Date(), updatedBy: userId }],
    });

    try {
      await order.save();
    } catch (saveErr) {
      if (walletAmount > 0) {
        try {
          await walletService.refundToWallet(userId, walletAmount, null, 'Grocery order creation failed — auto-refund', { section: 'grocery' });
        } catch (refErr) { logger.error('CRITICAL: wallet refund failed after save error', refErr); }
      }
      throw saveErr;
    }

    await order.populate('user', 'phone name');
    res.status(201).json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
    });
  } catch (e) {
    logger.error('grocery.customer.createOrder', e);
    res.status(500).json({ success: false, message: 'Failed to place grocery order' });
  }
};

/** GET /api/grocery/orders — current user's grocery orders, most recent first. */
exports.listMine = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = await GroceryOrder.find({ user: userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: orders.map(o => ({ ...o.toObject(), id: o._id.toString() })),
    });
  } catch (e) { logger.error('grocery.customer.listMine', e); res.status(500).json({ success: false }); }
};

/** GET /api/grocery/orders/:id — single order (must belong to caller, unless caller is an admin). */
exports.getMine = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { orderId: id };
    const order = await GroceryOrder.findOne(query).populate('user', 'phone name');
    if (!order) return res.status(404).json({ success: false });
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    if (orderUserId !== String(userId) && req.user.role === 'USER') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: { ...order.toObject(), id: order._id.toString() } });
  } catch (e) { logger.error('grocery.customer.getMine', e); res.status(500).json({ success: false }); }
};

// Shared helpers for Task 1.3 (Razorpay verify flow).
exports._internals = {
  generateOrderId,
  resolveAndSnapshotItems,
  computeBill,
};
