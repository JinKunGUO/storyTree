import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRoutes from '../../routes/auth';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';
import { hashPassword } from '../../utils/auth';

// The global setup.ts mocks ../src/index with { prisma: vi.fn() } — just a placeholder
// function with no .stories/.users etc. Source modules (like auth routes) import
// { prisma } from '../index', so we override that mock here to re-export the real
// prisma mock from ../db which has the full set of model methods.
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

// Mock express-rate-limit so all rate limiters become no-op pass-through middleware.
// Without this, the 5-request-per-hour register limiter would block tests.
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