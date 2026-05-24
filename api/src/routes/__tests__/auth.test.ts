import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock jsonwebtoken before any route module imports it (works around EPERM on macOS)
vi.mock('jsonwebtoken', () => {
  const jwt = {
    sign: (payload: any, _secret: string, _opts?: any) => {
      const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      return `mock.${base64}.sig`;
    },
    verify: (token: string, _secret: string) => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('jwt malformed');
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    },
    decode: (token: string) => {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    },
  };
  return { default: jwt, ...jwt };
});

import authRoutes from '../../routes/auth';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';
import { hashPassword } from '../../utils/auth';

vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

// Pre-compute a real bcrypt hash once (hashing is intentionally slow).
let correctHash: string;

beforeAll(async () => {
  correctHash = await hashPassword('CorrectPassword1');
});

/**
 * Build a mock user object suitable for the login handler's first findUnique
 * call (selects many fields). Override individual fields via `overrides`.
 */
function makeLoginUser(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@test.com',
    password: correctHash,
    avatar: '/assets/default-avatar.svg',
    bio: '',
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    points: 0,
    word_count: 0,
    consecutive_days: 0,
    makeup_chances: 0,
    badges: [],
    level: 1,
    membership_tier: 'free',
    membership_expires_at: null,
    isAdmin: false,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ===========================================================================
// POST /api/auth/register
// ===========================================================================
describe('POST /api/auth/register', () => {
  const app = createApp();

  beforeEach(() => {
    resetPrismaMocks();
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('用户名');
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'not-an-email', password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('邮箱');
  });

  it('returns 400 when password is too weak', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('密码');
  });

  it('returns 400 when username is already taken', async () => {
    // prisma.users.findUnique is called to check existing username; return a user.
    mockPrisma.users.findUnique.mockResolvedValue({ id: 1, username: 'testuser' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('用户名已被使用');
  });

  it('returns 201 with token on successful registration without email', async () => {
    // No existing user by username
    mockPrisma.users.findUnique.mockResolvedValue(null);
    // The $transaction mock calls the callback with `prisma`, so
    // tx.users.create(...) resolves to our mock return value.
    mockPrisma.users.create.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: null,
      avatar: '/assets/default-avatar.svg',
      bio: '',
      emailVerified: true,
      points: 0,
      createdAt: new Date(),
    });
    // After transaction, the code writes active_token via users.update
    mockPrisma.users.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('testuser');
  });

  it('returns 201 with requireVerification on successful registration with email', async () => {
    // No existing user by username or email (both findUnique calls return null)
    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.users.create.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      avatar: '/assets/default-avatar.svg',
      bio: '',
      emailVerified: false,
      points: 0,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: 'Password1' });

    expect(res.status).toBe(201);
    expect(res.body.requireVerification).toBe(true);
    // No token when email verification is required
    expect(res.body.token).toBeUndefined();
  });
});

