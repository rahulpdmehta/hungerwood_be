const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const ctl = require('../controllers/groceryPayment.controller');

router.use(authenticate);

router.post('/create-razorpay-order', ctl.createRazorpayOrder);
router.post('/verify', ctl.verifyPayment);

module.exports = router;
