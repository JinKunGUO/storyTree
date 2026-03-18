import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// 验证JWT中间件
async function authenticateToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

// 验证管理员中间件
async function authenticateAdmin(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

// 提交提现申请
router.post('/request', authenticateToken, async (req: any, res: any) => {
  const { amount, paymentMethod, paymentAccount } = req.body;
  const userId = req.userId;

  // 验证输入
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '请输入有效的提现金额' });
  }

  if (!paymentMethod || !paymentAccount) {
    return res.status(400).json({ error: '请填写提现方式和账号' });
  }

  // 最低提现金额
  const MIN_WITHDRAWAL = 100;
  if (amount < MIN_WITHDRAWAL) {
    return res.status(400).json({ 
      error: `最低提现金额为 ${MIN_WITHDRAWAL} 积分`,
      minAmount: MIN_WITHDRAWAL
    });
  }

  try {
    // 获取用户信息
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查余额是否足够
    if (user.earnings_balance < amount) {
      return res.status(400).json({ 
        error: '收益余额不足',
        available: user.earnings_balance,
        requested: amount
      });
    }

    // 检查是否有待处理的提现申请
    const pendingRequest = await prisma.withdrawal_requests.findFirst({
      where: {
        user_id: userId,
        status: 'pending'
      }
    });

    if (pendingRequest) {
      return res.status(400).json({ 
        error: '你有待处理的提现申请，请等待审核完成后再申请',
        pendingRequest
      });
    }

    // 使用事务处理提现申请
    const withdrawal = await prisma.$transaction(async (tx) => {
      // 扣除收益余额
      await tx.users.update({
        where: { id: userId },
        data: {
          earnings_balance: {
            decrement: amount
          }
        }
      });

      // 创建提现申请
      const request = await tx.withdrawal_requests.create({
        data: {
          user_id: userId,
          amount,
          payment_method: paymentMethod,
          payment_account: paymentAccount,
          status: 'pending'
        }
      });

      // 发送通知给用户
      await tx.notifications.create({
        data: {
          user_id: userId,
          type: 'withdrawal_submitted',
          title: '提现申请已提交',
          content: `你的提现申请（${amount}积分）已提交，请等待管理员审核`,
          link: '/profile?tab=withdrawals'
        }
      });

      return request;
    });

    res.json({
      success: true,
      message: '提现申请已提交，请等待审核',
      withdrawal
    });
  } catch (error) {
    console.error('提交提现申请失败:', error);
    res.status(500).json({ error: '提交提现申请失败' });
  }
});

// 取消提现申请（仅待审核状态可取消）
router.post('/:requestId/cancel', authenticateToken, async (req: any, res: any) => {
  const { requestId } = req.params;
  const userId = req.userId;

  try {
    // 查找提现申请
    const request = await prisma.withdrawal_requests.findUnique({
      where: { id: parseInt(requestId) }
    });

    if (!request) {
      return res.status(404).json({ error: '提现申请不存在' });
    }

    // 检查是否是本人的申请
    if (request.user_id !== userId) {
      return res.status(403).json({ error: '无权操作该提现申请' });
    }

    // 只能取消待审核的申请
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '只能取消待审核的提现申请' });
    }

    // 使用事务处理取消
    await prisma.$transaction(async (tx) => {
      // 删除提现申请
      await tx.withdrawal_requests.delete({
        where: { id: parseInt(requestId) }
      });

      // 退还收益余额
      await tx.users.update({
        where: { id: userId },
        data: {
          earnings_balance: {
            increment: request.amount
          }
        }
      });

      // 发送通知
      await tx.notifications.create({
        data: {
          user_id: userId,
          type: 'withdrawal_cancelled',
          title: '提现申请已取消',
          content: `你的提现申请（${request.amount}积分）已取消，金额已退回收益余额`,
          link: '/profile?tab=earnings'
        }
      });
    });

    res.json({
      success: true,
      message: '提现申请已取消，金额已退回'
    });
  } catch (error) {
    console.error('取消提现申请失败:', error);
    res.status(500).json({ error: '取消提现申请失败' });
  }
});

// 获取我的提现记录
router.get('/my-requests', authenticateToken, async (req: any, res: any) => {
  const userId = req.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const skip = (page - 1) * limit;

  try {
    const where: any = { user_id: userId };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.withdrawal_requests.findMany({
        where,
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.withdrawal_requests.count({ where })
    ]);

    // 统计数据
    const stats = await prisma.withdrawal_requests.groupBy({
      by: ['status'],
      where: { user_id: userId },
      _sum: {
        amount: true
      },
      _count: true
    });

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error) {
    console.error('获取提现记录失败:', error);
    res.status(500).json({ error: '获取提现记录失败' });
  }
});

