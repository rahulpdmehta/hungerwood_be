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
  'Fruits & Vegetables': {
    brands: ['Fresho','BB Royal','Organic Tattva','Nature\'s Basket','Safal','Qrate','Farm2Kitchen','Patanjali Fresh','Desi Farms','Deep','Nilon\'s','iD Fresh','24 Mantra','Pro Nature','FreshLo','Fieldking','Kisan','Godrej Fresh','Heritage Farm','Whole Farm','Veggie Fresh','Green Harvest','Namdhari','First Choice','Zespri'],
    bases: ['Apple','Banana','Orange','Pomegranate','Grapes','Papaya','Watermelon','Mango','Pear','Kiwi','Onion','Tomato','Potato','Carrot','Cucumber','Lady Finger','Brinjal','Cabbage','Cauliflower','Spinach','Coriander','Mint','Lemon','Ginger','Garlic','Green Chilli','Capsicum','Bottle Gourd','Pumpkin','Beetroot'],
    sizes: [['250 g', 20, 60],['500 g', 35, 120],['1 kg', 60, 240]],
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80',
      'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=400&q=80',
      'https://images.unsplash.com/photo-1566842600175-97dca3c5ad01?w=400&q=80',
    ],
  },
  Bakery: {
    brands: ['Britannia','Modern','English Oven','Harvest Gold','Winkies','Theobroma','Monginis','Loafers','Bon Ami','The Baker\'s Dozen','Brown Sugar','Karachi','Fresh Bakery','Wibs','Elite','Bonn','Perfetto','MIO AMORE','Dukes','Chheda\'s','Unibic','Karachi Bakery','Sunfeast','McVitie\'s','Parle'],
    bases: ['White Bread','Brown Bread','Multigrain Bread','Whole Wheat Bread','Pav','Fruit Bun','Cream Bun','Croissant','Bagel','Muffin','Cup Cake','Pound Cake','Plum Cake','Chocolate Pastry','Brownie','Butter Cookies','Donut','Rusk','Toast','Pizza Base','Burger Bun','Garlic Bread','Focaccia','Danish','Eclair'],
    sizes: [['Pack of 4', 30, 90],['Pack of 6', 45, 140],['Pack of 12', 80, 260]],
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80',
      'https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400&q=80',
    ],
  },
  'Masala & Spices': {
    brands: ['MDH','Everest','Catch','Tata Sampann','Ramdev','Aashirvaad','Badshah','Patanjali','Urban Platter','Goldiee','Sakthi','Eastern','Shakti','Priya','Priyanka','Mother\'s Recipe','Deep','Suhana','Pushp','Shalimar','Keya','Double Horse','Aachi','Dabur','Nilon\'s'],
    bases: ['Turmeric Powder','Red Chilli Powder','Coriander Powder','Cumin Powder','Garam Masala','Chaat Masala','Sambar Masala','Biryani Masala','Pav Bhaji Masala','Meat Masala','Kitchen King','Chicken Masala','Rajma Masala','Chhole Masala','Tandoori Masala','Pani Puri Masala','Dhaniya Powder','Hing Powder','Saunf','Ajwain','Black Pepper','Cardamom','Cinnamon','Clove','Bay Leaf'],
    sizes: [['100 g', 30, 100],['200 g', 55, 180],['500 g', 120, 400]],
    images: [
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80',
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80',
      'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&q=80',
      'https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?w=400&q=80',
    ],
  },
  'Oil & Ghee': {
    brands: ['Fortune','Saffola','Dhara','Sundrop','Engine','Gemini','Mahakosh','Patanjali','Amul','Mother Dairy','Gowardhan','Anik','Nutrela','Gagan','Freedom','Ruchi Gold','Postman','Tirupati','Idhayam','Kachi Ghani','Figaro','Olitalia','Bertolli','Borges','Leonardo'],
    bases: ['Refined Oil','Mustard Oil','Sunflower Oil','Rice Bran Oil','Groundnut Oil','Coconut Oil','Olive Oil','Cow Ghee','Pure Ghee','Desi Ghee','Vanaspati','Soyabean Oil','Palm Oil','Canola Oil','Sesame Oil','Flaxseed Oil','Kachi Ghani Oil','Filtered Oil','A2 Ghee','Buffalo Ghee'],
    sizes: [['500 ml', 80, 220],['1 L', 140, 380],['5 L', 650, 1700]],
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80',
      'https://images.unsplash.com/photo-1599003037890-5a6e9325ff06?w=400&q=80',
      'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=400&q=80',
      'https://images.unsplash.com/photo-1611735341450-74d61e660ad2?w=400&q=80',
    ],
  },
  'Personal Care': {
    brands: ['Dove','Lux','Lifebuoy','Santoor','Cinthol','Godrej','Patanjali','Himalaya','Nivea','Vaseline','Parachute','Dabur','Pond\'s','Head & Shoulders','Clinic Plus','Sunsilk','Pantene','Garnier','L\'Oreal','Colgate','Sensodyne','Pepsodent','Oral-B','Gillette','Old Spice'],
    bases: ['Bath Soap','Body Wash','Shampoo','Conditioner','Hair Oil','Face Wash','Body Lotion','Toothpaste','Toothbrush','Deodorant','Talc','Face Cream','Sunscreen','Shaving Foam','Razor','Hair Gel','Hair Color','Kajal','Lip Balm','Perfume','Moisturizer','Hand Cream','Foot Cream','Mouthwash','Cotton Buds'],
    sizes: [['100 g', 40, 140],['200 g', 70, 240],['500 g', 150, 480]],
    images: [
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80',
      'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&q=80',
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80',
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
