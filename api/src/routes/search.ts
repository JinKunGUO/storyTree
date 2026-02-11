import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 搜索故事和章节
router.get('/', async (req, res) => {
  const { q, type = 'all' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query required' });
  }

  const searchTerm = q.trim();
  if (searchTerm.length < 2) {
    return res.status(400).json({ error: 'Search term too short' });
  }

  try {
    let stories: any[] = [];
    let nodes: any[] = [];

    // 搜索故事
    if (type === 'all' || type === 'stories') {
      stories = await prisma.story.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm } },
            { description: { contains: searchTerm } }
          ]
        },
        include: {
          author: {
            select: { id: true, username: true }
          },
          nodes: {
            where: { parentId: null },
            take: 1,
            select: {
              id: true,
              title: true,
              ratingAvg: true,
              ratingCount: true,
              readCount: true
            }
          }
        },
        orderBy: [
          { updatedAt: 'desc' }
        ],
        take: 20
      });
    }

    // 搜索章节
    if (type === 'all' || type === 'nodes') {
      nodes = await prisma.node.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: searchTerm } },
                { content: { contains: searchTerm } }
              ]
            },
            { reviewStatus: 'APPROVED' } // 只搜索已审核通过的内容
          ]
        },
        include: {
          author: {
            select: { id: true, username: true }
          },
          story: {
            select: { id: true, title: true }
          }
        },
        orderBy: [
          { ratingAvg: 'desc' },
          { readCount: 'desc' }
        ],
        take: 20
      });
    }

    res.json({
      stories,
      nodes,
      total: stories.length + nodes.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;

