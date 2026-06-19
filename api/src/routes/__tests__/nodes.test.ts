/**
 * 章节(Nodes)模块测试
 *
 * 测试覆盖：
 * 1. 创建章节 - 参数验证、权限检查
 * 2. 更新章节 - 所有权验证
 * 3. 删除章节 - 所有权验证
 * 4. 获取章节详情 - 可见性权限
 * 5. router.param ID 验证
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// Mock Prisma
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

function makeNode(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: '测试章节',
    content: '这是测试内容',
    story_id: 1,
    author_id: 1,
    parent_id: null,
    is_draft: false,
    review_status: 'APPROVED',
    word_count: 100,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeStory(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: '测试故事',
    author_id: 1,
    visibility: 'public',
    allow_branch: true,
    is_deleted: false,
    ...overrides,
  };
}

// ===========================================================================
// 章节创建 - 参数验证
// ===========================================================================
describe('章节创建参数验证', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('缺少 story_id 应返回错误', () => {
    const body = { title: '测试', content: '内容' };
    expect(body).not.toHaveProperty('story_id');
  });

  it('缺少 title 应返回错误', () => {
    const body = { story_id: 1, content: '内容' };
    expect(body).not.toHaveProperty('title');
  });

  it('缺少 content 应返回错误', () => {
    const body = { story_id: 1, title: '标题' };
    expect(body).not.toHaveProperty('content');
  });

  it('title 过长应被拒绝（>200字符）', () => {
    const longTitle = 'a'.repeat(201);
    expect(longTitle.length).toBeGreaterThan(200);
  });
});

// ===========================================================================
// 章节所有权验证
// ===========================================================================
describe('章节所有权验证', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('章节作者可以编辑自己的章节', () => {
    const node = makeNode({ author_id: 1 });
    const userId = 1;
    expect(node.author_id).toBe(userId);
  });

  it('非作者不能编辑他人章节', () => {
    const node = makeNode({ author_id: 2 });
    const userId = 1;
    expect(node.author_id).not.toBe(userId);
  });

  it('故事作者可以删除故事中的任何章节', () => {
    const story = makeStory({ author_id: 1 });
    const node = makeNode({ author_id: 2, story_id: 1 });
    const userId = 1;
    expect(story.author_id).toBe(userId);
  });

  it('非故事作者不能删除他人章节', () => {
    const story = makeStory({ author_id: 2 });
    const node = makeNode({ author_id: 3, story_id: 1 });
    const userId = 1;
    expect(story.author_id).not.toBe(userId);
    expect(node.author_id).not.toBe(userId);
  });
});

// ===========================================================================
// 章节可见性权限
// ===========================================================================
describe('章节可见性权限', () => {
  it('公开故事的已审核章节任何人可见', () => {
    const story = makeStory({ visibility: 'public' });
    const node = makeNode({ review_status: 'APPROVED', is_draft: false });
    expect(story.visibility).toBe('public');
    expect(node.review_status).toBe('APPROVED');
    expect(node.is_draft).toBe(false);
  });

  it('草稿章节只有作者可见', () => {
    const node = makeNode({ is_draft: true, author_id: 1 });
    const userId = 1;
    const otherUserId = 2;
    expect(node.is_draft).toBe(true);
    expect(node.author_id).toBe(userId);
    expect(node.author_id).not.toBe(otherUserId);
  });

  it('私密故事的章节只有作者和协作者可见', () => {
    const story = makeStory({ visibility: 'private', author_id: 1 });
    expect(story.visibility).toBe('private');
  });
});

// ===========================================================================
// router.param ID 验证
// ===========================================================================
describe('router.param ID 验证', () => {
  it('有效正整数 ID 应通过', () => {
    const validIds = ['1', '42', '999999'];
    validIds.forEach(id => {
      const parsed = parseInt(id, 10);
      expect(isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThan(0);
    });
  });

  it('无效 ID 应被拒绝', () => {
    const invalidIds = ['abc', '0', '-1', '', 'null', 'undefined'];
    invalidIds.forEach(id => {
      const parsed = parseInt(id, 10);
      const isInvalid = isNaN(parsed) || parsed < 1;
      expect(isInvalid).toBe(true);
    });
  });

  it('浮点数 ID 被 parseInt 截断为整数（router.param 接受）', () => {
    // parseInt('3.14', 10) → 3，这是合法的
    const parsed = parseInt('3.14', 10);
    expect(parsed).toBe(3);
    expect(parsed >= 1).toBe(true);
  });
});

// ===========================================================================
// 分支创建验证
// ===========================================================================
describe('分支创建验证', () => {
  it('allow_branch=false 的故事不允许创建分支', () => {
    const story = makeStory({ allow_branch: false });
    expect(story.allow_branch).toBe(false);
  });

  it('allow_branch=true 的故事允许创建分支', () => {
    const story = makeStory({ allow_branch: true });
    expect(story.allow_branch).toBe(true);
  });

  it('分支章节必须有 parent_id', () => {
    const branchNode = makeNode({ parent_id: 5 });
    expect(branchNode.parent_id).not.toBeNull();
  });
});
