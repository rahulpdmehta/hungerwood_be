const SearchLog = require('../models/SearchLog.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const logger = require('../config/logger');

const HOT_THRESHOLD = 10; // 7-day count needed to earn the 🔥 trending pill

/**
 * GET /api/grocery/search/trending
 * Top terms in the last 7 days with `hot` flag if popular enough.
 */
exports.trending = async (_req, res) => {
  try {
    const cutoff = new Date(Date.now() - 7 * 86400000);
    const top = await SearchLog.aggregate([
      { $match: { createdAt: { $gte: cutoff } } },
      { $group: { _id: '$term', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);
    res.json({
      success: true,
      data: top.map(t => ({ term: t._id, hot: t.count >= HOT_THRESHOLD })),
    });
  } catch (e) {
    logger.error('grocery.search.trending', e);
    res.status(500).json({ success: false, data: [] });
  }
};

/**
 * GET /api/grocery/search/suggest?q=…
 * Live product suggestions for a partial query. Uses the existing text
 * index on (name, brand). Returns empty for queries shorter than 2 chars.
 */
exports.suggest = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });

    // Fall back from $text to a regex prefix match for very short / no-stem
    // queries — text index would otherwise miss "att" matching "atta".
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const list = await GroceryProduct.find({
      isAvailable: true,
      $or: [{ name: regex }, { brand: regex }],
    })
      .limit(8)
      .populate('category', 'name')
      .lean();

    res.json({
      success: true,
      data: list.map(p => ({
        id: String(p._id),
        name: p.name,
        brand: p.brand,
        image: p.image,
        category: p.category?.name,
      })),
    });
  } catch (e) {
    logger.error('grocery.search.suggest', e);
    res.status(500).json({ success: false, data: [] });
  }
};

/**
 * POST /api/grocery/search/log
 * Lightweight write — the search page sends every submitted term so
 * trending can be computed.
 */
exports.log = async (req, res) => {
  try {
    const term = String(req.body?.term || '').trim().toLowerCase().slice(0, 60);
    if (!term) return res.json({ success: true });
    SearchLog.create({ term, user: req.user?.userId }).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    logger.error('grocery.search.log', e);
    res.json({ success: true }); // best-effort, never fail the client
  }
};
