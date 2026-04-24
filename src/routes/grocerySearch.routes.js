const express = require('express');
const router = express.Router();
const { optionalAuthenticate } = require('../middlewares/auth.middleware');
const ctl = require('../controllers/grocerySearch.controller');

router.get('/trending', ctl.trending);
router.get('/suggest', ctl.suggest);
router.post('/log', optionalAuthenticate, ctl.log);

module.exports = router;
