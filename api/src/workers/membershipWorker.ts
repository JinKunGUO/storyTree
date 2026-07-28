import { prisma } from '../db';
import { createNotification } from '../routes/notifications';

/**
 * 会员定时任务
 * 负责：
 * 1. 检查即将到期的会员（提前 7 天、3 天、1 天提醒）
 * 2. 到期后自动降级为免费用户
 * 3. 自动续费处理
 */

// 每日执行
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 小时

/**
 * 检查并发送会员到期提醒
 */
async function checkExpiringMemberships() {
  const now = new Date();
  
  try {
    // 检查 7 天后到期的会员
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringIn7Days = await prisma.users.findMany({
      where: {
        membership_expires_at: {
          lte: sevenDaysLater,
          gt: now
        },
membership_tier: {
          not: 'free'
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        membership_tier: true,
        membership_expires_at: true,
        membership_auto_renew: true
      }
    });

    // 检查 3 天后到期的会员
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringIn3Days = await prisma.users.findMany({
      where: {
        membership_expires_at: {
          lte: threeDaysLater,
          gt: now
        },
membership_tier: {
          not: 'free'
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        membership_tier: true,
        membership_expires_at: true,
        membership_auto_renew: true
      }
    });

    // 检查 1 天后到期的会员
    const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const expiringIn1Day = await prisma.users.findMany({
      where: {
        membership_expires_at: {
          lte: oneDayLater,
          gt: now
        },
membership_tier: {
          not: 'free'
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        membership_tier: true,
        membership_expires_at: true,
        membership_auto_renew: true
      }
    });

    // 发送 7 天提醒
    for (const user of expiringIn7Days) {
      if (user.membership_expires_at) {
        await createNotification(
          user.id,
          'membership_expiring',
          '会员即将到期',
          `您的${getMembershipName(user.membership_tier)}将在 7 天后到期${user.membership_auto_renew ? '，已为您开启自动续费' : '，请及时续费以继续享受会员权益'}`,
          '/membership.html'
        );
        
        console.log(`📧 发送 7 天到期提醒给用户：${user.username}`);
      }
    }

    // 发送 3 天提醒
    for (const user of expiringIn3Days) {
      if (user.membership_expires_at) {
        await createNotification(
          user.id,
          'membership_expiring',
          '会员即将到期',
          `您的${getMembershipName(user.membership_tier)}将在 3 天后到期${user.membership_auto_renew ? '，已为您开启自动续费' : '，请尽快续费'}`,
          '/membership.html'
        );
        
        console.log(`📧 发送 3 天到期提醒给用户：${user.username}`);
      }
    }

    // 发送 1 天提醒
    for (const user of expiringIn1Day) {
      if (user.membership_expires_at) {
        await createNotification(
          user.id,
          'membership_expiring',
          '会员即将到期',
          `您的${getMembershipName(user.membership_tier)}将在 24 小时后到期${user.membership_auto_renew ? '，系统将在到期时自动续费' : '，请立即续费以免失去会员权益'}`,
          '/membership.html'
        );
        
        console.log(`📧 发送 1 天到期提醒给用户：${user.username}`);
      }
    }

    console.log(`✅ 会员到期提醒检查完成`);
  } catch (error) {
    console.error('检查会员到期提醒失败:', error);
  }
}

/**
 * 处理已过期的会员
 */
async function processExpiredMemberships() {
  const now = new Date();
  
  try {
    // 查找已过期的会员
    const expiredMembers = await prisma.users.findMany({
      where: {
        membership_expires_at: {
          lte: now
        },
        membership_tier: {
          not: 'free'
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        membership_tier: true,
        membership_expires_at: true,
        membership_auto_renew: true
      }
    });

    // 处理每个过期会员
    for (const user of expiredMembers) {
      if (user.membership_auto_renew) {
        // 自动续费暂未接入真实扣款，先降级并发送续费提醒通知
        // 避免免费赠送会员造成收入损失
        console.log(`⏰ 自动续费待扣款：${user.username}（${user.membership_tier}）`);
      }
      
      // 降级为免费用户
      await prisma.users.update({
        where: { id: user.id },
        data: {
          membership_tier: 'free',
          membership_auto_renew: false
        }
      });
      
      // 更新订阅记录状态
      await prisma.user_subscriptions.updateMany({
        where: {
          user_id: user.id,
          status: 'active'
        },
        data: {
          status: 'expired'
        }
      });
      
      console.log(`⬇️ 会员已过期降级：${user.username}`);
      
      await createNotification(
        user.id,
        'membership_expired',
        '会员已到期',
        user.membership_auto_renew
          ? `您的${getMembershipName(user.membership_tier)}已到期，自动续费功能正在开发中，请手动续费以免失去会员权益。`
          : `您的${getMembershipName(user.membership_tier)}已到期，已降级为免费用户。重新购买会员可继续享受特权。`,
        '/membership.html'
      );
    }

    console.log(`✅ 过期会员处理完成，共处理 ${expiredMembers.length} 人`);
  } catch (error) {
    console.error('处理过期会员失败:', error);
  }
}

/**
 * 获取会员等级名称
 */
function getMembershipName(tier: string): string {
  const names: Record<string, string> = {
    trial: '体验会员',
    monthly: '月度会员',
    quarterly: '季度会员',
    yearly: '年度会员',
    enterprise: '企业版'
  };
  return names[tier] || '会员';
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 清理过期的 pending 订单
 * 将已过期（expires_at < now）的 pending 订单标记为 expired
 */
async function processExpiredOrders() {
  const now = new Date();

  try {
    const result = await prisma.orders.updateMany({
      where: {
        status: 'pending',
        expires_at: { lt: now },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      console.log(`🧹 清理过期订单：${result.count} 个`);
    }
  } catch (error) {
    console.error('清理过期订单失败:', error);
  }
}

/**
 * 主函数
 */
async function runMembershipWorker() {
  console.log('🕒 会员定时任务启动...');
  
  // 启动时立即执行一次
  await checkExpiringMemberships();
  await processExpiredMemberships();
  await processExpiredOrders();
  
  // 然后每天执行
  setInterval(async () => {
    console.log('🕐 开始执行会员定时任务...');
    await checkExpiringMemberships();
    await processExpiredMemberships();
    await processExpiredOrders();
  }, CHECK_INTERVAL);
}

// 启动 Worker
runMembershipWorker().catch(console.error);

export { checkExpiringMemberships, processExpiredMemberships };