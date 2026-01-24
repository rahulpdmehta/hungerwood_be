/**
 * Address Routes
 * Protected routes for address management
 */

const express = require('express');
const router = express.Router();
const addressController = require('../controllers/address.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All address routes require authentication
router.use(authenticate);

// Get all addresses
router.get('/', addressController.getAddresses);

// Add new address
router.post('/', addressController.addAddress);

// Update address
router.put('/:id', addressController.updateAddress);

// Delete address
router.delete('/:id', addressController.deleteAddress);

// Set default address
router.patch('/:id/default', addressController.setDefaultAddress);

module.exports = router;
