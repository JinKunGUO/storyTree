import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin } from '../utils/middleware';
import { hashPassword } from '../utils/auth';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 获取用户列表（分页、搜索、筛选）
 * GET /api/admin/users?page=1&limit=20&search=xxx&role=admin|user&sort=created_at|points
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string; // 'admin' | 'user'
    const sort = (req.query.sort as string) || 'created_at';
    const order = (req.query.order as string) || 'desc';
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
        { wx_nickname: { contains: search } },
      ];
    }

    if (role === 'admin') {
      where.isAdmin = true;
    } else if (role === 'user') {
      where.isAdmin = false;
    }

    // 构建排序
    const orderBy: any = {};
    if (['created_at', 'points', 'level', 'word_count'].includes(sort)) {
      const sortField = sort === 'created_at' ? 'createdAt' : sort;
      orderBy[sortField] = order === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          wx_nickname: true,
          level: true,
          points: true,
          word_count: true,
          isAdmin: true,
          emailVerified: true,
          membership_tier: true,
          membership_expires_at: true,
          earnings_balance: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              authored_stories: true,
              authored_nodes: true,
              comments: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.users.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        wx_nickname: true,
        wx_avatar: true,
        level: true,
        points: true,
        word_count: true,
        badges: true,
        consecutive_days: true,
        last_checkin_date: true,
        earnings_balance: true,
        isAdmin: true,
        emailVerified: true,
        membership_tier: true,
        membership_started_at: true,
        membership_expires_at: true,
        membership_auto_renew: true,
        has_used_trial: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            authored_stories: true,
            authored_nodes: true,
            comments: true,
            reports: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 获取最近的积分交易
    const recentTransactions = await prisma.point_transactions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    res.json({ user, recentTransactions });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

/**
 * 封禁用户
 * POST /api/admin/users/:id/ban
 * Body: { reason?: string }
 *
 * 实现方式：将用户的 active_token 清空（强制下线），
 * 并在 bio 字段前缀 [BANNED] 标记（简单方案，后续可增加 banned 字段）
 */
router.post('/:id/ban', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    // 不能封禁自己
    if (userId === req.userId) {
      return res.status(400).json({ error: '不能封禁自己' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能封禁其他管理员
    if (user.isAdmin) {
      return res.status(400).json({ error: '不能封禁管理员用户' });
    }

    const reason = req.body.reason || '违反社区规范';
    const banPrefix = `[BANNED:${reason}] `;

    await prisma.users.update({
      where: { id: userId },
      data: {
        active_token: null, // 强制下线
        bio: user.bio?.startsWith('[BANNED') ? user.bio : banPrefix + (user.bio || ''),
      },
    });

    res.json({ message: `用户 ${user.username} 已被封禁`, reason });
  } catch (error) {
    console.error('封禁用户失败:', error);
    res.status(500).json({ error: '封禁用户失败' });
  }
});

/**
 * 解封用户
 * POST /api/admin/users/:id/unban
 */
router.post('/:id/unban', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 移除 bio 中的 [BANNED] 标记
    let newBio = user.bio || '';
    const banMatch = newBio.match(/^\[BANNED:[^\]]*\]\s*/);
    if (banMatch) {
      newBio = newBio.slice(banMatch[0].length);
    }

    await prisma.users.update({
      where: { id: userId },
      data: { bio: newBio || null },
    });

    res.json({ message: `用户 ${user.username} 已解封` });
  } catch (error) {
    console.error('解封用户失败:', error);
    res.status(500).json({ error: '解封用户失败' });
  }
});

/**
 * 重置用户密码
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword: string }
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '密码长度至少为 6 位' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.users.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        active_token: null, // 重置密码后强制重新登录
      },
    });

    res.json({ message: `用户 ${user.username} 的密码已重置` });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

export default router;

