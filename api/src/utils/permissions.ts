import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { getUserId } from './middleware';

/**
 * 检查用户是否是故事的主创作者
 */
export async function isStoryAuthor(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { author_id: true }
  });
  return story?.author_id === userId;
}

/**
 * 检查用户是否是故事的协作者（且未被移除）
 */
export async function isCollaborator(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  const collaborator = await prisma.story_collaborators.findFirst({
    where: { 
      story_id: storyId, 
      user_id: userId,
      removed_at: null // 未被移除
    }
  });
  return !!collaborator;
}

/**
 * 检查用户是否关注了故事作者（单向关注）
 */
export async function isFollowingAuthor(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { author_id: true }
  });
  if (!story) return false;
  
  const follow = await prisma.follows.findUnique({
    where: {
      follower_id_following_id: {
        follower_id: userId,
        following_id: story.author_id
      }
    }
  });
  return !!follow;
}

/**
 * 检查用户是否关注了故事（粉丝）
 */
export async function isStoryFollower(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  const follower = await prisma.story_followers.findUnique({
    where: {
      story_id_user_id: {
        story_id: storyId,
        user_id: userId
      }
    }
  });
  return !!follower;
}

/**
 * 检查用户是否可以查看故事
 * 规则：
 * - public: 任何人可见
 * - friends: 粉丝、关注者、协作者、作者可见
 * - private: 仅作者和协作者可见
 */
export async function canViewStory(userId: number | null, storyId: number): Promise<boolean> {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { visibility: true, author_id: true }
  });
  
  if (!story) return false;
  
  // 公开故事（包括未设置visibility的旧故事），任何人可见
  if (!story.visibility || story.visibility === 'public') return true;
  
  // 未登录用户不能查看非公开故事
  if (!userId) return false;
  
  // 作者始终可见
  if (story.author_id === userId) return true;
  
  // 协作者始终可见
  if (await isCollaborator(userId, storyId)) return true;
  
  // 仅关注者可见的故事
  if (story.visibility === 'friends') {
    // 检查是否是故事粉丝
    if (await isStoryFollower(userId, storyId)) return true;
    // 检查是否关注了作者
    return await isFollowingAuthor(userId, storyId);
  }
  
  // 私密故事，其他人不可见
  return false;
}

/**
 * 检查用户是否可以编辑故事（修改设置、删除故事等）
 * 规则：仅主创作者可以编辑
 */
export async function canEditStory(userId: number | null, storyId: number): Promise<boolean> {
  return await isStoryAuthor(userId, storyId);
}

/**
 * 检查用户是否可以创建分支（续写）
 * 规则：
 * - 主创作者始终可以
 * - 协作者根据allow_branch设置决定
 * - 其他人不可以
 */
export async function canCreateBranch(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  
  // 作者始终可以续写
  if (await isStoryAuthor(userId, storyId)) return true;
  
  // 检查是否是协作者
  if (!await isCollaborator(userId, storyId)) return false;
  
  // 协作者根据allow_branch设置决定
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { allow_branch: true }
  });
  
  return story?.allow_branch ?? true;
}

/**
 * 检查用户是否可以评论
 * 规则：
 * - 必须有查看权限
 * - 故事允许评论（allow_comment = true）
 */
export async function canComment(userId: number | null, storyId: number): Promise<boolean> {
  if (!userId) return false;
  
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { allow_comment: true }
  });
  
  if (story?.allow_comment === false) return false;
  
  return await canViewStory(userId, storyId);
}

/**
 * 检查用户是否可以删除章节
 * 规则：
 * - 章节作者可以删除自己的章节（如果有子节点则需要提交删除申请）
 * - 故事主创作者可以删除任何章节
 */
export async function canDeleteNode(userId: number | null, nodeId: number): Promise<boolean> {
  if (!userId) return false;
  
  const node = await prisma.nodes.findUnique({
    where: { id: nodeId },
    select: { author_id: true, story_id: true }
  });
  
  if (!node) return false;
  
  // 故事主创作者可以删除任何章节
  if (await isStoryAuthor(userId, node.story_id)) return true;
  
  // 章节作者可以删除自己的章节
  return node.author_id === userId;
}

/**
 * 检查章节是否有子节点
 */
export async function nodeHasChildren(nodeId: number): Promise<boolean> {
  const childCount = await prisma.nodes.count({
    where: { parent_id: nodeId }
  });
  return childCount > 0;
}

/**
 * 权限检查中间件 - 查看故事
 */
export function checkViewPermission(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  const storyId = parseInt(req.params.id || req.params.storyId);

  canViewStory(userId, storyId).then(allowed => {
    if (!allowed) {
      return res.status(403).json({ error: '无权限查看此故事' });
    }
    next();
  }).catch(error => {
    console.error('Permission check error:', error);
    res.status(500).json({ error: '权限检查失败' });
  });
}

/**
 * 权限检查中间件 - 编辑故事
 */
export function checkEditPermission(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  const storyId = parseInt(req.params.id || req.params.storyId);

  if (!userId) {
    return res.status(401).json({ error: '请先登录' });
  }

  canEditStory(userId, storyId).then(allowed => {
    if (!allowed) {
      return res.status(403).json({ error: '无权限编辑此故事' });
    }
    next();
  }).catch(error => {
    console.error('Permission check error:', error);
    res.status(500).json({ error: '权限检查失败' });
  });
}

/**
 * 权限检查中间件 - 创建分支
 */
export function checkBranchPermission(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  const storyId = parseInt(req.body.story_id || req.params.storyId);

  canCreateBranch(userId, storyId).then(allowed => {
    if (!allowed) {
      return res.status(403).json({ error: '无权限在此故事创建分支' });
    }
    next();
  }).catch(error => {
    console.error('Permission check error:', error);
    res.status(500).json({ error: '权限检查失败' });
  });
}
