const express = require('express');
const router = express.Router();
const ctl = require('../controllers/groceryCatalog.controller');

// All public — no auth needed.
router.get('/categories', ctl.listCategories);
router.get('/products', ctl.listProducts);
router.get('/products/:id', ctl.getProduct);
router.get('/settings', ctl.getSettings);

module.exports = router;
