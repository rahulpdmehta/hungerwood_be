#!/usr/bin/env node
/**
 * One-off migration for Grocery Section v1.
 *
 * Steps (all idempotent):
 *   1. Rename User.role 'ADMIN' -> 'SUPER_ADMIN'
 *   2. Default Banner.section to 'food' where missing
 *   3. Default WalletTransaction.section to null where missing
 *   4. Upsert GrocerySettings singleton with safe defaults (isOpen=false)
 *   5. If SUPER_ADMIN_PHONE env var is set and no super-admin exists, create one.
 *
 * Run: node scripts/migrate-grocery-v1.js
 * Safe to re-run.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/config/logger');

async function run() {
  await connectDB();
  const db = mongoose.connection.db;

  // 1. Rename ADMIN -> SUPER_ADMIN
  const r1 = await db.collection('users').updateMany(
    { role: 'ADMIN' },
    { $set: { role: 'SUPER_ADMIN' } }
  );
  logger.info(`[migrate] role ADMIN->SUPER_ADMIN: ${r1.modifiedCount} users updated`);

  // 2. Banner.section default
  const r2 = await db.collection('banners').updateMany(
    { section: { $exists: false } },
    { $set: { section: 'food' } }
  );
  logger.info(`[migrate] banner.section backfill: ${r2.modifiedCount} banners updated`);

  // 3. WalletTransaction.section default
  const r3 = await db.collection('wallettransactions').updateMany(
    { section: { $exists: false } },
    { $set: { section: null } }
  );
  logger.info(`[migrate] wallettransaction.section backfill: ${r3.modifiedCount} rows updated`);

  // 4. GrocerySettings singleton upsert
  const r4 = await db.collection('grocerysettings').updateOne(
    { _id: 'grocery-settings' },
    {
      $setOnInsert: {
        _id: 'grocery-settings',
        isOpen: false,
        closingMessage: '',
        taxRate: 0.05,
        deliveryFee: 40,
        freeDeliveryThreshold: null,
        minOrderValue: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  logger.info(`[migrate] grocerysettings upsert: matched=${r4.matchedCount} upserted=${r4.upsertedCount}`);

  // 5. Seed super-admin from env if none exists
  const phone = process.env.SUPER_ADMIN_PHONE;
  if (phone) {
    const existing = await db.collection('users').findOne({ role: 'SUPER_ADMIN' });
    if (!existing) {
      await db.collection('users').insertOne({
        phone,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info(`[migrate] seeded super-admin with phone ${phone}`);
    } else {
      logger.info(`[migrate] super-admin already exists (${existing.phone}) — skipping seed`);
    }
  } else {
    logger.warn('[migrate] SUPER_ADMIN_PHONE env not set — skipping seed. Set it before deploy if no admin yet.');
  }

  await mongoose.disconnect();
  logger.info('[migrate] done.');
}

run().catch(err => {
  logger.error('[migrate] FAILED:', err);
  process.exit(1);
});
