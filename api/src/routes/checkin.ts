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

    // 计算奖励积分
    const pointsEarned = calculateCheckinReward(newConsecutiveDays);

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

// 补签
router.post('/makeup', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { date } = req.body; // 补签日期 YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: '请提供补签日期' });
    }

    const makeupDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    makeupDate.setHours(0, 0, 0, 0);

    // 验证补签日期
    if (makeupDate >= today) {
      return res.status(400).json({ error: '不能补签今天或未来的日期' });
    }

    const diffTime = today.getTime() - makeupDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      return res.status(400).json({ error: '只能补签最近 7 天内的日期' });
    }

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

    if (user.makeup_chances <= 0) {
      return res.status(400).json({ error: '补签机会不足' });
    }

    // 检查是否已经签到过
    const existingCheckin = await prisma.checkin_records.findUnique({
      where: {
        user_id_checkin_date: {
          user_id: userId,
          checkin_date: makeupDate,
        }
      }
    });

    if (existingCheckin) {
      return res.status(400).json({ error: '该日期已经签到过了' });
    }

    // 【核心修复】重新计算补签后的连续天数
    // 从补签日期开始，倒推检查到今天的所有日期是否都已签到
    const checkinRecords = await prisma.checkin_records.findMany({
      where: {
        user_id: userId,
        checkin_date: {
          gte: makeupDate,
          lte: today,
        }
      },
      select: {
        checkin_date: true,
      }
    });

    // 构建已签到日期集合
    const checkinDates = new Set(checkinRecords.map(r => {
      const d = new Date(r.checkin_date);
      return d.toISOString().split('T')[0];
    }));

    // 添加本次补签日期
    const makeupDateStr = makeupDate.toISOString().split('T')[0];
    checkinDates.add(makeupDateStr);

    // 从今天开始倒推，计算连续天数
    let newConsecutiveDays = 0;
    let currentDate = new Date(today);
    
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (checkinDates.has(dateStr)) {
        newConsecutiveDays++;
        // 倒推一天
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // 遇到未签到的日期，中断
        break;
      }
    }

    // 计算补签的奖励积分（基于补签时的连续天数）
    const pointsEarned = calculateCheckinReward(newConsecutiveDays);

    // 使用事务处理补签
    const result = await prisma.$transaction(async (tx) => {
      // 创建补签记录
      const checkinRecord = await tx.checkin_records.create({
        data: {
          user_id: userId,
          checkin_date: makeupDate,
          consecutive_days: newConsecutiveDays,
          points_earned: pointsEarned,
          is_makeup: true,
        }
      });

      // 更新用户信息
      await tx.users.update({
        where: { id: userId },
        data: {
          makeup_chances: user.makeup_chances - 1,
          consecutive_days: newConsecutiveDays, // ✅ 更新连续天数
          last_checkin_date: today, // ✅ 更新最后签到日期
          points: user.points + pointsEarned,
        }
      });

      // 记录积分交易
      await tx.point_transactions.create({
        data: {
          user_id: userId,
          amount: pointsEarned,
          type: 'makeup_checkin',
          description: `补签${makeupDate.toLocaleDateString('zh-CN')}`,
        }
      });

      // 【新增】检查里程碑奖励（补签也可能触发）
      let bonusPoints = 0;
      let milestoneMessage = '';
      
      if (newConsecutiveDays === 7) {
        bonusPoints = 50;
        milestoneMessage = '连续签到 7 天';
      } else if (newConsecutiveDays === 30) {
        bonusPoints = 200;
        milestoneMessage = '连续签到 30 天';
      } else if (newConsecutiveDays === 100) {
        bonusPoints = 1000;
        milestoneMessage = '连续签到 100 天';
      } else if (newConsecutiveDays === 365) {
        bonusPoints = 5000;
        milestoneMessage = '连续签到 365 天';
      }

      if (bonusPoints > 0) {
        await tx.users.update({
          where: { id: userId },
          data: {
            points: user.points + pointsEarned + bonusPoints,
          }
        });

        await tx.point_transactions.create({
          data: {
            user_id: userId,
            amount: bonusPoints,
            type: 'checkin_milestone',
            description: `${milestoneMessage}里程碑奖励（补签触发）`,
          }
        });

        // 发送通知
        await tx.notifications.create({
          data: {
            user_id: userId,
            type: 'checkin_milestone',
            title: '🎉 签到里程碑达成！',
            content: `恭喜你通过补签达成${milestoneMessage}！获得 ${bonusPoints} 积分奖励！`,
            link: '/profile',
          }
        });
      }

      return {
        checkinRecord,
        pointsEarned,
        bonusPoints,
        milestoneMessage,
        remainingMakeupChances: user.makeup_chances - 1,
        newConsecutiveDays,
      };
    });

    res.json({
      success: true,
      message: '补签成功！' + (result.bonusPoints > 0 ? ` 🎉 达成${result.milestoneMessage}里程碑！` : ''),
      data: result,
    });

  } catch (error) {
    console.error('补签失败:', error);
    res.status(500).json({ error: '补签失败，请稍后重试' });
  }
});

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
    const { limit = 50 } = req.query;

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
      take: parseInt(limit as string),
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