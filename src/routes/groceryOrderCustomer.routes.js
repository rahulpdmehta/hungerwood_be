const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const ctl = require('../controllers/groceryOrderCustomer.controller');

router.use(authenticate);

router.post('/', ctl.createOrder);
router.get('/', ctl.listMine);
router.get('/:id', ctl.getMine);

module.exports = router;
