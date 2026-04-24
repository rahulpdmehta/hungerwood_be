const ProductAffinity = require('../models/ProductAffinity.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const logger = require('../config/logger');

/**
 * GET /api/grocery/products/:id/fbt
 * Top-N (default 2) "frequently bought together" products. Falls back to
 * same-category bestsellers if affinity data is sparse for this product.
 */
exports.fbt = async (req, res) => {
  try {
    const id = req.params.id;
    const limit = Math.min(4, parseInt(req.query.limit, 10) || 2);

    const top = await ProductAffinity.find({ productA: id })
      .sort({ score: -1 })
      .limit(limit)
      .populate('productB')
      .lean();

    let products = top.map(t => t.productB).filter(p => p && p.isAvailable);

    if (products.length < limit) {
      const cur = await GroceryProduct.findById(id).lean();
      if (cur) {
        const need = limit - products.length;
        const seen = new Set(products.map(p => String(p._id)));
        seen.add(String(cur._id));
        const fallback = await GroceryProduct.find({
          category: cur.category,
          isAvailable: true,
          _id: { $nin: Array.from(seen) },
        })
          .limit(need)
          .lean();
        products = [...products, ...fallback];
      }
    }

    res.json({
      success: true,
      data: products.map(p => ({ ...p, id: String(p._id) })),
    });
  } catch (e) {
    logger.error('grocery.reco.fbt', e);
    res.status(500).json({ success: false });
  }
};

/**
 * GET /api/grocery/products/:id/more-from-brand
 * Up to 8 other products from the same brand. Empty if brand missing.
 */
exports.moreFromBrand = async (req, res) => {
  try {
    const cur = await GroceryProduct.findById(req.params.id).lean();
    if (!cur || !cur.brand) return res.json({ success: true, data: [] });
    const list = await GroceryProduct.find({
      brand: cur.brand,
      _id: { $ne: cur._id },
      isAvailable: true,
    })
      .limit(8)
      .lean();
    res.json({
      success: true,
      data: list.map(p => ({ ...p, id: String(p._id) })),
    });
  } catch (e) {
    logger.error('grocery.reco.moreFromBrand', e);
    res.status(500).json({ success: false });
  }
};
