#!/usr/bin/env node
/**
 * Grocery bundle seeder.
 *
 * Each bundle is defined as a list of slots — (category, name substring).
 * The script resolves each slot to a real product currently in the DB and
 * picks its cheapest available variant, then computes:
 *   regularPrice = Σ variant.sellingPrice
 *   bundlePrice  = regularPrice * (100 - discount) / 100
 *
 * Upserts by slug, so repeat runs are idempotent and pick up catalogue
 * changes (e.g. product names shifting after a reseed).
 *
 * Depends on categories + products already existing — run
 * scripts/seed-grocery.js and scripts/seed-grocery-bulk.js first.
 *
 * Run: node scripts/seed-grocery-bundles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/config/logger');

const GroceryCategory = require('../src/models/GroceryCategory.model');
const GroceryProduct = require('../src/models/GroceryProduct.model');
const GroceryBundle = require('../src/models/GroceryBundle.model');

const BUNDLES = [
  {
    name: 'Kitchen Basics Combo',
    slug: 'kitchen-basics-combo',
    description: 'Atta, dal, oil and salt — the monthly essentials.',
    theme: 'warm',
    discount: 15,
    slots: [
      { category: 'Atta & Flours',     nameIncludes: 'Atta' },
      { category: 'Dals & Pulses',     nameIncludes: 'Toor Dal' },
      { category: 'Oil & Ghee',        nameIncludes: 'Refined Oil' },
      { category: 'Staples',           nameIncludes: 'Rock Salt' },
    ],
  },
  {
    name: 'Breakfast Starter Pack',
    slug: 'breakfast-starter-pack',
    description: 'Cereal, milk, bread and tea — start your mornings sorted.',
    theme: 'green',
    discount: 12,
    slots: [
      { category: 'Breakfast & Cereals', nameIncludes: 'Corn Flakes' },
      { category: 'Dairy',               nameIncludes: 'Milk' },
      { category: 'Bakery',              nameIncludes: 'Bread' },
      { category: 'Tea',                 nameIncludes: 'Premium Tea' },
    ],
  },
  {
    name: 'Tea Time Combo',
    slug: 'tea-time-combo',
    description: 'Biscuits, chai and namkeen — the evening ritual.',
    theme: 'warm',
    discount: 14,
    slots: [
      { category: 'Tea',                 nameIncludes: 'Masala Chai' },
      { category: 'Biscuits & Cookies',  nameIncludes: 'Cream Biscuits' },
      { category: 'Chips & Namkeen',     nameIncludes: 'Aloo Bhujia' },
    ],
  },
  {
    name: 'Healthy Morning Bundle',
    slug: 'healthy-morning-bundle',
    description: 'Oats, honey, dry fruits and green tea for a clean start.',
    theme: 'green',
    discount: 13,
    slots: [
      { category: 'Breakfast & Cereals', nameIncludes: 'Oats' },
      { category: 'Jams & Spreads',      nameIncludes: 'Honey' },
      { category: 'Dry Fruits & Nuts',   nameIncludes: 'Almonds' },
      { category: 'Tea',                 nameIncludes: 'Green Tea' },
    ],
  },
  {
    name: 'Party Snacks Combo',
    slug: 'party-snacks-combo',
    description: 'Chips, chocolates and soft drinks — everything the guests need.',
    theme: 'rose',
    discount: 16,
    slots: [
      { category: 'Chips & Namkeen',     nameIncludes: 'Classic Salted Chips' },
      { category: 'Chocolates',          nameIncludes: 'Milk Chocolate' },
      { category: 'Soft Drinks',         nameIncludes: 'Cola' },
      { category: 'Biscuits & Cookies',  nameIncludes: 'Butter Cookies' },
    ],
  },
  {
    name: 'Indian Cooking Essentials',
    slug: 'indian-cooking-essentials',
    description: 'Turmeric, chilli, garam masala and oil — core Indian flavour kit.',
    theme: 'warm',
    discount: 15,
    slots: [
      { category: 'Masala & Spices',     nameIncludes: 'Turmeric Powder' },
      { category: 'Masala & Spices',     nameIncludes: 'Red Chilli Powder' },
      { category: 'Masala & Spices',     nameIncludes: 'Garam Masala' },
      { category: 'Oil & Ghee',          nameIncludes: 'Mustard Oil' },
    ],
  },
  {
    name: 'Monsoon Comfort Pack',
    slug: 'monsoon-comfort-pack',
    description: 'Hot drinks and instant food for rainy days.',
    theme: 'green',
    discount: 12,
    slots: [
      { category: 'Noodles & Pasta',     nameIncludes: 'Masala Noodles' },
      { category: 'Coffee',              nameIncludes: 'Instant Coffee' },
      { category: 'Tea',                 nameIncludes: 'Adrak Chai' },
      { category: 'Snacks',              nameIncludes: 'Aloo Bhujia' },
    ],
  },
  {
    name: 'Personal Care Bundle',
    slug: 'personal-care-bundle',
    description: 'Soap, shampoo, toothpaste and deo — monthly personal care refill.',
    theme: 'rose',
    discount: 14,
    slots: [
      { category: 'Personal Care',       nameIncludes: 'Bath Soap' },
      { category: 'Hair Care',           nameIncludes: 'Shampoo' },
      { category: 'Oral Care',           nameIncludes: 'Toothpaste' },
      { category: 'Deodorants',          nameIncludes: 'Deodorant Spray' },
    ],
  },
  {
    name: 'Cleaning Essentials Combo',
    slug: 'cleaning-essentials-combo',
    description: 'Detergent, dishwash, floor cleaner and air freshener in one buy.',
    theme: 'warm',
    discount: 15,
    slots: [
      { category: 'Detergents',          nameIncludes: 'Detergent Powder' },
      { category: 'Dishwash',            nameIncludes: 'Dishwash Liquid' },
      { category: 'Floor & Toilet Care', nameIncludes: 'Floor Cleaner' },
      { category: 'Air Fresheners',      nameIncludes: 'Room Spray' },
    ],
  },
  {
    name: 'Baby Care Starter Kit',
    slug: 'baby-care-starter-kit',
    description: 'Diapers, wipes, baby oil and shampoo — newborn essentials.',
    theme: 'rose',
    discount: 13,
    slots: [
      { category: 'Baby Care',           nameIncludes: 'Baby Diapers' },
      { category: 'Baby Care',           nameIncludes: 'Baby Wipes' },
      { category: 'Baby Care',           nameIncludes: 'Baby Oil' },
      { category: 'Baby Care',           nameIncludes: 'Baby Shampoo' },
    ],
  },
  {
    name: 'Pooja Essentials Pack',
    slug: 'pooja-essentials-pack',
    description: 'Agarbatti, camphor and diya — ready for daily pooja.',
    theme: 'warm',
    discount: 12,
    slots: [
      { category: 'Pooja Needs',         nameIncludes: 'Agarbatti' },
      { category: 'Pooja Needs',         nameIncludes: 'Camphor' },
      { category: 'Pooja Needs',         nameIncludes: 'Ghee Diya' },
    ],
  },
  {
    name: 'Dairy Fresh Bundle',
    slug: 'dairy-fresh-bundle',
    description: 'Milk, paneer, curd and butter — dairy shopping done.',
    theme: 'green',
    discount: 11,
    slots: [
      { category: 'Dairy',               nameIncludes: 'Full Cream Milk' },
      { category: 'Paneer & Cheese',     nameIncludes: 'Fresh Paneer' },
      { category: 'Curd & Yogurt',       nameIncludes: 'Plain Curd' },
      { category: 'Dairy',               nameIncludes: 'Butter' },
    ],
  },
];

async function resolveSlot(slot, catByName) {
  const catId = catByName.get(slot.category);
  if (!catId) {
    logger.warn(`[bundles] category not found: ${slot.category}`);
    return null;
  }
  const candidates = await GroceryProduct
    .find({
      category: catId,
      isAvailable: true,
      name: { $regex: slot.nameIncludes, $options: 'i' },
    })
    .limit(5)
    .lean();

  for (const p of candidates) {
    const avail = (p.variants || []).filter(v => v.isAvailable);
    if (!avail.length) continue;
    const cheapest = avail.reduce((a, b) => (a.sellingPrice < b.sellingPrice ? a : b));
    return {
      product: p._id,
      variantId: cheapest._id,
      sellingPrice: cheapest.sellingPrice,
      quantity: 1,
    };
  }
  logger.warn(`[bundles] no product matched: ${slot.category} / ${slot.nameIncludes}`);
  return null;
}

async function run() {
  await connectDB();

  const cats = await GroceryCategory.find({}, { _id: 1, name: 1 }).lean();
  const catByName = new Map(cats.map(c => [c.name, c._id]));

  let upserted = 0;
  let skipped = 0;

  for (let i = 0; i < BUNDLES.length; i++) {
    const b = BUNDLES[i];
    const resolvedItems = [];
    for (const slot of b.slots) {
      const item = await resolveSlot(slot, catByName);
      if (item) resolvedItems.push(item);
    }

    if (resolvedItems.length < 2) {
      logger.warn(`[bundles] skipping "${b.name}" — only ${resolvedItems.length} items resolved`);
      skipped++;
      continue;
    }

    const regularPrice = resolvedItems.reduce((s, it) => s + it.sellingPrice, 0);
    const bundlePrice = Math.round((regularPrice * (100 - b.discount)) / 100);

    const doc = {
      name: b.name,
      slug: b.slug,
      description: b.description,
      theme: b.theme,
      items: resolvedItems.map(({ product, variantId, quantity }) => ({ product, variantId, quantity })),
      bundlePrice,
      regularPrice,
      isActive: true,
      order: i + 1,
    };

    await GroceryBundle.findOneAndUpdate(
      { slug: b.slug },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    upserted++;
    logger.info(`[bundles] upserted "${b.name}" → ₹${bundlePrice} (was ₹${regularPrice}, ${resolvedItems.length} items)`);
  }

  logger.info(`[bundles] done. upserted=${upserted}, skipped=${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error(`[bundles] failed: ${err.message}`);
  process.exit(1);
});
