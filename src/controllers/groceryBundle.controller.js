const GroceryBundle = require('../models/GroceryBundle.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const logger = require('../config/logger');

/** GET /api/grocery/bundles */
exports.list = async (req, res) => {
  try {
    const list = await GroceryBundle.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .populate('items.product', 'name image brand variants')
      .lean();
    const enriched = list.map(b => ({
      ...b,
      items: (b.items || []).map(it => {
        const variant = it.product?.variants?.find(v => String(v._id) === String(it.variantId));
        return {
          productId: it.product?._id,
          variantId: it.variantId,
          quantity: it.quantity,
          name: it.product?.name,
          image: it.product?.image,
          variantLabel: variant?.label,
          mrp: variant?.mrp,
          sellingPrice: variant?.sellingPrice,
        };
      }),
    }));
    res.json({ success: true, data: enriched });
  } catch (e) {
    logger.error('grocery.bundle.list', e);
    res.status(500).json({ success: false });
  }
};

/**
 * GET /api/grocery/bundles/:slug
 * Returns the resolved item list (already enriched with product/variant
 * snapshot) so the client can drop them straight into the cart.
 */
exports.getBySlug = async (req, res) => {
  try {
    const b = await GroceryBundle.findOne({ slug: req.params.slug, isActive: true })
      .populate('items.product', 'name image brand variants')
      .lean();
    if (!b) return res.status(404).json({ success: false, message: 'Bundle not found' });
    const items = (b.items || [])
      .map(it => {
        const variant = it.product?.variants?.find(v => String(v._id) === String(it.variantId));
        if (!variant || !variant.isAvailable) return null;
        return {
          productId: it.product._id,
          variantId: it.variantId,
          quantity: it.quantity,
          name: it.product.name,
          image: it.product.image,
          variantLabel: variant.label,
          mrp: variant.mrp,
          sellingPrice: variant.sellingPrice,
        };
      })
      .filter(Boolean);
    res.json({
      success: true,
      data: {
        slug: b.slug,
        name: b.name,
        description: b.description,
        theme: b.theme,
        bundlePrice: b.bundlePrice,
        regularPrice: b.regularPrice,
        bundleDiscount: Math.max(0, b.regularPrice - b.bundlePrice),
        items,
      },
    });
  } catch (e) {
    logger.error('grocery.bundle.getBySlug', e);
    res.status(500).json({ success: false });
  }
};
