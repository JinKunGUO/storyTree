import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deductPoints, addPoints } from '../points';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

vi.mock('../notification', () => ({
  notifyPointsEarned: vi.fn().mockResolvedValue(undefined),
  notifyLevelUp: vi.fn().mockResolvedValue(undefined),
}));

describe('deductPoints — atomic race-condition fix', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('deducts points successfully when balance is sufficient', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 100, isAdmin: false });
    mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    // After decrement, return updated balance
    mockPrisma.users.findUnique.mockResolvedValueOnce({ points: 100, isAdmin: false });
    // Inside transaction, findUnique is called again
    mockPrisma.users.findUnique.mockResolvedValueOnce({ points: 90 });
    mockPrisma.users.update.mockResolvedValue({});
    mockPrisma.point_transactions.create.mockResolvedValue({});

    const result = await deductPoints(1, 10, 'ai_continuation', 'AI续写');

    expect(result.success).toBe(true);
    expect(result.newPoints).toBe(90);
  });

  it('fails when balance is insufficient', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 5, isAdmin: false });

    const result = await deductPoints(1, 10, 'ai_continuation', 'AI续写');

    expect(result.success).toBe(false);
    expect(result.newPoints).toBe(5);
  });

  it('fails atomically when concurrent request drains balance (updateMany returns 0)', async () => {
    // User has 10 points initially
    mockPrisma.users.findUnique.mockResolvedValue({ points: 10, isAdmin: false });
    // But by the time updateMany runs, another request already drained them
    mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });

    const result = await deductPoints(1, 10, 'ai_continuation', 'AI续写');

    expect(result.success).toBe(false);
    // No point_transactions should be created on failure
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it('uses $transaction for atomicity', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 100, isAdmin: false });
    mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.users.findUnique.mockResolvedValueOnce({ points: 100, isAdmin: false });
    mockPrisma.users.findUnique.mockResolvedValueOnce({ points: 90 });
    mockPrisma.users.update.mockResolvedValue({});
    mockPrisma.point_transactions.create.mockResolvedValue({});

    await deductPoints(1, 10, 'test', 'test');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('skips deduction for admin users', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 50, isAdmin: true });

    const result = await deductPoints(1, 10, 'ai_continuation', 'AI续写');

    expect(result.success).toBe(true);
    expect(result.newPoints).toBe(50);
    expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
  });

  it('throws when user does not exist', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    await expect(deductPoints(999, 10, 'test', 'test'))
      .rejects.toThrow('用户不存在');
  });

  it('records negative amount in point_transactions', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 100, isAdmin: false });
    mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.users.findUnique
      .mockResolvedValueOnce({ points: 100, isAdmin: false })
      .mockResolvedValueOnce({ points: 80 });
    mockPrisma.users.update.mockResolvedValue({});
    mockPrisma.point_transactions.create.mockResolvedValue({});

    await deductPoints(1, 20, 'ai_polish', 'AI润色');

    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -20 })
      })
    );
  });
});

describe('addPoints — atomic increment fix', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('uses atomic increment instead of read-then-write', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 50, level: 1 });
    mockPrisma.users.update
      .mockResolvedValueOnce({ points: 70 })  // increment result
      .mockResolvedValueOnce({});              // level update
    mockPrisma.point_transactions.create.mockResolvedValue({});

    const result = await addPoints(1, 20, 'publish', '发布故事');

    expect(result.newPoints).toBe(70);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('detects level up correctly', async () => {
    mockPrisma.users.findUnique.mockResolvedValue({ points: 95, level: 1 });
    mockPrisma.users.update
      .mockResolvedValueOnce({ points: 115 })  // now level 2
      .mockResolvedValueOnce({});
    mockPrisma.point_transactions.create.mockResolvedValue({});

    const result = await addPoints(1, 20, 'publish', '发布故事');

    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it('throws when user does not exist', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    await expect(addPoints(999, 10, 'test', 'test'))
      .rejects.toThrow('用户不存在');
  });
});
