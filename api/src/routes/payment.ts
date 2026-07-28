import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { addPoints } from '../utils/points';
import crypto from 'crypto';
import { upgradeMembership, MEMBERSHIP_TIERS } from '../utils/membership';
import { wsServer } from '../utils/websocket';
import { JWT_SECRET } from '../utils/auth';
import { verifyNotify as verifyAlipayNotify } from '../utils/alipay';

const router = Router();

// JWT认证函数
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
 * 支付成功后的订单处理逻辑（mock/wxpay/alipay 三种支付方式共用）
 * 包含幂等检查：订单状态必须为 pending 才会处理，否则直接返回已处理
 * @param orderId 商户订单号
 * @param paymentMethod 支付方式标识 ('mock' | 'wxpay' | 'alipay')
 * @param transactionId 第三方交易号（可选）
 * @returns { success: boolean; message: string; alreadyProcessed?: boolean }
 */
async function processPaymentSuccess(
  orderId: string,
  paymentMethod: string,
  transactionId?: string
): Promise<{ success: boolean; message: string; alreadyProcessed?: boolean }> {
  const order = await prisma.orders.findUnique({ where: { id: orderId } });
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  if (order.status !== 'pending') {
    return { success: true, message: '订单已处理', alreadyProcessed: true };
  }

  await prisma.orders.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      payment_method: paymentMethod,
      paid_at: new Date(),
      transaction_id: transactionId || null,
    },
  });

  if (order.type === 'subscription' && order.tier) {
    await upgradeMembership(
      order.user_id,
      order.tier,
      order.id,
      order.amount,
      order.original_amount || order.amount,
      order.discount_code || undefined,
    );
  } else if (order.type === 'points' && order.points) {
    await addPoints(
      order.user_id,
      order.points,
      'purchase',
      '充值积分',
      parseInt(orderId.split('_')[1] || '0', 10),
    );
  }

  wsServer.sendToUser(order.user_id, 'payment:status', {
    orderId,
    status: 'paid',
    type: order.type,
    amount: order.amount,
    points: order.points,
  });

  return { success: true, message: '支付成功' };
}

/**
 * 会员套餐配置（从 MEMBERSHIP_TIERS 派生，确保单一数据源）
 */
