/**
 * 会员系统测试
 *
 * 测试覆盖：
 * 1. 会员等级配置
 * 2. 会员权益检查
 * 3. 会员配额计算
 * 4. 会员升级逻辑
 * 5. 边界情况测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MEMBERSHIP_TIERS,
  getMembershipBenefits,
  isValidMembership,
} from '../../utils/membership';
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
    level: 2,
    membership_tier: 'free',
    membership_expires_at: null,
    isAdmin: false,
    has_used_trial: false,
    ...overrides,
  };
}

// ===========================================================================
// MEMBERSHIP_TIERS - 会员等级配置
// ===========================================================================
describe('MEMBERSHIP_TIERS 配置', () => {
  it('免费用户配置正确', () => {
    expect(MEMBERSHIP_TIERS.free.price).toBe(0);
    expect(MEMBERSHIP_TIERS.free.duration).toBe(0);
    expect(MEMBERSHIP_TIERS.free.quotaMultiplier).toBe(1);
  });

  it('体验会员配置正确', () => {
    expect(MEMBERSHIP_TIERS.trial.price).toBe(9.9);
    expect(MEMBERSHIP_TIERS.trial.duration).toBe(7);
    expect(MEMBERSHIP_TIERS.trial.quotaMultiplier).toBe(1.2);
  });

  it('月度会员配置正确', () => {
    expect(MEMBERSHIP_TIERS.monthly.price).toBe(39);
    expect(MEMBERSHIP_TIERS.monthly.duration).toBe(30);
    expect(MEMBERSHIP_TIERS.monthly.quotaMultiplier).toBe(1.5);
  });

  it('季度会员配置正确', () => {
    expect(MEMBERSHIP_TIERS.quarterly.price).toBe(99);
    expect(MEMBERSHIP_TIERS.quarterly.duration).toBe(90);
    expect(MEMBERSHIP_TIERS.quarterly.quotaMultiplier).toBe(1.8);
  });

  it('年度会员配置正确', () => {
    expect(MEMBERSHIP_TIERS.yearly.price).toBe(388);
    expect(MEMBERSHIP_TIERS.yearly.duration).toBe(365);
    expect(MEMBERSHIP_TIERS.yearly.quotaMultiplier).toBe(-1); // 无限
  });

  it('企业版配置正确', () => {
    expect(MEMBERSHIP_TIERS.enterprise.price).toBe(999);
    expect(MEMBERSHIP_TIERS.enterprise.duration).toBe(365);
    expect(MEMBERSHIP_TIERS.enterprise.quotaMultiplier).toBe(-1); // 无限
    expect(MEMBERSHIP_TIERS.enterprise.maxAccounts).toBe(5);
  });

  it('会员等级按价格升序排列', () => {
    const tiers = Object.values(MEMBERSHIP_TIERS);
    const prices = tiers.map(t => t.price);

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });
});

// ===========================================================================
// getMembershipBenefits - 获取会员权益列表
// ===========================================================================
describe('getMembershipBenefits', () => {
  it('返回所有会员等级的权益', () => {
    const benefits = getMembershipBenefits();

    expect(benefits).toHaveLength(Object.keys(MEMBERSHIP_TIERS).length);
    expect(benefits.map(b => b.tier)).toEqual(
      expect.arrayContaining(Object.keys(MEMBERSHIP_TIERS))
    );
  });

  it('返回指定会员等级的权益', () => {
    const benefits = getMembershipBenefits('yearly');

    expect(benefits).toHaveLength(1);
    expect(benefits[0].tier).toBe('yearly');
    expect(benefits[0].name).toBe('年度会员');
    expect(benefits[0].price).toBe(388);
  });

  it('免费用户的配额描述正确', () => {
    const benefits = getMembershipBenefits('free');

    expect(benefits[0].quotaDescription).toContain('按用户等级');
  });

  it('年度会员的配额描述为无限', () => {
    const benefits = getMembershipBenefits('yearly');

    expect(benefits[0].quotaDescription).toContain('无限');
  });

  it('企业版的配额描述为无限', () => {
    const benefits = getMembershipBenefits('enterprise');

    expect(benefits[0].quotaDescription).toContain('无限');
  });
});

// ===========================================================================
// isValidMembership - 检查会员是否有效
// ===========================================================================
describe('isValidMembership', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('免费用户返回 false（无有效期）', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({ membership_tier: 'free', membership_expires_at: null })
    );

    const result = await isValidMembership(1);
    // 免费用户没有 expires_at，isActive = false
    expect(result).toBe(false);
  });

  it('有效期内的会员返回 true', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({
        membership_tier: 'monthly',
        membership_expires_at: futureDate
      })
    );

    const result = await isValidMembership(1);
    expect(result).toBe(true);
  });

  it('已过期的会员返回 false', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({
        membership_tier: 'monthly',
        membership_expires_at: pastDate
      })
    );

    const result = await isValidMembership(1);
    expect(result).toBe(false);
  });

  it('检查特定等级：等级匹配返回 true', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({
        membership_tier: 'monthly',
        membership_expires_at: futureDate
      })
    );

    const result = await isValidMembership(1, 'monthly');
    expect(result).toBe(true);
  });

  it('检查特定等级：更高等级返回 true', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);

    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({
        membership_tier: 'yearly',
        membership_expires_at: futureDate
      })
    );

    // 年度会员 > 月度会员要求
    const result = await isValidMembership(1, 'monthly');
    expect(result).toBe(true);
  });

  it('检查特定等级：等级不足返回 false', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({
        membership_tier: 'monthly',
        membership_expires_at: futureDate
      })
    );

    // 月度会员 < 年度会员要求
    const result = await isValidMembership(1, 'yearly');
    expect(result).toBe(false);
  });

  it('管理员用户视为有效会员', async () => {
    mockPrisma.users.findUnique.mockResolvedValue(
      makeUser({ isAdmin: true })
    );

    const result = await isValidMembership(1);
    expect(result).toBe(true);
  });
});

// ===========================================================================
// 会员权益映射测试
// ===========================================================================
describe('会员权益映射', () => {
  it('体验会员包含基础权益', () => {
    const trialBenefits = MEMBERSHIP_TIERS.trial.benefits;
    expect(trialBenefits).toContain('会员徽章 (铜色)');
    expect(trialBenefits).toContain('AI 响应速度优先');
    expect(trialBenefits).toContain('去除广告');
  });

  it('月度会员包含高级编辑器功能', () => {
    const monthlyBenefits = MEMBERSHIP_TIERS.monthly.benefits;
    expect(monthlyBenefits).toContain('会员徽章 (银色)');
    expect(monthlyBenefits).toContain('AI 模型选择');
    expect(monthlyBenefits).toContain('高级编辑器功能');
    expect(monthlyBenefits).toContain('批量操作功能');
  });

  it('季度会员包含导出功能', () => {
    const quarterlyBenefits = MEMBERSHIP_TIERS.quarterly.benefits;
    expect(quarterlyBenefits).toContain('导出功能 (PDF/EPUB/DOCX)');
    expect(quarterlyBenefits).toContain('数据分析报表');
    expect(quarterlyBenefits).toContain('粉丝画像分析');
  });

  it('年度会员包含版本历史功能', () => {
    const yearlyBenefits = MEMBERSHIP_TIERS.yearly.benefits;
    expect(yearlyBenefits).toContain('版本历史功能');
    expect(yearlyBenefits).toContain('敏感词审核优先通过');
    expect(yearlyBenefits).toContain('专属客服通道');
    expect(yearlyBenefits).toContain('每月赠送 500 积分');
  });

  it('企业版包含团队协作功能', () => {
    const enterpriseBenefits = MEMBERSHIP_TIERS.enterprise.benefits;
    expect(enterpriseBenefits).toContain('团队协作增强功能');
    expect(enterpriseBenefits).toContain('多账号管理面板');
    expect(enterpriseBenefits).toContain('专属客服经理');
  });
});

// ===========================================================================
// 配额倍数计算测试
// ===========================================================================
describe('配额倍数计算', () => {
  it('免费用户配额倍数为 1', () => {
    expect(MEMBERSHIP_TIERS.free.quotaMultiplier).toBe(1);
  });

  it('体验会员配额增加 20%', () => {
    expect(MEMBERSHIP_TIERS.trial.quotaMultiplier).toBe(1.2);
  });

  it('月度会员配额增加 50%', () => {
    expect(MEMBERSHIP_TIERS.monthly.quotaMultiplier).toBe(1.5);
  });

  it('季度会员配额增加 80%', () => {
    expect(MEMBERSHIP_TIERS.quarterly.quotaMultiplier).toBe(1.8);
  });

  it('年度会员和企业版配额无限', () => {
    expect(MEMBERSHIP_TIERS.yearly.quotaMultiplier).toBe(-1);
    expect(MEMBERSHIP_TIERS.enterprise.quotaMultiplier).toBe(-1);
  });
});

// ===========================================================================
// 会员等级顺序测试
// ===========================================================================
describe('会员等级顺序', () => {
  it('会员等级价格从低到高', () => {
    const tierOrder = ['free', 'trial', 'monthly', 'quarterly', 'yearly', 'enterprise'];
    const prices = tierOrder.map(tier => MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS].price);

    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('季度会员比月度会员优惠', () => {
    const monthlyPrice = MEMBERSHIP_TIERS.monthly.price;
    const quarterlyPrice = MEMBERSHIP_TIERS.quarterly.price;

    // 季度会员价格应小于 3 倍月度会员价格
    expect(quarterlyPrice).toBeLessThan(monthlyPrice * 3);
  });

  it('年度会员比季度会员优惠', () => {
    const quarterlyPrice = MEMBERSHIP_TIERS.quarterly.price;
    const yearlyPrice = MEMBERSHIP_TIERS.yearly.price;

    // 年度会员价格应小于 4 倍季度会员价格
    expect(yearlyPrice).toBeLessThan(quarterlyPrice * 4);
  });
});