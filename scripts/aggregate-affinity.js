#!/usr/bin/env node
/**
 * Recompute the ProductAffinity collection from the last 30 days of
 * grocery orders. Intended to run nightly via OS cron, e.g.:
 *
 *   0 3 * * * cd /path/to/backend && node scripts/aggregate-affinity.js
 *
 * Idempotent — wipes and rewrites the collection on every run.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/env');
const logger = require('../src/config/logger');
const { recompute } = require('../src/services/affinity.service');

(async () => {
  try {
    await mongoose.connect(config.mongoUri || process.env.MONGO_URI);
    const written = await recompute();
    logger.info(`affinity recompute: wrote ${written} pair documents`);
    process.exit(0);
  } catch (err) {
    logger.error('affinity recompute failed', err);
    process.exit(1);
  }
})();
