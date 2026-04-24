#!/usr/bin/env node
/**
 * Seed the e2e test database with deterministic fixtures.
 *
 * Wipes hungerwood_e2e (or whatever MONGO_URI points at) and creates:
 *   - 4 fixed users (customer, restaurant-admin, grocery-admin, super-admin)
 *     all signing in via OTP `000000` (requires E2E_BYPASS_OTP=true on backend)
 *   - 3 grocery categories: Atta & Rice, Dairy, Snacks
 *   - 6 grocery products spread across them, 2 multi-variant
 *   - 2 bundles: Daily Essentials (warm), Tea-time (rose)
 *   - 2 coupons: TEST10 (10% PERCENTAGE max ₹50), FREEDEL (FREE_DELIVERY)
 *   - GrocerySettings.isOpen = true with sane defaults
 *
 * Usage:
 *   MONGO_URI=mongodb://localhost:27017/hungerwood_e2e node scripts/seed-e2e.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const PHONES = {
  customer:        '9999900001',
  restaurantAdmin: '9999900002',
  groceryAdmin:    '9999900003',
  superAdmin:      '9999900004',
};

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri || !uri.includes('e2e')) {
    console.error('Refusing to seed: MONGO_URI must include "e2e" in the database name to avoid accidental wipes.');
    process.exit(2);
  }
  await mongoose.connect(uri);

  // Wipe everything first (small DB, simple reset).
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    await mongoose.connection.db.collection(c.name).deleteMany({});
  }
  console.log(`Cleared ${collections.length} collections.`);

  const User = require('../src/models/User.model');
  const GroceryCategory = require('../src/models/GroceryCategory.model');
  const GroceryProduct = require('../src/models/GroceryProduct.model');
  const GrocerySettings = require('../src/models/GrocerySettings.model');
  const GroceryBundle = require('../src/models/GroceryBundle.model');
  const Coupon = require('../src/models/Coupon.model');
  const { ROLES } = require('../src/utils/constants');

  // Users
  const users = await User.insertMany([
    { phone: PHONES.customer,        name: 'E2E Customer',  role: ROLES.USER, isProfileComplete: true, isActive: true },
    { phone: PHONES.restaurantAdmin, name: 'E2E Rest Admin', role: ROLES.RESTAURANT_ADMIN, isProfileComplete: true, isActive: true },
    { phone: PHONES.groceryAdmin,    name: 'E2E Gro Admin',  role: ROLES.GROCERY_ADMIN,    isProfileComplete: true, isActive: true },
    { phone: PHONES.superAdmin,      name: 'E2E Super',      role: ROLES.SUPER_ADMIN,      isProfileComplete: true, isActive: true },
  ]);
  const customerId = users[0]._id;

  // Categories
  const cats = await GroceryCategory.insertMany([
    { name: 'Atta & Rice', image: 'https://picsum.photos/seed/atta/200', order: 1, isActive: true },
    { name: 'Dairy',       image: 'https://picsum.photos/seed/dairy/200', order: 2, isActive: true },
    { name: 'Snacks',      image: 'https://picsum.photos/seed/snacks/200', order: 3, isActive: true },
  ]);

  // Products
  const products = await GroceryProduct.insertMany([
    {
      name: 'Aashirvaad Atta', brand: 'Aashirvaad', description: 'Whole wheat',
      image: 'https://picsum.photos/seed/aatta/300', category: cats[0]._id,
      isAvailable: true, tags: { isBestseller: true, isNew: false },
      variants: [
        { label: '1 kg',  mrp: 60,  sellingPrice: 52,  isAvailable: true },
        { label: '5 kg',  mrp: 290, sellingPrice: 245, isAvailable: true },
        { label: '10 kg', mrp: 540, sellingPrice: 485, isAvailable: true },
      ],
    },
    {
      name: 'Sona Masuri Rice', brand: 'India Gate',
      image: 'https://picsum.photos/seed/rice/300', category: cats[0]._id,
      isAvailable: true,
      variants: [{ label: '5 kg', mrp: 380, sellingPrice: 360, isAvailable: true }],
    },
    {
      name: 'Amul Butter', brand: 'Amul',
      image: 'https://picsum.photos/seed/butter/300', category: cats[1]._id,
      isAvailable: true, tags: { isBestseller: true },
      variants: [
        { label: '100g', mrp: 60,  sellingPrice: 55,  isAvailable: true },
        { label: '500g', mrp: 280, sellingPrice: 265, isAvailable: true },
      ],
    },
    {
      name: 'Mother Dairy Milk', brand: 'Mother Dairy',
      image: 'https://picsum.photos/seed/milk/300', category: cats[1]._id,
      isAvailable: true,
      variants: [{ label: '1 L', mrp: 68, sellingPrice: 64, isAvailable: true }],
    },
    {
      name: 'Parle-G Biscuits', brand: 'Parle',
      image: 'https://picsum.photos/seed/parleg/300', category: cats[2]._id,
      isAvailable: true, tags: { isBestseller: true },
      variants: [{ label: '800g', mrp: 95, sellingPrice: 85, isAvailable: true }],
    },
    {
      name: 'Lays Classic', brand: 'Lays',
      image: 'https://picsum.photos/seed/lays/300', category: cats[2]._id,
      isAvailable: true,
      variants: [{ label: '52g', mrp: 20, sellingPrice: 20, isAvailable: true }],
    },
  ]);

  // Bundles — pick the cheapest variant from each chosen product
  await GroceryBundle.insertMany([
    {
      name: 'Daily Essentials Bundle', slug: 'daily-essentials', theme: 'warm',
      description: 'Atta + rice + milk + butter',
      items: [
        { product: products[0]._id, variantId: products[0].variants[0]._id, quantity: 1 }, // 1kg atta
        { product: products[1]._id, variantId: products[1].variants[0]._id, quantity: 1 }, // 5kg rice
        { product: products[3]._id, variantId: products[3].variants[0]._id, quantity: 1 }, // 1L milk
        { product: products[2]._id, variantId: products[2].variants[0]._id, quantity: 1 }, // 100g butter
      ],
      bundlePrice: 510, regularPrice: 588, isActive: true, order: 1,
    },
    {
      name: 'Tea-time Bundle', slug: 'tea-time', theme: 'rose',
      description: 'Biscuits + chips',
      items: [
        { product: products[4]._id, variantId: products[4].variants[0]._id, quantity: 2 },
        { product: products[5]._id, variantId: products[5].variants[0]._id, quantity: 2 },
      ],
      bundlePrice: 190, regularPrice: 210, isActive: true, order: 2,
    },
  ]);

  // Coupons
  const dayMs = 86_400_000;
  await Coupon.insertMany([
    {
      code: 'TEST10', section: 'grocery', description: '10% off · max ₹50',
      type: 'PERCENTAGE', value: 10, maxDiscount: 50, minOrderValue: 100,
      validFrom: new Date(Date.now() - dayMs), validTo: new Date(Date.now() + 30 * dayMs),
      isActive: true, theme: 'green',
    },
    {
      code: 'FREEDEL', section: 'grocery', description: 'Free delivery · no minimum',
      type: 'FREE_DELIVERY', value: 0,
      validFrom: new Date(Date.now() - dayMs), validTo: new Date(Date.now() + 30 * dayMs),
      isActive: true, theme: 'amber',
    },
  ]);

  // Settings
  const settings = await GrocerySettings.get();
  settings.isOpen = true;
  settings.taxRate = 0.05;
  settings.deliveryFee = 40;
  settings.freeDeliveryThreshold = 499;
  settings.minOrderValue = 99;
  await settings.save();

  console.log(`Seeded ${users.length} users, ${cats.length} categories, ${products.length} products, 2 bundles, 2 coupons.`);
  console.log(`Customer ${customerId} can sign in via phone ${PHONES.customer} + OTP 000000 (requires E2E_BYPASS_OTP=true on backend).`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('seed-e2e failed:', err);
  process.exit(1);
});