// 获取收益统计
router.get('/earnings-stats', authenticateToken, async (req: any, res: any) => {
  const userId = req.userId;

  try {
    // 获取用户收益余额
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        earnings_balance: true
      }
    });

    // 获取已提现金额
    const withdrawnAmount = await prisma.withdrawal_requests.aggregate({
      where: {
        user_id: userId,
        status: 'approved'
      },
      _sum: {
        amount: true
      }
    });

    // 获取待审核提现金额
    const pendingAmount = await prisma.withdrawal_requests.aggregate({
      where: {
        user_id: userId,
        status: 'pending'
      },
      _sum: {
        amount: true
      }
    });

    // 注：付费章节功能已移除，以下数据不再统计
    // - totalEarnings: 总收益（原来自 paid_nodes 表）
    // - unlockCount: 解锁次数（原来自 node_unlocks 表）
    // - unlockRevenue: 解锁收益（原来自 node_unlocks 表）

    res.json({
      earningsBalance: user?.earnings_balance || 0,
      totalEarnings: 0, // 付费功能已移除
      withdrawnAmount: withdrawnAmount._sum.amount || 0,
      pendingAmount: pendingAmount._sum.amount || 0,
      unlockCount: 0, // 付费功能已移除
      unlockRevenue: 0 // 付费功能已移除
    });
  } catch (error) {
    console.error('获取收益统计失败:', error);
    res.status(500).json({ error: '获取收益统计失败' });
  }
});

// ========== 管理员接口 ==========

// 获取所有提现申请（管理员）
router.get('/admin/requests', authenticateAdmin, async (req: any, res: any) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const skip = (page - 1) * limit;

  try {
    const where: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.withdrawal_requests.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              earnings_balance: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.withdrawal_requests.count({ where })
    ]);

    // 统计数据
    const stats = await prisma.withdrawal_requests.groupBy({
      by: ['status'],
      _sum: {
        amount: true
      },
      _count: true
    });

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error) {
    console.error('获取提现申请失败:', error);
    res.status(500).json({ error: '获取提现申请失败' });
  }
});

// 审核提现申请（管理员）
router.post('/admin/:requestId/review', authenticateAdmin, async (req: any, res: any) => {
  const { requestId } = req.params;
  const { status, adminNote } = req.body;
  const adminId = req.userId;

  // 验证状态
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的审核状态' });
  }

  try {
    // 查找提现申请
    const request = await prisma.withdrawal_requests.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        user: true
      }
    });

    if (!request) {
      return res.status(404).json({ error: '提现申请不存在' });
    }

    // 只能审核待处理的申请
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    // 使用事务处理审核
    await prisma.$transaction(async (tx) => {
      // 更新提现申请状态
      await tx.withdrawal_requests.update({
        where: { id: parseInt(requestId) },
        data: {
          status,
          admin_note: adminNote || null,
          processed_at: new Date(),
          processed_by: adminId
        }
      });

      // 如果拒绝，退还金额
      if (status === 'rejected') {
        await tx.users.update({
          where: { id: request.user_id },
          data: {
            earnings_balance: {
              increment: request.amount
            }
          }
        });
      }

      // 发送通知给用户
      const notificationContent = status === 'approved'
        ? `你的提现申请（${request.amount}积分）已通过审核，款项将在3-5个工作日内到账`
        : `你的提现申请（${request.amount}积分）被拒绝${adminNote ? `，原因：${adminNote}` : ''}，金额已退回收益余额`;

      await tx.notifications.create({
        data: {
          user_id: request.user_id,
          type: status === 'approved' ? 'withdrawal_approved' : 'withdrawal_rejected',
          title: status === 'approved' ? '提现申请已通过' : '提现申请被拒绝',
          content: notificationContent,
          link: '/profile?tab=withdrawals'
        }
      });
    });

    res.json({
      success: true,
      message: status === 'approved' ? '提现申请已通过' : '提现申请已拒绝'
    });
  } catch (error) {
    console.error('审核提现申请失败:', error);
    res.status(500).json({ error: '审核提现申请失败' });
  }
});

// 获取提现统计（管理员）
router.get('/admin/stats', authenticateAdmin, async (req: any, res: any) => {
  try {
    // 总提现金额
    const totalWithdrawn = await prisma.withdrawal_requests.aggregate({
      where: { status: 'approved' },
      _sum: { amount: true },
      _count: true
    });

    // 待审核提现
    const pendingWithdrawals = await prisma.withdrawal_requests.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
      _count: true
    });

    // 被拒绝提现
    const rejectedWithdrawals = await prisma.withdrawal_requests.aggregate({
      where: { status: 'rejected' },
      _sum: { amount: true },
      _count: true
    });

    // 平台总收益（所有用户的收益余额 + 已提现金额）
    const usersEarnings = await prisma.users.aggregate({
      _sum: { earnings_balance: true }
    });

    res.json({
      totalWithdrawn: {
        amount: totalWithdrawn._sum.amount || 0,
        count: totalWithdrawn._count
      },
      pendingWithdrawals: {
        amount: pendingWithdrawals._sum.amount || 0,
        count: pendingWithdrawals._count
      },
      rejectedWithdrawals: {
        amount: rejectedWithdrawals._sum.amount || 0,
        count: rejectedWithdrawals._count
      },
      totalEarningsBalance: usersEarnings._sum.earnings_balance || 0,
      platformTotalEarnings: (usersEarnings._sum.earnings_balance || 0) + (totalWithdrawn._sum.amount || 0)
    });
  } catch (error) {
    console.error('获取提现统计失败:', error);
    res.status(500).json({ error: '获取提现统计失败' });
  }
});

export default router;

