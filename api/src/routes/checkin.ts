import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { JWT_SECRET } from '../utils/auth';
import { authenticateToken, safeParseLimit } from '../utils/middleware';
import { getMembershipTier } from '../utils/membership';

const router = Router();

// 将 Date 格式化为本地日期字符串 "YYYY-MM-DD"，避免 toISOString() 的 UTC 偏移问题
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// authenticateToken 统一从 ../utils/middleware 导入（含 active_token 单端互踢校验）

// 计算签到奖励积分
function calculateCheckinReward(consecutiveDays: number): number {
  // 基础奖励
  const baseReward = 10;
  
  // 连续签到奖励递增
  if (consecutiveDays <= 7) {
    return baseReward + (consecutiveDays - 1) * 2; // 10, 12, 14, 16, 18, 20, 22
  } else if (consecutiveDays <= 30) {
    return baseReward + 12 + Math.floor((consecutiveDays - 7) / 7) * 5; // 每周递增5
  } else {
    return baseReward + 12 + 15 + Math.floor((consecutiveDays - 30) / 30) * 10; // 每月递增10
  }
}

// 检查是否可以签到
function canCheckin(lastCheckinDate: Date | null): { canCheckin: boolean; reason?: string; isMissed?: boolean } {
  if (!lastCheckinDate) {
    return { canCheckin: true };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCheckin = new Date(lastCheckinDate.getFullYear(), lastCheckinDate.getMonth(), lastCheckinDate.getDate());
  
  const diffTime = today.getTime() - lastCheckin.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { canCheckin: false, reason: '今天已经签到过了' };
  } else if (diffDays === 1) {
    return { canCheckin: true };
  } else {
    return { canCheckin: true, isMissed: true };
  }
}

// 每日签到
router.post('/daily', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        consecutive_days: true,
        last_checkin_date: true,
        points: true,
        makeup_chances: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查是否可以签到
    const checkinStatus = canCheckin(user.last_checkin_date);
    
    if (!checkinStatus.canCheckin) {
      return res.status(400).json({ error: checkinStatus.reason });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 计算新的连续天数
    let newConsecutiveDays = 1;
    if (user.last_checkin_date && !checkinStatus.isMissed) {
      newConsecutiveDays = user.consecutive_days + 1;
    }

    // 计算奖励积分（基础奖励）
    const basePoints = calculateCheckinReward(newConsecutiveDays);

    // 根据会员档位应用积分倍数
    const membership = await getMembershipTier(userId);
    let pointsMultiplier = 1;
    if (membership.tier === 'trial' || membership.tier === 'monthly') {
      pointsMultiplier = 2; // 体验/月度会员双倍积分
    } else if (membership.tier === 'quarterly' || membership.tier === 'yearly') {
      pointsMultiplier = 3; // 季度/年度会员三倍积分
    }
    const pointsEarned = Math.floor(basePoints * pointsMultiplier);

    // 使用事务处理签到
    const result = await prisma.$transaction(async (tx) => {
      // 更新用户信息
      const updatedUser = await tx.users.update({
        where: { id: userId },
        data: {
          consecutive_days: newConsecutiveDays,
          last_checkin_date: now,
          points: user.points + pointsEarned,
        }
      });

      // 创建签到记录
      const checkinRecord = await tx.checkin_records.create({
        data: {
          user_id: userId,
          checkin_date: today,
          consecutive_days: newConsecutiveDays,
          points_earned: pointsEarned,
          is_makeup: false,
        }
      });

      // 记录积分交易
      await tx.point_transactions.create({
        data: {
          user_id: userId,
          amount: pointsEarned,
          type: 'checkin',
          description: `每日签到奖励（连续${newConsecutiveDays}天）`,
        }
      });

      // 连续签到里程碑奖励
      let bonusPoints = 0;
      let milestoneMessage = '';
      
      if (newConsecutiveDays === 7) {
        bonusPoints = 50;
        milestoneMessage = '连续签到7天';
      } else if (newConsecutiveDays === 30) {
        bonusPoints = 200;
        milestoneMessage = '连续签到30天';
      } else if (newConsecutiveDays === 100) {
        bonusPoints = 1000;
        milestoneMessage = '连续签到100天';
      } else if (newConsecutiveDays === 365) {
        bonusPoints = 5000;
        milestoneMessage = '连续签到365天';
      }

      if (bonusPoints > 0) {
        await tx.users.update({
          where: { id: userId },
          data: {
            points: updatedUser.points + bonusPoints,
          }
        });

        await tx.point_transactions.create({
          data: {
            user_id: userId,
            amount: bonusPoints,
            type: 'checkin_milestone',
            description: `${milestoneMessage}里程碑奖励`,
          }
        });

        // 发送通知
        await tx.notifications.create({
          data: {
            user_id: userId,
            type: 'checkin_milestone',
            title: '🎉 签到里程碑达成！',
            content: `恭喜你达成${milestoneMessage}！获得 ${bonusPoints} 积分奖励！`,
            link: '/profile',
          }
        });
      }

      // 连续签到奖励补签机会
      let bonusMakeupChances = 0;
      if (newConsecutiveDays % 7 === 0 && newConsecutiveDays > 0) {
        bonusMakeupChances = 1;
        await tx.users.update({
          where: { id: userId },
          data: {
            makeup_chances: user.makeup_chances + 1,
          }
        });

        await tx.notifications.create({
          data: {
            user_id: userId,
            type: 'makeup_chance',
            title: '🎁 获得补签机会',
            content: `连续签到${newConsecutiveDays}天，获得1次补签机会！`,
            link: '/profile',
          }
        });
      }

      return {
        checkinRecord,
        pointsEarned,
        bonusPoints,
        bonusMakeupChances,
        consecutiveDays: newConsecutiveDays,
        totalPoints: updatedUser.points + bonusPoints,
        milestoneMessage,
      };
    });

    res.json({
      success: true,
      message: checkinStatus.isMissed 
        ? '签到成功！连续签到已中断，重新开始计算'
        : '签到成功！',
      data: result,
    });

  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json({ error: '签到失败，请稍后重试' });
  }
});

