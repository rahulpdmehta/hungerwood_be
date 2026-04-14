/**
 * Returns the current HH:mm in Asia/Kolkata (IST) as a string.
 */
function getCurrentIstHHmm(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  // en-GB with the options above yields "HH:mm".
  return fmt.format(now);
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate an HH:mm string.
 */
function isValidHHmm(s) {
  return typeof s === 'string' && HHMM_RE.test(s);
}

/**
 * Is the category currently orderable?
 * - Categories without isTimeRestricted are always orderable.
 * - Window is half-open: [availableFrom, availableTo).
 * - If either bound is missing/invalid, treat as always orderable (fail open;
 *   admin validation is the enforcement point).
 */
function isCategoryOrderable(category, now = new Date()) {
  if (!category || !category.isTimeRestricted) return true;
  const { availableFrom, availableTo } = category;
  if (!isValidHHmm(availableFrom) || !isValidHHmm(availableTo)) return true;
  const nowHHmm = getCurrentIstHHmm(now);
  return nowHHmm >= availableFrom && nowHHmm < availableTo;
}

module.exports = {
  getCurrentIstHHmm,
  isValidHHmm,
  isCategoryOrderable,
  HHMM_RE
};
