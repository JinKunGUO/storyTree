import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, getUserId } from '../utils/middleware';
import { WORD_MILESTONES, getAllBadges, getNextMilestone, getBadgeById } from '../utils/milestones';

const router = Router();

/**
 * 获取徽章列表
 * GET /api/badges
 */
router.get('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { badges: true, word_count: true }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userBadges: string[] = user.badges ? JSON.parse(user.badges) : [];
    const allBadges = getAllBadges();

    const badgesWithStatus = allBadges.map(badge => ({
      ...badge,
      unlocked: userBadges.includes(badge.id)
    }));

    const nextMilestone = getNextMilestone(user.word_count);

    res.json({
      badges: badgesWithStatus,
      word_count: user.word_count,
      next_milestone: nextMilestone
    });
  } catch (error) {
    console.error('获取徽章列表失败:', error);
    res.status(500).json({ error: '获取徽章列表失败' });
  }
});

/**
 * 获取指定用户的徽章
 * GET /api/badges/user/:id
 */
router.get('/user/:id', async (req, res) => {
  const targetUserId = parseInt(req.params.id);

  if (isNaN(targetUserId)) {
    return res.status(400).json({ error: '无效的用户ID' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: targetUserId },
      select: { 
        id: true,
        username: true,
        badges: true, 
        word_count: true 
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userBadges: string[] = user.badges ? JSON.parse(user.badges) : [];
    const unlockedBadges = userBadges.map(badgeId => getBadgeById(badgeId)).filter(Boolean);

    res.json({
      user_id: user.id,
      username: user.username,
      word_count: user.word_count,
      badges: unlockedBadges
    });
  } catch (error) {
    console.error('获取用户徽章失败:', error);
    res.status(500).json({ error: '获取用户徽章失败' });
  }
});

export default router;

