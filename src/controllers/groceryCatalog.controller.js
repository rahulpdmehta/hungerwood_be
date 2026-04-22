const GroceryCategory = require('../models/GroceryCategory.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const GrocerySettings = require('../models/GrocerySettings.model');
const logger = require('../config/logger');

/** GET /api/grocery/categories — active categories only, sorted by order. */
exports.listCategories = async (_req, res) => {
  try {
    const cats = await GroceryCategory.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({
      success: true,
      data: cats.map(c => ({ ...c.toObject(), id: c._id.toString() })),
    });
  } catch (e) { logger.error('grocery.catalog.listCategories', e); res.status(500).json({ success: false }); }
};

/** GET /api/grocery/products — available products, optional ?category=<id> filter. */
exports.listProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const q = { isAvailable: true };
    if (category) q.category = category;
    if (search) q.$text = { $search: search };
    const items = await GroceryProduct.find(q).populate('category', 'name isActive').sort({ createdAt: -1 });
    // Hide products whose category is inactive
    const visible = items.filter(p => p.category && p.category.isActive !== false);
    res.json({
      success: true,
      data: visible.map(p => {
        const o = p.toObject();
        o.id = o._id.toString();
        o.category = o.category ? { id: o.category._id.toString(), name: o.category.name } : null;
        o.variants = (o.variants || []).filter(v => v.isAvailable).map(v => ({ ...v, id: v._id?.toString() }));
        return o;
      }),
    });
  } catch (e) { logger.error('grocery.catalog.listProducts', e); res.status(500).json({ success: false }); }
};

/** GET /api/grocery/products/:id — single product with all variants. */
exports.getProduct = async (req, res) => {
  try {
    const p = await GroceryProduct.findOne({ _id: req.params.id, isAvailable: true }).populate('category', 'name isActive');
    if (!p || !p.category || !p.category.isActive) return res.status(404).json({ success: false });
    const o = p.toObject();
    o.id = o._id.toString();
    o.category = { id: o.category._id.toString(), name: o.category.name };
    o.variants = (o.variants || []).map(v => ({ ...v, id: v._id?.toString() }));
    res.json({ success: true, data: o });
  } catch (e) { res.status(500).json({ success: false }); }
};

/** GET /api/grocery/settings — public subset for rendering bill breakdown. */
exports.getSettings = async (_req, res) => {
  try {
    const s = await GrocerySettings.get();
    const o = s.toObject();
    res.json({
      success: true,
      data: {
        isOpen: o.isOpen,
        closingMessage: o.closingMessage,
        taxRate: o.taxRate,
        deliveryFee: o.deliveryFee,
        freeDeliveryThreshold: o.freeDeliveryThreshold,
        minOrderValue: o.minOrderValue,
      },
    });
  } catch (e) { logger.error('grocery.catalog.getSettings', e); res.status(500).json({ success: false }); }
};
