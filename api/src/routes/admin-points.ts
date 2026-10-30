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

/**
 * 批量生成积分兑换码
 * POST /api/admin/points/exchange-codes
 * Body: { count, points, maxUses?, expiresInDays? }
 */
router.post('/exchange-codes', async (req, res) => {
  try {
    const { count = 1, points, maxUses = 1, expiresInDays } = req.body;

    const numCount = parseInt(count, 10);
    const numPoints = parseInt(points, 10);

    if (isNaN(numCount) || numCount < 1 || numCount > 100) {
      return res.status(400).json({ error: '生成数量需在 1-100 之间' });
    }
    if (isNaN(numPoints) || numPoints < 1 || numPoints > 100000) {
      return res.status(400).json({ error: '单个兑换码积分需在 1-100000 之间' });
    }

    const numMaxUses = parseInt(maxUses, 10) || 1;
    if (numMaxUses < 1 || numMaxUses > 1000) {
      return res.status(400).json({ error: '使用次数上限需在 1-1000 之间' });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000)
      : null;

    // 排除易混淆字符（0/O/1/I/L）
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const genCode = () => {
      let s = '';
      for (let i = 0; i < 12; i++) {
        s += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      return s;
    };

    const codes: string[] = [];
    for (let i = 0; i < numCount; i++) {
      // 随机码碰撞概率极低，最多重试 5 次
      let code = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = genCode();
        const exists = await prisma.exchange_codes.findUnique({ where: { code: candidate } });
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return res.status(500).json({ error: '生成兑换码失败，请重试' });
      }

      await prisma.exchange_codes.create({
        data: {
          code,
          points: numPoints,
          max_uses: numMaxUses,
          expires_at: expiresAt,
        },
      });
      codes.push(code);
    }

    res.json({ message: `成功生成 ${codes.length} 个兑换码`, codes });
  } catch (error) {
    console.error('生成兑换码失败:', error);
    res.status(500).json({ error: '生成兑换码失败' });
  }
});

/**
 * 兑换码列表
 * GET /api/admin/points/exchange-codes?page=1&limit=20
 */
router.get('/exchange-codes', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      prisma.exchange_codes.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.exchange_codes.count(),
    ]);

    res.json({
      codes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('获取兑换码列表失败:', error);
    res.status(500).json({ error: '获取兑换码列表失败' });
  }
});

export default router;

