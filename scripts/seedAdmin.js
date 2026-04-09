/**
 * Seed Admin Data Script
 * Ensures admin user exists and data consistency
 */

const path = require('path');
const JsonDB = require('../src/utils/jsonDB');

const usersDB = new JsonDB('users.json');
const categoriesDB = new JsonDB('categories.json');
const menuItemsDB = new JsonDB('menuItems.json');

const ADMIN_USER = {
  phone: '9999999999',
  name: 'Admin User',
  email: 'admin@hungerwood.com',
  role: 'ADMIN',
  isActive: true,
  isProfileComplete: true,
  walletBalance: 0,
  addresses: [
    {
      id: '1',
      label: 'Home',
      street: '123 Admin Street',
      city: 'Gaya',
      state: 'Bihar',
      pincode: '823001',
      isDefault: true,
      createdAt: new Date().toISOString()
    }
  ],
  profilePic: 'https://ui-avatars.com/api/?name=Admin&background=B45309&color=fff&size=200'
};

async function seedAdminUser() {
  console.log('🔍 Checking for admin user...');
  
  const existingAdmin = usersDB.findAll().find(
    user => user.role === 'ADMIN' || user.phone === ADMIN_USER.phone
  );

  if (existingAdmin) {
    console.log('✅ Admin user already exists:', existingAdmin.phone);
    
    // Update role if needed
    if (existingAdmin.role !== 'ADMIN') {
      usersDB.update(existingAdmin._id, { role: 'ADMIN' });
      console.log('✅ Updated user role to ADMIN');
    }
  } else {
    const admin = usersDB.create(ADMIN_USER);
    console.log('✅ Admin user created:', admin.phone);
  }
}

async function ensureDataConsistency() {
  console.log('\n🔍 Checking data consistency...');
  
  // Ensure all categories have required fields
  const categories = categoriesDB.findAll();
  let categoriesUpdated = 0;
  
  categories.forEach(category => {
    const updates = {};
    let needsUpdate = false;
    
    if (category.isActive === undefined) {
      updates.isActive = true;
      needsUpdate = true;
    }
    
    if (!category.createdAt) {
      updates.createdAt = new Date().toISOString();
      needsUpdate = true;
    }
    
    if (!category.updatedAt) {
      updates.updatedAt = new Date().toISOString();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      categoriesDB.update(category._id, updates);
      categoriesUpdated++;
    }
  });
  
  if (categoriesUpdated > 0) {
    console.log(`✅ Updated ${categoriesUpdated} categories`);
  } else {
    console.log('✅ All categories have required fields');
  }
  
  // Ensure all menu items have required fields
  const menuItems = menuItemsDB.findAll();
  let menuItemsUpdated = 0;
  
  menuItems.forEach(item => {
    const updates = {};
    let needsUpdate = false;
    
    if (item.isAvailable === undefined) {
      updates.isAvailable = true;
      needsUpdate = true;
    }
    
    if (item.isVeg === undefined) {
      updates.isVeg = true;
      needsUpdate = true;
    }
    
    if (item.isBestSeller === undefined && item.isBestseller !== undefined) {
      updates.isBestSeller = item.isBestseller;
      needsUpdate = true;
    }
    
    if (!item.createdAt) {
      updates.createdAt = new Date().toISOString();
      needsUpdate = true;
    }
    
    if (!item.updatedAt) {
      updates.updatedAt = new Date().toISOString();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      menuItemsDB.update(item._id, updates);
      menuItemsUpdated++;
    }
  });
  
  if (menuItemsUpdated > 0) {
    console.log(`✅ Updated ${menuItemsUpdated} menu items`);
  } else {
    console.log('✅ All menu items have required fields');
  }
}

async function displayStats() {
  console.log('\n📊 Database Statistics:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const users = usersDB.findAll();
  const admins = users.filter(u => u.role === 'ADMIN');
  const customers = users.filter(u => u.role === 'customer' || u.role === 'USER');
  
  console.log(`👥 Users: ${users.length} total`);
  console.log(`   - Admins: ${admins.length}`);
  console.log(`   - Customers: ${customers.length}`);
  
  const categories = categoriesDB.findAll();
  const activeCategories = categories.filter(c => c.isActive);
  
  console.log(`\n📁 Categories: ${categories.length} total`);
  console.log(`   - Active: ${activeCategories.length}`);
  console.log(`   - Inactive: ${categories.length - activeCategories.length}`);
  
  const menuItems = menuItemsDB.findAll();
  const availableItems = menuItems.filter(i => i.isAvailable);
  const vegItems = menuItems.filter(i => i.isVeg);
  
  console.log(`\n🍽️  Menu Items: ${menuItems.length} total`);
  console.log(`   - Available: ${availableItems.length}`);
  console.log(`   - Unavailable: ${menuItems.length - availableItems.length}`);
  console.log(`   - Vegetarian: ${vegItems.length}`);
  console.log(`   - Non-Veg: ${menuItems.length - vegItems.length}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Admin login credentials:');
  console.log('   Phone: 9999999999');
  console.log('   OTP: Any 6 digits (dev mode)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
  try {
    console.log('\n🚀 Starting Admin Seed Script...\n');
    
    await seedAdminUser();
    await ensureDataConsistency();
    await displayStats();
    
    console.log('✅ Seed script completed successfully!\n');
  } catch (error) {
    console.error('❌ Error running seed script:', error);
    process.exit(1);
  }
}

// Run the script
main();