const MEMBERSHIP_PLANS = Object.fromEntries(
  Object.entries(MEMBERSHIP_TIERS)
    .filter(([key]) => key !== 'free')
    .map(([key, config]) => [key, {
      name: config.name,
      price: config.price,
      duration: config.duration,
      tier: key,
      ...(key === 'enterprise' ? { maxAccounts: (config as any).maxAccounts } : {}),
    }])
);

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
    subscriptions: Object.entries(MEMBERSHIP_PLANS).map(([key, plan]: [string, any]) => ({
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
      // 折扣码功能暂未上线，忽略无效折扣码
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
        payment_method: null,
        expires_at: new Date(Date.now() + 30 * 60 * 1000)
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
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  try {
    const where: any = { user_id: userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const orders = await prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
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
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 模拟支付回调（仅用于开发测试）
 * 生产环境禁止调用
 */
router.post('/callback/mock', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: '此接口仅限开发环境使用' });
  }

  const { orderId, success = true } = req.body;

  try {
    if (success) {
      const result = await processPaymentSuccess(orderId, 'mock');
      if (!result.success && !result.alreadyProcessed) {
        return res.status(404).json({ error: result.message });
      }
      res.json({ success: true, message: result.message });
    } else {
      await prisma.orders.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      wsServer.sendToUser(
        (await prisma.orders.findUnique({ where: { id: orderId } }))?.user_id || 0,
        'payment:status',
        { orderId, status: 'cancelled' },
      );

      res.json({ success: false, message: '支付取消' });
    }
  } catch (error) {
    console.error('处理支付回调失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

/**
 * 微信小程序支付 - 统一下单
 * POST /api/payment/wxpay/create
 * body: { orderId }  (先创建订单，再调此接口获取支付参数)
 */
router.post('/wxpay/create', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: '缺少 orderId' });
  }

  // 检查微信支付配置
  const appId = process.env.WX_APPID;
  const mchId = process.env.WX_PAY_MCH_ID;
  const apiKey = process.env.WX_PAY_API_KEY;

  if (!appId || !mchId || !apiKey) {
    return res.status(503).json({
      error: '微信支付暂未开通，请使用其他支付方式',
      code: 'WXPAY_NOT_CONFIGURED'
    });
  }

  try {
    const order = await prisma.orders.findUnique({ where: { id: orderId } });

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (order.user_id !== userId) {
      return res.status(403).json({ error: '无权操作此订单' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: '订单状态异常，无法支付' });
    }

    // 获取用户 openid（微信支付必须）
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { wx_openid: true }
    });

    if (!user?.wx_openid) {
      return res.status(400).json({
        error: '当前账号未绑定微信，请先使用微信登录或绑定微信',
        code: 'NO_OPENID'
      });
    }

    // 构造微信支付统一下单参数（V2 API）
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const totalFee = Math.round(order.amount * 100); // 转换为分
    const notifyUrl = `${process.env.API_BASE_URL || 'https://your-domain.com'}/api/payment/wxpay/callback`;

    const params: Record<string, string> = {
      appid: appId,
      mch_id: mchId,
      nonce_str: nonceStr,
      body: order.type === 'subscription' ? 'StoryTree会员订阅' : 'StoryTree积分充值',
      out_trade_no: orderId,
      total_fee: totalFee.toString(),
      spbill_create_ip: req.ip || '127.0.0.1',
      notify_url: notifyUrl,
      trade_type: 'JSAPI',
      openid: user.wx_openid,
    };

    // 生成签名
    const signStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&') + `&key=${apiKey}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    params.sign = sign;

    // 转为 XML
    const xmlBody = '<xml>' + Object.entries(params).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('') + '</xml>';

    // 调用微信统一下单接口
    const wxRes = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlBody,
    });
    const wxXml = await wxRes.text();

    // 简单解析 XML（生产环境建议用 xml2js 库）
    const parseXmlValue = (xml: string, tag: string) => {
      const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`));
      return match ? match[1] : '';
    };

    const returnCode = parseXmlValue(wxXml, 'return_code');
    const resultCode = parseXmlValue(wxXml, 'result_code');

    if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
      const errMsg = parseXmlValue(wxXml, 'err_code_des') || parseXmlValue(wxXml, 'return_msg');
      console.error('微信统一下单失败:', wxXml);
      return res.status(400).json({ error: `微信支付下单失败: ${errMsg}` });
    }

    const prepayId = parseXmlValue(wxXml, 'prepay_id');

    // 生成小程序端调起支付的参数（需要二次签名）
    const payParams: Record<string, string> = {
      appId,
      timeStamp,
      nonceStr: crypto.randomBytes(16).toString('hex'),
      package: `prepay_id=${prepayId}`,
      signType: 'MD5',
    };
    const paySignStr = Object.keys(payParams)
      .sort()
      .map(k => `${k}=${payParams[k as keyof typeof payParams]}`)
      .join('&') + `&key=${apiKey}`;
    payParams.paySign = crypto.createHash('md5').update(paySignStr).digest('hex').toUpperCase();

    // 更新订单状态为 paying
    await prisma.orders.update({
      where: { id: orderId },
      data: { payment_method: 'wxpay' }
    });

    res.json({
      ...payParams,
      orderId,
    });
  } catch (error) {
    console.error('微信支付下单失败:', error);
    res.status(500).json({ error: '创建支付订单失败' });
  }
});

/**
 * 微信支付回调
 * POST /api/payment/wxpay/callback
 * 由微信服务器主动调用，验签后处理订单
 */
router.post('/wxpay/callback', async (req, res) => {
  const apiKey = process.env.WX_PAY_API_KEY;
  if (!apiKey) {
    return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[未配置支付密钥]]></return_msg></xml>');
  }

  try {
    const xmlBody = req.body?.toString?.() || '';

    const parseXmlValue = (xml: string, tag: string) => {
      const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`));
      return match ? match[1] : '';
    };

    const returnCode = parseXmlValue(xmlBody, 'return_code');
    const resultCode = parseXmlValue(xmlBody, 'result_code');
    const outTradeNo = parseXmlValue(xmlBody, 'out_trade_no');
    const transactionId = parseXmlValue(xmlBody, 'transaction_id');
    const sign = parseXmlValue(xmlBody, 'sign');

    if (returnCode !== 'SUCCESS') {
      return res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
    }

    // 验证签名（提取所有字段，去掉 sign，重新签名）
    const fields: Record<string, string> = {};
    const fieldRegex = /<(\w+)><!\[CDATA\[(.+?)\]\]><\/\1>/g;
    let match;
    while ((match = fieldRegex.exec(xmlBody)) !== null) {
      if (match[1] !== 'sign') {
        fields[match[1]] = match[2];
      }
    }
    const signStr = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('&') + `&key=${apiKey}`;
    const expectedSign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    if (sign !== expectedSign) {
      console.error('微信支付回调签名验证失败');
      return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>');
    }

    if (resultCode !== 'SUCCESS') {
      return res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
    }

    // 校验支付金额与订单金额一致
    const totalFeeStr = parseXmlValue(xmlBody, 'total_fee');
    const paidFee = parseInt(totalFeeStr, 10);
    const wxOrder = await prisma.orders.findUnique({ where: { id: outTradeNo } });
    if (!wxOrder) {
      return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单不存在]]></return_msg></xml>');
    }
    const expectedFee = Math.round(wxOrder.amount * 100);
    if (isNaN(paidFee) || paidFee !== expectedFee) {
      console.error(`微信支付回调金额不匹配: 订单=${outTradeNo} 实付=${paidFee} 期望=${expectedFee}`);
      return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[金额不匹配]]></return_msg></xml>');
    }

    const result = await processPaymentSuccess(outTradeNo, 'wxpay', transactionId);
    if (!result.success && !result.alreadyProcessed) {
      return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单处理失败]]></return_msg></xml>');
    }

    res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (error) {
    console.error('处理微信支付回调失败:', error);
    res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code></xml>');
  }
});

