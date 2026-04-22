const GroceryCategory = require('../models/GroceryCategory.model');
const GroceryProduct = require('../models/GroceryProduct.model');
const logger = require('../config/logger');

exports.list = async (_req, res) => {
  try {
    const cats = await GroceryCategory.find().sort({ order: 1, name: 1 });
    const withCount = await Promise.all(cats.map(async c => {
      const productCount = await GroceryProduct.countDocuments({ category: c._id });
      return { ...c.toObject(), id: c._id.toString(), productCount };
    }));
    res.json({ success: true, data: withCount });
  } catch (e) { logger.error('grocery.category.list', e); res.status(500).json({ success: false }); }
};

exports.create = async (req, res) => {
  try {
    const { name, image = '', order = 0, isActive = true } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const existing = await GroceryCategory.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) return res.status(400).json({ success: false, message: 'Category name already exists' });
    const finalImage = req.file ? `/uploads/${req.file.filename}` : image;
    const cat = await GroceryCategory.create({ name: name.trim(), image: finalImage, order, isActive });
    res.status(201).json({ success: true, data: { ...cat.toObject(), id: cat._id.toString() } });
  } catch (e) { logger.error('grocery.category.create', e); res.status(500).json({ success: false }); }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await GroceryCategory.findById(id);
    if (!cat) return res.status(404).json({ success: false, message: 'Not found' });
    const { name, image, order, isActive } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (image !== undefined) cat.image = image;
    if (req.file) cat.image = `/uploads/${req.file.filename}`;
    if (order !== undefined) cat.order = order;
    if (isActive !== undefined) cat.isActive = isActive;
    await cat.save();
    res.json({ success: true, data: { ...cat.toObject(), id: cat._id.toString() } });
  } catch (e) { logger.error('grocery.category.update', e); res.status(500).json({ success: false }); }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const inUse = await GroceryProduct.exists({ category: id });
    if (inUse) return res.status(400).json({ success: false, message: 'Category has products; reassign or delete them first' });
    await GroceryCategory.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (e) { logger.error('grocery.category.remove', e); res.status(500).json({ success: false }); }
};

exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;
    const cat = await GroceryCategory.findById(id);
    if (!cat) return res.status(404).json({ success: false });
    cat.isActive = !cat.isActive;
    await cat.save();
    res.json({ success: true, data: { ...cat.toObject(), id: cat._id.toString() } });
  } catch (e) { logger.error('grocery.category.toggle', e); res.status(500).json({ success: false }); }
};
