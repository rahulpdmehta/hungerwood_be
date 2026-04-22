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
 * roles. SUPER_ADMIN is always allowed regardless of the allowlist.
 * Called with no arguments (`hasRole()`), only SUPER_ADMIN passes.
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
 * Restaurant-admin guard. Kept as `isAdmin` for backward compatibility
 * with the original two-role system; existing routes (menu, banners,
 * restaurant admin) continue to call this. SUPER_ADMIN is allowed
 * implicitly via hasRole. GROCERY_ADMIN is NOT allowed here —
 * grocery routes use `hasRole(ROLES.GROCERY_ADMIN)` explicitly.
 */
const isAdmin = hasRole(ROLES.RESTAURANT_ADMIN);

module.exports = { hasRole, isAdmin };
