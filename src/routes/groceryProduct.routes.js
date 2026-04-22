const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { hasRole } = require('../middlewares/role.middleware');
const { ROLES } = require('../utils/constants');
const { upload } = require('../middlewares/upload.middleware');
const ctl = require('../controllers/groceryProduct.controller');

router.use(authenticate, hasRole(ROLES.GROCERY_ADMIN));

router.get('/', ctl.list);
router.get('/:id', ctl.get);
router.post('/', upload.single('image'), ctl.create);
router.patch('/:id', upload.single('image'), ctl.update);
router.delete('/:id', ctl.remove);
router.patch('/:id/toggle', ctl.toggle);

module.exports = router;
