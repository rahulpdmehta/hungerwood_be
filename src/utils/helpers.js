/**
 * Utility Helper Functions
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate unique order ID
 */
const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}${random}`;
};

/**
 * Calculate order total
 */
const calculateOrderTotal = (items, orderType, TAX_RATE, PACKAGING_FEE, DELIVERY_FEE) => {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate tax
  const tax = Math.round(subtotal * TAX_RATE);
  
  // Add packaging fee
  const packaging = PACKAGING_FEE;
  
  // Add delivery fee if applicable
  const delivery = orderType === 'DELIVERY' ? DELIVERY_FEE : 0;
  
  // Calculate total
  const total = subtotal + tax + packaging + delivery;
  
  return {
    subtotal,
    tax,
    packaging,
    delivery,
    total
  };
};

/**
 * Sanitize phone number (remove spaces, dashes, etc.)
 */
const sanitizePhone = (phone) => {
  return phone.replace(/[\s\-\(\)]/g, '');
};

/**
 * Validate phone number (Indian format)
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(sanitizePhone(phone));
};

/**
 * Format currency (Indian Rupees)
 */
const formatCurrency = (amount) => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

/**
 * API Response formatter
 */
const successResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message
  };
  
  if (data) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

const errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

module.exports = {
  generateToken,
  verifyToken,
  generateOTP,
  generateOrderId,
  calculateOrderTotal,
  sanitizePhone,
  isValidPhone,
  formatCurrency,
  successResponse,
  errorResponse
};
