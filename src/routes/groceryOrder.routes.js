const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');
const ctl = require('../controllers/groceryOrder.controller');

router.use(authenticate, hasRole(ROLES.GROCERY_ADMIN));

router.get('/', ctl.adminList);
router.get('/:id', ctl.adminGet);
router.patch('/:id/status', ctl.adminUpdateStatus);

module.exports = router;
