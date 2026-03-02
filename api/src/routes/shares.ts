import { Router } from 'express';
import { prisma } from '../index';
import { getUserId } from '../utils/middleware';

const router = Router();

// 记录分享
router.post('/', async (req, res) => {
  const { story_id, node_id, platform } = req.body;

  if (!story_id || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validPlatforms = ['copy', 'wechat', 'weibo', 'qq', 'qzone', 'twitter', 'facebook'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  try {
    // 获取用户ID（可选，未登录也可以分享）
    const userId = getUserId(req);

    // 验证故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(story_id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 如果提供了node_id，验证节点是否存在
    if (node_id) {
      const node = await prisma.nodes.findUnique({
        where: { id: parseInt(node_id) }
      });

      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }
    }

    // 记录分享
    const share = await prisma.shares.create({
      data: {
        story_id: parseInt(story_id),
        node_id: node_id ? parseInt(node_id) : null,
        user_id: userId || null,
        platform
      }
    });

    res.json({
      success: true,
      share
    });
  } catch (error) {
    console.error('记录分享错误:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// 获取分享统计
router.get('/stats/:story_id', async (req, res) => {
  const { story_id } = req.params;

  try {
    // 总分享次数
    const totalShares = await prisma.shares.count({
      where: { story_id: parseInt(story_id) }
    });

    // 按平台统计
    const sharesByPlatform = await prisma.shares.groupBy({
      by: ['platform'],
      where: { story_id: parseInt(story_id) },
      _count: {
        id: true
      }
    });

    // 最近分享记录（最多10条）
    const recentShares = await prisma.shares.findMany({
      where: { story_id: parseInt(story_id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    // 格式化平台统计
    const platformStats = sharesByPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total_shares: totalShares,
      by_platform: platformStats,
      recent_shares: recentShares
    });
  } catch (error) {
    console.error('获取分享统计错误:', error);
    res.status(500).json({ error: 'Failed to get share stats' });
  }
});

// 获取章节分享统计
router.get('/stats/node/:node_id', async (req, res) => {
  const { node_id } = req.params;

  try {
    const totalShares = await prisma.shares.count({
      where: { node_id: parseInt(node_id) }
    });

    const sharesByPlatform = await prisma.shares.groupBy({
      by: ['platform'],
      where: { node_id: parseInt(node_id) },
      _count: {
        id: true
      }
    });

    const platformStats = sharesByPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total_shares: totalShares,
      by_platform: platformStats
    });
  } catch (error) {
    console.error('获取章节分享统计错误:', error);
    res.status(500).json({ error: 'Failed to get node share stats' });
  }
});

export default router;

