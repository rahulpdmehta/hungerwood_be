/**
 * Database Seed Script
 * Populates the database with initial data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/env');
const logger = require('../config/logger');

// Models
const User = require('../models/User.model');
const Category = require('../models/Category.model');
const MenuItem = require('../models/MenuItem.model');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB Connected for seeding');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed data
const seedData = async () => {
  try {
    console.log('🌱 Starting database seed...\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = await User.create({
      phone: config.adminPhone,
      name: config.adminName,
      role: 'ADMIN'
    });
    console.log(`✅ Admin created: ${admin.phone}\n`);

    // Create categories
    console.log('📁 Creating categories...');
    const categories = await Category.insertMany([
      {
        name: 'Tandoor',
        description: 'Clay oven delicacies',
        image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&q=80',
        order: 1
      },
      {
        name: 'Chinese',
        description: 'Indo-Chinese favorites',
        image: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=400&q=80',
        order: 2
      },
      {
        name: 'Main Course',
        description: 'Traditional Indian curries',
        image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80',
        order: 3
      },
      {
        name: 'Beverages',
        description: 'Refreshing drinks',
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80',
        order: 4
      },
      {
        name: 'Desserts',
        description: 'Sweet endings',
        image: 'https://images.unsplash.com/photo-1589119908995-c6c4c9e48f1f?w=400&q=80',
        order: 5
      }
    ]);
    console.log(`✅ ${categories.length} categories created\n`);

    // Get category IDs
    const tandoorCat = categories.find(c => c.name === 'Tandoor')._id;
    const chineseCat = categories.find(c => c.name === 'Chinese')._id;
    const mainCourseCat = categories.find(c => c.name === 'Main Course')._id;
    const beveragesCat = categories.find(c => c.name === 'Beverages')._id;
    const dessertsCat = categories.find(c => c.name === 'Desserts')._id;

    // Create menu items
    console.log('🍽️  Creating menu items...');
    const menuItems = await MenuItem.insertMany([
      // Tandoor
      {
        name: 'Tandoori Butter Chicken',
        description: 'Slow-cooked in clay oven, tossed in a rich velvet tomato gravy.',
        price: 350,
        category: tandoorCat,
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&q=80',
        isVeg: false,
        tags: { isBestseller: true, isRecommended: true },
        spiceLevel: 'Medium',
        prepTime: 25
      },
      {
        name: 'Tandoori Paneer Tikka',
        description: 'Cottage cheese marinated with spices and grilled to perfection.',
        price: 320,
        category: tandoorCat,
        image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300&q=80',
        isVeg: true,
        tags: { isBestseller: true },
        spiceLevel: 'Medium',
        prepTime: 20
      },
      {
        name: 'Seekh Kebab',
        description: 'Minced lamb kebabs with aromatic spices cooked in tandoor.',
        price: 380,
        category: tandoorCat,
        image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&q=80',
        isVeg: false,
        spiceLevel: 'High',
        prepTime: 30
      },
      
      // Chinese
      {
        name: 'Hakka Noodles',
        description: 'Stir-fried noodles with fresh vegetables and soy sauce.',
        price: 180,
        category: chineseCat,
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80',
        isVeg: true,
        tags: { isBestseller: true },
        spiceLevel: 'Low',
        prepTime: 15
      },
      {
        name: 'Chilli Chicken',
        description: 'Crispy chicken tossed in spicy Indo-Chinese sauce.',
        price: 280,
        category: chineseCat,
        image: 'https://images.unsplash.com/photo-1606502272419-54298e077909?w=300&q=80',
        isVeg: false,
        spiceLevel: 'High',
        prepTime: 20
      },
      {
        name: 'Veg Manchurian',
        description: 'Vegetable dumplings in tangy Manchurian sauce.',
        price: 220,
        category: chineseCat,
        image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=300&q=80',
        isVeg: true,
        spiceLevel: 'Medium',
        prepTime: 20
      },
      
      // Main Course
      {
        name: 'Dal Makhani HungerWood',
        description: 'Our signature 24-hour slow cooked black lentils with churned butter.',
        price: 280,
        category: mainCourseCat,
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80',
        isVeg: true,
        tags: { isBestseller: true, isSpecial: true },
        spiceLevel: 'Medium',
        prepTime: 15
      },
      {
        name: 'Lucknowi Mutton Biryani',
        description: 'Aromatic long grain basmati rice layered with tender mutton and saffron.',
        price: 420,
        category: mainCourseCat,
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&q=80',
        isVeg: false,
        tags: { isSpecial: true },
        spiceLevel: 'Medium',
        prepTime: 30
      },
      {
        name: 'Garlic Butter Naan',
        description: 'Leavened bread topped with fresh chopped garlic and coriander.',
        price: 65,
        category: mainCourseCat,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&q=80',
        isVeg: true,
        spiceLevel: 'None',
        prepTime: 10
      },
      {
        name: 'Butter Chicken Masala',
        description: 'Creamy tomato curry with tender chicken pieces.',
        price: 340,
        category: mainCourseCat,
        image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300&q=80',
        isVeg: false,
        tags: { isBestseller: true },
        spiceLevel: 'Medium',
        prepTime: 25
      },
      
      // Beverages
      {
        name: 'Mango Lassi',
        description: 'Traditional yogurt drink blended with fresh mango pulp.',
        price: 80,
        category: beveragesCat,
        image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300&q=80',
        isVeg: true,
        tags: { isBestseller: true },
        spiceLevel: 'None',
        prepTime: 5
      },
      {
        name: 'Masala Chai',
        description: 'Indian spiced tea brewed with aromatic spices.',
        price: 40,
        category: beveragesCat,
        image: 'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=300&q=80',
        isVeg: true,
        spiceLevel: 'None',
        prepTime: 5
      },
      {
        name: 'Fresh Lime Soda',
        description: 'Refreshing lime juice with soda and mint.',
        price: 60,
        category: beveragesCat,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&q=80',
        isVeg: true,
        spiceLevel: 'None',
        prepTime: 3
      },
      
      // Desserts
      {
        name: 'Gulab Jamun',
        description: 'Soft milk solid dumplings soaked in sugar syrup.',
        price: 120,
        category: dessertsCat,
        image: 'https://images.unsplash.com/photo-1589119908995-c6c4c9e48f1f?w=300&q=80',
        isVeg: true,
        tags: { isBestseller: true },
        spiceLevel: 'None',
        prepTime: 5
      },
      {
        name: 'Kulfi Falooda',
        description: 'Traditional Indian ice cream with vermicelli and rose syrup.',
        price: 150,
        category: dessertsCat,
        image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&q=80',
        isVeg: true,
        spiceLevel: 'None',
        prepTime: 8
      },
      {
        name: 'Ras Malai',
        description: 'Soft cottage cheese patties in sweetened milk.',
        price: 140,
        category: dessertsCat,
        image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=300&q=80',
        isVeg: true,
        spiceLevel: 'None',
        prepTime: 5
      }
    ]);
    console.log(`✅ ${menuItems.length} menu items created\n`);

    console.log('🎉 Database seeded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Admin User: 1`);
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Menu Items: ${menuItems.length}`);
    console.log(`\n👤 Admin Credentials:`);
    console.log(`   Phone: ${config.adminPhone}`);
    console.log(`   Name: ${config.adminName}`);
    console.log(`\n✅ Use these credentials to login as admin\n`);

  } catch (error) {
    logger.error('Seed error:', error);
    console.error('❌ Seed failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit();
  }
};

// Run seed
const run = async () => {
  await connectDB();
  await seedData();
};

run();
