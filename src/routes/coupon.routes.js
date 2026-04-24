const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const ctl = require('../controllers/coupon.controller');

router.use(authenticate);

router.get('/', ctl.listAvailable);
router.post('/apply', ctl.apply);

module.exports = router;