// ===========================================================================
// POST /api/auth/login
// ===========================================================================
describe('POST /api/auth/login', () => {
  const app = createApp();

  beforeEach(() => {
    resetPrismaMocks();
    // login_logs.create is called with .catch() on every login failure path.
    // It must resolve to a Promise so that .catch() does not throw
    // "Cannot read properties of undefined (reading 'catch')".
    mockPrisma.login_logs.create.mockResolvedValue({});
    mockPrisma.users.update.mockResolvedValue({});
  });

  it('returns 400 when account is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('账号');
  });

  it('returns 401 when user is not found', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: 'nonexistent', password: 'Password1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('密码错误');
  });

  it('returns 401 when password is wrong', async () => {
    // First findUnique: return user with correct hash
    mockPrisma.users.findUnique.mockResolvedValue(makeLoginUser());

    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: 'testuser', password: 'WrongPassword1' });
    expect(res.status).toBe(401);
  });

  it('returns 403 with code ACCOUNT_BANNED when user is banned', async () => {
    // First call: find user (password matches)
    // Second call: check isBanned status
    mockPrisma.users.findUnique
      .mockResolvedValueOnce(makeLoginUser())
      .mockResolvedValueOnce({ isBanned: true, bannedReason: 'violation' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: 'testuser', password: 'CorrectPassword1' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BANNED');
  });

  it('returns 403 with code EMAIL_NOT_VERIFIED when email is unverified', async () => {
    // First call: user with unverified email; set a valid verification token so
    // the handler reuses it (avoids an extra users.update call).
    // Second call: ban check returns false.
    mockPrisma.users.findUnique
      .mockResolvedValueOnce(
        makeLoginUser({
          emailVerified: false,
          emailVerificationToken: 'existing-valid-token',
          emailVerificationExpires: new Date(Date.now() + 86400000), // still valid
        }),
      )
      .mockResolvedValueOnce({ isBanned: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: 'testuser', password: 'CorrectPassword1' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns 200 with token on successful login', async () => {
    // First call: find user (password matches, email verified)
    // Second call: ban check returns false
    mockPrisma.users.findUnique
      .mockResolvedValueOnce(makeLoginUser())
      .mockResolvedValueOnce({ isBanned: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: 'testuser', password: 'CorrectPassword1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('testuser');
  });
});

// Shared fetch mock for WeChat API tests (single stubGlobal to avoid conflicts)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ===========================================================================
// POST /api/auth/wx-login — ban check
// ===========================================================================
describe('POST /api/auth/wx-login', () => {
  const app = createApp();

  beforeEach(() => {
    resetPrismaMocks();
    mockFetch.mockReset();
    mockPrisma.users.update.mockResolvedValue({});
    mockPrisma.login_logs.create.mockResolvedValue({});
  });

  function mockWxCodeSuccess() {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ openid: 'test_openid_123', session_key: 'sk' }),
    });
  }

  it('returns 403 when existing user is banned via wx-login', async () => {
    // Set WX env vars
    process.env.WX_APPID = 'test_appid';
    process.env.WX_APP_SECRET = 'test_secret';

    mockWxCodeSuccess();

    // Existing user found by openid — banned
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 1, username: 'banned_wx_user', email: null, avatar: null, bio: null,
      emailVerified: true, points: 0, level: 1,
      membership_tier: 'free', membership_expires_at: null, createdAt: new Date(),
      isBanned: true, bannedReason: '发布违规内容',
    });

    const res = await request(app)
      .post('/api/auth/wx-login')
      .send({ code: 'valid_wx_code' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('封禁');
    expect(res.body.reason).toBe('发布违规内容');
  });

  it('allows wx-login for non-banned existing user', async () => {
    process.env.WX_APPID = 'test_appid';
    process.env.WX_APP_SECRET = 'test_secret';

    mockWxCodeSuccess();

    mockPrisma.users.findUnique.mockResolvedValue({
      id: 2, username: 'normal_wx_user', email: null, avatar: null, bio: null,
      emailVerified: true, points: 50, level: 1,
      membership_tier: 'free', membership_expires_at: null, createdAt: new Date(),
      isBanned: false, bannedReason: null,
    });

    const res = await request(app)
      .post('/api/auth/wx-login')
      .send({ code: 'valid_wx_code' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('normal_wx_user');
  });

  it('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/api/auth/wx-login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('code');
  });
});

// ===========================================================================
// POST /api/auth/wx-web-login — ban check
// ===========================================================================
describe('POST /api/auth/wx-web-login', () => {
  const app = createApp();

  beforeEach(() => {
    resetPrismaMocks();
    mockFetch.mockReset();
    mockPrisma.users.update.mockResolvedValue({});
    mockPrisma.login_logs.create.mockResolvedValue({});
  });

  function mockWxWebCodeSuccess() {
    mockFetch
      // First call: token exchange
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ openid: 'web_openid', unionid: 'web_unionid', access_token: 'at' }),
      })
      // Second call: userinfo
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ nickname: 'wxuser', headimgurl: 'http://img.com/a.jpg' }),
      });
  }

  it('returns 403 when existing user is banned via wx-web-login', async () => {
    process.env.WX_WEB_APPID = 'test_web_appid';
    process.env.WX_WEB_APP_SECRET = 'test_web_secret';

    mockWxWebCodeSuccess();

    // Found by unionid
    mockPrisma.users.findUnique.mockResolvedValue({
      id: 1, username: 'banned_web_user', email: null, avatar: null, bio: null,
      emailVerified: true, points: 0, level: 1,
      membership_tier: 'free', membership_expires_at: null, createdAt: new Date(),
      isBanned: true, bannedReason: '刷积分',
    });

    const res = await request(app)
      .post('/api/auth/wx-web-login')
      .send({ code: 'valid_code' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('封禁');
  });
});