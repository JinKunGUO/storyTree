import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, safeParsePage, safeParseLimit } from '../utils/middleware';
import { createRefund, isMockMode } from '../utils/alipay';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 获取会员统计数据
 */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();

    // 总会员数
    const totalMembers = await prisma.users.count({
      where: {
        membership_tier: {
          not: 'free'
        }
      }
    });

    // 各等级会员数
    const tierStats = await prisma.users.groupBy({
      by: ['membership_tier'],
      where: {
        membership_tier: {
          not: 'free'
        }
      },
      _count: true
    });

    // 即将到期的会员（7 天内）
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringMembers = await prisma.users.count({
      where: {
        membership_expires_at: {
          lte: sevenDaysLater,
          gt: now
        },
        membership_tier: {
          not: 'free'
        }
      }
    });

    // 今日新增会员
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newMembersToday = await prisma.user_subscriptions.count({
      where: {
        user_id: {
          gt: 0
        },
        created_at: {
          gte: todayStart
        }
      }
    });

    // 本月新增会员
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newMembersThisMonth = await prisma.user_subscriptions.count({
      where: {
        user_id: {
          gt: 0
        },
        created_at: {
          gte: monthStart
        }
      }
    });

    // 活跃会员（最近 7 天有使用记录）
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeMembers = await prisma.membership_benefits_log.groupBy({
      by: ['user_id'],
      where: {
        used_at: {
          gte: sevenDaysAgo
        }
      }
    }).then(logs => logs.length);

    // 会员收入统计（本月）
    const membershipRevenue = await prisma.orders.aggregate({
      where: {
        type: {
          in: ['subscription', 'renewal']
        },
        status: 'paid',
        paid_at: {
          gte: monthStart
        }
      },
      _sum: {
        amount: true
      }
    });

    // 自动续费开启数
    const autoRenewCount = await prisma.user_subscriptions.count({
      where: {
        user_id: {
          gt: 0
        },
        auto_renew: true,
        status: 'active'
      }
    });

    // 整理数据
    const tierDistribution = tierStats.reduce((acc: any, stat: any) => {
      acc[stat.membership_tier || 'unknown'] = stat._count;
      return acc;
    }, {});

    res.json({
      totalMembers,
      tierDistribution,
      expiringMembers,
      newMembersToday,
      newMembersThisMonth,
      activeMembers,
      revenue: membershipRevenue._sum.amount || 0,
      autoRenewCount,
      timestamp: now
    });
  } catch (error) {
    console.error('获取会员统计失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

/**
 * 获取会员列表（分页）
 */
router.get('/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const tier = req.query.tier as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {
      membership_tier: {
        not: 'free'
      }
    };

    if (tier && tier !== 'all') {
      where.membership_tier = tier;
    }

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const [members, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          membership_tier: true,
          membership_expires_at: true
        },
        orderBy: {
          id: 'desc'
        }
      }),
      prisma.users.count({ where })
    ]);

    res.json({
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取会员列表失败:', error);
    res.status(500).json({ error: '获取会员列表失败' });
  }
});

/**
 * 获取订单列表（分页）
 */
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const status = req.query.status as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (type && type !== 'all') {
      where.type = type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      }),
      prisma.orders.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

/**
 * 订单退款（管理员）
 * POST /api/admin/membership/orders/:id/refund
 * body: { reason? }
 * 流程：校验订单 → 支付宝原路退款（拆分订单逐笔退子订单）→ 标记 refunded → 权益回滚
 */
