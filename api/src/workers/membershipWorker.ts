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
          `您的${getMembershipName(user.membership_tier)}将在 7 天后到期，请及时续费以继续享受会员权益`,
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
          `您的${getMembershipName(user.membership_tier)}将在 3 天后到期，请尽快续费`,
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
          `您的${getMembershipName(user.membership_tier)}将在 24 小时后到期，请立即续费以免失去会员权益`,
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

      // 如果是企业版过期，冻结所有子账号
      if (user.membership_tier === 'enterprise') {
        const frozenCount = await prisma.team_memberships.updateMany({
          where: { owner_user_id: user.id, status: 'active' },
          data: { status: 'frozen', frozen_at: new Date() }
        });

        if (frozenCount.count > 0) {
          // 通知所有子账号
          const frozenMembers = await prisma.team_memberships.findMany({
            where: { owner_user_id: user.id, status: 'frozen' },
            select: { member_user_id: true }
          });

          for (const member of frozenMembers) {
            await createNotification(
              member.member_user_id,
              'team_frozen',
              '团队权益已冻结',
              '企业主账号会员已到期，您的企业版权益已冻结。数据保留，主账号续费后自动恢复。',
              '/membership.html'
            );
          }

          console.log(`🧊 企业版过期，冻结 ${frozenCount.count} 个子账号`);

          // 检查冻结的子账号是否有 pending 个人会员，有则激活
          const pendingMembers = await prisma.users.findMany({
            where: {
              id: { in: frozenMembers.map(m => m.member_user_id) },
              pending_membership_tier: { not: null },
              pending_membership_expires: { gt: new Date() }
            },
            select: { id: true, username: true, pending_membership_tier: true, pending_membership_expires: true }
          });

          for (const member of pendingMembers) {
            await prisma.users.update({
              where: { id: member.id },
              data: {
                membership_tier: member.pending_membership_tier!,
                membership_started_at: new Date(),
                membership_expires_at: member.pending_membership_expires,
                pending_membership_tier: null,
                pending_membership_expires: null
              }
            });

            // 恢复为 active（个人会员生效，不再是 frozen）
            await prisma.team_memberships.updateMany({
              where: { member_user_id: member.id, status: 'frozen' },
              data: { status: 'active', frozen_at: null }
            });

            await createNotification(
              member.id,
              'pending_membership_activated',
              '个人会员已激活',
              `您之前购买的${getMembershipName(member.pending_membership_tier!)}已自动激活`,
              '/membership.html'
            );

            console.log(`✅ 子账号 ${member.username} pending 会员已激活：${member.pending_membership_tier}`);
          }
        }
      }
      
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
 * 月度积分赠送
 * 每月 1 日对年度会员赠送 500 积分，企业版主账号赠送 1000 积分
 * 通过 last_membership_bonus_at 字段防止重复发放
 */
async function processMonthlyBonus() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 仅在每月 1-3 日执行（容错窗口），避免每天重复检查
  if (now.getDate() > 3) {
    return;
  }

  try {
    // 查找年度会员用户，且本月未发放过（企业版不赠送积分）
    const bonusStartOfMonth = new Date(currentYear, currentMonth, 1);
    const eligibleUsers = await prisma.users.findMany({
      where: {
        membership_tier: 'yearly',
        membership_expires_at: { gt: now },
        OR: [
          { last_membership_bonus_at: null },
          { last_membership_bonus_at: { lt: bonusStartOfMonth } }
        ]
      },
      select: {
        id: true,
        username: true,
        membership_tier: true
      }
    });

    for (const user of eligibleUsers) {
      const bonusPoints = 500;
      const bonusDesc = '年度会员月度赠送积分';

      await prisma.$transaction(async (tx) => {
        await tx.point_transactions.create({
          data: {
            user_id: user.id,
            amount: bonusPoints,
            type: 'membership_bonus',
            description: bonusDesc
          }
        });
        await tx.users.update({
          where: { id: user.id },
          data: {
            points: { increment: bonusPoints },
            last_membership_bonus_at: now
          }
        });
      });

      await createNotification(
        user.id,
        'membership_bonus',
        '月度积分已到账',
        `您本月获得 ${bonusPoints} 积分奖励，快去创作吧！`,
        '/points-mall.html'
      );

      console.log(`🎁 月度积分赠送：${user.username} +${bonusPoints}`);
    }

    console.log(`✅ 月度积分赠送完成，共 ${eligibleUsers.length} 人`);
  } catch (error) {
    console.error('月度积分赠送失败:', error);
  }
}

