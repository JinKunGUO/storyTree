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

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 * Query: { hardDelete?: boolean } - 是否硬删除（彻底删除），默认为软删除（标记删除）
 *
 * 软删除：将用户标记为已删除状态，保留数据用于审计
 * 硬删除：彻底删除用户及其关联数据（谨慎使用）
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }

    // 不能删除自己
    if (userId === req.userId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能删除其他管理员
    if (user.isAdmin) {
      return res.status(400).json({ error: '不能删除管理员用户' });
    }

    const hardDelete = req.query.hardDelete === 'true';

    if (hardDelete) {
      // 硬删除：使用事务删除用户及其关联数据
      await prisma.$transaction(async (tx) => {
        // 删除用户的评论投票
        await tx.comment_votes.deleteMany({ where: { user_id: userId } });

        // 删除用户的评论
        await tx.comments.deleteMany({ where: { user_id: userId } });

        // 删除用户的举报记录
        await tx.reports.deleteMany({ where: { reporter_id: userId } });

        // 删除用户的积分交易记录
        await tx.point_transactions.deleteMany({ where: { user_id: userId } });

        // 删除用户的签到记录（正确表名：checkin_records）
        await tx.checkin_records.deleteMany({ where: { user_id: userId } });

        // 删除用户的关注关系（正确表名：follows）
        await tx.follows.deleteMany({
          where: { OR: [{ follower_id: userId }, { following_id: userId }] },
        });

        // 删除用户的故事关注
        await tx.story_followers.deleteMany({ where: { user_id: userId } });

        // 删除用户的节点书签
        await tx.node_bookmarks.deleteMany({ where: { user_id: userId } });

        // 删除用户的故事书签
        await tx.bookmarks.deleteMany({ where: { user_id: userId } });

        // 删除用户的通知
        await tx.notifications.deleteMany({ where: { user_id: userId } });

        // 删除用户的协作请求（作为申请者）
        await tx.collaboration_requests.deleteMany({ where: { user_id: userId } });

        // 删除用户的故事协作者关系
        await tx.story_collaborators.deleteMany({ where: { user_id: userId } });

        // 删除用户的邀请记录
        await tx.invitation_records.deleteMany({
          where: { OR: [{ inviter_id: userId }, { invitee_id: userId }] },
        });

        // 删除用户创建的邀请码
        await tx.invitation_codes.deleteMany({ where: { created_by_id: userId } });

        // 删除用户的订阅记录
        await tx.user_subscriptions.deleteMany({ where: { user_id: userId } });

        // 删除用户的提现记录
        await tx.withdrawal_requests.deleteMany({ where: { user_id: userId } });

        // 删除用户的 AI 使用日志
        await tx.ai_usage_logs.deleteMany({ where: { user_id: userId } });

        // 删除用户的 AI 任务
        await tx.ai_tasks.deleteMany({ where: { user_id: userId } });

        // 删除用户的登录日志
        await tx.login_logs.deleteMany({ where: { user_id: userId } });

        // 删除用户的会员权益日志
        await tx.membership_benefits_log.deleteMany({ where: { user_id: userId } });

        // 删除用户的评分
        await tx.ratings.deleteMany({ where: { user_id: userId } });

        // 删除用户的分享记录
        await tx.shares.deleteMany({ where: { user_id: userId } });

        // 删除用户的打赏记录
        await tx.tips.deleteMany({
          where: { OR: [{ sender_id: userId }, { receiver_id: userId }] },
        });

        // 删除用户的订单
        await tx.orders.deleteMany({ where: { user_id: userId } });

        // 将用户创建的节点转为匿名（保留内容）
        await tx.nodes.updateMany({
          where: { author_id: userId },
          data: { author_id: 1 }, // 转给系统用户（ID=1）
        });

        // 将用户创建的故事转为匿名（正确字段名：author_id）
        await tx.stories.updateMany({
          where: { author_id: userId },
          data: { author_id: 1 },
        });

        // 最后删除用户
        await tx.users.delete({ where: { id: userId } });
      });

      res.json({
        message: `用户 ${user.username} 已被彻底删除`,
        type: 'hard_delete',
      });
    } else {
      // 软删除：标记用户为已删除状态
      const deletedAt = new Date().toISOString();
      const deletedUsername = `[DELETED_${userId}_${Date.now()}]`;

      await prisma.users.update({
        where: { id: userId },
        data: {
          username: deletedUsername,
          email: null,
          password: null,
          avatar: null,
          bio: `[DELETED] 账号已于 ${deletedAt} 被管理员删除。原用户名：${user.username}`,
          active_token: null, // 强制下线
          wx_openid: null,
          wx_unionid: null,
          wx_nickname: null,
          wx_avatar: null,
          emailVerified: false,
        },
      });

      res.json({
        message: `用户 ${user.username} 已被标记删除`,
        type: 'soft_delete',
        deletedUsername,
      });
    }
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;