router.post('/orders/:id/refund', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const refundReason = reason || '管理员退款';

  try {
    const order = await prisma.orders.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (order.status === 'refunded') {
      return res.status(400).json({ error: '订单已退款，请勿重复操作' });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，仅已支付订单可退款` });
    }

    // 拆分订单：逐笔对子订单退款；普通订单：直接退
    const subOrders = await prisma.orders.findMany({
      where: { id: { startsWith: `${id}_SUB` } },
    });

    if (!isMockMode()) {
      if (subOrders.length > 0) {
        for (const sub of subOrders) {
          if (sub.status === 'paid') {
            await createRefund({ orderId: sub.id, refundAmount: sub.amount, refundReason });
          }
        }
      } else {
        await createRefund({ orderId: order.id, refundAmount: order.amount, refundReason });
      }
    } else {
      console.log(`🔧 Mock 模式：跳过支付宝退款调用（订单 ${id}）`);
    }

    // 标记退款 + 权益回滚（事务）
    await prisma.$transaction(async (tx) => {
      await tx.orders.update({ where: { id }, data: { status: 'refunded' } });
      if (subOrders.length > 0) {
        await tx.orders.updateMany({
          where: { id: { startsWith: `${id}_SUB` } },
          data: { status: 'refunded' },
        });
      }

      if (order.type === 'subscription') {
        // 作废该订单对应的订阅记录
        const subscription = await tx.user_subscriptions.findUnique({ where: { order_id: id } });
        if (subscription) {
          await tx.user_subscriptions.update({
            where: { id: subscription.id },
            data: { status: 'refunded', cancelled_at: new Date(), cancel_reason: refundReason },
          });

          // 重算用户会员状态：回退到最新有效订阅，无则降为 free
          const latestActive = await tx.user_subscriptions.findFirst({
            where: {
              user_id: order.user_id,
              status: 'active',
              expires_at: { gt: new Date() },
              id: { not: subscription.id },
            },
            orderBy: { expires_at: 'desc' },
          });

          await tx.users.update({
            where: { id: order.user_id },
            data: latestActive
              ? { membership_tier: latestActive.tier, membership_expires_at: latestActive.expires_at }
              : {
                  membership_tier: 'free',
                  membership_expires_at: null,
                  // 体验会员退款后恢复体验资格（交易视为未发生）
                  has_used_trial: order.tier === 'trial' ? false : undefined,
                },
          });
        }

        // 年度会员退款：扣回赠送的 500 积分（余额不足允许为负）
        if (order.tier === 'yearly') {
          await tx.point_transactions.create({
            data: {
              user_id: order.user_id,
              amount: -500,
              type: 'refund',
              description: `年度会员退款扣回赠送积分（订单 ${id}）`,
            },
          });
          await tx.users.update({
            where: { id: order.user_id },
            data: { points: { decrement: 500 } },
          });
        }
      } else if (order.type === 'points' && order.points) {
        // 积分充值退款：扣回积分（余额不足允许为负）
        await tx.point_transactions.create({
          data: {
            user_id: order.user_id,
            amount: -order.points,
            type: 'refund',
            description: `积分充值退款（订单 ${id}）`,
          },
        });
        await tx.users.update({
          where: { id: order.user_id },
          data: { points: { decrement: order.points } },
        });
      }
    });

    res.json({
      success: true,
      message: subOrders.length > 0
        ? `退款成功：已逐笔退回 ${subOrders.filter(s => s.status === 'paid').length} 笔子订单`
        : '退款成功',
      mock: isMockMode(),
    });
  } catch (error) {
    console.error('订单退款失败:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '退款失败' });
  }
});

/**
 * 手动调整会员状态（管理员特殊操作）
 */
router.post('/members/:userId/adjust', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { tier, expiresAt, reason } = req.body;

    if (!tier || !expiresAt) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新会员状态
    await prisma.users.update({
      where: { id: userId },
      data: {
        membership_tier: tier,
        membership_expires_at: new Date(expiresAt)
      }
    });

    // 记录操作日志
    await prisma.user_subscriptions.create({
      data: {
        user_id: userId,
        tier,
        status: 'manual_adjustment',
        started_at: new Date(),
        expires_at: new Date(expiresAt),
        auto_renew: false,
        order_id: null,
        original_price: 0,
        paid_price: 0
      }
    });

    res.json({ success: true, message: '会员状态已调整' });
  } catch (error) {
    console.error('调整会员状态失败:', error);
    res.status(500).json({ error: '调整会员状态失败' });
  }
});

export default router;