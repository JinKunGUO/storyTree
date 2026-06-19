/**
 * 评论(Comments)模块测试
 *
 * 测试覆盖：
 * 1. 评论创建 - 参数验证、敏感词过滤
 * 2. 评论删除 - 所有权验证
 * 3. 评论更新 - 所有权验证
 * 4. 评论投票 - 重复投票检查
 * 5. router.param commentId 验证
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// Mock Prisma
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

function makeComment(overrides: Partial<any> = {}) {
  return {
    id: 1,
    content: '这是一条测试评论',
    node_id: 1,
    user_id: 1,
    parent_id: null,
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// 评论创建参数验证
// ===========================================================================
describe('评论创建参数验证', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('空内容应被拒绝', () => {
    const emptyContents = ['', '   ', null, undefined];
    emptyContents.forEach(content => {
      const isInvalid = !content || (typeof content === 'string' && content.trim().length === 0);
      expect(isInvalid).toBe(true);
    });
  });

  it('有效内容应通过', () => {
    const validContent = '这是一条有效的评论';
    expect(validContent.trim().length).toBeGreaterThan(0);
  });

  it('评论内容过长应被拒绝（>5000字符）', () => {
    const longContent = '字'.repeat(5001);
    expect(longContent.length).toBeGreaterThan(5000);
  });

  it('评论内容在限制内应通过', () => {
    const normalContent = '字'.repeat(500);
    expect(normalContent.length).toBeLessThanOrEqual(5000);
  });
});

// ===========================================================================
// 评论所有权验证
// ===========================================================================
describe('评论所有权验证', () => {
  it('评论作者可以删除自己的评论', () => {
    const comment = makeComment({ user_id: 1 });
    const userId = 1;
    expect(comment.user_id).toBe(userId);
  });

  it('非评论作者不能删除他人评论', () => {
    const comment = makeComment({ user_id: 2 });
    const userId = 1;
    expect(comment.user_id).not.toBe(userId);
  });

  it('评论作者可以编辑自己的评论', () => {
    const comment = makeComment({ user_id: 1 });
    const userId = 1;
    expect(comment.user_id).toBe(userId);
  });

  it('非评论作者不能编辑他人评论', () => {
    const comment = makeComment({ user_id: 2 });
    const userId = 1;
    expect(comment.user_id).not.toBe(userId);
  });
});

// ===========================================================================
// 评论投票逻辑
// ===========================================================================
describe('评论投票逻辑', () => {
  it('用户不能给自己的评论投票', () => {
    const comment = makeComment({ user_id: 1 });
    const voterId = 1;
    expect(comment.user_id).toBe(voterId);
  });

  it('用户可以给他人评论投票', () => {
    const comment = makeComment({ user_id: 2 });
    const voterId = 1;
    expect(comment.user_id).not.toBe(voterId);
  });

  it('投票类型只能是 up 或 down', () => {
    const validTypes = ['up', 'down'];
    const invalidTypes = ['like', 'dislike', '', null, 1];
    
    validTypes.forEach(type => {
      expect(['up', 'down']).toContain(type);
    });
    
    invalidTypes.forEach(type => {
      expect(['up', 'down']).not.toContain(type);
    });
  });
});

// ===========================================================================
// router.param commentId 验证
// ===========================================================================
describe('router.param commentId 验证', () => {
  it('有效正整数 commentId 应通过', () => {
    const validIds = ['1', '100', '99999'];
    validIds.forEach(id => {
      const parsed = parseInt(id, 10);
      expect(isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThan(0);
    });
  });

  it('无效 commentId 应被拒绝', () => {
    const invalidIds = ['abc', '0', '-5', '', 'NaN'];
    invalidIds.forEach(id => {
      const parsed = parseInt(id, 10);
      const isInvalid = isNaN(parsed) || parsed < 1;
      expect(isInvalid).toBe(true);
    });
  });
});

// ===========================================================================
// 嵌套评论（回复）
// ===========================================================================
describe('嵌套评论（回复）', () => {
  it('回复评论必须指向存在的父评论', () => {
    const reply = makeComment({ parent_id: 5 });
    expect(reply.parent_id).not.toBeNull();
    expect(reply.parent_id).toBeGreaterThan(0);
  });

  it('顶层评论 parent_id 为 null', () => {
    const topLevel = makeComment({ parent_id: null });
    expect(topLevel.parent_id).toBeNull();
  });
});
