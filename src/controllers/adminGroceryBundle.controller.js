const GroceryBundle = require('../models/GroceryBundle.model');
const logger = require('../config/logger');

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

exports.list = async (_req, res) => {
  try {
    const list = await GroceryBundle.find({})
      .sort({ order: 1, createdAt: -1 })
      .populate('items.product', 'name image brand')
      .lean();
    res.json({ success: true, data: list });
  } catch (e) { logger.error('admin.bundle.list', e); res.status(500).json({ success: false }); }
};

exports.create = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !Array.isArray(body.items) || body.items.length === 0 || body.bundlePrice == null || body.regularPrice == null) {
      return res.status(400).json({ success: false, message: 'name, items, bundlePrice, regularPrice required' });
    }
    const slug = body.slug || slugify(body.name);
    const created = await GroceryBundle.create({ ...body, slug });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ success: false, message: 'Slug already exists' });
    logger.error('admin.bundle.create', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to create bundle' });
  }
};

exports.update = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
    const updated = await GroceryBundle.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Bundle not found' });
    res.json({ success: true, data: updated });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ success: false, message: 'Slug already exists' });
    logger.error('admin.bundle.update', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to update bundle' });
  }
};

exports.toggle = async (req, res) => {
  try {
    const b = await GroceryBundle.findById(req.params.id);
    if (!b) return res.status(404).json({ success: false, message: 'Bundle not found' });
    b.isActive = !b.isActive;
    await b.save();
    res.json({ success: true, data: b });
  } catch (e) { logger.error('admin.bundle.toggle', e); res.status(500).json({ success: false }); }
};

exports.remove = async (req, res) => {
  try {
    const r = await GroceryBundle.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Bundle not found' });
    res.json({ success: true });
  } catch (e) { logger.error('admin.bundle.remove', e); res.status(500).json({ success: false }); }
};
