/**
 * Find and optionally delete grocery products with invalid images.
 *
 * "Invalid" means one of:
 *   - empty / null image string
 *   - URL whose HEAD (or GET fallback) returns >= 400
 *   - local /uploads/... path whose file is missing on disk
 *
 * Network errors / timeouts are NOT treated as invalid (we err on the side
 * of keeping the product). Run dry-run first to inspect counts.
 *
 * Usage:
 *   node scripts/clean-invalid-product-images.js                # dry run
 *   node scripts/clean-invalid-product-images.js --delete       # actually delete
 *   node scripts/clean-invalid-product-images.js --concurrency=40
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const GroceryProduct = require('../src/models/GroceryProduct.model');

const args = process.argv.slice(2);
const DELETE = args.includes('--delete');
const CONCURRENCY = parseInt(
  (args.find(a => a.startsWith('--concurrency=')) || '').split('=')[1] || '20',
  10,
);
const TIMEOUT_MS = 7000;

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function checkUrl(url) {
  // result: { ok: bool, reason: string }
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { ok: false, reason: 'empty' };
  }
  const trimmed = url.trim();

  // Local upload path
  if (trimmed.startsWith('/uploads/')) {
    const filename = trimmed.replace(/^\/uploads\//, '');
    const fullPath = path.join(UPLOADS_DIR, filename);
    return fs.existsSync(fullPath)
      ? { ok: true, reason: 'local-exists' }
      : { ok: false, reason: 'local-missing' };
  }

  // Must be http(s)
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, reason: 'malformed' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(trimmed, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    // Some CDNs reject HEAD with 405; fall back to a tiny GET
    if (res.status === 405 || res.status === 403) {
      res = await fetch(trimmed, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    clearTimeout(timer);
    if (res.status >= 400) {
      return { ok: false, reason: `http-${res.status}` };
    }
    return { ok: true, reason: `http-${res.status}` };
  } catch (e) {
    clearTimeout(timer);
    // network error / timeout → keep (we don't want to delete on flaky net)
    return { ok: true, reason: `net-error:${e.name || 'unknown'}` };
  }
}

async function runPool(items, worker, concurrency) {
  let i = 0;
  const out = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await worker(items[idx], idx);
      }
    }),
  );
  return out;
}

(async () => {
  console.log(`Mode: ${DELETE ? 'DELETE' : 'DRY RUN'}  |  concurrency: ${CONCURRENCY}`);
  await mongoose.connect(process.env.MONGO_URI);

  const products = await GroceryProduct.find({}, { _id: 1, name: 1, image: 1 }).lean();
  console.log(`Loaded ${products.length} products. Checking images…`);

  let done = 0;
  const t0 = Date.now();
  const results = await runPool(
    products,
    async (p) => {
      const { ok, reason } = await checkUrl(p.image);
      done += 1;
      if (done % 200 === 0) {
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${done}/${products.length} checked (${dt}s)`);
      }
      return { id: p._id, name: p.name, image: p.image, ok, reason };
    },
    CONCURRENCY,
  );

  const invalid = results.filter(r => !r.ok);
  const byReason = invalid.reduce((acc, r) => {
    acc[r.reason] = (acc[r.reason] || 0) + 1;
    return acc;
  }, {});

  console.log('\n— Summary —');
  console.log(`Total: ${results.length}`);
  console.log(`Invalid: ${invalid.length}`);
  console.log('By reason:');
  Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .forEach(([r, n]) => console.log(`  ${r}: ${n}`));

  if (invalid.length) {
    console.log('\nSample (first 10):');
    invalid.slice(0, 10).forEach(r => {
      console.log(`  - [${r.reason}] ${r.name}  ${r.image || '(empty)'}`);
    });
  }

  if (!DELETE) {
    console.log('\nDry run complete. Re-run with --delete to remove these products.');
  } else if (invalid.length) {
    const ids = invalid.map(r => r.id);
    const res = await GroceryProduct.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${res.deletedCount} products.`);
  } else {
    console.log('\nNothing to delete.');
  }

  await mongoose.disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
