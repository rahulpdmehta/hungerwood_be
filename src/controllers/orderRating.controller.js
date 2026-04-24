const GroceryOrder = require('../models/GroceryOrder.model');
const Order = require('../models/Order.model');
const logger = require('../config/logger');

const VALID_TAGS = new Set([
  'Fresh produce', 'On time', 'Well packed', 'Could be better',
  'Polite delivery', 'Tasty food', 'Hot when delivered', 'Good portion size',
]);

function sanitizeRating(body = {}) {
  const stars = Math.max(1, Math.min(5, parseInt(body.stars, 10) || 0));
  if (!stars) return null;
  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .filter(t => VALID_TAGS.has(t))
    .slice(0, 6);
  const comment = String(body.comment || '').trim().slice(0, 500);
  return { stars, tags, comment, submittedAt: new Date() };
}

const submitFor = (Model, label) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const order = await Model.findById(id);
    if (!order) return res.status(404).json({ success: false, message: `${label} not found` });
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    if (orderUserId !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const terminal = ['DELIVERED', 'PICKED_UP', 'COMPLETED'];
    if (!terminal.includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Can only rate completed orders' });
    }
    if (order.rating?.submittedAt) {
      return res.status(409).json({ success: false, message: 'You have already rated this order' });
    }
    const rating = sanitizeRating(req.body);
    if (!rating) return res.status(400).json({ success: false, message: 'Stars 1-5 required' });
    if (Model === Order) {
      // Order schema stores stars as a top-level Number (legacy).
      order.rating = rating.stars;
      order.review = rating.comment || undefined;
    } else {
      order.rating = rating;
    }
    await order.save();
    res.json({ success: true, data: { rating } });
  } catch (e) {
    logger.error(`${label.toLowerCase()}.rating.submit`, e);
    res.status(500).json({ success: false });
  }
};

exports.submitGrocery = submitFor(GroceryOrder, 'Grocery order');
exports.submitFood = submitFor(Order, 'Order');
