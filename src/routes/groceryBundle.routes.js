const express = require('express');
const router = express.Router();
const ctl = require('../controllers/groceryBundle.controller');

router.get('/', ctl.list);
router.get('/:slug', ctl.getBySlug);

module.exports = router;
