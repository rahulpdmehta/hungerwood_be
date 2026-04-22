const GroceryOrder = require('../models/GroceryOrder.model');
const walletService = require('../services/wallet.service');
const logger = require('../config/logger');
const {
  GROCERY_ORDER_STATUS,
  validateGroceryStatusTransition,
  getAllowedNextGroceryStatuses,
} = require('../utils/groceryOrderStatusValidator');

exports.adminList = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (status) q.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      GroceryOrder.find(q).populate('user', 'phone name').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      GroceryOrder.countDocuments(q)
    ]);
    res.json({
      success: true,
      data: orders.map(o => ({ ...o.toObject(), id: o._id.toString() })),
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (e) { logger.error('groceryOrder.adminList', e); res.status(500).json({ success: false }); }
};

exports.adminGet = async (req, res) => {
  try {
    const o = await GroceryOrder.findById(req.params.id).populate('user', 'phone name');
    if (!o) return res.status(404).json({ success: false });
    res.json({ success: true, data: { ...o.toObject(), id: o._id.toString() } });
  } catch (e) { res.status(500).json({ success: false }); }
};

exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status: nextStatus } = req.body;
    const o = await GroceryOrder.findById(req.params.id);
    if (!o) return res.status(404).json({ success: false });
    if (!validateGroceryStatusTransition(o.status, nextStatus, o.orderType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition ${o.status} -> ${nextStatus}`,
        allowedStatuses: getAllowedNextGroceryStatuses(o.status, o.orderType)
      });
    }

    // Wallet refund on cancel
    if (nextStatus === GROCERY_ORDER_STATUS.CANCELLED && o.walletUsed > 0) {
      try {
        await walletService.refundToWallet(o.user, o.walletUsed, o._id, `Refund for cancelled grocery order #${o.orderId}`, { section: 'grocery' });
      } catch (e) { logger.error('grocery cancel wallet refund', e); }
    }

    // Razorpay refund on cancel
    if (
      nextStatus === GROCERY_ORDER_STATUS.CANCELLED &&
      o.paymentMethod === 'RAZORPAY' &&
      o.paymentStatus === 'COMPLETED' &&
      o.paymentDetails?.razorpayPaymentId
    ) {
      // Refund the amount that was captured via Razorpay = total minus wallet used.
      const paidViaRazorpay = o.totalAmount - (o.walletUsed || 0);
      if (paidViaRazorpay > 0) {
        try {
          const Razorpay = require('razorpay');
          const config = require('../config/env');
          if (config.razorpayKeyId && config.razorpayKeySecret) {
            const rp = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
            const refund = await rp.payments.refund(o.paymentDetails.razorpayPaymentId, {
              amount: Math.round(paidViaRazorpay * 100),
            });
            logger.info(`↩️ Razorpay refund on cancel: ${refund.id} for grocery order ${o.orderId}`);
            o.paymentStatus = 'REFUNDED';
          } else {
            logger.error(`CRITICAL: Cannot refund grocery order ${o.orderId} — Razorpay not configured`);
          }
        } catch (refErr) {
          logger.error(`CRITICAL: Razorpay refund failed for cancelled grocery order ${o.orderId}`, refErr);
        }
      }
    }

    o.status = nextStatus;
    o.statusHistory.push({ status: nextStatus, timestamp: new Date(), updatedBy: req.user.userId });
    await o.save();
    res.json({ success: true, data: { ...o.toObject(), id: o._id.toString() } });
  } catch (e) { logger.error('groceryOrder.updateStatus', e); res.status(500).json({ success: false }); }
};
