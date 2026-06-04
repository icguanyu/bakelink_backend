const jwt = require('jsonwebtoken');
const { authRequired, adminOnly } = require('../src/middleware/auth');

const SECRET = 'test-secret';

jest.mock('../src/config', () => ({
  jwt: { secret: 'test-secret', expiresIn: '1h' },
}));

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authRequired', () => {
  test('沒有 token 回傳 401', () => {
    const req = { headers: {} };
    const res = mockRes();
    authRequired(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('token 格式錯誤回傳 401', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = mockRes();
    authRequired(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('合法 token 會繼續往下執行', () => {
    const token = jwt.sign({ sub: 1, role: 'user' }, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    authRequired(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe(1);
  });
});

describe('adminOnly', () => {
  test('非 admin 回傳 403', () => {
    const req = { user: { role: 'user' } };
    const res = mockRes();
    adminOnly(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('admin 繼續往下執行', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
