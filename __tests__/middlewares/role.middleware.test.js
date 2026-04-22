const { hasRole, isAdmin } = require('../../src/middlewares/role.middleware');
const { ROLES } = require('../../src/utils/constants');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('hasRole', () => {
  it('allows user whose role is in the allowlist', () => {
    const next = jest.fn();
    const req = { user: { role: ROLES.GROCERY_ADMIN } };
    hasRole(ROLES.GROCERY_ADMIN)(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows SUPER_ADMIN even when not in the allowlist', () => {
    const next = jest.fn();
    const req = { user: { role: ROLES.SUPER_ADMIN } };
    hasRole(ROLES.GROCERY_ADMIN)(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects user with wrong role with 403', () => {
    const next = jest.fn();
    const res = mockRes();
    const req = { user: { role: ROLES.USER } };
    hasRole(ROLES.GROCERY_ADMIN)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects unauthenticated request with 401', () => {
    const next = jest.fn();
    const res = mockRes();
    const req = { user: null };
    hasRole(ROLES.GROCERY_ADMIN)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('isAdmin', () => {
  it('allows SUPER_ADMIN', () => {
    const next = jest.fn();
    const req = { user: { role: ROLES.SUPER_ADMIN } };
    isAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('allows RESTAURANT_ADMIN', () => {
    const next = jest.fn();
    const req = { user: { role: ROLES.RESTAURANT_ADMIN } };
    isAdmin(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('rejects GROCERY_ADMIN (grocery-admin has no access to restaurant routes)', () => {
    const next = jest.fn();
    const res = mockRes();
    const req = { user: { role: ROLES.GROCERY_ADMIN } };
    isAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
  it('rejects USER', () => {
    const next = jest.fn();
    const res = mockRes();
    const req = { user: { role: ROLES.USER } };
    isAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
