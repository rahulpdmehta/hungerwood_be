const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const ctl = require('../controllers/groceryOrderCustomer.controller');

router.use(authenticate);

const ratingCtl = require('../controllers/orderRating.controller');
const reorderCtl = require('../controllers/groceryReorder.controller');

router.post('/', ctl.createOrder);
router.get('/', ctl.listMine);
router.get('/:id', ctl.getMine);
router.post('/:id/cancel', ctl.cancelMine);
router.post('/:id/rating', ratingCtl.submitGrocery);
router.post('/:id/reorder', reorderCtl.reorder);

module.exports = router;
