import { AlipaySdk } from 'alipay-sdk';

/**
 * 支付宝支付服务
 * 
 * 配置说明：
 * 1. 登录支付宝开放平台：https://open.alipay.com/
 * 2. 创建应用，获取 APP_ID
 * 3. 生成应用私钥和公钥，上传公钥到支付宝
 * 4. 签约产品：当面付 (WAP_WAP)、手机网站支付
 * 5. 配置回调 URL 白名单
 */

// 支付宝配置
const ALIPAY_CONFIG = {
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  timeoutExpress: 30000, // 30 秒超时
};

// 初始化 SDK
const alipaySdk = new AlipaySdk({
  appId: ALIPAY_CONFIG.appId,
  privateKey: ALIPAY_CONFIG.privateKey,
  alipayPublicKey: ALIPAY_CONFIG.alipayPublicKey,
  gateway: ALIPAY_CONFIG.gateway,
  timeoutExpress: ALIPAY_CONFIG.timeoutExpress,
});

/**
 * 创建手机网站支付订单
 * @param orderId 订单 ID
 * @param subject 订单标题
 * @param totalAmount 订单金额（元）
 * @param returnUrl 同步跳转地址
 * @param notifyUrl 异步通知地址
 * @returns 表单 HTML 或 支付链接
 */
export async function createWapPay(params: {
  orderId: string;
  subject: string;
  totalAmount: number;
  returnUrl: string;
  notifyUrl: string;
}): Promise<string> {
  const { orderId, subject, totalAmount, returnUrl, notifyUrl } = params;

  try {
    // 使用 alipay-sdk 的 exec 方法调用手机网站支付 API
    const formData = {
      method: 'alipay.trade.wap.pay',
      bizContent: {
        outTradeNo: orderId, // 商户订单号
        productCode: 'QUICK_WAP_WAY', // 产品码：手机网站支付
        totalAmount: totalAmount.toFixed(2), // 订单金额
        subject: subject, // 订单标题
        timeoutExpress: '30m', // 订单有效期 30 分钟
      },
      returnUrl: returnUrl,
      notifyUrl: notifyUrl,
    };

    const result = await alipaySdk.exec('alipay.trade.wap.pay', {
      bizContent: formData.bizContent,
    }, {
      formData: {
      returnUrl: returnUrl,
      notifyUrl: notifyUrl,
    }});

    return result;
  } catch (error) {
    console.error('创建支付宝订单失败:', error);
    throw new Error('创建支付订单失败');
  }
}

/**
 * 创建当面付二维码
 * @param orderId 订单 ID
 * @param subject 订单标题
 * @param totalAmount 订单金额（元）
 * @returns 二维码内容
 */
export async function createQrPay(params: {
  orderId: string;
  subject: string;
  totalAmount: number;
}): Promise<string> {
  const { orderId, subject, totalAmount } = params;

  try {
    const result = await alipaySdk.exec('alipay.trade.precreate', {
      bizContent: {
        outTradeNo: orderId,
        totalAmount: totalAmount.toFixed(2),
        subject: subject,
      },
    });

    if (result.code !== '10000') {
      throw new Error(result.sub_msg || '创建二维码失败');
    }

    // 返回二维码内容（支付链接）
    return result.qrCode;
  } catch (error) {
    console.error('创建支付宝二维码失败:', error);
    throw new Error('创建支付二维码失败');
  }
}

/**
 * 查询订单状态
 * @param orderId 订单 ID
 * @returns 订单状态信息
 */
export async function queryOrderStatus(orderId: string): Promise<{
  tradeStatus: string;
  totalAmount: string;
  buyerPayAmount: string;
  tradeNo: string;
} | null> {
  try {
    const result = await alipaySdk.exec('alipay.trade.query', {
      bizContent: {
        outTradeNo: orderId,
      },
    });

    if (result.code !== '10000') {
      throw new Error(result.sub_msg || '查询订单失败');
    }

    return {
      tradeStatus: result.tradeStatus,
      totalAmount: result.totalAmount,
      buyerPayAmount: result.buyerPayAmount,
      tradeNo: result.tradeNo,
    };
  } catch (error) {
    console.error('查询订单状态失败:', error);
    return null;
  }
}

/**
 * 验证支付宝异步通知签名
 * @param notifyData 通知数据对象
 * @returns 验证是否通过
 */
export function verifyNotify(notifyData: any): boolean {
  try {
    const sign = notifyData.sign;
    const signType = notifyData.sign_type || 'RSA2';
    
    // 移除 sign 和 sign_type 字段
    const { sign: _, sign_type: __, ...bizContent } = notifyData;
    
    // 使用 SDK 验证签名
    const verifyResult = alipaySdk.checkNotifySign(bizContent, sign, signType);
    
    return verifyResult;
  } catch (error) {
    console.error('验证支付宝通知签名失败:', error);
    return false;
  }
}

/**
 * 处理支付成功后的业务逻辑
 * @param outTradeNo 商户订单号
 * @param tradeNo 支付宝交易号
 * @param totalAmount 交易金额
 */
export async function handlePaymentSuccess(
  outTradeNo: string,
  tradeNo: string,
  totalAmount: string,
): Promise<void> {
  // 这里会调用 payment.ts 中的订单处理逻辑
  // 实际实现在 payment.ts 的回调处理中
  console.log(`订单 ${outTradeNo} 支付成功，支付宝交易号：${tradeNo}, 金额：${totalAmount}`);
}

/**
 * 创建退款
 * @param orderId 订单 ID
 * @param refundAmount 退款金额
 * @param refundReason 退款原因
 * @returns 退款结果
 */
export async function createRefund(params: {
  orderId: string;
  refundAmount: number;
  refundReason: string;
}): Promise<{
  refundTradeNo: string;
  refundAmount: string;
  refundStatus: string;
}> {
  const { orderId, refundAmount, refundReason } = params;

  try {
    const result = await alipaySdk.exec('alipay.trade.refund', {
      bizContent: {
        outTradeNo: orderId,
        refundAmount: refundAmount.toFixed(2),
        refundReason: refundReason,
      },
    });

    if (result.code !== '10000') {
      throw new Error(result.sub_msg || '退款失败');
    }

    return {
      refundTradeNo: result.fundChange,
      refundAmount: result.refundAmount,
      refundStatus: result.code,
    };
  } catch (error) {
    console.error('支付宝退款失败:', error);
    throw new Error('退款失败');
  }
}

export default {
  createWapPay,
  createQrPay,
  queryOrderStatus,
  verifyNotify,
  handlePaymentSuccess,
  createRefund,
};
