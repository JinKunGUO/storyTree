import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import {
  MEMBERSHIP_TIERS,
  getMembershipTier,
  checkMembershipFeature,
  getMembershipBenefits,
  upgradeMembership,
  cancelAutoRenew,
  isValidMembership
} from '../utils/membership';
import crypto from 'crypto';
import { JWT_SECRET } from '../utils/auth';

const router = Router();

// JWT 认证函数
const getUserId = (req: any): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

/**
 * 获取会员套餐列表
 */
router.get('/tiers', (req, res) => {
  try {
    const tiers = Object.entries(MEMBERSHIP_TIERS).map(([key, config]) => {
      let quotaDescription = '';
      
      if (key === 'free') {
        quotaDescription = '按用户等级 (Lv1-Lv4) 分配配额';
      } else if (config.quotaMultiplier === -1) {
        quotaDescription = '全部无限';
      } else {
        const baseQuota = { continuation: 50, illustration: 10 }; // Lv4 配额
        quotaDescription = `Lv4 配额 × ${config.quotaMultiplier} 倍`;
        quotaDescription += `\n续写：${Math.floor(baseQuota.continuation * config.quotaMultiplier)} 次/月`;
        quotaDescription += `\n润色：无限`;
        quotaDescription += `\n插图：${Math.floor(baseQuota.illustration * config.quotaMultiplier)} 张/月`;
      }
      
      return {
        id: key,
        name: config.name,
        price: config.price,
        duration: config.duration,
        durationText: config.duration === 0 ? '永久' : 
                     config.duration === 7 ? '7 天' :
                     config.duration === 30 ? '1 个月' :
                     config.duration === 90 ? '3 个月' :
                     config.duration === 365 ? '1 年' : `${config.duration}天`,
        quotaMultiplier: config.quotaMultiplier,
        quotaDescription,
        benefits: config.benefits,
        isPopular: key === 'yearly', // 标注为热门
        isTrial: key === 'trial'
      };
    });

    res.json({ tiers });
  } catch (error) {
    console.error('获取会员套餐失败:', error);
    res.status(500).json({ error: '获取会员套餐失败' });
  }
});

/**
 * 获取我的会员状态
 */
router.get('/my', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const membership = await getMembershipTier(userId);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        has_used_trial: true,
        membership_auto_renew: true
      }
    });

    // 获取订阅历史
    const subscriptions = await prisma.user_subscriptions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    res.json({
      membership: {
        tier: membership.tier,
        name: membership.name,
        isActive: membership.isActive,
        expiresAt: membership.expiresAt,
        autoRenew: user?.membership_auto_renew || false,
        hasUsedTrial: user?.has_used_trial || false
      },
      subscriptionHistory: subscriptions.map(sub => ({
        id: sub.id,
        tier: sub.tier,
        status: sub.status,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at,
        paidPrice: sub.paid_price,
        autoRenew: sub.auto_renew
      }))
    });
  } catch (error) {
    console.error('获取会员状态失败:', error);
    res.status(500).json({ error: '获取会员状态失败' });
  }
});

/**
 * 获取会员权益对比
 */
router.get('/benefits', (req, res) => {
  try {
    const benefits = getMembershipBenefits();
    res.json({ benefits });
  } catch (error) {
    console.error('获取会员权益失败:', error);
    res.status(500).json({ error: '获取会员权益失败' });
  }
});

/**
 * 检查功能权限
 */
router.post('/check-feature', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { feature } = req.body;

  if (!feature) {
    return res.status(400).json({ error: '缺少功能参数' });
  }

  try {
    const result = await checkMembershipFeature(userId, feature);
    res.json(result);
  } catch (error) {
    console.error('检查功能权限失败:', error);
    res.status(500).json({ error: '检查功能权限失败' });
  }
});

/**
 * 创建会员升级订单
 */
