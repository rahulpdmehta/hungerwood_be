const GroceryOrder = require('../models/GroceryOrder.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const logger = require('../config/logger');

/**
 * POST /api/grocery/orders/:id/reorder
 * Returns a list of items from the original order that are still
 * available, plus a list of skipped items (with reason). The client adds
 * the available items to the cart.
 *
 * Does not mutate any state.
 */
exports.reorder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const original = await GroceryOrder.findOne({ _id: req.params.id, user: userId }).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Order not found' });

    const productIds = [...new Set((original.items || []).map(i => String(i.product)))];
    const products = await GroceryProduct.find({ _id: { $in: productIds }, isAvailable: true }).lean();
    const byId = new Map(products.map(p => [String(p._id), p]));

    const added = [];
    const skipped = [];
    for (const it of original.items || []) {
      const p = byId.get(String(it.product));
      if (!p) {
        skipped.push({ name: it.name, reason: 'Product no longer available' });
        continue;
      }
      const v = (p.variants || []).find(x => String(x._id) === String(it.variantId));
      if (!v || !v.isAvailable) {
        skipped.push({ name: it.name, reason: 'Variant no longer available' });
        continue;
      }
      added.push({
        productId: String(p._id),
        variantId: String(v._id),
        quantity: it.quantity,
        name: p.name,
        variantLabel: v.label,
        mrp: v.mrp,
        sellingPrice: v.sellingPrice,
        image: p.image,
      });
    }

    res.json({ success: true, data: { added, skipped } });
  } catch (e) {
    logger.error('grocery.reorder', e);
    res.status(500).json({ success: false });
  }
};
