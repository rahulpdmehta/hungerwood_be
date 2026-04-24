#!/usr/bin/env node
/**
 * Bulk dummy grocery seeder — target ~2000 products across the existing
 * 5 categories (400 per category). Idempotent: skips any product whose
 * name already exists, so repeat runs insert nothing.
 *
 * Depends on categories already existing — run scripts/seed-grocery.js first.
 *
 * Run: node scripts/seed-grocery-bulk.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/config/logger');

const GroceryCategory = require('../src/models/GroceryCategory.model');
const GroceryProduct = require('../src/models/GroceryProduct.model');

const PER_CATEGORY = 400;

const CATEGORY_DATA = {
  Staples: {
    brands: ['Aashirvaad','Fortune','India Gate','Daawat','Tata Sampann','Patanjali','Organic Tattva','Nature Fresh','24 Mantra','Kohinoor','Dhara','Saffola','Mother Dairy','ITC Chakki','Everest','MDH','Catch','Shakti Bhog','Pillsbury','Rajdhani','Laxmi','Pro Nature','Gyan','Royal','Double Horse'],
    bases: ['Atta','Basmati Rice','Sona Masoori Rice','Toor Dal','Chana Dal','Moong Dal','Masoor Dal','Urad Dal','Besan','Suji','Maida','Poha','Sugar','Rock Salt','Jaggery','Refined Oil','Mustard Oil','Ghee','Honey','Vinegar'],
    sizes: [['500 g', 45, 120],['1 kg', 80, 220],['5 kg', 350, 900]],
    images: [
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80',
      'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    ],
  },
  Dairy: {
    brands: ['Amul','Mother Dairy','Nestle','Britannia','Parag','Go','Epigamia','Danone','Govardhan','Heritage','Nandini','Aavin','Vita','Verka','Milky Mist','Paras','Tirumala','Gokul','Kwality','Sarvottam','Dodla','Hatsun','Chitale','Sudha','Sangam'],
    bases: ['Full Cream Milk','Toned Milk','Butter','Salted Butter','Cheese Slices','Mozzarella','Paneer','Dahi','Curd','Lassi','Chaas','Buttermilk','Cream','Ice Cream','Khoya','Condensed Milk','Pure Ghee','Flavoured Milk','Kulfi','Shrikhand'],
    sizes: [['200 g', 40, 110],['500 g', 75, 220],['1 L', 55, 180]],
    images: [
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
      'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80',
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80',
    ],
  },
  Snacks: {
    brands: ["Lay's","Kurkure","Haldiram's","Bingo","Bikano","Balaji","Parle","Britannia","Sunfeast","Pringles","Too Yumm","Uncle Chipps","Bikaji","Ching's","Unibic","McVitie's","Tops","Priyagold","Cadbury","Nestle Maggi","Ferrero","Oreo","Hershey's","Dukes","Anmol"],
    bases: ['Classic Salted Chips','Masala Chips','Tangy Tomato Chips','Cream & Onion Chips','Aloo Bhujia','Moong Dal Namkeen','Sev','Mixture Namkeen','Butter Cookies','Glucose Biscuits','Cream Biscuits','Digestive Biscuits','Chocolate Cookies','Nachos','Popcorn','Mathri','Khakhra','Wafers','Crackers','Rusk'],
    sizes: [['Small (30 g)', 15, 35],['Medium (75 g)', 30, 70],['Large (150 g)', 60, 140]],
    images: [
      'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80',
      'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    ],
  },
  Beverages: {
    brands: ['Coca-Cola','Pepsi','Sprite','Thums Up','Fanta','7UP','Mountain Dew','Frooti','Maaza','Slice','Real','Tropicana','Paper Boat','Minute Maid','Red Bull','Monster','Tata Tea','Taj Mahal','Red Label','Nescafe','Bru','Lipton','Society','Wagh Bakri','Continental'],
    bases: ['Original Soda','Diet Soda','Orange Juice','Apple Juice','Mixed Fruit Juice','Mango Drink','Lemon Drink','Iced Tea','Green Tea','Black Tea','Masala Chai','Coffee Powder','Instant Coffee','Energy Drink','Coconut Water','Aam Panna','Jaljeera','Rose Drink','Lassi Drink','Salted Buttermilk'],
    sizes: [['250 ml', 20, 40],['500 ml', 30, 80],['1 L', 55, 140],['2 L', 90, 200]],
    images: [
      'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80',
      'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80',
      'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=400&q=80',
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80',
    ],
  },
  Household: {
    brands: ['Surf Excel','Ariel','Tide','Rin','Wheel','Ghadi','Nirma','Vim','Pril','Fena','Dettol','Lizol','Harpic','Domex','Colin','Fogg','Odonil','Hit','Mortein','Santoor','Lux','Dove','Cinthol','Lifebuoy','Godrej'],
    bases: ['Detergent Powder','Liquid Detergent','Dish Wash Bar','Dish Wash Liquid','Floor Cleaner','Toilet Cleaner','Glass Cleaner','Bathroom Cleaner','Air Freshener','Mosquito Repellent','Hand Wash','Bath Soap','Antiseptic Liquid','Phenyl','Bleach','Fabric Conditioner','Room Spray','Kitchen Cleaner','Tiles Cleaner','Drain Cleaner'],
    sizes: [['200 g', 25, 80],['500 g', 60, 180],['1 kg', 110, 330],['2 L', 200, 650]],
    images: [
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80',
      'https://images.unsplash.com/photo-1600857062241-98ef96a7e3db?w=400&q=80',
    ],
  },
};

function buildVariants(category, idx) {
  const sizes = CATEGORY_DATA[category].sizes;
  const a = sizes[idx % sizes.length];
  const b = sizes[(idx + 1) % sizes.length];
  return [a, b].map(([label, lo, hi]) => {
    const mrp = lo + ((idx * 13) % (hi - lo + 1));
    const discount = 5 + (idx % 15); // 5-19%
    const sellingPrice = Math.max(1, Math.round((mrp * (100 - discount)) / 100));
    return { label, mrp, sellingPrice, isAvailable: true };
  });
}

async function run() {
  await connectDB();

  const cats = await GroceryCategory.find({ name: { $in: Object.keys(CATEGORY_DATA) } }).lean();
  if (cats.length !== Object.keys(CATEGORY_DATA).length) {
    throw new Error(`Expected ${Object.keys(CATEGORY_DATA).length} categories, found ${cats.length}. Run scripts/seed-grocery.js first.`);
  }
  const catByName = new Map(cats.map(c => [c.name, c._id]));

  const existingNames = new Set(
    (await GroceryProduct.find({}, { name: 1 }).lean()).map(p => p.name)
  );
  logger.info(`[bulk-seed] starting with ${existingNames.size} existing products`);

  const docs = [];

  for (const [catName, data] of Object.entries(CATEGORY_DATA)) {
    const catId = catByName.get(catName);
    let produced = 0;
    let idx = 0;

    outer: for (const base of data.bases) {
      for (const brand of data.brands) {
        if (produced >= PER_CATEGORY) break outer;
        const name = `${brand} ${base}`;
        if (existingNames.has(name)) { idx++; continue; }
        existingNames.add(name);
        docs.push({
          name,
          brand,
          description: `${base} by ${brand}.`,
          image: data.images[idx % data.images.length],
          category: catId,
          variants: buildVariants(catName, idx),
          isAvailable: true,
          tags: {
            isBestseller: idx % 23 === 0,
            isNew: idx % 37 === 0,
          },
        });
        produced++;
        idx++;
      }
    }
    logger.info(`[bulk-seed] ${catName}: prepared ${produced} new products`);
  }

  logger.info(`[bulk-seed] total new products to insert: ${docs.length}`);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const res = await GroceryProduct.insertMany(slice, { ordered: false });
    inserted += res.length;
    logger.info(`[bulk-seed] inserted ${inserted} / ${docs.length}`);
  }

  await mongoose.disconnect();
  logger.info(`[bulk-seed] done. Inserted ${inserted} products.`);
}

run().catch(err => {
  logger.error('[bulk-seed] FAILED:', err);
  process.exit(1);
});
