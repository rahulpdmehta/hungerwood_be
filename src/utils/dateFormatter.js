const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

// Extend dayjs with plugins
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * Get current ISO timestamp
 * @returns {string} Current ISO timestamp
 */
const getCurrentISO = () => {
  return dayjs().toISOString();
};

/**
 * Add time to a date
 * @param {string|Date} date - Base date
 * @param {number} amount - Amount to add
 * @param {string} unit - Unit ('minute', 'hour', 'day', etc.)
 * @returns {string} ISO timestamp
 */
const addTime = (date, amount, unit) => {
  return dayjs(date).add(amount, unit).toISOString();
};

/**
 * Subtract time from a date
 * @param {string|Date} date - Base date
 * @param {number} amount - Amount to subtract
 * @param {string} unit - Unit ('minute', 'hour', 'day', etc.)
 * @returns {string} ISO timestamp
 */
const subtractTime = (date, amount, unit) => {
  return dayjs(date).subtract(amount, unit).toISOString();
};

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '';
  return dayjs(date).format(format);
};

/**
 * Check if date is before another date
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {boolean} True if date1 is before date2
 */
const isBefore = (date1, date2) => {
  return dayjs(date1).isBefore(dayjs(date2));
};

/**
 * Check if date is after another date
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {boolean} True if date1 is after date2
 */
const isAfter = (date1, date2) => {
  return dayjs(date1).isAfter(dayjs(date2));
};

/**
 * Get difference between two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @param {string} unit - Unit ('minute', 'hour', 'day', etc.)
 * @returns {number} Difference in specified unit
 */
const getDifference = (date1, date2, unit = 'day') => {
  return dayjs(date1).diff(dayjs(date2), unit);
};

module.exports = {
  getCurrentISO,
  addTime,
  subtractTime,
  formatDate,
  isBefore,
  isAfter,
  getDifference,
  dayjs
};
