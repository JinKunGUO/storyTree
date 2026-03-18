import express from 'express';
import { prisma } from '../index';
import { authenticateToken, getUserId } from '../utils/middleware';
import { deductPoints, addPoints, POINTS_COST } from '../utils/points';

const router = express.Router();

// ==================== 故事置顶功能 ====================

/**
 * 置顶故事
 * POST /api/points-features/stories/:storyId/pin
 * 
 * Body: { days: number } // 置顶天数（1-30 天）
 */
router.post('/stories/:storyId/pin', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { storyId } = req.params;
  const { days } = req.body;

  try {
    // 验证参数
    if (!days || days < 1 || days > 30) {
      return res.status(400).json({ error: '置顶天数必须在 1-30 天之间' });
    }

    // 验证故事所有权
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story || story.author_id !== userId) {
      return res.status(404).json({ error: '故事不存在或您无权操作' });
    }

    // 计算所需积分
    const pointsCost = POINTS_COST.STORY_PIN_PER_DAY * days;

    // 检查积分是否足够
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { points: true }
    });

    if (!user || user.points < pointsCost) {
      return res.status(400).json({ error: '积分不足' });
    }

    // 扣除积分
    const deductResult = await deductPoints(
      userId,
      pointsCost,
      'story_pin',
      `故事置顶${days}天`
    );

    if (!deductResult.success) {
      return res.status(400).json({ error: '积分扣除失败' });
    }

    // 更新故事置顶状态
    const pinnedUntil = new Date();
    pinnedUntil.setDate(pinnedUntil.getDate() + days);

    await prisma.stories.update({
      where: { id: parseInt(storyId) },
      data: {
        pinned: true,
        pinned_until: pinnedUntil,
        pinned_at: new Date()
      }
    });

    res.json({ 
      success: true, 
      message: `故事已置顶${days}天`,
      pinnedUntil 
    });

  } catch (error) {
    console.error('置顶故事失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 取消置顶故事
 * DELETE /api/points-features/stories/:storyId/pin
 */
router.delete('/stories/:storyId/pin', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { storyId } = req.params;

  try {
    // 验证故事所有权
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story || story.author_id !== userId) {
      return res.status(404).json({ error: '故事不存在或您无权操作' });
    }

    // 取消置顶
    await prisma.stories.update({
      where: { id: parseInt(storyId) },
      data: {
        pinned: false,
        pinned_until: null,
        pinned_at: null
      }
    });

    res.json({ success: true, message: '已取消置顶' });

  } catch (error) {
    console.error('取消置顶失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 打赏作者功能 ====================

/**
 * 打赏作者
 * POST /api/points-features/tips
 * 
 * Body: { 
 *   receiverId: number,  // 接收人 ID
 *   amount: number,      // 打赏金额（5-10000 积分）
 *   storyId?: number,    // 故事 ID（可选）
 *   nodeId?: number,     // 章节 ID（可选）
 *   message?: string     // 打赏留言（可选）
 * }
 */
router.post('/tips', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { receiverId, amount, storyId, nodeId, message } = req.body;

  if (!userId) {
    return res.status(401).json({ error: '未授权' });
  }

  try {
    // 验证参数
    if (!receiverId || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (amount < POINTS_COST.TIP_MIN || amount > POINTS_COST.TIP_MAX) {
      return res.status(400).json({ 
        error: `打赏金额必须在${POINTS_COST.TIP_MIN}-${POINTS_COST.TIP_MAX}积分之间` 
      });
    }

    // 不能打赏自己
    if (receiverId === userId) {
      return res.status(400).json({ error: '不能打赏自己' });
    }

    // 检查积分是否足够
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { points: true }
    });

    if (!user || user.points < amount) {
      return res.status(400).json({ error: '积分不足' });
    }

    // 扣除打赏人的积分
    const deductResult = await deductPoints(
      userId,
      amount,
      'tip_send',
      `打赏用户 ID:${receiverId}${message ? `：${message}` : ''}`
    );

    if (!deductResult.success) {
      return res.status(400).json({ error: '积分扣除失败' });
    }

    // 增加接收人的积分
    const senderUsername = (req as any).user?.username || '用户';
    await addPoints(
      receiverId,
      amount,
      'tip_receive',
      `收到 @${senderUsername} 的打赏`,
      userId
    );

    // 创建打赏记录
    const tip = await prisma.tips.create({
      data: {
        sender_id: userId,
        receiver_id: receiverId,
        story_id: storyId ? parseInt(storyId as string) : undefined,
        node_id: nodeId ? parseInt(nodeId as string) : undefined,
        amount,
        message: message || null
      }
    });

    // 发送通知给接收人
    await prisma.notifications.create({
      data: {
        user_id: receiverId,
        type: 'tip_received',
        title: '🎁 收到打赏',
        content: `@${senderUsername} 打赏了你${amount}积分${message ? `：${message}` : ''}`,
        link: storyId ? `/story?id=${storyId}` : '/profile'
      }
    });

    res.json({ 
      success: true, 
      message: '打赏成功',
      tip 
    });

  } catch (error) {
    console.error('打赏失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取打赏记录
 * GET /api/points-features/tips?type=sent|received&page=1&limit=20
 */
router.get('/tips', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { type = 'received', page = '1', limit = '20' } = req.query;

  if (!userId) {
    return res.status(401).json({ error: '未授权' });
  }

  try {
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where = type === 'sent' 
      ? { sender_id: userId }
      : { receiver_id: userId };

    const [tips, total] = await Promise.all([
      prisma.tips.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, avatar: true }
          },
          receiver: {
            select: { id: true, username: true, avatar: true }
          }
        }
      }),
      prisma.tips.count({ where })
    ]);

    // 获取故事标题（如果有 story_id）
    const storyIds = tips
      .filter(tip => tip.story_id)
      .map(tip => tip.story_id!);
    
    let storyMap: Record<number, { id: number; title: string }> = {};
    if (storyIds.length > 0) {
      const stories = await prisma.stories.findMany({
        where: { id: { in: storyIds } },
        select: { id: true, title: true }
      });
      storyMap = Object.fromEntries(stories.map(s => [s.id, s]));
    }

    // 将故事信息添加到结果中
    const tipsWithStory = tips.map(tip => ({
      ...tip,
      story: tip.story_id ? storyMap[tip.story_id] || null : null
    }));

    res.json({
      tips: tipsWithStory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('获取打赏记录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 置顶评论功能 ====================

/**
 * 置顶评论
 * POST /api/points-features/comments/:commentId/pin
 * 
 * 只有故事作者可以置顶评论
 */
router.post('/comments/:commentId/pin', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { commentId } = req.params;

  try {
    // 获取评论及其故事信息
    const comment = await prisma.comments.findFirst({
      where: { id: parseInt(commentId) },
      include: {
        node: {
          include: {
            story: true
          }
        }
      }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 检查是否是故事作者
    if (comment.node.story.author_id !== userId) {
      return res.status(403).json({ error: '只有故事作者可以置顶评论' });
    }

    // 检查积分是否足够
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { points: true }
    });

    if (!user || user.points < POINTS_COST.COMMENT_PIN) {
      return res.status(400).json({ error: '积分不足' });
    }

    // 扣除积分
    const deductResult = await deductPoints(
      userId,
      POINTS_COST.COMMENT_PIN,
      'comment_pin',
      '置顶评论'
    );

    if (!deductResult.success) {
      return res.status(400).json({ error: '积分扣除失败' });
    }

    // 更新评论置顶状态
    await prisma.comments.update({
      where: { id: parseInt(commentId) },
      data: {
        pinned: true,
        pinned_at: new Date()
      }
    });

    // 发送通知给评论作者
    if (comment.user_id !== userId) {
      await prisma.notifications.create({
        data: {
          user_id: comment.user_id,
          type: 'comment_pinned',
          title: '📌 您的评论被置顶',
          content: `@${(req as any).user?.username || '作者'} 置顶了您的评论`,
          link: `/story?id=${comment.node.story_id}#comment-${commentId}`
        }
      });
    }

    res.json({ 
      success: true, 
      message: '评论已置顶'
    });

  } catch (error) {
    console.error('置顶评论失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 取消置顶评论
 * DELETE /api/points-features/comments/:commentId/pin
 */
router.delete('/comments/:commentId/pin', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { commentId } = req.params;

  try {
    // 获取评论及其故事信息
    const comment = await prisma.comments.findFirst({
      where: { id: parseInt(commentId) },
      include: {
        node: {
          include: {
            story: true
          }
        }
      }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 检查是否是故事作者
    if (comment.node.story.author_id !== userId) {
      return res.status(403).json({ error: '只有故事作者可以置顶评论' });
    }

    // 取消置顶
    await prisma.comments.update({
      where: { id: parseInt(commentId) },
      data: {
        pinned: false,
        pinned_at: null
      }
    });

    res.json({ success: true, message: '已取消置顶' });

  } catch (error) {
    console.error('取消置顶失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;
