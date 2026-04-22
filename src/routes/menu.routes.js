/**
 * Menu Routes
 * Public browsing — customers can view the menu without logging in.
 * optionalAuthenticate populates req.user when a token is present, so
 * downstream handlers can still use `req.user` for personalization.
 */

const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');
const { optionalAuthenticate } = require('../middlewares/auth.middleware');

router.use(optionalAuthenticate);

router.get('/version', menuController.getMenuVersion);
router.get('/categories', menuController.getCategories);
router.get('/items', menuController.getMenuItems);
router.get('/items/:id', menuController.getMenuItem);

module.exports = router;
