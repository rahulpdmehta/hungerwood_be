/**
 * Role-based Access Control Middleware
 * SUPER_ADMIN is implicitly allowed on every admin route.
 */

const { ROLES } = require('../utils/constants');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

const isSuperAdmin = (req) => req.user?.role === ROLES.SUPER_ADMIN;

/**
 * Allow the request only if the authenticated user has any of the listed
 * roles. SUPER_ADMIN is always allowed.
 */
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.UNAUTHORIZED);
    }
    if (isSuperAdmin(req) || roles.includes(req.user.role)) {
      return next();
    }
    return errorResponse(res, HTTP_STATUS.FORBIDDEN, MESSAGES.FORBIDDEN);
  };
};

/**
 * Legacy admin guard — accepts any of the three admin roles.
 * Kept for backward compatibility with existing routes that call isAdmin
 * without specifying a role; new code should prefer hasRole(...).
 */
const isAdmin = (req, res, next) => {
  const adminRoles = [
    ROLES.RESTAURANT_ADMIN,
    ROLES.GROCERY_ADMIN,
    ROLES.SUPER_ADMIN,
  ];
  if (!req.user) {
    return errorResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.UNAUTHORIZED);
  }
  if (adminRoles.includes(req.user.role)) {
    return next();
  }
  return errorResponse(res, HTTP_STATUS.FORBIDDEN, MESSAGES.FORBIDDEN);
};

module.exports = { hasRole, isAdmin };
