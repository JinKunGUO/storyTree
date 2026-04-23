import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';
import { updateWordCountAndCheckMilestones } from '../utils/milestone-checker';
import { addPoints } from '../utils/points';
import { WORD_REWARD_RATE, MAKEUP_CHANCE_RATE } from '../utils/milestones';

const router = Router();

// 举报频率限制（简单内存实现，生产环境建议用Redis）
const reportLimit = new Map<string, { count: number; date: string }>();
const MAX_REPORTS_PER_DAY = 10;

// Create node (first node or branch)
router.post('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { storyId, parentId, title, content, image, path, isPublished } = req.body;

  if (!storyId || !title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 验证故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 权限验证：检查用户是否是作者或有效的协作者
    const isAuthor = story.author_id === userId;
    const collaborator = await prisma.story_collaborators.findFirst({
      where: { 
        story_id: parseInt(storyId), 
        user_id: userId,
        removed_at: null // 未被移除
      }
    });
    const isValidCollaborator = !!collaborator;

    // 如果不是作者也不是有效协作者，拒绝
    if (!isAuthor && !isValidCollaborator) {
      return res.status(403).json({ error: '无权限为此故事创建章节' });
    }

    // 如果是协作者，检查是否允许续写
    if (isValidCollaborator && !isAuthor) {
      if (!story.allow_branch) {
        return res.status(403).json({ error: '故事作者已关闭协作者续写权限' });
      }
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查（只对发布的内容进行审核）
    const shouldPublish = isPublished !== false; // 默认为true以保持向后兼容
    const reviewCheck = shouldPublish ? needsReview(content, userNodeCount) : { needReview: false, reason: '' };

    // 如果是第一个节点（没有parentId）
    if (!parentId) {
      // 检查故事是否已有根节点
      const existingRoot = await prisma.nodes.findFirst({
        where: {
          story_id: parseInt(storyId),
          parent_id: null
        }
      });

      if (existingRoot) {
        return res.status(400).json({ error: '该故事已有第一章，请使用分支功能添加新章节' });
      }

      // 创建第一个节点
      const node = await prisma.nodes.create({
        data: {
          story_id: parseInt(storyId),
          parent_id: null,
          author_id: userId,
          title,
          content,
          image: image || null,
          path: path || '1',
          is_published: shouldPublish, // 根据参数设置发布状态
          review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
        },
        include: {
          author: {
            select: { id: true, username: true }
          },
          story: {
            select: { id: true, title: true }
          }
        }
      });

      // 更新故事的root_node_id（仅在发布状态时才设置）
      if (shouldPublish) {
        await prisma.stories.update({
          where: { id: parseInt(storyId) },
          data: { root_node_id: node.id }
        });
      }

    // 如果是发布状态且审核通过，通知粉丝
    if (shouldPublish && !reviewCheck.needReview) {
      // 获取故事粉丝列表
      const storyFollowers = await prisma.story_followers.findMany({
        where: { story_id: parseInt(storyId) },
        select: { user_id: true }
      });

      // 获取作者粉丝列表
      const authorFollowers = await prisma.follows.findMany({
        where: { following_id: userId },
        select: { follower_id: true }
      });

      // 合并并去重用户ID（避免重复通知）
      const notifyUserIds = new Set<number>();
      storyFollowers.forEach(f => notifyUserIds.add(f.user_id));
      authorFollowers.forEach(f => notifyUserIds.add(f.follower_id));
      
      // 排除作者自己
      notifyUserIds.delete(userId);

      // 批量创建通知
      if (notifyUserIds.size > 0) {
        await prisma.notifications.createMany({
          data: Array.from(notifyUserIds).map(user_id => ({
            user_id,
            type: 'STORY_UPDATE',
            title: '故事更新',
            content: `《${node.story.title}》发布了新章节：${title}`,
            link: `/chapter?id=${node.id}`
          }))
        });
      }

// 码字统计：仅统计非 AI 生成的已发布章节
      if (shouldPublish && !node.ai_generated) {
        const wordCount = content.length;
        
        // 实时码字奖励：每 1000 字奖励 10 积分
        const wordReward = Math.floor(wordCount / 1000) * WORD_REWARD_RATE;
        if (wordReward > 0) {
          // 章节作者获得全部奖励
          await addPoints(userId, wordReward, 'word_count', `创作章节《${title}》（${wordCount}字）`);
        }

        // 补签机会奖励：每 1000 字获得 1 次补签机会
        const makeupChances = Math.floor(wordCount / MAKEUP_CHANCE_RATE);
        if (makeupChances > 0) {
          await prisma.users.update({
            where: { id: userId },
            data: {
              makeup_chances: { increment: makeupChances }
            }
          });
        }

        // 更新码字数并检查里程碑（只统计章节作者）
        try {
          await updateWordCountAndCheckMilestones(userId, wordCount);
        } catch (error) {
          console.error('更新码字统计失败:', error);
        }
      }
    }

      const statusMessage = shouldPublish 
        ? (reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '第一章创建成功')
        : '草稿保存成功';

      return res.json({
        node,
        reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
        message: statusMessage
      });
    }

    // 如果有parentId，创建分支
    const parentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(parentId) }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 生成路径
    const siblingCount = await prisma.nodes.count({
      where: { parent_id: parseInt(parentId) }
    });
    const newPath = path || `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.nodes.create({
      data: {
        story_id: parseInt(storyId),
        parent_id: parseInt(parentId),
        author_id: userId,
        title,
        content,
        image: image || null,
        path: newPath,
        is_published: shouldPublish, // 根据参数设置发布状态
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    // 如果是发布状态且审核通过，通知粉丝
    if (shouldPublish && !reviewCheck.needReview) {
      // 获取故事粉丝列表
      const storyFollowers = await prisma.story_followers.findMany({
        where: { story_id: parseInt(storyId) },
        select: { user_id: true }
      });

      // 获取作者粉丝列表
      const authorFollowers = await prisma.follows.findMany({
        where: { following_id: node.author_id },
        select: { follower_id: true }
      });

      // 合并并去重用户 ID（避免重复通知）
      const notifyUserIds = new Set<number>();
      storyFollowers.forEach(f => notifyUserIds.add(f.user_id));
      authorFollowers.forEach(f => notifyUserIds.add(f.follower_id));
      
      // 排除作者自己
      notifyUserIds.delete(node.author_id);

      // 批量创建通知
      if (notifyUserIds.size > 0) {
        await prisma.notifications.createMany({
          data: Array.from(notifyUserIds).map(user_id => ({
            user_id,
            type: 'STORY_UPDATE',
            title: '故事更新',
            content: `《${node.story.title}》发布了新章节：${title}`,
            link: `/chapter?id=${node.id}`
          }))
        });
      }
    }

    // 码字统计：仅统计非 AI 生成的已发布章节
    if (shouldPublish && !node.ai_generated) {
        const wordCount = content.length;
        
        // 实时码字奖励：每 1000 字奖励 10 积分
        const wordReward = Math.floor(wordCount / 1000) * WORD_REWARD_RATE;
        if (wordReward > 0) {
          await addPoints(userId, wordReward, 'word_count', `创作章节《${title}》（${wordCount}字）`);
        }

        // 补签机会奖励：每 1000 字获得 1 次补签机会
        const makeupChances = Math.floor(wordCount / MAKEUP_CHANCE_RATE);
        if (makeupChances > 0) {
          await prisma.users.update({
            where: { id: userId },
            data: {
              makeup_chances: { increment: makeupChances }
            }
          });
        }

        // 更新码字数并检查里程碑
        try {
          await updateWordCountAndCheckMilestones(userId, wordCount);
        } catch (error) {
          console.error('更新码字统计失败:', error);
        }
    }

    const statusMessage = shouldPublish 
      ? (reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '分支创建成功')
      : '草稿保存成功';

    res.json({
      node,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: statusMessage
    });
  } catch (error) {
    console.error('创建节点错误:', error);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// Update node (章节编辑)
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content, image } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 检查节点是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 检查是否是作者
    if (node.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this node' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // 准备更新数据
    const updateData: any = {
      title,
      content,
      updated_at: new Date(),
      review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
    };

    // 如果提供了image字段，则更新它
    if (image !== undefined) {
      updateData.image = image || null;
    }

    // 更新节点
    const updatedNode = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      node: updatedNode,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '更新成功'
    });
  } catch (error) {
    console.error('更新节点错误:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// Publish draft chapter (发布草稿章节)
router.post('/:id/publish', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    // 检查节点是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: {
        story: {
          select: { id: true, title: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 检查是否是作者
    if (node.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to publish this node' });
    }

    // 检查是否已经发布
    if (node.is_published) {
      return res.status(400).json({ error: 'Node is already published' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId, is_published: true }
    });

    // 审核检查
    const reviewCheck = needsReview(node.content, userNodeCount);

    // 更新节点为已发布状态
    const updatedNode = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        is_published: true,
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
        updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    // 如果是第一章（无父节点），需要更新故事的 root_node_id
    if (!node.parent_id) {
      await prisma.stories.update({
        where: { id: node.story_id },
        data: { root_node_id: node.id }
      });
    }

    // 如果审核通过，通知粉丝
    if (!reviewCheck.needReview) {
      // 获取故事粉丝列表
      const storyFollowers = await prisma.story_followers.findMany({
        where: { story_id: node.story_id },
        select: { user_id: true }
      });

      // 获取作者粉丝列表
      const authorFollowers = await prisma.follows.findMany({
        where: { following_id: userId },
        select: { follower_id: true }
      });

      // 合并并去重用户ID（避免重复通知）
      const notifyUserIds = new Set<number>();
      storyFollowers.forEach(f => notifyUserIds.add(f.user_id));
      authorFollowers.forEach(f => notifyUserIds.add(f.follower_id));
      
      // 排除作者自己
      notifyUserIds.delete(userId);

      // 批量创建通知
      if (notifyUserIds.size > 0) {
        await prisma.notifications.createMany({
          data: Array.from(notifyUserIds).map(user_id => ({
            user_id,
            type: 'STORY_UPDATE',
            title: '故事更新',
            content: `《${node.story.title}》发布了新章节：${node.title}`,
            link: `/chapter?id=${node.id}`
          }))
        });
      }
    }

    // 码字统计：仅统计非AI生成的已发布章节
    if (!node.ai_generated && !reviewCheck.needReview) {
      const wordCount = node.content.length;
      
      // 实时码字奖励：每1000字奖励10积分
      const wordReward = Math.floor(wordCount / 1000) * WORD_REWARD_RATE;
      if (wordReward > 0) {
        await addPoints(userId, wordReward, 'word_count', `码字奖励（${wordCount}字）`, parseInt(id));
      }

      // 补签机会奖励：每1000字获得1次补签机会
      const makeupChances = Math.floor(wordCount / MAKEUP_CHANCE_RATE);
      if (makeupChances > 0) {
        await prisma.users.update({
          where: { id: userId },
          data: {
            makeup_chances: { increment: makeupChances }
          }
        });
      }

      // 更新码字数并检查里程碑
      try {
        await updateWordCountAndCheckMilestones(userId, wordCount);
      } catch (error) {
        console.error('更新码字统计失败:', error);
      }
    }

    const statusMessage = reviewCheck.needReview 
      ? `章节已发布，内容需要审核：${reviewCheck.reason}`
      : '章节发布成功';

    res.json({
      node: updatedNode,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: statusMessage
    });
  } catch (error) {
    console.error('发布章节错误:', error);
    res.status(500).json({ error: 'Failed to publish node' });
  }
});

// Delete node (删除章节)
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    // 检查节点是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: {
        story: {
          select: { id: true, author_id: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 检查权限：必须是节点作者或故事作者
    if (node.author_id !== userId && node.story.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this node' });
    }

    // 检查是否有子节点
    const childCount = await prisma.nodes.count({
      where: { parent_id: parseInt(id) }
    });

    if (childCount > 0) {
      return res.status(400).json({ 
        error: '该章节有子章节，无法删除',
        hasChildren: true,
        childCount
      });
    }

    // 检查是否是根节点
    if (node.parent_id === null) {
      // 如果是根节点，需要清除故事的root_node_id
      await prisma.stories.update({
        where: { id: node.story_id },
        data: { root_node_id: null }
      });
    }

    // 删除相关的评分
    await prisma.ratings.deleteMany({
      where: { node_id: parseInt(id) }
    });

    // 删除相关的评论
    await prisma.comments.deleteMany({
      where: { node_id: parseInt(id) }
    });

    // 删除相关的举报
    await prisma.reports.deleteMany({
      where: { node_id: parseInt(id) }
    });

    // 删除节点
    await prisma.nodes.delete({
      where: { id: parseInt(id) }
    });

    res.json({ 
      success: true, 
      message: '章节删除成功' 
    });
  } catch (error) {
    console.error('删除节点错误:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

// 获取当前用户的草稿列表（is_published=false 的节点）
// GET /api/nodes/my-drafts
router.get('/my-drafts', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rawDrafts = await prisma.nodes.findMany({
      where: {
        author_id: userId,
        is_published: false,
      },
      include: {
        story: {
          select: { id: true, title: true }
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // 批量查询父节点标题
    const parentIds = rawDrafts.map(d => d.parent_id).filter((id): id is number => id !== null);
    const parentNodes = parentIds.length > 0
      ? await prisma.nodes.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, title: true }
        })
      : [];
    const parentMap = new Map(parentNodes.map(n => [n.id, n.title]));

    const drafts = rawDrafts.map(d => ({
      ...d,
      parent_title: d.parent_id ? (parentMap.get(d.parent_id) || null) : null,
    }));

    res.json({ drafts });
  } catch (error) {
    console.error('获取草稿列表错误:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// 更新草稿内容（仅允许更新未发布节点，不触发审核）
// PATCH /api/nodes/:id/draft
router.patch('/:id/draft', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content, image } = req.body;

  try {
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (node.is_published) {
      return res.status(400).json({ error: '已发布章节请使用编辑接口' });
    }

    const updateData: any = { updated_at: new Date() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (image !== undefined) updateData.image = image || null;

    const updated = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: { id: true, title: true, content: true, updated_at: true }
    });

    res.json({ node: updated, message: '草稿已保存' });
  } catch (error) {
    console.error('更新草稿错误:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// Get node details with branches
router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true, author_id: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 草稿节点权限校验：只有节点作者和故事协作者可以访问
    const userId = getUserId(req);
    if (!node.is_published) {
      let canAccess = false;
      if (userId) {
        if (node.author_id === userId || node.story.author_id === userId) {
          canAccess = true;
        } else {
          const collaborator = await prisma.story_collaborators.findFirst({
            where: { story_id: node.story_id, user_id: userId, removed_at: null }
          });
          canAccess = !!collaborator;
        }
      }
      if (!canAccess) {
        return res.status(403).json({ error: '无权限访问此草稿章节' });
      }
    }

    // Increment read count (only for published nodes)
    if (node.is_published) {
      await prisma.nodes.update({
        where: { id: parseInt(id) },
        data: { read_count: { increment: 1 } }
      });
    }

    // Get branches with rating info（只返回已发布的分支，作者/协作者可见草稿分支）
    let branchFilter: any = { parent_id: parseInt(id) };
    if (userId) {
      const isStoryAuthor = node.story.author_id === userId;
      const isNodeAuthor = node.author_id === userId;
      if (!isStoryAuthor && !isNodeAuthor) {
        const collaborator = await prisma.story_collaborators.findFirst({
          where: { story_id: node.story_id, user_id: userId, removed_at: null }
        });
        if (!collaborator) {
          branchFilter.is_published = true;
        }
      }
    } else {
      branchFilter.is_published = true;
    }

    const branches = await prisma.nodes.findMany({
      where: branchFilter,
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [
        { rating_avg: 'desc' },
        { read_count: 'desc' }
      ]
    });

    // Get parent info for breadcrumb
    let parent = null;
    if (node.parent_id) {
      parent = await prisma.nodes.findUnique({
        where: { id: node.parent_id },
        select: { id: true, title: true }
      });
    }

    // Check if user has rated
    let userRating = null;
    if (userId) {
      const rating = await prisma.ratings.findUnique({
        where: {
          node_id_user_id: {
            node_id: parseInt(id),
            user_id: userId
          }
        }
      });
      if (rating) userRating = rating.score;
    }

    res.json({ node, branches, parent, userRating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// 查询节点插图数量
router.get('/:id/illustrations/count', async (req, res) => {
  const { id } = req.params;

  try {
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      select: { image: true }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 统计image字段中有多少张图片
    // 如果image字段包含多个URL（用逗号或换行分隔），则计数
    let count = 0;
    if (node.image) {
      // 尝试多种分隔符：逗号、分号、换行
      const images = node.image.split(/[,;\n]/).filter(url => url.trim());
      count = images.length;
    }

    res.json({ count });
  } catch (error) {
    console.error('查询插图数量错误:', error);
    res.status(500).json({ error: 'Failed to count illustrations' });
  }
});

// Get siblings (同级分支)
router.get('/:id/siblings', async (req, res) => {
  const { id } = req.params;

  try {
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      select: { parent_id: true }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 如果是根节点，没有同级分支
    if (!node.parent_id) {
      return res.json({ siblings: [] });
    }

    // 查询同级分支（同一个父节点下的其他节点）
    const siblings = await prisma.nodes.findMany({
      where: {
        parent_id: node.parent_id,
        id: { not: parseInt(id) }
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            comments: true,
            ratings: true
          }
        }
      },
      orderBy: [
        { rating_avg: 'desc' },
        { read_count: 'desc' }
      ]
    });

    res.json({ siblings });
  } catch (error) {
    console.error('获取同级分支错误:', error);
    res.status(500).json({ error: 'Failed to fetch siblings' });
  }
});

// Create branch
router.post('/:id/branches', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content, image, isPublished } = req.body;

  try {
    const parentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 权限验证：检查用户是否是作者或有效的协作者
    const isAuthor = parentNode.story.author_id === userId;
    const collaborator = await prisma.story_collaborators.findFirst({
      where: { 
        story_id: parentNode.story_id, 
        user_id: userId,
        removed_at: null // 未被移除
      }
    });
    const isValidCollaborator = !!collaborator;

    // 如果不是作者也不是有效协作者，拒绝
    if (!isAuthor && !isValidCollaborator) {
      return res.status(403).json({ error: '无权限为此故事创建分支' });
    }

    // 如果是协作者，检查是否允许续写
    if (isValidCollaborator && !isAuthor) {
      if (!parentNode.story.allow_branch) {
        return res.status(403).json({ error: '故事作者已关闭协作者续写权限' });
      }
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查（只对发布的内容进行审核）
    const shouldPublish = isPublished !== false; // 默认为true以保持向后兼容
    const reviewCheck = shouldPublish ? needsReview(content, userNodeCount) : { needReview: false, reason: '' };

    // Generate path: parent.path + branch number
    const siblingCount = await prisma.nodes.count({
      where: { parent_id: parseInt(id) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.nodes.create({
      data: {
        story_id: parentNode.story_id,
        parent_id: parseInt(id),
        author_id: userId,
        title,
        content,
        image,
        path: newPath,
        is_published: shouldPublish, // 根据参数设置发布状态
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    // 如果是发布状态且审核通过，通知粉丝
    if (shouldPublish && !reviewCheck.needReview) {
      // 获取故事粉丝列表
      const storyFollowers = await prisma.story_followers.findMany({
        where: { story_id: parentNode.story_id },
        select: { user_id: true }
      });

      // 获取作者粉丝列表
      const authorFollowers = await prisma.follows.findMany({
        where: { following_id: userId },
        select: { follower_id: true }
      });

      // 合并并去重用户ID（避免重复通知）
      const notifyUserIds = new Set<number>();
      storyFollowers.forEach(f => notifyUserIds.add(f.user_id));
      authorFollowers.forEach(f => notifyUserIds.add(f.follower_id));
      
      // 排除作者自己
      notifyUserIds.delete(userId);

      // 批量创建通知
      if (notifyUserIds.size > 0) {
        await prisma.notifications.createMany({
          data: Array.from(notifyUserIds).map(user_id => ({
            user_id,
            type: 'STORY_UPDATE',
            title: '故事更新',
            content: `《${node.story.title}》发布了新章节：${title}`,
            link: `/chapter?id=${node.id}`
          }))
        });
      }
    }

    const statusMessage = shouldPublish 
      ? (reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '发布成功')
      : '草稿保存成功';

    res.json({
      node,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: statusMessage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Rate a node（score=0 表示取消评分）
router.post('/:id/rate', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { score } = req.body;

  // score=0 表示取消评分，1-5 为正常评分
  if (score !== 0 && (score < 1 || score > 5)) {
    return res.status(400).json({ error: 'Score must be 0-5 (0 to cancel)' });
  }

  try {
    if (score === 0) {
      // 取消评分：删除已有评分记录（不存在时静默忽略）
      await prisma.ratings.deleteMany({
        where: {
          node_id: parseInt(id),
          user_id: userId,
        }
      });
    } else {
      // 新增或更新评分
      await prisma.ratings.upsert({
        where: {
          node_id_user_id: {
            node_id: parseInt(id),
            user_id: userId
          }
        },
        create: {
          node_id: parseInt(id),
          user_id: userId,
          score
        },
        update: {
          score
        }
      });
    }

    // 重新计算平均分
    const ratings = await prisma.ratings.findMany({
      where: { node_id: parseInt(id) }
    });
    const avg = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        rating_avg: avg,
        rating_count: ratings.length
      }
    });

    res.json({ success: true, rating_avg: avg, rating_count: ratings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rate node' });
  }
});

// 举报节点
router.post('/:id/report', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { reason, description } = req.body;

  // 映射前端的中文原因到后端的英文代码
  const reasonMap: { [key: string]: string } = {
    '垃圾广告': 'spam',
    '不当内容': 'illegal',
    '暴力血腥': 'violence',
    '色情低俗': 'porn',
    '抄袭侵权': 'copyright',
    '其他': 'other'
  };

  const mappedReason = reasonMap[reason] || reason;
  const validReasons = ['spam', 'illegal', 'porn', 'violence', 'copyright', 'other'];
  
  if (!mappedReason || !validReasons.includes(mappedReason)) {
    return res.status(400).json({ error: 'Invalid reason' });
  }

  // 检查举报频率限制
  const today = new Date().toISOString().split('T')[0];
  const limitKey = `${userId}:${today}`;
  const userLimit = reportLimit.get(limitKey);

  if (userLimit) {
    if (userLimit.count >= MAX_REPORTS_PER_DAY) {
      return res.status(429).json({ error: '今日举报次数已达上限' });
    }
    userLimit.count += 1;
  } else {
    reportLimit.set(limitKey, { count: 1, date: today });
  }

  try {
    // 检查是否重复举报
    const existingReport = await prisma.reports.findFirst({
      where: {
        node_id: parseInt(id),
        reporter_id: userId
      }
    });

    if (existingReport) {
      return res.status(400).json({ error: '您已经举报过该内容' });
    }

    // 创建举报记录
    const report = await prisma.reports.create({
      data: {
        node_id: parseInt(id),
        reporter_id: userId,
        reason: mappedReason,
        description: description || null
      }
    });

    // 更新节点举报计数
    const node = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        report_count: { increment: 1 },
        report_reasons: {
          set: JSON.stringify({
            reasons: [...(await getExistingReasons(parseInt(id))), mappedReason]
          })
        }
      }
    });

    // 如果举报次数 >= 3，自动下架
    if (node.report_count >= 3) {
      await prisma.nodes.update({
        where: { id: parseInt(id) },
        data: { review_status: 'HIDDEN' }
      });
    }

    res.json({
      success: true,
      report,
      autoHidden: node.report_count >= 3,
      remainingReports: MAX_REPORTS_PER_DAY - (reportLimit.get(limitKey)?.count || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 辅助函数：获取已有举报原因
async function getExistingReasons(nodeId: number): Promise<string[]> {
  const node = await prisma.nodes.findUnique({
    where: { id: nodeId },
    select: { report_reasons: true }
  });
  if (node?.report_reasons) {
    try {
      const parsed = JSON.parse(node.report_reasons);
      return parsed.reasons || [];
    } catch {
      return [];
    }
  }
  return [];
}

export default router;