/**
 * Role-based Access Control Middleware
 */

const { ROLES } = require('../utils/constants');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return errorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      MESSAGES.UNAUTHORIZED
    );
  }
  
  if (req.user.role !== ROLES.ADMIN) {
    return errorResponse(
      res,
      HTTP_STATUS.FORBIDDEN,
      MESSAGES.FORBIDDEN
    );
  }
  
  next();
};

/**
 * Check if user has any of the specified roles
 */
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        MESSAGES.UNAUTHORIZED
      );
    }
    
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        MESSAGES.FORBIDDEN
      );
    }
    
    next();
  };
};

module.exports = {
  isAdmin,
  hasRole
};