// 补签接口已删除，改为自动断签保护系统
// 自动断签保护：会员用户忘记签到时，系统自动使用补签机会保护连续记录
// 详见 membershipWorker.ts 中的 processAutoCheckinProtection 函数

// 获取签到状态
router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        consecutive_days: true,
        last_checkin_date: true,
        makeup_chances: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const checkinStatus = canCheckin(user.last_checkin_date);
    const nextReward = calculateCheckinReward(user.consecutive_days + 1);

    res.json({
      consecutiveDays: user.consecutive_days,
      lastCheckinDate: user.last_checkin_date,
      makeupChances: user.makeup_chances,
      canCheckin: checkinStatus.canCheckin,
      isMissed: checkinStatus.isMissed || false,
      nextReward,
      reason: checkinStatus.reason,
    });

  } catch (error) {
    console.error('获取签到状态失败:', error);
    res.status(500).json({ error: '获取签到状态失败' });
  }
});

// 获取签到历史
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { year, month } = req.query;

    // 默认当前年月
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const records = await prisma.checkin_records.findMany({
      where: {
        user_id: userId,
        checkin_date: {
          gte: startDate,
          lte: endDate,
        }
      },
      orderBy: {
        checkin_date: 'asc',
      }
    });

    // 计算统计信息
    const totalCheckins = await prisma.checkin_records.count({
      where: { user_id: userId }
    });

    const totalPoints = await prisma.checkin_records.aggregate({
      where: { user_id: userId },
      _sum: { points_earned: true }
    });

    const makeupCount = await prisma.checkin_records.count({
      where: {
        user_id: userId,
        is_makeup: true,
      }
    });

    res.json({
      year: targetYear,
      month: targetMonth,
      records,
      stats: {
        totalCheckins,
        totalPoints: totalPoints._sum.points_earned || 0,
        makeupCount,
      }
    });

  } catch (error) {
    console.error('获取签到历史失败:', error);
    res.status(500).json({ error: '获取签到历史失败' });
  }
});

// 获取签到排行榜
router.get('/leaderboard', async (req, res) => {
  try {
    // 上限 100，防止超大 limit 拖垮数据库
    const limit = safeParseLimit(req, 50, 100);

    const users = await prisma.users.findMany({
      where: {
        consecutive_days: {
          gt: 0,
        }
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        consecutive_days: true,
        last_checkin_date: true,
      },
      orderBy: {
        consecutive_days: 'desc',
      },
      take: limit,
    });

    res.json({
      leaderboard: users.map((user, index) => ({
        rank: index + 1,
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        consecutiveDays: user.consecutive_days,
        lastCheckinDate: user.last_checkin_date,
      }))
    });

  } catch (error) {
    console.error('获取签到排行榜失败:', error);
    res.status(500).json({ error: '获取签到排行榜失败' });
  }
});

export default router;