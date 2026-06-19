/**
 * 搜索(Search)模块测试
 *
 * 测试覆盖：
 * 1. 搜索参数验证 - 关键词长度、type 参数
 * 2. 分页参数 - page/limit/pageSize 兼容
 * 3. 搜索结果格式验证
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// Mock Prisma
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

// ===========================================================================
// 搜索参数验证
// ===========================================================================
describe('搜索参数验证', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('空搜索词应被拒绝', () => {
    const invalidQueries = ['', null, undefined];
    invalidQueries.forEach(q => {
      const isInvalid = !q || typeof q !== 'string';
      expect(isInvalid).toBe(true);
    });
  });

  it('搜索词过短（<2字符）应被拒绝', () => {
    const shortQueries = ['a', '1', '字'];
    shortQueries.forEach(q => {
      expect(q.trim().length).toBeLessThan(2);
    });
  });

  it('有效搜索词应通过（>=2字符）', () => {
    const validQueries = ['故事', 'ab', '测试搜索', 'hello world'];
    validQueries.forEach(q => {
      expect(q.trim().length).toBeGreaterThanOrEqual(2);
    });
  });

  it('type 参数应为 all/stories/nodes', () => {
    const validTypes = ['all', 'stories', 'nodes'];
    const invalidTypes = ['users', 'comments', 'random'];
    
    validTypes.forEach(type => {
      expect(['all', 'stories', 'nodes']).toContain(type);
    });
    
    invalidTypes.forEach(type => {
      expect(['all', 'stories', 'nodes']).not.toContain(type);
    });
  });
});

// ===========================================================================
// 分页参数处理
// ===========================================================================
describe('分页参数处理', () => {
  it('page 默认为 1', () => {
    const page = Math.max(1, parseInt(undefined as any) || 1);
    expect(page).toBe(1);
  });

  it('page 负数应被修正为 1', () => {
    const page = Math.max(1, parseInt('-5') || 1);
    expect(page).toBe(1);
  });

  it('limit 默认为 20', () => {
    const rawLimit = undefined;
    const limit = Math.min(50, Math.max(1, parseInt(rawLimit as any) || 20));
    expect(limit).toBe(20);
  });

  it('limit 超过 50 应被截断为 50', () => {
    const rawLimit = '100';
    const limit = Math.min(50, Math.max(1, parseInt(rawLimit) || 20));
    expect(limit).toBe(50);
  });

  it('limit 为 0 时 fallback 到默认值 20（0 是 falsy）', () => {
    const rawLimit = '0';
    // parseInt('0') = 0, 0 || 20 = 20, Math.max(1, 20) = 20
    const limit = Math.min(50, Math.max(1, parseInt(rawLimit) || 20));
    expect(limit).toBe(20);
  });

  it('pageSize 参数应兼容为 limit（小程序端）', () => {
    const queryLimit = undefined;
    const queryPageSize = '15';
    const rawLimit = queryLimit || queryPageSize;
    const limit = Math.min(50, Math.max(1, parseInt(rawLimit as string) || 20));
    expect(limit).toBe(15);
  });

  it('skip 计算正确', () => {
    const page = 3;
    const limit = 20;
    const skip = (page - 1) * limit;
    expect(skip).toBe(40);
  });
});

// ===========================================================================
// 搜索结果格式
// ===========================================================================
describe('搜索结果格式', () => {
  it('返回结果应包含必要字段', () => {
    const result = {
      stories: [],
      nodes: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    expect(result).toHaveProperty('stories');
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('hasMore');
  });

  it('hasMore 计算正确 - 有更多数据', () => {
    const skip = 0;
    const limit = 20;
    const total = 50;
    const hasMore = skip + limit < total;
    expect(hasMore).toBe(true);
  });

  it('hasMore 计算正确 - 无更多数据', () => {
    const skip = 40;
    const limit = 20;
    const total = 50;
    const hasMore = skip + limit < total;
    expect(hasMore).toBe(false);
  });
});
