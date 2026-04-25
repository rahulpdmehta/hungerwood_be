/**
 * Seeds dummy photos into the restaurant photo gallery. Upserts by `title`
 * so re-running just refreshes the same set.
 *
 * Usage: node scripts/seed-photos.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Photo } = require('../src/models/Photo.model');

const PHOTOS = [
  // Food
  { title: "Chef's Special Thali", category: 'Food', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1200&q=80', isFeatured: true, displayOrder: 1, description: 'A hearty plated thali with curries, rice, and warm rotis.' },
  { title: 'Tandoori Platter', category: 'Food', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80', isFeatured: true, displayOrder: 2, description: 'Smoky tandoor-grilled selections, plated for sharing.' },
  { title: 'Dum Biryani Service', category: 'Food', url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&q=80', displayOrder: 3, description: 'Long-grain biryani with our signature gravy.' },
  { title: 'Garden Fresh Salad', category: 'Food', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80', displayOrder: 4, description: 'Crisp greens dressed in-house every morning.' },
  { title: 'Wood-fired Pizza', category: 'Food', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1200&q=80', displayOrder: 5, description: 'Hand-stretched dough, blistered crust.' },

  // Restaurant
  { title: 'Front Entrance', category: 'Restaurant', url: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200&q=80', isFeatured: true, displayOrder: 1, description: 'Welcoming you off the main road in Gaya.' },
  { title: 'Open Kitchen', category: 'Restaurant', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80', displayOrder: 2, description: 'Watch your meal come together in real time.' },
  { title: 'Bar Counter', category: 'Restaurant', url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200&q=80', displayOrder: 3, description: 'Mocktails, lassi, and chai on rotation.' },

  // Ambiance
  { title: 'Evening Lights', category: 'Ambiance', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', isFeatured: true, displayOrder: 1, description: 'Warm-toned lighting after sundown.' },
  { title: 'Window Seating', category: 'Ambiance', url: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=1200&q=80', displayOrder: 2, description: 'Quiet two-tops along the front window.' },
  { title: 'Family Dining Hall', category: 'Ambiance', url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80', displayOrder: 3, description: 'Plenty of room for the whole table.' },

  // Events
  { title: 'Birthday Setup', category: 'Events', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80', displayOrder: 1, description: 'Cake, candles, and a reserved corner — on the house decor.' },
  { title: 'Private Dinner', category: 'Events', url: 'https://images.unsplash.com/photo-1593504049359-74330189a345?w=1200&q=80', displayOrder: 2, description: 'Closed-room arrangements for small groups.' },
  { title: 'Festival Buffet', category: 'Events', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80', displayOrder: 3, description: 'Festive spreads with regional specialities.' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let created = 0;
  let updated = 0;
  for (const p of PHOTOS) {
    const doc = { ...p, isActive: true };
    const existing = await Photo.findOne({ title: p.title });
    if (existing) {
      await Photo.updateOne({ _id: existing._id }, { $set: doc });
      updated += 1;
    } else {
      await Photo.create(doc);
      created += 1;
    }
  }
  console.log(`Photos — created: ${created}, updated: ${updated}, total seeded: ${PHOTOS.length}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