router.post('/upgrade/create', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { tier, discountCode } = req.body;

  if (!tier || !MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS]) {
    return res.status(400).json({ error: '无效的会员等级' });
  }

  // 检查体验会员资格
  if (tier === 'trial') {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { has_used_trial: true }
    });

    if (user?.has_used_trial) {
      return res.status(400).json({ error: '体验会员仅限使用一次' });
    }
  }

  try {
    const tierConfig = MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS];
    const orderId = `MEM_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 计算优惠
    let originalPrice = tierConfig.price;
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (discountCode) {
      // TODO: 实现优惠码逻辑
      // 这里简单示例：使用优惠码打 9 折
      discountAmount = originalPrice * 0.1;
      finalPrice = originalPrice - discountAmount;
    }

    // 创建订单
    const order = await prisma.orders.create({
      data: {
        id: orderId,
        user_id: userId,
        type: 'subscription',
        tier,
        amount: finalPrice,
        original_amount: originalPrice,
        discount_amount: discountAmount,
        discount_code: discountCode,
        status: 'pending',
        payment_method: null,
        expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 分钟过期
      }
    });

    res.json({
      orderId: order.id,
      tier,
      tierName: tierConfig.name,
      originalPrice,
      discountAmount,
      finalPrice,
      duration: tierConfig.duration,
      durationText: tierConfig.duration === 7 ? '7 天体验' :
                   tierConfig.duration === 30 ? '1 个月' :
                   tierConfig.duration === 90 ? '3 个月' :
                   tierConfig.duration === 365 ? '1 年' : `${tierConfig.duration}天`,
      benefits: tierConfig.benefits,
      paymentUrl: `/payment/mock?orderId=${orderId}`,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orderId}`,
      expiresAt: order.expires_at
    });
  } catch (error) {
    console.error('创建会员订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

/**
 * 取消自动续费
 */
router.post('/cancel-renewal', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const result = await cancelAutoRenew(userId);
    
    // 更新最新的订阅记录
    const latestSubscription = await prisma.user_subscriptions.findFirst({
      where: { 
        user_id: userId,
        status: 'active'
      },
      orderBy: { expires_at: 'desc' }
    });

    if (latestSubscription) {
      await prisma.user_subscriptions.update({
        where: { id: latestSubscription.id },
        data: { auto_renew: false }
      });
    }

    res.json({
      success: true,
      message: '已取消自动续费'
    });
  } catch (error) {
    console.error('取消自动续费失败:', error);
    res.status(500).json({ error: '取消自动续费失败' });
  }
});

/**
 * 获取会员统计数据（管理员）
 */
router.get('/admin/stats', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  // 检查管理员权限
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { isAdmin: true }
  });

  if (!user?.isAdmin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    // 统计各等级会员数量
    const tierStats = await prisma.users.groupBy({
      by: ['membership_tier'],
      _count: true
    });

    // 本月新增会员
    const newMembersThisMonth = await prisma.user_subscriptions.count({
      where: {
        started_at: { gte: firstDayOfMonth }
      }
    });

    // 本月收入
    const revenueThisMonth = await prisma.orders.aggregate({
      where: {
        type: 'subscription',
        status: 'paid',
        paid_at: { gte: firstDayOfMonth }
      },
      _sum: { amount: true }
    });

    // 本年收入
    const revenueThisYear = await prisma.orders.aggregate({
      where: {
        type: 'subscription',
        status: 'paid',
        paid_at: { gte: firstDayOfYear }
      },
      _sum: { amount: true }
    });

    // 即将过期的会员（7 天内）
    const expiringSoon = await prisma.users.count({
      where: {
        membership_expires_at: {
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          gt: now
        }
      }
    });

    res.json({
      tierStats: tierStats.reduce((acc, item) => {
        acc[item.membership_tier] = item._count;
        return acc;
      }, {} as Record<string, number>),
      newMembersThisMonth,
      revenueThisMonth: revenueThisMonth._sum.amount || 0,
      revenueThisYear: revenueThisYear._sum.amount || 0,
      expiringSoon
    });
  } catch (error) {
    console.error('获取会员统计失败:', error);
    res.status(500).json({ error: '获取会员统计失败' });
  }
});

export default router;
