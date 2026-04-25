const GroceryProduct = require('../models/GroceryProduct.model');
const GroceryCategory = require('../models/GroceryCategory.model');
const logger = require('../config/logger');

const serialize = (p) => {
  const o = p.toObject();
  o.id = o._id.toString();
  if (o.category && typeof o.category === 'object') {
    // Populated category doc: keep { id, name }. Otherwise it's a raw ObjectId
    // and we want a plain string id.
    if (o.category.name !== undefined) {
      o.category = { id: (o.category._id || o.category.id || '').toString(), name: o.category.name };
    } else {
      o.category = o.category.toString();
    }
  }
  o.variants = (o.variants || []).map(v => ({ ...v, id: v._id?.toString() }));
  return o;
};

/** Parse variants from multipart payload (may arrive as JSON string) or JSON body. */
function parseVariants(raw) {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return raw;
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.list = async (req, res) => {
  try {
    const { category, search, available } = req.query;
    const q = {};
    if (category) q.category = category;
    if (available === 'true') q.isAvailable = true;
    else if (available === 'false') q.isAvailable = false;
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      q.$or = [{ name: rx }, { brand: rx }, { description: rx }];
    }

    // When `page` is present, paginate. Otherwise return the full list
    // (kept for callers that need every product, e.g. the bundles picker).
    if (req.query.page !== undefined || req.query.limit !== undefined) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        GroceryProduct.find(q)
          .populate('category', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        GroceryProduct.countDocuments(q),
      ]);
      return res.json({
        success: true,
        data: items.map(serialize),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    }

    const items = await GroceryProduct.find(q).populate('category', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: items.map(serialize) });
  } catch (e) { logger.error('grocery.product.list', e); res.status(500).json({ success: false }); }
};

exports.get = async (req, res) => {
  try {
    const p = await GroceryProduct.findById(req.params.id).populate('category', 'name');
    if (!p) return res.status(404).json({ success: false });
    res.json({ success: true, data: serialize(p) });
  } catch (e) { res.status(500).json({ success: false }); }
};

exports.create = async (req, res) => {
  try {
    const { name, brand = '', description = '', category, isAvailable = true, tags = {} } = req.body;
    const variants = parseVariants(req.body.variants);
    if (!name || !category) return res.status(400).json({ success: false, message: 'name and category required' });
    if (!variants.length) return res.status(400).json({ success: false, message: 'At least one variant required' });
    const catExists = await GroceryCategory.findById(category);
    if (!catExists) return res.status(400).json({ success: false, message: 'Invalid category' });
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;
    if (!image) return res.status(400).json({ success: false, message: 'image required' });
    const p = await GroceryProduct.create({ name, brand, description, image, category, variants, isAvailable, tags });
    res.status(201).json({ success: true, data: serialize(p) });
  } catch (e) {
    logger.error('grocery.product.create', e);
    res.status(e.name === 'ValidationError' ? 400 : 500).json({ success: false, message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const p = await GroceryProduct.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false });
    const { name, brand, description, category, isAvailable, tags } = req.body;
    if (name !== undefined) p.name = name;
    if (brand !== undefined) p.brand = brand;
    if (description !== undefined) p.description = description;
    if (category !== undefined) p.category = category;
    if (isAvailable !== undefined) p.isAvailable = isAvailable;
    if (tags !== undefined) p.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (req.body.variants !== undefined) p.variants = parseVariants(req.body.variants);
    if (req.file) p.image = `/uploads/${req.file.filename}`;
    else if (req.body.image !== undefined) p.image = req.body.image;
    await p.save();
    res.json({ success: true, data: serialize(p) });
  } catch (e) {
    logger.error('grocery.product.update', e);
    res.status(e.name === 'ValidationError' ? 400 : 500).json({ success: false, message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await GroceryProduct.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
};

exports.toggle = async (req, res) => {
  try {
    const p = await GroceryProduct.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false });
    p.isAvailable = !p.isAvailable;
    await p.save();
    res.json({ success: true, data: serialize(p) });
  } catch (e) { res.status(500).json({ success: false }); }
};
