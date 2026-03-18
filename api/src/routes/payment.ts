import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { addPoints } from '../utils/points';
import crypto from 'crypto';
import { upgradeMembership } from '../utils/membership';

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
 * 会员套餐配置
 */
const MEMBERSHIP_PLANS = {
  trial: {
    name: '体验会员',
    price: 9.9,
    duration: 7, // 天
    tier: 'trial'
  },
  monthly: {
    name: '月度会员',
    price: 39,
    duration: 30,
    tier: 'monthly'
  },
  quarterly: {
    name: '季度会员',
    price: 99,
    duration: 90,
    tier: 'quarterly'
  },
  yearly: {
    name: '年度会员',
    price: 388,
    duration: 365,
    tier: 'yearly'
  },
  enterprise: {
    name: '企业版/创作团队版',
    price: 999,
    duration: 365,
    tier: 'enterprise',
    maxAccounts: 5
  }
};

/**
 * 订阅套餐配置（向后兼容）
 */
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: '月度会员',
    price: 28,
    duration: 30, // 天
    bonusPoints: 0
  },
  yearly: {
    name: '年度会员',
    price: 268,
    duration: 365,
    bonusPoints: 1000
  }
};

/**
 * 积分充值套餐
 */
const POINTS_PACKAGES = {
  basic: {
    name: '基础包',
    price: 10,
    points: 100
  },
  value: {
    name: '超值包',
    price: 50,
    points: 600
  },
  premium: {
    name: '豪华包',
    price: 100,
    points: 1500
  }
};

/**
 * 获取套餐列表
 */
router.get('/plans', (req, res) => {
  res.json({
    subscriptions: Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
      id: key,
      ...plan
    })),
    pointsPackages: Object.entries(POINTS_PACKAGES).map(([key, pkg]) => ({
      id: key,
      ...pkg
    }))
  });
});

/**
 * 创建订阅订单
 */
/**
 * 创建会员订阅订单
 */
router.post('/membership/create', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { tier, discountCode } = req.body;

  if (!tier || !MEMBERSHIP_PLANS[tier as keyof typeof MEMBERSHIP_PLANS]) {
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
    const plan = MEMBERSHIP_PLANS[tier as keyof typeof MEMBERSHIP_PLANS];
    const orderId = `MEM_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 计算优惠
    let originalPrice = plan.price;
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (discountCode) {
      // TODO: 实现优惠码逻辑
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
      tierName: plan.name,
      originalPrice,
      discountAmount,
      finalPrice,
      duration: plan.duration,
      durationText: plan.duration === 7 ? '7 天体验' :
                   plan.duration === 30 ? '1 个月' :
                   plan.duration === 90 ? '3 个月' :
                   plan.duration === 365 ? '1 年' : `${plan.duration}天`,
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
 * 创建积分充值订单
 */
router.post('/points/create', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { packageId } = req.body;

  if (!POINTS_PACKAGES[packageId as keyof typeof POINTS_PACKAGES]) {
    return res.status(400).json({ error: '无效的套餐' });
  }

  try {
    const pkg = POINTS_PACKAGES[packageId as keyof typeof POINTS_PACKAGES];
    const orderId = `PTS_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await prisma.orders.create({
      data: {
        id: orderId,
        user_id: userId,
        type: 'points',
        amount: pkg.price,
        points: pkg.points,
        status: 'pending',
        payment_method: null
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      points: pkg.points,
      packageName: pkg.name,
      paymentUrl: `/payment/mock?orderId=${orderId}`,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${orderId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

/**
 * 查询订单状态
 */
router.get('/orders/:orderId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { orderId } = req.params;

  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (order.user_id !== userId) {
      return res.status(403).json({ error: '无权访问此订单' });
    }

    res.json({
      orderId: order.id,
      type: order.type,
      amount: order.amount,
      points: order.points,
      status: order.status,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      createdAt: order.created_at
    });
  } catch (error) {
    console.error('查询订单失败:', error);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * 获取用户订单列表
 */
router.get('/orders', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { type, status, page = 1, limit = 20 } = req.query;

  try {
    const where: any = { user_id: userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const orders = await prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    const total = await prisma.orders.count({ where });

    res.json({
      orders: orders.map(order => ({
        orderId: order.id,
        type: order.type,
        amount: order.amount,
        points: order.points,
        status: order.status,
        createdAt: order.created_at,
        paidAt: order.paid_at
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 模拟支付回调（仅用于开发测试）
 * 生产环境需要替换为真实的支付回调处理
 */
router.post('/callback/mock', async (req, res) => {
  const { orderId, success = true } = req.body;

  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: '订单状态异常' });
    }

    if (success) {
      // 更新订单状态
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          payment_method: 'mock',
          paid_at: new Date()
        }
      });

      // 处理订单
      if (order.type === 'subscription') {
        // 会员订阅订单：使用新的会员系统
        if (order.tier) {
          await upgradeMembership(
            order.user_id,
            order.tier,
            order.id,
            order.amount,
            order.original_amount || order.amount,
            order.discount_code || undefined
          );
        } else {
          // 向后兼容旧的订阅系统
          const plan = Object.entries(SUBSCRIPTION_PLANS).find(
            ([_, p]) => p.price === order.amount
          );

          if (plan) {
            const [planId, planInfo] = plan;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + planInfo.duration);

            await prisma.users.update({
              where: { id: order.user_id },
              data: {
                subscription_type: planId,
                subscription_expires: expiresAt
              }
            });

            // 赠送积分
            if (planInfo.bonusPoints > 0) {
              await addPoints(
                order.user_id,
                planInfo.bonusPoints,
                'subscription_bonus',
                `购买${planInfo.name}赠送积分`,
                parseInt(orderId.split('_')[1])
              );
            }
          }
        }
      } else if (order.type === 'points') {
        // 积分充值订单：增加积分
        if (order.points) {
          await addPoints(
            order.user_id,
            order.points,
            'purchase',
            `充值积分`,
            parseInt(orderId.split('_')[1])
          );
        }
      }

      res.json({ success: true, message: '支付成功' });
    } else {
      await prisma.orders.update({
        where: { id: orderId },
        data: { status: 'cancelled' }
      });

      res.json({ success: false, message: '支付取消' });
    }
  } catch (error) {
    console.error('处理支付回调失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

export default router;