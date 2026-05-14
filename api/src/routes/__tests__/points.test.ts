import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addPoints,
  deductPoints,
  hasEnoughPoints,
  getUserLevel,
  LEVEL_CONFIG,
} from '../../utils/points';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// Mock Prisma
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

// Mock notification functions
vi.mock('../../utils/notification', () => ({
  notifyPointsEarned: vi.fn().mockResolvedValue(undefined),
  notifyLevelUp: vi.fn().mockResolvedValue(undefined),
}));

// 模拟用户对象
function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 1,
    username: 'testuser',
    points: 100,
    level: 2,
    isAdmin: false,
    ...overrides,
  };
}

// ===========================================================================
// addPoints - 添加积分
// ===========================================================================
describe('addPoints', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('成功添加积分并返回新积分和等级信息', async () => {
    const user = makeUser({ points: 100, level: 2 });
    mockPrisma.users.findUnique.mockResolvedValue(user);
    mockPrisma.users.update.mockResolvedValue({ ...user, points: 150 });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: 1 });

    const result = await addPoints(1, 50, 'PUBLISH_STORY', '发布故事奖励');

    expect(result.newPoints).toBe(150);
    expect(result.levelUp).toBe(false);
    expect(mockPrisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: 150,
        }),
      })
    );
  });

  it('添加积分后升级', async () => {
    const user = makeUser({ points: 99, level: 1 });
    mockPrisma.users.findUnique.mockResolvedValue(user);
    mockPrisma.users.update.mockResolvedValue({ ...user, points: 100, level: 2 });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: 1 });

    const result = await addPoints(1, 1, 'PUBLISH_STORY', '发布故事奖励');

    expect(result.newPoints).toBe(100);
    expect(result.levelUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it('用户不存在时抛出错误', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    await expect(addPoints(999, 50, 'PUBLISH_STORY', '测试')).rejects.toThrow('用户不存在');
  });

  it('记录积分交易流水', async () => {
    const user = makeUser({ points: 100 });
    mockPrisma.users.findUnique.mockResolvedValue(user);
    mockPrisma.users.update.mockResolvedValue({ ...user, points: 150 });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: 1 });

    await addPoints(1, 50, 'PUBLISH_STORY', '发布故事奖励');

    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 1,
          amount: 50,
          type: 'PUBLISH_STORY',
          description: '发布故事奖励',
        }),
      })
    );
  });
});

// ===========================================================================
// deductPoints - 扣除积分
// ===========================================================================
describe('deductPoints', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('成功扣除积分', async () => {
    const user = makeUser({ points: 100 });
    mockPrisma.users.findUnique.mockResolvedValue(user);
    mockPrisma.users.update.mockResolvedValue({ ...user, points: 50 });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: 1 });

    const result = await deductPoints(1, 50, 'AI_CONTINUATION', 'AI 续写');

    expect(result.newPoints).toBe(50);
    expect(result.success).toBe(true);
  });

  it('积分不够时返回 success=false', async () => {
    const user = makeUser({ points: 30 });
    mockPrisma.users.findUnique.mockResolvedValue(user);

    const result = await deductPoints(1, 50, 'AI_CONTINUATION', 'AI 续写');

    expect(result.success).toBe(false);
    expect(result.newPoints).toBe(30);
  });

  it('管理员用户不扣除积分', async () => {
    const user = makeUser({ points: 100, isAdmin: true });
    mockPrisma.users.findUnique.mockResolvedValue(user);

    const result = await deductPoints(1, 50, 'AI_CONTINUATION', 'AI 续写');

    expect(result.success).toBe(true);
    expect(result.newPoints).toBe(100); // 管理员不扣分
    expect(mockPrisma.users.update).not.toHaveBeenCalled();
  });

  it('用户不存在时抛出错误', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    await expect(deductPoints(999, 50, 'AI_CONTINUATION', '测试')).rejects.toThrow('用户不存在');
  });

  it('记录积分交易流水（负数）', async () => {
    const user = makeUser({ points: 100 });
    mockPrisma.users.findUnique.mockResolvedValue(user);
    mockPrisma.users.update.mockResolvedValue({ ...user, points: 50 });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: 1 });

    await deductPoints(1, 50, 'AI_CONTINUATION', 'AI 续写');

    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 1,
          amount: -50, // 负数表示扣除
          type: 'AI_CONTINUATION',
          description: 'AI 续写',
        }),
      })
    );
  });
});

// ===========================================================================
// hasEnoughPoints - 检查积分是否足够
// ===========================================================================
describe('hasEnoughPoints', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('积分足够返回 true', async () => {
    const user = makeUser({ points: 100 });
    mockPrisma.users.findUnique.mockResolvedValue(user);

    const result = await hasEnoughPoints(1, 50);

    expect(result).toBe(true);
  });

  it('积分刚好够返回 true', async () => {
    const user = makeUser({ points: 100 });
    mockPrisma.users.findUnique.mockResolvedValue(user);

    const result = await hasEnoughPoints(1, 100);

    expect(result).toBe(true);
  });

  it('积分不够返回 false', async () => {
    const user = makeUser({ points: 50 });
    mockPrisma.users.findUnique.mockResolvedValue(user);

    const result = await hasEnoughPoints(1, 100);

    expect(result).toBe(false);
  });

  it('用户不存在返回 false', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(null);

    const result = await hasEnoughPoints(999, 50);

    expect(result).toBe(false);
  });
});

// ===========================================================================
// getUserLevel - 获取用户等级（纯函数，不需要 mock）
// ===========================================================================
describe('getUserLevel', () => {
  it('0 积分返回等级 1（新手作者）', () => {
    const result = getUserLevel(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe('新手作者');
    expect(result.progress).toBe(0);
  });

  it('99 积分返回等级 1（边界值）', () => {
    const result = getUserLevel(99);
    expect(result.level).toBe(1);
  });

  it('100 积分返回等级 2（活跃作者）', () => {
    const result = getUserLevel(100);
    expect(result.level).toBe(2);
    expect(result.name).toBe('活跃作者');
  });

  it('500 积分返回等级 3（专业作者）', () => {
    const result = getUserLevel(500);
    expect(result.level).toBe(3);
    expect(result.name).toBe('专业作者');
  });

  it('2000 积分返回等级 4（大师作者）', () => {
    const result = getUserLevel(2000);
    expect(result.level).toBe(4);
    expect(result.name).toBe('大师作者');
    expect(result.progress).toBe(100); // 最高等级
  });

  it('10000 积分返回等级 4（超出边界）', () => {
    const result = getUserLevel(10000);
    expect(result.level).toBe(4);
    expect(result.progress).toBe(100);
  });

  it('正确计算升级进度', () => {
    // 50 积分在等级 1 的中间
    const result = getUserLevel(50);
    expect(result.level).toBe(1);
    expect(result.progress).toBeCloseTo(50, 0); // 约 50%
  });

  it('返回正确的配额信息', () => {
    const result = getUserLevel(0);
    expect(result.quotas).toBeDefined();
    expect(result.quotas.continuation).toBe(5);
    expect(result.quotas.polish).toBe(10);
    expect(result.quotas.illustration).toBe(2);
  });
});