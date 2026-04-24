const GroceryOrder = require('../models/GroceryOrder.model');
const logger = require('../config/logger');
const { refundCancelledOrder } = require('../services/groceryOrderCancel.service');
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

    if (nextStatus === GROCERY_ORDER_STATUS.CANCELLED) {
      await refundCancelledOrder(o);
      o.cancelledAt = new Date();
    }

    o.status = nextStatus;
    o.statusHistory.push({ status: nextStatus, timestamp: new Date(), updatedBy: req.user.userId });
    await o.save();
    res.json({ success: true, data: { ...o.toObject(), id: o._id.toString() } });
  } catch (e) { logger.error('groceryOrder.updateStatus', e); res.status(500).json({ success: false }); }
};
