/**
 * Banner Model
 * Data access layer for banners using JSON file storage
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

const BANNERS_FILE = path.join(__dirname, '../../data/banners.json');

// Initialize banners file if it doesn't exist
const initializeBannersFile = async () => {
  try {
    await fs.access(BANNERS_FILE);
  } catch (error) {
    // File doesn't exist, create with sample data
    const initialData = {
      banners: [
        {
          id: 'banner_1',
          type: 'OFFER',
          enabled: true,
          priority: 1,
          title: 'Flat 30% Off',
          subtitle: 'on Starters',
          description: 'Valid on orders above ₹499',
          badge: 'LIMITED OFFER',
          badgeColor: '#cf6317',
          image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80',
          backgroundColor: 'linear-gradient(135deg, #181411 0%, #2d221a 100%)',
          textColor: '#ffffff',
          ctaText: 'Order Now',
          ctaLink: '/menu',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          minOrderAmount: 499,
          discountPercent: 30,
          applicableCategories: ['Starters', 'Tandoor'],
          applicableOn: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'banner_2',
          type: 'PROMOTION',
          enabled: true,
          priority: 2,
          title: 'Family Feast',
          subtitle: 'Starter Combo',
          description: 'Free dessert on orders above ₹799',
          badge: 'WEEKEND SPECIAL',
          badgeColor: '#16a34a',
          image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
          backgroundColor: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          textColor: '#ffffff',
          ctaText: 'Explore',
          ctaLink: '/menu?category=Combos',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          minOrderAmount: 799,
          discountPercent: 0,
          applicableCategories: [],
          applicableOn: ['SATURDAY', 'SUNDAY'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'banner_3',
          type: 'ANNOUNCEMENT',
          enabled: true,
          priority: 3,
          title: 'New Menu Alert',
          subtitle: 'Biryani Special',
          description: 'Authentic Gaya-style Biryani now available',
          badge: 'NEW LAUNCH',
          badgeColor: '#dc2626',
          image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
          backgroundColor: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)',
          textColor: '#ffffff',
          ctaText: 'Try Now',
          ctaLink: '/menu?category=Biryani',
          validFrom: '2026-01-15',
          validUntil: '2026-02-15',
          minOrderAmount: 0,
          discountPercent: 0,
          applicableCategories: ['Biryani'],
          applicableOn: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await fs.writeFile(BANNERS_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    logger.info('Banners file initialized with sample data');
  }
};

// Read banners from file
const readBanners = async () => {
  try {
    await initializeBannersFile();
    const data = await fs.readFile(BANNERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error reading banners file:', error);
    throw new Error('Failed to read banners data');
  }
};

// Write banners to file
const writeBanners = async (data) => {
  try {
    await fs.writeFile(BANNERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    logger.error('Error writing banners file:', error);
    throw new Error('Failed to write banners data');
  }
};

// Get all banners
const getAll = async () => {
  const data = await readBanners();
  return data.banners || [];
};

// Get banner by ID
const getById = async (id) => {
  const data = await readBanners();
  return data.banners.find(banner => banner.id === id) || null;
};

// Create new banner
const create = async (bannerData) => {
  const data = await readBanners();
  data.banners.push(bannerData);
  await writeBanners(data);
  return bannerData;
};

// Update banner
const update = async (id, bannerData) => {
  const data = await readBanners();
  const index = data.banners.findIndex(banner => banner.id === id);
  
  if (index === -1) {
    throw new Error('Banner not found');
  }

  data.banners[index] = bannerData;
  await writeBanners(data);
  return bannerData;
};

// Delete banner
const deleteBanner = async (id) => {
  const data = await readBanners();
  const index = data.banners.findIndex(banner => banner.id === id);
  
  if (index === -1) {
    throw new Error('Banner not found');
  }

  data.banners.splice(index, 1);
  await writeBanners(data);
  return true;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteBanner,
};
