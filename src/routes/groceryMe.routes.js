const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const savingsCtl = require('../controllers/grocerySavings.controller');

router.use(authenticate);

router.get('/savings', savingsCtl.lifetimeSavings);

module.exports = router;
