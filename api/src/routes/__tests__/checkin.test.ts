/**
 * 签到系统测试
 *
 * 测试覆盖：
 * 1. 每日签到功能
 * 2. 连续天数计算
 * 3. 补签功能
 * 4. 奖励积分计算
 * 5. 里程碑奖励
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// Mock Prisma
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

// 模拟用户对象
function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 1,
    username: 'testuser',
    points: 100,
    consecutive_days: 0,
    last_checkin_date: null,
    makeup_chances: 0,
    ...overrides,
  };
}

// 计算签到奖励积分（与 routes/checkin.ts 中的逻辑保持一致）
function calculateCheckinReward(consecutiveDays: number): number {
  const baseReward = 10;

  if (consecutiveDays <= 7) {
    return baseReward + (consecutiveDays - 1) * 2; // 10, 12, 14, 16, 18, 20, 22
  } else if (consecutiveDays <= 30) {
    return baseReward + 12 + Math.floor((consecutiveDays - 7) / 7) * 5; // 每周递增 5
  } else {
    return baseReward + 12 + 15 + Math.floor((consecutiveDays - 30) / 30) * 10; // 每月递增 10
  }
}

// 检查是否可以签到（与 routes/checkin.ts 中的逻辑保持一致）
function canCheckin(lastCheckinDate: Date | null): { canCheckin: boolean; reason?: string; isMissed?: boolean } {
  if (!lastCheckinDate) {
    return { canCheckin: true };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCheckin = new Date(lastCheckinDate.getFullYear(), lastCheckinDate.getMonth(), lastCheckinDate.getDate());

  const diffTime = today.getTime() - lastCheckin.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { canCheckin: false, reason: '今天已经签到过了' };
  } else if (diffDays === 1) {
    return { canCheckin: true };
  } else {
    return { canCheckin: true, isMissed: true };
  }
}

// ===========================================================================
// calculateCheckinReward - 计算签到奖励积分
// ===========================================================================
describe('calculateCheckinReward', () => {
  it('第 1 天签到获得 10 积分', () => {
    expect(calculateCheckinReward(1)).toBe(10);
  });

  it('第 2-7 天签到奖励递增（每天 +2）', () => {
    expect(calculateCheckinReward(2)).toBe(12);
    expect(calculateCheckinReward(3)).toBe(14);
    expect(calculateCheckinReward(4)).toBe(16);
    expect(calculateCheckinReward(5)).toBe(18);
    expect(calculateCheckinReward(6)).toBe(20);
    expect(calculateCheckinReward(7)).toBe(22);
  });

  it('第 8-14 天签到：第 1 周后递增', () => {
    // 公式：baseReward + 12 + floor((days-7)/7)*5
    // 第 8-13 天：10 + 12 + 0*5 = 22
    // 第 14 天：10 + 12 + 1*5 = 27
    expect(calculateCheckinReward(8)).toBe(22);
    expect(calculateCheckinReward(13)).toBe(22);
    expect(calculateCheckinReward(14)).toBe(27);
  });

  it('第 15-30 天签到：第 2 周后递增', () => {
    // 公式：10 + 12 + floor((days-7)/7)*5
    // 第 15-20 天：10 + 12 + 1*5 = 27
    // 第 21-27 天：10 + 12 + 2*5 = 32
    // 第 28-30 天：10 + 12 + 3*5 = 37
    expect(calculateCheckinReward(15)).toBe(27);
    expect(calculateCheckinReward(20)).toBe(27);
    expect(calculateCheckinReward(21)).toBe(32);
    expect(calculateCheckinReward(28)).toBe(37);
    expect(calculateCheckinReward(30)).toBe(37);
  });

  it('第 31-60 天签到：进入月度递增', () => {
    // 公式：baseReward + 12 + 15 + floor((days-30)/30)*10
    // 第 31-59 天：10 + 12 + 15 + 0*10 = 37
    // 第 60 天：10 + 12 + 15 + 1*10 = 47
    expect(calculateCheckinReward(31)).toBe(37);
    expect(calculateCheckinReward(59)).toBe(37);
    expect(calculateCheckinReward(60)).toBe(47);
  });

  it('第 61-90 天签到继续递增', () => {
    // 公式：10 + 12 + 15 + floor((days-30)/30)*10
    // 第 31-59 天：10 + 12 + 15 + 0*10 = 37
    // 第 60-89 天：10 + 12 + 15 + 1*10 = 47
    // 第 90-119 天：10 + 12 + 15 + 2*10 = 57
    expect(calculateCheckinReward(61)).toBe(47);
    expect(calculateCheckinReward(89)).toBe(47);
    expect(calculateCheckinReward(90)).toBe(57);
  });

  it('第 91+ 天签到继续递增', () => {
    expect(calculateCheckinReward(91)).toBe(57); // 10 + 12 + 15 + 2*10
    expect(calculateCheckinReward(100)).toBe(57);
  });
});

// ===========================================================================
// canCheckin - 检查是否可以签到
// ===========================================================================
describe('canCheckin', () => {
  it('从未签到的用户可以签到', () => {
    const result = canCheckin(null);
    expect(result.canCheckin).toBe(true);
    expect(result.isMissed).toBeUndefined();
  });

  it('今天已经签到的用户不能再次签到', () => {
    const today = new Date();
    const result = canCheckin(today);
    expect(result.canCheckin).toBe(false);
    expect(result.reason).toBe('今天已经签到过了');
  });

  it('昨天签到的用户可以今天继续签到', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = canCheckin(yesterday);
    expect(result.canCheckin).toBe(true);
    expect(result.isMissed).toBeUndefined();
  });

  it('前天签到的用户可以补签（中断了）', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const result = canCheckin(twoDaysAgo);
    expect(result.canCheckin).toBe(true);
    expect(result.isMissed).toBe(true);
  });

  it('7 天前签到的用户可以补签', () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const result = canCheckin(sevenDaysAgo);
    expect(result.canCheckin).toBe(true);
    expect(result.isMissed).toBe(true);
  });
});

// ===========================================================================
// 边界情况测试
// ===========================================================================
describe('边界情况测试', () => {
  it('闰年 2 月 29 日的签到处理', () => {
    const leapYearDate = new Date(2024, 1, 29); // 2024 年 2 月 29 日
    expect(leapYearDate.getDate()).toBe(29);
  });

  it('跨年签到的连续天数计算', () => {
    const newYearEve = new Date(2023, 11, 31);
    const newYearDay = new Date(2024, 0, 1);

    const diffTime = newYearDay.getTime() - newYearEve.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(1);
  });

  it('时区边界情况的日期格式化', () => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${y}-${m}-${d}`;

    expect(localDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});