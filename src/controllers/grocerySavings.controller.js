const GroceryOrder = require('../models/GroceryOrder.model');
const logger = require('../config/logger');

/**
 * GET /api/grocery/me/savings
 * Returns the sum of (mrp - sellingPrice) * qty across the caller's
 * delivered/picked-up grocery orders since the start of the current year.
 *
 * Used by the SavingsWidget on the grocery home screen.
 */
exports.lifetimeSavings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const result = await GroceryOrder.aggregate([
      {
        $match: {
          user: new (require('mongoose').Types.ObjectId)(String(userId)),
          status: { $in: ['DELIVERED', 'PICKED_UP'] },
          createdAt: { $gte: startOfYear },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          savings: {
            $sum: {
              $multiply: [
                { $subtract: ['$items.mrp', '$items.sellingPrice'] },
                '$items.quantity',
              ],
            },
          },
        },
      },
    ]);
    res.json({ success: true, savings: Math.max(0, Math.round(result[0]?.savings || 0)) });
  } catch (e) {
    logger.error('grocery.savings.lifetime', e);
    res.status(500).json({ success: false, savings: 0 });
  }
};
