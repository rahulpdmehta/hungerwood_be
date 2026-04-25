/**
 * One-off: set a user's role in MongoDB.
 * Usage: node scripts/promote-superadmin.js <phone> [role]
 *   role defaults to SUPER_ADMIN. Valid roles: USER, RESTAURANT_ADMIN,
 *   GROCERY_ADMIN, SUPER_ADMIN.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const { ROLES } = require('../src/utils/constants');

(async () => {
  const phone = process.argv[2];
  const requested = (process.argv[3] || 'SUPER_ADMIN').toUpperCase();
  if (!phone) {
    console.error('Usage: node scripts/promote-superadmin.js <phone> [role]');
    process.exit(1);
  }
  if (!ROLES[requested]) {
    console.error(`Unknown role "${requested}". Valid: ${Object.keys(ROLES).join(', ')}`);
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const before = await User.findOne({ phone }).select('phone name role');
  if (!before) {
    console.error(`No user found with phone ${phone}`);
    process.exit(2);
  }
  console.log('Before:', before.toObject());
  before.role = ROLES[requested];
  await before.save();
  const after = await User.findOne({ phone }).select('phone name role');
  console.log('After: ', after.toObject());
  await mongoose.disconnect();
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
