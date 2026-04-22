const {
  GROCERY_ORDER_STATUS,
  validateGroceryStatusTransition,
  getAllowedNextGroceryStatuses,
} = require('../../src/utils/groceryOrderStatusValidator');

const S = GROCERY_ORDER_STATUS;

describe('getAllowedNextGroceryStatuses', () => {
  it('RECEIVED+DELIVERY -> PACKED or CANCELLED', () => {
    expect(getAllowedNextGroceryStatuses(S.RECEIVED, 'DELIVERY')).toEqual(
      expect.arrayContaining([S.PACKED, S.CANCELLED])
    );
  });
  it('RECEIVED+PICKUP -> READY_FOR_PICKUP or CANCELLED', () => {
    expect(getAllowedNextGroceryStatuses(S.RECEIVED, 'PICKUP')).toEqual(
      expect.arrayContaining([S.READY_FOR_PICKUP, S.CANCELLED])
    );
  });
  it('DELIVERED is terminal', () => {
    expect(getAllowedNextGroceryStatuses(S.DELIVERED)).toEqual([]);
  });
  it('PICKED_UP is terminal', () => {
    expect(getAllowedNextGroceryStatuses(S.PICKED_UP)).toEqual([]);
  });
});

describe('validateGroceryStatusTransition', () => {
  it('allows PACKED -> OUT_FOR_DELIVERY', () => {
    expect(validateGroceryStatusTransition(S.PACKED, S.OUT_FOR_DELIVERY, 'DELIVERY')).toBe(true);
  });
  it('rejects RECEIVED -> DELIVERED (skipping packing)', () => {
    expect(validateGroceryStatusTransition(S.RECEIVED, S.DELIVERED, 'DELIVERY')).toBe(false);
  });
  it('rejects transitions from terminal states', () => {
    expect(validateGroceryStatusTransition(S.DELIVERED, S.CANCELLED, 'DELIVERY')).toBe(false);
  });
});
