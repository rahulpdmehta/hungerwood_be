/**
 * Version Routes
 * Public routes for checking data versions
 */

const express = require('express');
const router = express.Router();
const versionController = require('../controllers/version.controller');

// Public route - no authentication required for version checking
router.get('/', versionController.getAllVersions);

module.exports = router;
