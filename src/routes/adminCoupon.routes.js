const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');
const ctl = require('../controllers/adminCoupon.controller');

router.use(authenticate);
router.use(hasRole(ROLES.GROCERY_ADMIN));

router.get('/', ctl.list);
router.post('/', ctl.create);
router.patch('/:id', ctl.update);
router.patch('/:id/toggle', ctl.toggle);
router.delete('/:id', ctl.remove);

module.exports = router;
