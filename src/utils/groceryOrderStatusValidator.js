const GROCERY_ORDER_STATUS = Object.freeze({
  RECEIVED: 'RECEIVED',
  PACKED: 'PACKED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  PICKED_UP: 'PICKED_UP',
  CANCELLED: 'CANCELLED'
});

const S = GROCERY_ORDER_STATUS;

const TERMINAL = new Set([S.DELIVERED, S.PICKED_UP, S.CANCELLED]);

function getAllowedNextGroceryStatuses(current, orderType) {
  if (TERMINAL.has(current)) return [];
  switch (current) {
    case S.RECEIVED:
      return orderType === 'PICKUP'
        ? [S.READY_FOR_PICKUP, S.CANCELLED]
        : [S.PACKED, S.CANCELLED];
    case S.PACKED:
      return [S.OUT_FOR_DELIVERY, S.CANCELLED];
    case S.OUT_FOR_DELIVERY:
      return [S.DELIVERED];
    case S.READY_FOR_PICKUP:
      return [S.PICKED_UP];
    default:
      return [];
  }
}

function validateGroceryStatusTransition(from, to, orderType) {
  return getAllowedNextGroceryStatuses(from, orderType).includes(to);
}

module.exports = {
  GROCERY_ORDER_STATUS,
  getAllowedNextGroceryStatuses,
  validateGroceryStatusTransition,
};
