// Mocks the Mongoose User model to test pure controller logic.
jest.mock('../../src/models/User.model');
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const User = require('../../src/models/User.model');
const { updateAdmin, deactivateAdmin } = require('../../src/controllers/adminUser.controller');
const { ROLES } = require('../../src/utils/constants');

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

describe('updateAdmin', () => {
  it('blocks demotion of the last super-admin', async () => {
    const save = jest.fn();
    User.findById.mockResolvedValue({ role: ROLES.SUPER_ADMIN, save });
    User.countDocuments.mockResolvedValue(1);
    const req = { params: { id: 'u1' }, body: { role: ROLES.GROCERY_ADMIN }, user: { userId: 'u2' } };
    const res = mockRes();
    await updateAdmin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('allows demotion when multiple super-admins exist', async () => {
    const save = jest.fn();
    User.findById.mockResolvedValue({ role: ROLES.SUPER_ADMIN, save });
    User.countDocuments.mockResolvedValue(3);
    const req = { params: { id: 'u1' }, body: { role: ROLES.GROCERY_ADMIN }, user: { userId: 'u2' } };
    const res = mockRes();
    await updateAdmin(req, res);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('deactivateAdmin', () => {
  it('rejects self-deactivation', async () => {
    const req = { params: { id: 'u1' }, user: { userId: 'u1' } };
    const res = mockRes();
    await deactivateAdmin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks deactivating the last active super-admin', async () => {
    const save = jest.fn();
    User.findById.mockResolvedValue({ role: ROLES.SUPER_ADMIN, isActive: true, save });
    User.countDocuments.mockResolvedValue(1);
    const req = { params: { id: 'u1' }, user: { userId: 'u2' } };
    const res = mockRes();
    await deactivateAdmin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
  });
});
