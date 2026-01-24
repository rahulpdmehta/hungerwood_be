/**
 * Global Error Handling Middleware
 */

const logger = require('../config/logger');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = HTTP_STATUS.NOT_FOUND;
  next(error);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Validation Error',
      errors
    );
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      `${field} already exists`
    );
  }
  
  // Mongoose cast error (invalid ID)
  if (err.name === 'CastError') {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid ID format'
    );
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      'Invalid token'
    );
  }
  
  if (err.name === 'TokenExpiredError') {
    return errorResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      'Token expired'
    );
  }
  
  // Default error
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal Server Error';
  
  return errorResponse(res, statusCode, message);
};

module.exports = {
  notFound,
  errorHandler
};
