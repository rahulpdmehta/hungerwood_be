const GroceryOrder = require('../models/GroceryOrder.model');
const ProductAffinity = require('../models/ProductAffinity.model');

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Recompute productA → productB co-occurrence scores from all grocery
 * orders in the last `windowDays` days. Writes one document per ordered
 * pair where (a !== b).
 *
 * Returns the number of pair documents written.
 */
async function recompute({ windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const cutoff = new Date(Date.now() - windowDays * 86400000);
  const orders = await GroceryOrder.find(
    { createdAt: { $gte: cutoff } },
    { items: 1 }
  ).lean();

  const pairs = new Map();
  for (const o of orders) {
    const ids = [...new Set((o.items || []).map(i => String(i.product)))];
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const key = `${ids[i]}|${ids[j]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  await ProductAffinity.deleteMany({});
  if (pairs.size === 0) return 0;

  const docs = [];
  for (const [key, score] of pairs.entries()) {
    const [productA, productB] = key.split('|');
    docs.push({ productA, productB, score });
  }
  await ProductAffinity.insertMany(docs);
  return docs.length;
}

module.exports = { recompute, DEFAULT_WINDOW_DAYS };
