/**
 * Order Status Validator
 * Enforces strict order status flow
 */

const { ORDER_STATUS } = require('./constants');

// Define allowed status transitions
const STATUS_FLOW = {
  [ORDER_STATUS.RECEIVED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: []
};

/**
 * Validate if status transition is allowed
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} - Whether transition is valid
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  const allowedStatuses = STATUS_FLOW[currentStatus];
  
  if (!allowedStatuses) {
    return false;
  }
  
  return allowedStatuses.includes(newStatus);
};

/**
 * Get allowed next statuses for current status
 * @param {string} currentStatus - Current order status
 * @returns {string[]} - Array of allowed next statuses
 */
const getAllowedNextStatuses = (currentStatus) => {
  return STATUS_FLOW[currentStatus] || [];
};

/**
 * Check if order can be cancelled
 * @param {string} currentStatus - Current order status
 * @returns {boolean} - Whether order can be cancelled
 */
const canBeCancelled = (currentStatus) => {
  return STATUS_FLOW[currentStatus]?.includes(ORDER_STATUS.CANCELLED) || false;
};

/**
 * Get status flow as readable text
 * @returns {string} - Status flow description
 */
const getStatusFlowDescription = () => {
  return 'RECEIVED → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED (Can be CANCELLED before OUT_FOR_DELIVERY)';
};

module.exports = {
  validateStatusTransition,
  getAllowedNextStatuses,
  canBeCancelled,
  getStatusFlowDescription,
  STATUS_FLOW
};
