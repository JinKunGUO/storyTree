import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin } from '../utils/middleware';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 总览数据
 * GET /api/admin/dashboard/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalStories,
      totalNodes,
      totalComments,
      todayNewUsers,
      todayNewStories,
      todayNewNodes,
      todayNewComments,
      totalAdmins,
      totalMembers,
      pendingReports,
    ] = await Promise.all([
      prisma.users.count(),
      prisma.stories.count(),
      prisma.nodes.count(),
      prisma.comments.count({ where: { is_deleted: false } }),
      prisma.users.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.stories.count({ where: { created_at: { gte: todayStart } } }),
      prisma.nodes.count({ where: { created_at: { gte: todayStart } } }),
      prisma.comments.count({ where: { created_at: { gte: todayStart }, is_deleted: false } }),
      prisma.users.count({ where: { isAdmin: true } }),
      prisma.users.count({ where: { membership_tier: { not: 'free' } } }),
      prisma.reports.count({ where: { status: 'pending' } }),
    ]);

    res.json({
      overview: {
        totalUsers,
        totalStories,
        totalNodes,
        totalComments,
        totalAdmins,
        totalMembers,
        pendingReports,
      },
      today: {
        newUsers: todayNewUsers,
        newStories: todayNewStories,
        newNodes: todayNewNodes,
        newComments: todayNewComments,
      },
    });
  } catch (error) {
    console.error('获取总览数据失败:', error);
    res.status(500).json({ error: '获取总览数据失败' });
  }
});

/**
 * 用户增长趋势
 * GET /api/admin/dashboard/user-growth?period=day&days=30
 */
router.get('/user-growth', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 使用 count 按天聚合，避免拉取所有用户记录到内存
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, 0);
    }

    // 逐天计数（利用 Prisma count 在数据库层面聚合）
    const dayPromises = Array.from(dailyMap.keys()).map(async (dateKey) => {
      const dayStart = new Date(dateKey + 'T00:00:00.000Z');
      const dayEnd = new Date(dateKey + 'T23:59:59.999Z');
      const count = await prisma.users.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
      return { date: dateKey, count };
    });

    const dailyCounts = await Promise.all(dayPromises);
    for (const { date, count } of dailyCounts) {
      dailyMap.set(date, count);
    }

    const growth = Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // 累计用户数
    const totalBefore = await prisma.users.count({
      where: { createdAt: { lt: startDate } },
    });

    let cumulative = totalBefore;
    const cumulativeGrowth = growth.map((item) => {
      cumulative += item.count;
      return { ...item, cumulative };
    });

    res.json({ growth: cumulativeGrowth });
  } catch (error) {
    console.error('获取用户增长趋势失败:', error);
    res.status(500).json({ error: '获取用户增长趋势失败' });
  }
});

/**
 * 内容统计（故事/章节创建趋势）
 * GET /api/admin/dashboard/content-stats?days=30
 */
router.get('/content-stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 使用 count 按天聚合，避免拉取所有记录到内存
    const dateKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dateKeys.push(date.toISOString().split('T')[0]);
    }

    const dayPromises = dateKeys.map(async (dateKey) => {
      const dayStart = new Date(dateKey + 'T00:00:00.000Z');
      const dayEnd = new Date(dateKey + 'T23:59:59.999Z');
      const timeRange = { gte: dayStart, lte: dayEnd };

      const [storyCount, nodeCount] = await Promise.all([
        prisma.stories.count({ where: { created_at: timeRange } }),
        prisma.nodes.count({ where: { created_at: timeRange } }),
      ]);

      return { date: dateKey, stories: storyCount, nodes: nodeCount };
    });

    const contentStats = await Promise.all(dayPromises);

    res.json({ contentStats });
  } catch (error) {
    console.error('获取内容统计失败:', error);
    res.status(500).json({ error: '获取内容统计失败' });
  }
});

/**
 * 活跃用户统计
 * GET /api/admin/dashboard/active-users?days=7
 */
router.get('/active-users', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 通过近期活动（创建节点、评论、签到）来判断活跃用户
    const [activeAuthors, activeCommenters, activeCheckins] = await Promise.all([
      // 近期发布章节的用户
      prisma.nodes.findMany({
        where: { created_at: { gte: startDate } },
        select: { author_id: true },
        distinct: ['author_id'],
      }),
      // 近期发表评论的用户
      prisma.comments.findMany({
        where: { created_at: { gte: startDate }, is_deleted: false },
        select: { user_id: true },
        distinct: ['user_id'],
      }),
      // 近期签到的用户
      prisma.checkin_records.findMany({
        where: { checkin_date: { gte: startDate } },
        select: { user_id: true },
        distinct: ['user_id'],
      }),
    ]);

    // 合并去重
    const activeUserIds = new Set<number>();
    activeAuthors.forEach((a) => activeUserIds.add(a.author_id));
    activeCommenters.forEach((c) => activeUserIds.add(c.user_id));
    activeCheckins.forEach((c) => activeUserIds.add(c.user_id));

    // 获取活跃用户详情（按活跃度排序）
    const topActiveUsers = await prisma.users.findMany({
      where: { id: { in: Array.from(activeUserIds) } },
      select: {
        id: true,
        username: true,
        avatar: true,
        level: true,
        _count: {
          select: {
            authored_nodes: true,
            comments: true,
          },
        },
      },
      take: 20,
    });

    res.json({
      activePeriodDays: days,
      totalActiveUsers: activeUserIds.size,
      breakdown: {
        authors: activeAuthors.length,
        commenters: activeCommenters.length,
        checkins: activeCheckins.length,
      },
      topActiveUsers,
    });
  } catch (error) {
    console.error('获取活跃用户统计失败:', error);
    res.status(500).json({ error: '获取活跃用户统计失败' });
  }
});

export default router;

