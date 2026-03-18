import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { getUserLevel, addPoints, POINT_RULES } from '../utils/points';

const router = Router();

// JWT认证函数
const getUserId = (req: any): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

/**
 * 获取用户积分信息
 */
router.get('/info', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        points: true,
        level: true,
        subscription_type: true,
        subscription_expires: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const levelInfo = getUserLevel(user.points);

    res.json({
      points: user.points,
      level: {
        current: levelInfo.level,
        name: levelInfo.name,
        progress: levelInfo.progress,
        nextLevelPoints: levelInfo.nextLevelPoints,
        quotas: levelInfo.quotas
      },
      subscription: {
        type: user.subscription_type,
        expires: user.subscription_expires,
        active: user.subscription_expires && user.subscription_expires > new Date()
      }
    });
  } catch (error) {
    console.error('获取积分信息失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 获取积分交易历史
 */
router.get('/transactions', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { page = 1, limit = 20, type } = req.query;

  try {
    const where: any = { user_id: userId };
    if (type) where.type = type;

    const transactions = await prisma.point_transactions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    const total = await prisma.point_transactions.count({ where });

    // 批量获取关联的故事/章节信息
    const enrichedTransactions = await Promise.all(
      transactions.map(async (t) => {
        let sourceInfo = null;
        
        // 根据 type 判断需要查询的表
        if (
          t.type.includes('bookmark') || 
          t.type.includes('follow') || 
          t.type.includes('like') ||
          t.type.includes('word_count') ||
          t.type.includes('publish_node')
        ) {
          // 查询章节信息
          if (t.reference_id) {
            const node = await prisma.nodes.findUnique({
              where: { id: t.reference_id },
              select: { id: true, title: true, story_id: true }
            });
            if (node) {
              const story = await prisma.stories.findUnique({
                where: { id: node.story_id },
                select: { id: true, title: true }
              });
              sourceInfo = {
                type: 'node',
                title: node.title,
                storyTitle: story?.title || '未知故事'
              };
            }
          }
        } else if (
          t.type.includes('publish_story') ||
          t.type.includes('pin_story')
        ) {
          // 查询故事信息
          if (t.reference_id) {
            const story = await prisma.stories.findUnique({
              where: { id: t.reference_id },
              select: { id: true, title: true }
            });
            if (story) {
              sourceInfo = {
                type: 'story',
                title: story.title
              };
            }
          }
        } else if (
          t.type.includes('checkin') ||
          t.type.includes('milestone') ||
          t.type.includes('invite') ||
          t.type.includes('invited') ||
          t.type.includes('membership')
        ) {
          // 这些类型不需要额外的 source info
          sourceInfo = null;
        }

        return {
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          createdAt: t.created_at,
          sourceInfo: sourceInfo
        };
      })
    );

    res.json({
      transactions: enrichedTransactions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('获取交易历史失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 每日签到（获取积分）
 */
router.post('/daily-checkin', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    // 检查今天是否已签到
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCheckin = await prisma.point_transactions.findFirst({
      where: {
        user_id: userId,
        type: 'daily_checkin',
        created_at: { gte: today }
      }
    });

    if (todayCheckin) {
      return res.status(400).json({ error: '今天已经签到过了' });
    }

    // 添加签到积分
    const result = await addPoints(
      userId,
      POINT_RULES.DAILY_LOGIN.points,
      'daily_checkin',
      POINT_RULES.DAILY_LOGIN.description
    );

    res.json({
      success: true,
      points: POINT_RULES.DAILY_LOGIN.points,
      newPoints: result.newPoints,
      levelUp: result.levelUp,
      newLevel: result.newLevel
    });
  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json({ error: '签到失败' });
  }
});

/**
 * 获取积分获取规则
 */
router.get('/rules', (req, res) => {
  res.json({
    rules: Object.entries(POINT_RULES).map(([key, value]) => ({
      key,
      points: value.points,
      description: value.description
    }))
  });
});

export default router;