/**
 * 自动断签保护
 * 会员用户忘记签到时，系统自动使用补签机会保护连续记录
 * 每月自动补签次数：体验1次/月度3次/季度5次/年度10次/企业版无限
 */
async function processAutoCheckinProtection() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // 查找所有有补签机会的会员用户
    const usersWithChances = await prisma.users.findMany({
      where: {
        makeup_chances: { gt: 0 },
        membership_tier: { not: 'free' },
        membership_expires_at: { gt: now }
      },
      select: {
        id: true,
        username: true,
        membership_tier: true,
        makeup_chances: true,
        consecutive_days: true,
        last_checkin_date: true,
        points: true
      }
    });

    // 会员等级对应的每月自动补签次数
    const autoMakeupLimits: Record<string, number> = {
      trial: 1,
      monthly: 3,
      quarterly: 5,
      yearly: 10,
      enterprise: -1 // 无限
    };

    for (const user of usersWithChances) {
      const tier = user.membership_tier;
      const maxAutoMakeup = autoMakeupLimits[tier] || 0;

      // 检查本月已使用的自动补签次数
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const usedAutoMakeup = await prisma.checkin_records.count({
        where: {
          user_id: user.id,
          is_makeup: true,
          checkin_date: {
            gte: monthStart,
            lte: monthEnd,
          }
        }
      });

      // 如果已达到上限，跳过
      if (maxAutoMakeup !== -1 && usedAutoMakeup >= maxAutoMakeup) {
        continue;
      }

      // 检查昨天是否签到
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayCheckin = await prisma.checkin_records.findUnique({
        where: {
          user_id_checkin_date: {
            user_id: user.id,
            checkin_date: yesterday,
          }
        }
      });

      // 如果昨天已签到，跳过
      if (yesterdayCheckin) {
        continue;
      }

      // 检查最后签到日期是否是昨天之前
      const lastCheckin = user.last_checkin_date ? new Date(user.last_checkin_date) : null;
      if (lastCheckin && lastCheckin >= yesterday) {
        continue; // 最后签到是昨天或今天，不需要保护
      }

      // 自动补签昨天
      const newConsecutiveDays = (user.consecutive_days || 0) + 1;
      const pointsEarned = Math.floor(10 * (newConsecutiveDays <= 7 ? newConsecutiveDays : 7)); // 简化计算

      await prisma.$transaction(async (tx) => {
        // 创建补签记录
        await tx.checkin_records.create({
          data: {
            user_id: user.id,
            checkin_date: yesterday,
            consecutive_days: newConsecutiveDays,
            points_earned: pointsEarned,
            is_makeup: true,
          }
        });

        // 更新用户信息
        await tx.users.update({
          where: { id: user.id },
          data: {
            makeup_chances: user.makeup_chances - 1,
            consecutive_days: newConsecutiveDays,
            last_checkin_date: today,
            points: user.points + pointsEarned,
          }
        });

        // 记录积分交易
        await tx.point_transactions.create({
          data: {
            user_id: user.id,
            amount: pointsEarned,
            type: 'auto_makeup_checkin',
            description: `自动断签保护补签（${tier}）`,
          }
        });

        // 发送通知
        await tx.notifications.create({
          data: {
            user_id: user.id,
            type: 'auto_makeup',
            title: '🛡️ 断签保护已触发',
            content: `您昨天忘记签到，系统已自动为您补签。本月剩余保护次数：${maxAutoMakeup === -1 ? '无限' : maxAutoMakeup - usedAutoMakeup - 1}`,
            link: '/profile.html',
          }
        });
      });

      console.log(`🛡️ 自动断签保护：${user.username} (${tier})`);
    }

    console.log(`✅ 自动断签保护检查完成，共处理 ${usersWithChances.length} 人`);
  } catch (error) {
    console.error('自动断签保护失败:', error);
  }
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
  await processMonthlyBonus();
  await processAutoCheckinProtection();
  
  // 然后每天执行
  setInterval(async () => {
    console.log('🕐 开始执行会员定时任务...');
    await checkExpiringMemberships();
    await processExpiredMemberships();
    await processExpiredOrders();
    await processMonthlyBonus();
    await processAutoCheckinProtection();
  }, CHECK_INTERVAL);
}

// 启动 Worker
runMembershipWorker().catch(console.error);

export { checkExpiringMemberships, processExpiredMemberships };