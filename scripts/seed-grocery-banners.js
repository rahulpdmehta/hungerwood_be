/**
 * Seeds dummy banners for the grocery section.
 * Upserts by `id` so re-running just updates the existing rows.
 *
 * Usage: node scripts/seed-grocery-banners.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Banner } = require('../src/models/banner.model');

const BANNERS = [
  {
    id: 'grocery-banner-fresh-arrivals',
    type: 'OFFER',
    title: 'Fresh Off The Farm',
    subtitle: 'Crisp fruits & vegetables, daily',
    description: 'Hand-picked produce delivered fresh from local farms',
    badge: 'NEW',
    badgeColor: '#16a34a',
    image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80',
    backgroundColor: '#ecfdf5',
    textColor: '#065f46',
    ctaText: 'Shop Fruits & Veg',
    ctaLink: '/grocery/c/fruits-vegetables',
    priority: 1,
  },
  {
    id: 'grocery-banner-pantry-deals',
    type: 'PROMOTION',
    title: 'Pantry Restock Sale',
    subtitle: 'Up to 25% off staples',
    description: 'Atta, rice, dals & cooking oils — stock up and save',
    badge: '25% OFF',
    badgeColor: '#dc2626',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80',
    backgroundColor: '#fef3c7',
    textColor: '#78350f',
    ctaText: 'Shop Pantry',
    ctaLink: '/grocery/c/staples',
    discountPercent: 25,
    priority: 2,
  },
  {
    id: 'grocery-banner-dairy-fresh',
    type: 'OFFER',
    title: 'Daily Dairy Essentials',
    subtitle: 'Milk, paneer, curd — delivered cold',
    description: 'Fresh dairy from trusted local brands',
    badge: 'DAILY',
    badgeColor: '#2563eb',
    image: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=1200&q=80',
    backgroundColor: '#eff6ff',
    textColor: '#1e3a8a',
    ctaText: 'Shop Dairy',
    ctaLink: '/grocery/c/dairy',
    priority: 3,
  },
  {
    id: 'grocery-banner-snacks-combo',
    type: 'PROMOTION',
    title: 'Snack Attack Combos',
    subtitle: 'Buy 2 get 1 on chips & namkeen',
    description: 'Mix and match your favourite munchies',
    badge: 'B2G1',
    badgeColor: '#ea580c',
    image: 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=1200&q=80',
    backgroundColor: '#fff7ed',
    textColor: '#7c2d12',
    ctaText: 'Shop Snacks',
    ctaLink: '/grocery/c/snacks',
    priority: 4,
  },
  {
    id: 'grocery-banner-beverages',
    type: 'OFFER',
    title: 'Cool Drinks, Warm Welcomes',
    subtitle: 'Juices, sodas & energy drinks',
    description: 'Stay hydrated with our chilled selection',
    badge: 'CHILLED',
    badgeColor: '#0891b2',
    image: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=1200&q=80',
    backgroundColor: '#ecfeff',
    textColor: '#155e75',
    ctaText: 'Shop Beverages',
    ctaLink: '/grocery/c/beverages',
    priority: 5,
  },
  {
    id: 'grocery-banner-personal-care',
    type: 'PROMOTION',
    title: 'Personal Care, Curated',
    subtitle: 'Flat 15% off bath & beauty',
    description: 'Top brands for hair, skin & oral care',
    badge: '15% OFF',
    badgeColor: '#9333ea',
    image: 'https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=1200&q=80',
    backgroundColor: '#faf5ff',
    textColor: '#581c87',
    ctaText: 'Shop Personal Care',
    ctaLink: '/grocery/c/personal-care',
    discountPercent: 15,
    priority: 6,
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let created = 0;
  let updated = 0;
  for (const b of BANNERS) {
    const doc = { ...b, section: 'grocery', enabled: true };
    const res = await Banner.findOneAndUpdate(
      { id: b.id },
      { $set: doc },
      { upsert: true, new: true, rawResult: true },
    );
    if (res.lastErrorObject?.updatedExisting) updated += 1;
    else created += 1;
  }
  console.log(`Grocery banners — created: ${created}, updated: ${updated}, total: ${BANNERS.length}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
