import { describe, it, expect, vi } from 'vitest';
import {
  safeParseInt,
  safeParseId,
  safeParsePage,
  safeParseLimit,
  safeParsePageSize,
  requireAdmin,
  getUserId,
} from '../middleware';

// ---------------------------------------------------------------------------
// safeParseInt
// ---------------------------------------------------------------------------
describe('safeParseInt', () => {
  it('returns defaultValue for undefined', () => {
    expect(safeParseInt(undefined, 42)).toBe(42);
  });

  it('returns defaultValue for null', () => {
    expect(safeParseInt(null, 42)).toBe(42);
  });

  it('returns defaultValue for empty string', () => {
    expect(safeParseInt('', 42)).toBe(42);
  });

  it('returns defaultValue for NaN string', () => {
    expect(safeParseInt('abc', 7)).toBe(7);
  });

  it('returns defaultValue for Infinity string', () => {
    expect(safeParseInt('Infinity', 7)).toBe(7);
  });

  it('returns defaultValue for number Infinity', () => {
    expect(safeParseInt(Infinity, 7)).toBe(7);
  });

  it('parses a normal integer string', () => {
    expect(safeParseInt('123')).toBe(123);
  });

  it('parses a number value', () => {
    expect(safeParseInt(456)).toBe(456);
  });

  it('clamps to min when value is below min', () => {
    expect(safeParseInt('0', 10, 5)).toBe(5);
  });

  it('does not clamp when value equals min', () => {
    expect(safeParseInt('5', 10, 5)).toBe(5);
  });

  it('clamps to max when value exceeds max', () => {
    expect(safeParseInt('200', 10, undefined, 100)).toBe(100);
  });

  it('does not clamp when value equals max', () => {
    expect(safeParseInt('100', 10, undefined, 100)).toBe(100);
  });

  it('clamps both min and max', () => {
    expect(safeParseInt('500', 10, 1, 100)).toBe(100);
    expect(safeParseInt('-5', 10, 1, 100)).toBe(1);
  });

  it('defaults defaultValue to 0 when not provided', () => {
    expect(safeParseInt(undefined)).toBe(0);
  });

  it('returns defaultValue for value outside safe integer range (too large)', () => {
    expect(safeParseInt(String(Number.MAX_SAFE_INTEGER + 1), 0)).toBe(0);
  });

  it('returns defaultValue for value outside safe integer range (too small)', () => {
    expect(safeParseInt(String(Number.MIN_SAFE_INTEGER - 1), 0)).toBe(0);
  });

  it('trims whitespace before parsing', () => {
    expect(safeParseInt('  30  ', 0)).toBe(30);
  });

  it('uses default when only whitespace is provided', () => {
    expect(safeParseInt('   ', 99)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// safeParseId
// ---------------------------------------------------------------------------
describe('safeParseId', () => {
  it('returns default when value is null', () => {
    expect(safeParseId(null, 5)).toBe(5);
  });

  it('clamps negative values to 1', () => {
    expect(safeParseId(-10)).toBe(1);
  });

  it('clamps zero to 1', () => {
    expect(safeParseId(0)).toBe(1);
  });

  it('returns valid positive id as-is', () => {
    expect(safeParseId(42)).toBe(42);
  });

  it('defaults defaultValue to 1 when not provided', () => {
    expect(safeParseId(undefined)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// safeParsePage
// ---------------------------------------------------------------------------
describe('safeParsePage', () => {
  it('returns 1 for null when default is 1', () => {
    expect(safeParsePage(null)).toBe(1);
  });

  it('clamps huge value to max (default 1000)', () => {
    expect(safeParsePage(9999)).toBe(1000);
  });

  it('returns the parsed value within range', () => {
    expect(safeParsePage('5')).toBe(5);
  });

  it('respects custom max', () => {
    expect(safeParsePage('500', 1, 50)).toBe(50);
  });

  it('clamps below 1 to 1', () => {
    expect(safeParsePage('0')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// safeParseLimit
// ---------------------------------------------------------------------------
describe('safeParseLimit', () => {
  it('prefers limit over pageSize', () => {
    const req = { query: { limit: '10', pageSize: '20' } };
    expect(safeParseLimit(req)).toBe(10);
  });

  it('falls back to pageSize when limit is absent', () => {
    const req = { query: { pageSize: '25' } };
    expect(safeParseLimit(req)).toBe(25);
  });

  it('returns default when neither limit nor pageSize is present', () => {
    const req = { query: {} };
    expect(safeParseLimit(req)).toBe(20);
  });

  it('returns custom default', () => {
    const req = { query: {} };
    expect(safeParseLimit(req, 50)).toBe(50);
  });

  it('clamps to max', () => {
    const req = { query: { limit: '500' } };
    expect(safeParseLimit(req, 20, 100)).toBe(100);
  });

  it('clamps to 1 minimum', () => {
    const req = { query: { limit: '0' } };
    expect(safeParseLimit(req)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// safeParsePageSize (deprecated, but still tested)
// ---------------------------------------------------------------------------
describe('safeParsePageSize', () => {
  it('returns default for null', () => {
    expect(safeParsePageSize(null, 15)).toBe(15);
  });

  it('parses a valid value', () => {
    expect(safeParsePageSize('30')).toBe(30);
  });

  it('clamps to max', () => {
    expect(safeParsePageSize('999', 20, 50)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------
describe('requireAdmin', () => {
  function createMocks() {
    const req: any = {};
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  }

  it('returns 401 when userId is absent', () => {
    const { req, res, next } = createMocks();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', () => {
    const { req, res, next } = createMocks();
    req.userId = 1;
    req.isAdmin = false;
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user is admin', () => {
    const { req, res, next } = createMocks();
    req.userId = 1;
    req.isAdmin = true;
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getUserId
// ---------------------------------------------------------------------------
describe('getUserId', () => {
  it('returns userId when present', () => {
    const req: any = { userId: 42 };
    expect(getUserId(req)).toBe(42);
  });

  it('returns null when userId is absent', () => {
    const req: any = {};
    expect(getUserId(req)).toBeNull();
  });

  it('returns null when userId is 0 (falsy)', () => {
    const req: any = { userId: 0 };
    expect(getUserId(req)).toBeNull();
  });
});