import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';

const router = Router();

// List all stories with first node info
router.get('/', optionalAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const stories = await prisma.story.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        nodes: {
          where: {
            parentId: null,
            // 只显示已通过审核的节点，或者用户自己的节点
            OR: [
              { reviewStatus: 'APPROVED' },
              ...(userId ? [{ authorId: userId }] : [])
            ]
          },
          take: 1,
          select: {
            id: true,
            title: true,
            content: true,
            ratingAvg: true,
            ratingCount: true,
            reviewStatus: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 过滤掉没有可见节点的故事
    const filteredStories = stories.filter(s => s.nodes.length > 0);

    res.json({ stories: filteredStories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create story with first node
router.post('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, description, coverImage, firstNodeTitle, firstNodeContent } = req.body;

  try {
    // 如果提供了第一章内容，则创建故事和第一章
    if (firstNodeContent) {
      // 检查用户已发布节点数
      const userNodeCount = await prisma.node.count({
        where: { authorId: userId }
      });

      // 审核检查
      const reviewCheck = needsReview(firstNodeContent, userNodeCount);

      const story = await prisma.story.create({
        data: {
          title,
          description,
          coverImage,
          authorId: userId,
          nodes: {
            create: {
              title: firstNodeTitle || '第一章',
              content: firstNodeContent,
              authorId: userId,
              path: '1',
              reviewStatus: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
            }
          }
        },
        include: {
          nodes: true,
          author: {
            select: { id: true, username: true }
          }
        }
      });

      // Update rootNodeId
      await prisma.story.update({
        where: { id: story.id },
        data: { rootNodeId: story.nodes[0].id }
      });

      return res.json({
        story: { ...story, rootNodeId: story.nodes[0].id },
        reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
        message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '发布成功'
      });
    } else {
      // 只创建故事，不创建第一章
      const story = await prisma.story.create({
        data: {
          title,
          description,
          coverImage,
          authorId: userId
        },
        include: {
          author: {
            select: { id: true, username: true }
          }
        }
      });

      return res.json({
        story,
        message: '故事创建成功，请添加第一章'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get story with full tree
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const story = await prisma.story.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Get all nodes for this story
    const nodes = await prisma.node.findMany({
      where: { storyId: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { branches: true }
        }
      },
      orderBy: { path: 'asc' }
    });

    res.json({ story, nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Update story
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, description, coverImage } = req.body;

  try {
    // 检查故事是否存在
    const story = await prisma.story.findUnique({
      where: { id: parseInt(id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查权限：只有作者可以编辑
    if (story.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this story' });
    }

    // 更新故事（只更新存在的字段）
    const updatedStory = await prisma.story.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(coverImage && { coverImage })
      },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ 
      story: updatedStory,
      message: 'Story updated successfully'
    });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

export default router;
