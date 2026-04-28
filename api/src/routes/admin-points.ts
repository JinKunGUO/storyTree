import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin } from '../utils/middleware';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 手动调整用户积分
 * POST /api/admin/points/users/:id/adjust
 * Body: { amount: number, reason: string }
 */
router.post('/users/:id/adjust', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const { amount, reason } = req.body;

    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ error: '请输入有效的积分调整数量（正数增加，负数扣除）' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: '请填写调整原因' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 扣除积分时检查余额是否足够
    if (amount < 0 && user.points + amount < 0) {
      return res.status(400).json({
        error: '用户积分不足',
        currentPoints: user.points,
        adjustAmount: amount,
      });
    }

    // 使用事务：更新积分 + 记录交易
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: { points: { increment: amount } },
        select: { id: true, username: true, points: true },
      }),
      prisma.point_transactions.create({
        data: {
          user_id: userId,
          amount,
          type: amount > 0 ? 'admin_add' : 'admin_deduct',
          description: `[管理员操作] ${reason}`,
        },
      }),
    ]);

    res.json({
      message: `已${amount > 0 ? '增加' : '扣除'}用户 ${updatedUser.username} ${Math.abs(amount)} 积分`,
      user: updatedUser,
      transaction,
    });
  } catch (error) {
    console.error('调整积分失败:', error);
    res.status(500).json({ error: '调整积分失败' });
  }
});

/**
 * 积分交易记录查询
 * GET /api/admin/points/transactions?page=1&limit=20&userId=xxx&type=xxx
 */
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const type = req.query.type as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId && !isNaN(userId)) {
      where.user_id = userId;
    }

    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.point_transactions.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.point_transactions.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取积分交易记录失败:', error);
    res.status(500).json({ error: '获取积分交易记录失败' });
  }
});

export default router;

