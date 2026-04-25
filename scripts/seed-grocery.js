#!/usr/bin/env node
/**
 * Dummy grocery data seeder.
 *
 * - Enables GrocerySettings and sets billing defaults
 * - Upserts ~5 categories
 * - Upserts ~15 products across categories, each with 1-3 variants
 *
 * Idempotent: re-running updates existing records in place rather than creating duplicates.
 *
 * Run: node scripts/seed-grocery.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/config/logger');

const GroceryCategory = require('../src/models/GroceryCategory.model');
const GroceryProduct = require('../src/models/GroceryProduct.model');
const GrocerySettings = require('../src/models/GrocerySettings.model');

const CATEGORIES = [
  { name: 'Staples',              order: 1,  image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80' },
  { name: 'Dairy',                order: 2,  image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80' },
  { name: 'Fruits & Vegetables',  order: 3,  image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' },
  { name: 'Snacks',               order: 4,  image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80' },
  { name: 'Beverages',            order: 5,  image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80' },
  { name: 'Bakery',               order: 6,  image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80' },
  { name: 'Masala & Spices',      order: 7,  image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80' },
  { name: 'Oil & Ghee',           order: 8,  image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80' },
  { name: 'Personal Care',        order: 9,  image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80' },
  { name: 'Household',            order: 10, image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80' },
  { name: 'Breakfast & Cereals',  order: 11, image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&q=80' },
  { name: 'Atta & Flours',        order: 12, image: 'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=400&q=80' },
  { name: 'Rice & Rice Products', order: 13, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80' },
  { name: 'Dals & Pulses',        order: 14, image: 'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80' },
  { name: 'Dry Fruits & Nuts',    order: 15, image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80' },
  { name: 'Chocolates',           order: 16, image: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80' },
  { name: 'Sweets & Desserts',    order: 17, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80' },
  { name: 'Ice Cream',            order: 18, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80' },
  { name: 'Frozen Foods',         order: 19, image: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=400&q=80' },
  { name: 'Sauces & Ketchups',    order: 20, image: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=400&q=80' },
  { name: 'Jams & Spreads',       order: 21, image: 'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80' },
  { name: 'Pickles & Chutneys',   order: 22, image: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=400&q=80' },
  { name: 'Noodles & Pasta',      order: 23, image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80' },
  { name: 'Ready to Eat',         order: 24, image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80' },
  { name: 'Biscuits & Cookies',   order: 25, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80' },
  { name: 'Chips & Namkeen',      order: 26, image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80' },
  { name: 'Tea',                  order: 27, image: 'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=400&q=80' },
  { name: 'Coffee',               order: 28, image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&q=80' },
  { name: 'Juices',               order: 29, image: 'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80' },
  { name: 'Soft Drinks',          order: 30, image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80' },
  { name: 'Energy Drinks',        order: 31, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80' },
  { name: 'Water',                order: 32, image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80' },
  { name: 'Baby Food',            order: 33, image: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=400&q=80' },
  { name: 'Paneer & Cheese',      order: 34, image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80' },
  { name: 'Curd & Yogurt',        order: 35, image: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80' },
  { name: 'Eggs',                 order: 36, image: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400&q=80' },
  { name: 'Chicken & Meat',       order: 37, image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80' },
  { name: 'Fish & Seafood',       order: 38, image: 'https://images.unsplash.com/photo-1535596898139-e2c54ab81e8b?w=400&q=80' },
  { name: 'Beauty & Makeup',      order: 39, image: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&q=80' },
  { name: 'Hair Care',            order: 40, image: 'https://images.unsplash.com/photo-1526045478516-99145907023c?w=400&q=80' },
  { name: 'Oral Care',            order: 41, image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=400&q=80' },
  { name: 'Skin Care',            order: 42, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80' },
  { name: "Men's Grooming",       order: 43, image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=80' },
  { name: 'Deodorants',           order: 44, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80' },
  { name: 'Baby Care',            order: 45, image: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=400&q=80' },
  { name: 'Feminine Hygiene',     order: 46, image: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80' },
  { name: 'Pet Food',             order: 47, image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80' },
  { name: 'Detergents',           order: 48, image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80' },
  { name: 'Dishwash',             order: 49, image: 'https://images.unsplash.com/photo-1600857062241-98ef96a7e3db?w=400&q=80' },
  { name: 'Floor & Toilet Care',  order: 50, image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80' },
  { name: 'Pooja Needs',          order: 51, image: 'https://images.unsplash.com/photo-1545048709-9fa36c1ad9a2?w=400&q=80' },
  { name: 'Kitchen Essentials',   order: 52, image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80' },
  { name: 'Stationery',           order: 53, image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80' },
  { name: 'Air Fresheners',       order: 54, image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&q=80' },
];

// Products reference categories by name; we resolve IDs after categories are upserted.
const PRODUCTS = [
  // Staples
  {
    name: 'Aashirvaad Atta', brand: 'Aashirvaad', category: 'Staples',
    image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
    description: 'Whole wheat flour — soft, fluffy rotis every time.',
    tags: { isBestseller: true, isNew: false },
    variants: [
      { label: '1 kg',  mrp: 55,  sellingPrice: 52 },
      { label: '5 kg',  mrp: 260, sellingPrice: 240 },
      { label: '10 kg', mrp: 510, sellingPrice: 470 },
    ],
  },
  {
    name: 'India Gate Basmati Rice', brand: 'India Gate', category: 'Staples',
    image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80',
    description: 'Long-grain aromatic basmati rice.',
    tags: { isBestseller: true },
    variants: [
      { label: '1 kg', mrp: 130, sellingPrice: 120 },
      { label: '5 kg', mrp: 620, sellingPrice: 580 },
    ],
  },
  {
    name: 'Tata Sampann Toor Dal', brand: 'Tata Sampann', category: 'Staples',
    image: 'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80',
    description: 'Unpolished toor dal, rich in protein.',
    variants: [
      { label: '500 g', mrp: 90,  sellingPrice: 82 },
      { label: '1 kg',  mrp: 170, sellingPrice: 155 },
    ],
  },

  // Dairy
  {
    name: 'Amul Gold Full Cream Milk', brand: 'Amul', category: 'Dairy',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
    description: 'Rich, creamy full-cream milk.',
    tags: { isBestseller: true },
    variants: [
      { label: '500 ml', mrp: 36, sellingPrice: 34 },
      { label: '1 L',    mrp: 68, sellingPrice: 65 },
    ],
  },
  {
    name: 'Amul Butter', brand: 'Amul', category: 'Dairy',
    image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
    description: 'Classic salted butter.',
    variants: [
      { label: '100 g', mrp: 58,  sellingPrice: 55 },
      { label: '500 g', mrp: 275, sellingPrice: 260 },
    ],
  },
  {
    name: 'Nestle a+ Dahi', brand: 'Nestle', category: 'Dairy',
    image: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80',
    description: 'Thick, creamy set dahi.',
    variants: [
      { label: '400 g', mrp: 65, sellingPrice: 60 },
    ],
  },
  {
    name: 'Mother Dairy Paneer', brand: 'Mother Dairy', category: 'Dairy',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80',
    description: 'Fresh, soft paneer.',
    tags: { isNew: true },
    variants: [
      { label: '200 g', mrp: 90,  sellingPrice: 85 },
      { label: '500 g', mrp: 210, sellingPrice: 195 },
    ],
  },

  // Snacks
  {
    name: "Lay's Classic Salted", brand: "Lay's", category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
    description: 'Classic salted potato chips.',
    tags: { isBestseller: true },
    variants: [
      { label: 'Small (30 g)', mrp: 20, sellingPrice: 18 },
      { label: 'Party (80 g)', mrp: 50, sellingPrice: 45 },
    ],
  },
  {
    name: "Haldiram's Aloo Bhujia", brand: "Haldiram's", category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80',
    description: 'Crunchy potato-based namkeen.',
    variants: [
      { label: '200 g', mrp: 60,  sellingPrice: 55 },
      { label: '400 g', mrp: 115, sellingPrice: 105 },
    ],
  },
  {
    name: 'Parle-G Biscuits', brand: 'Parle', category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    description: 'Classic glucose biscuits.',
    variants: [
      { label: 'Single (55 g)', mrp: 10, sellingPrice: 10 },
      { label: 'Family (800 g)', mrp: 90, sellingPrice: 85 },
    ],
  },

  // Beverages
  {
    name: 'Coca-Cola', brand: 'Coca-Cola', category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80',
    description: 'The classic cola.',
    variants: [
      { label: '750 ml', mrp: 40, sellingPrice: 38 },
      { label: '2 L',    mrp: 95, sellingPrice: 90 },
    ],
  },
  {
    name: 'Real Fruit Power Mixed Juice', brand: 'Real', category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80',
    description: '100% fruit juice blend.',
    tags: { isNew: true },
    variants: [
      { label: '1 L', mrp: 110, sellingPrice: 100 },
    ],
  },
  {
    name: 'Tata Tea Premium', brand: 'Tata', category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=400&q=80',
    description: 'Strong, refreshing chai.',
    variants: [
      { label: '250 g', mrp: 135, sellingPrice: 125 },
      { label: '500 g', mrp: 265, sellingPrice: 250 },
    ],
  },

  // Household
  {
    name: 'Surf Excel Matic', brand: 'Surf Excel', category: 'Household',
    image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80',
    description: 'Front-load detergent powder.',
    variants: [
      { label: '1 kg', mrp: 180, sellingPrice: 165 },
      { label: '4 kg', mrp: 650, sellingPrice: 595 },
    ],
  },
  {
    name: 'Dettol Original Soap', brand: 'Dettol', category: 'Household',
    image: 'https://images.unsplash.com/photo-1600857062241-98ef96a7e3db?w=400&q=80',
    description: 'Antibacterial bar soap.',
    variants: [
      { label: '75 g',  mrp: 45,  sellingPrice: 40 },
      { label: '125 g', mrp: 70,  sellingPrice: 63 },
    ],
  },
];

async function run() {
  await connectDB();

  // 1. Enable grocery + sensible defaults
  const settings = await GrocerySettings.get();
  settings.isOpen = true;
  if (settings.taxRate == null) settings.taxRate = 0.05;
  if (!settings.deliveryFee) settings.deliveryFee = 40;
  if (settings.freeDeliveryThreshold == null) settings.freeDeliveryThreshold = 499;
  if (settings.minOrderValue == null) settings.minOrderValue = 199;
  await settings.save();
  logger.info(`[seed] GrocerySettings → isOpen=${settings.isOpen}, tax=${settings.taxRate}, delivery=${settings.deliveryFee}, free>=${settings.freeDeliveryThreshold}, min=${settings.minOrderValue}`);

  // 2. Upsert categories; collect name→_id map
  const catByName = new Map();
  for (const c of CATEGORIES) {
    const doc = await GroceryCategory.findOneAndUpdate(
      { name: c.name },
      { $set: { image: c.image, order: c.order, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    catByName.set(c.name, doc._id);
  }
  logger.info(`[seed] Categories upserted: ${catByName.size}`);

  // 3. Upsert products
  let created = 0;
  let updated = 0;
  for (const p of PRODUCTS) {
    const categoryId = catByName.get(p.category);
    if (!categoryId) {
      logger.warn(`[seed] Skipping ${p.name} — unknown category ${p.category}`);
      continue;
    }
    const payload = {
      name: p.name,
      brand: p.brand,
      description: p.description || '',
      image: p.image,
      category: categoryId,
      variants: p.variants.map(v => ({ ...v, isAvailable: true })),
      isAvailable: true,
      tags: { isBestseller: !!p.tags?.isBestseller, isNew: !!p.tags?.isNew },
    };
    const existing = await GroceryProduct.findOne({ name: p.name });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      updated++;
    } else {
      await GroceryProduct.create(payload);
      created++;
    }
  }
  logger.info(`[seed] Products: ${created} created, ${updated} updated`);

  await mongoose.disconnect();
  logger.info('[seed] done.');
}

run().catch(err => {
  logger.error('[seed] FAILED:', err);
  process.exit(1);
});