/**
 * 支付宝异步通知回调
 * POST /api/payment/alipay/notify
 * 由支付宝服务器主动调用，验签后处理订单
 */
router.post('/alipay/notify', async (req, res) => {
  try {
    const notifyData = req.body;

    // 验证支付宝签名
    const isVerified = verifyAlipayNotify(notifyData);
    if (!isVerified) {
      console.error('支付宝回调签名验证失败');
      return res.send('fail');
    }

    const outTradeNo = notifyData.out_trade_no;
    const tradeNo = notifyData.trade_no;
    const tradeStatus = notifyData.trade_status;
    const totalAmount = parseFloat(notifyData.total_amount);

    // 仅处理交易成功状态
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return res.send('success');
    }

    // 校验支付金额与订单金额一致
    const order = await prisma.orders.findUnique({ where: { id: outTradeNo } });
    if (!order) {
      console.error(`支付宝回调: 订单不存在 ${outTradeNo}`);
      return res.send('fail');
    }
    if (Math.abs(totalAmount - order.amount) > 0.01) {
      console.error(`支付宝回调金额不匹配: 订单=${outTradeNo} 实付=${totalAmount} 期望=${order.amount}`);
      return res.send('fail');
    }

    const result = await processPaymentSuccess(outTradeNo, 'alipay', tradeNo);
    if (!result.success && !result.alreadyProcessed) {
      return res.send('fail');
    }

    res.send('success');
  } catch (error) {
    console.error('处理支付宝回调失败:', error);
    res.send('fail');
  }
});

/**
 * 查询微信支付订单状态（供前端轮询）
 * GET /api/payment/wxpay/query/:orderId
 */
router.get('/wxpay/query/:orderId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { orderId } = req.params;

  try {
    const order = await prisma.orders.findUnique({ where: { id: orderId } });
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      paidAt: order.paid_at,
    });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

export default router;