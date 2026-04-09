/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

const User = require('../models/User.model');
const { verifyToken } = require('../utils/helpers');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

/**
 * Verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        MESSAGES.UNAUTHORIZED
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return errorResponse(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        'Invalid or expired token'
      );
    }

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return errorResponse(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        'User not found or inactive'
      );
    }

    // Attach user to request
    req.user = {
      userId: user._id,
      phone: user.phone,
      name: user.name,
      role: user.role
    };

    next();

  } catch (error) {
    return errorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      MESSAGES.UNAUTHORIZED
    );
  }
};

/**
 * Optional authentication (for guest access)
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (decoded) {
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
          req.user = {
            userId: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role
          };
        }
      }
    }

    next();

  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate
};
