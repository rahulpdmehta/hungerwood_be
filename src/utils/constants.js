/**
 * Application Constants
 */

module.exports = {
  // User Roles
  ROLES: {
    USER: 'USER',
    ADMIN: 'ADMIN'
  },

  // Order Types
  ORDER_TYPES: {
    DINE_IN: 'DINE_IN',
    TAKEAWAY: 'TAKEAWAY',
    DELIVERY: 'DELIVERY'
  },

  // Order Status
  ORDER_STATUS: {
    RECEIVED: 'RECEIVED',
    CONFIRMED: 'CONFIRMED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },

  // Payment Methods
  PAYMENT_METHODS: {
    UPI: 'UPI',
    CASH: 'CASH',
    CARD: 'CARD'
  },

  // Tax & Fees
  TAX_RATE: 0.05, // 5%
  PACKAGING_FEE: 20, // ₹20
  DELIVERY_FEE: 40, // ₹40

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
  },

  // Response Messages
  MESSAGES: {
    SUCCESS: 'Operation successful',
    OTP_SENT: 'OTP sent successfully',
    OTP_VERIFIED: 'OTP verified successfully',
    LOGIN_SUCCESS: 'Login successful',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    NOT_FOUND: 'Resource not found',
    INVALID_OTP: 'Invalid or expired OTP',
    SERVER_ERROR: 'Internal server error'
  }
};
