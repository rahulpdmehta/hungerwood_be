const Coupon = require('../models/Coupon.model');
const logger = require('../config/logger');

exports.list = async (req, res) => {
  try {
    const { section } = req.query;
    const q = {};
    if (section) q.section = section;
    const list = await Coupon.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: list });
  } catch (e) { logger.error('admin.coupon.list', e); res.status(500).json({ success: false }); }
};

exports.create = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.code || !body.type || body.value == null || !body.validTo || !body.section) {
      return res.status(400).json({ success: false, message: 'code, type, value, validTo, section required' });
    }
    const created = await Coupon.create({ ...body, code: String(body.code).toUpperCase().trim() });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Coupon code already exists' });
    }
    logger.error('admin.coupon.create', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to create coupon' });
  }
};

exports.update = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.code) updates.code = String(updates.code).toUpperCase().trim();
    const updated = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true, data: updated });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Coupon code already exists' });
    }
    logger.error('admin.coupon.update', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to update coupon' });
  }
};

exports.toggle = async (req, res) => {
  try {
    const c = await Coupon.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Coupon not found' });
    c.isActive = !c.isActive;
    await c.save();
    res.json({ success: true, data: c });
  } catch (e) { logger.error('admin.coupon.toggle', e); res.status(500).json({ success: false }); }
};

exports.remove = async (req, res) => {
  try {
    const r = await Coupon.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Coupon not found' });
    res.json({ success: true });
  } catch (e) { logger.error('admin.coupon.remove', e); res.status(500).json({ success: false }); }
};
