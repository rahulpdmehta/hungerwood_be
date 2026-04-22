const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');
const ctl = require('../controllers/adminUser.controller');

router.use(authenticate, hasRole(ROLES.SUPER_ADMIN));

router.get('/', ctl.listAdmins);
router.post('/', ctl.createAdmin);
router.patch('/:id', ctl.updateAdmin);
router.delete('/:id', ctl.deactivateAdmin);

module.exports = router;
