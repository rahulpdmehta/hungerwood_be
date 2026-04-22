const GrocerySettings = require('../models/GrocerySettings.model');
const logger = require('../config/logger');

exports.get = async (_req, res) => {
  try {
    const s = await GrocerySettings.get();
    res.json({ success: true, data: s });
  } catch (e) { logger.error('grocerySettings.get', e); res.status(500).json({ success: false }); }
};

exports.update = async (req, res) => {
  try {
    const allowed = ['isOpen','closingMessage','taxRate','deliveryFee','freeDeliveryThreshold','minOrderValue'];
    const s = await GrocerySettings.get();
    for (const k of allowed) {
      if (req.body[k] !== undefined) s[k] = req.body[k];
    }
    s.updatedBy = req.user.userId;
    await s.save();
    res.json({ success: true, data: s });
  } catch (e) {
    logger.error('grocerySettings.update', e);
    res.status(e.name === 'ValidationError' ? 400 : 500).json({ success: false, message: e.message });
  }
};
