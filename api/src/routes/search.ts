import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 搜索故事和章节（支持分页）
router.get('/', async (req, res) => {
  const { q, type = 'all' } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

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
    let storiesTotal = 0;
    let nodesTotal = 0;

    // 搜索故事
    if (type === 'all' || type === 'stories') {
      const storyWhere = {
        OR: [
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } }
        ]
      };

      [stories, storiesTotal] = await Promise.all([
        prisma.stories.findMany({
          where: storyWhere,
          include: {
            author: {
              select: { id: true, username: true }
            },
            nodes: {
              where: { parent_id: null },
              take: 1,
              select: {
                id: true,
                title: true,
                rating_avg: true,
                rating_count: true,
                read_count: true
              }
            }
          },
          orderBy: [
            { updated_at: 'desc' }
          ],
          skip,
          take: limit
        }),
        prisma.stories.count({ where: storyWhere })
      ]);
    }

    // 搜索章节
    if (type === 'all' || type === 'nodes') {
      const nodeWhere = {
        AND: [
          {
            OR: [
              { title: { contains: searchTerm } },
              { content: { contains: searchTerm } }
            ]
          },
          { review_status: 'APPROVED' } // 只搜索已审核通过的内容
        ]
      };

      [nodes, nodesTotal] = await Promise.all([
        prisma.nodes.findMany({
          where: nodeWhere,
          include: {
            author: {
              select: { id: true, username: true }
            },
            story: {
              select: { id: true, title: true }
            }
          },
          orderBy: [
            { rating_avg: 'desc' },
            { read_count: 'desc' }
          ],
          skip,
          take: limit
        }),
        prisma.nodes.count({ where: nodeWhere })
      ]);
    }

    res.json({
      stories,
      nodes,
      total: storiesTotal + nodesTotal,
      page,
      limit,
      hasMore: skip + limit < storiesTotal || skip + limit < nodesTotal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;

