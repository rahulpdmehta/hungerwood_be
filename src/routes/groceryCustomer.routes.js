const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');
const ctl = require('../controllers/groceryCustomer.controller');

router.use(authenticate, hasRole(ROLES.GROCERY_ADMIN));

router.get('/', ctl.list);

module.exports = router;
