import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';

const router = Router();

// Get auth user from header (dev mode)
const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// List all stories with first node info
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, description, coverImage, firstNodeTitle, firstNodeContent } = req.body;

  try {
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

    res.json({
      story: { ...story, rootNodeId: story.nodes[0].id },
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '发布成功'
    });
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

export default router;
