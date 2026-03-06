import { prisma } from '../index';
import { notifyLevelUp, notifyPointsEarned } from './notification';

/**
 * 用户等级配置
 */
export const LEVEL_CONFIG = {
  1: {
    name: '新手作者',
    minPoints: 0,
    maxPoints: 99,
    quotas: {
      continuation: 3,  // 每月AI续写次数
      polish: 5,        // 每月AI润色次数
      illustration: 2   // 每月AI插图张数
    }
  },
  2: {
    name: '活跃作者',
    minPoints: 100,
    maxPoints: 499,
    quotas: {
      continuation: 10,
      polish: 20,
      illustration: 2
    }
  },
  3: {
    name: '专业作者',
    minPoints: 500,
    maxPoints: 1999,
    quotas: {
      continuation: 30,
      polish: -1,  // -1表示无限制
      illustration: 10
    }
  },
  4: {
    name: '大师作者',
    minPoints: 2000,
    maxPoints: Infinity,
    quotas: {
      continuation: -1,
      polish: -1,
      illustration: 50
    }
  }
};

/**
 * 积分获取规则
 */
export const POINT_RULES = {
  PUBLISH_STORY: { points: 20, description: '发布故事' },
  GET_BOOKMARK: { points: 5, description: '获得收藏' },
  GET_COMMENT: { points: 2, description: '获得评论' },
  DAILY_LOGIN: { points: 1, description: '每日登录' },
  COMPLETE_PROFILE: { points: 10, description: '完善个人资料' },
  FIRST_STORY: { points: 50, description: '发布首个故事' },
  STORY_READ_100: { points: 15, description: '故事阅读量达100' },
  STORY_READ_1000: { points: 100, description: '故事阅读量达1000' }
};

/**
 * AI功能消耗规则
 */
export const AI_COST = {
  CONTINUATION: 10,      // AI续写
  POLISH: 3,            // AI润色
  ILLUSTRATION: 20,     // AI插图
  RUSH: 5              // 加急处理
};

/**
 * 获取用户等级信息
 */
export function getUserLevel(points: number): {
  level: number;
  name: string;
  quotas: any;
  progress: number;
  nextLevelPoints: number;
} {
  let level = 1;
  for (const [lv, config] of Object.entries(LEVEL_CONFIG)) {
    const lvNum = parseInt(lv);
    if (points >= config.minPoints && points <= config.maxPoints) {
      level = lvNum;
      break;
    }
  }

  const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
  const nextLevel = level + 1;
  const nextConfig = LEVEL_CONFIG[nextLevel as keyof typeof LEVEL_CONFIG];
  
  let progress = 0;
  let nextLevelPoints = 0;
  
  if (nextConfig) {
    const currentLevelRange = config.maxPoints - config.minPoints + 1;
    const currentProgress = points - config.minPoints;
    progress = (currentProgress / currentLevelRange) * 100;
    nextLevelPoints = nextConfig.minPoints - points;
  } else {
    progress = 100; // 已达最高等级
  }

  return {
    level,
    name: config.name,
    quotas: config.quotas,
    progress: Math.min(progress, 100),
    nextLevelPoints: Math.max(nextLevelPoints, 0)
  };
}

/**
 * 增加用户积分
 */
export async function addPoints(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceId?: number
): Promise<{ newPoints: number; levelUp: boolean; newLevel?: number }> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { points: true, level: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  const oldLevel = user.level;
  const newPoints = user.points + amount;
  const levelInfo = getUserLevel(newPoints);

  // 更新用户积分和等级
  await prisma.users.update({
    where: { id: userId },
    data: {
      points: newPoints,
      level: levelInfo.level
    }
  });

  // 记录积分交易
  await prisma.point_transactions.create({
    data: {
      user_id: userId,
      amount,
      type,
      description,
      reference_id: referenceId
    }
  });

  // 发送通知
  if (amount > 0) {
    await notifyPointsEarned(userId, amount, description);
  }

  // 检查是否升级
  const levelUp = levelInfo.level > oldLevel;
  if (levelUp) {
    await notifyLevelUp(userId, levelInfo.level, levelInfo.name);
  }

  return {
    newPoints,
    levelUp,
    newLevel: levelUp ? levelInfo.level : undefined
  };
}

/**
 * 扣除用户积分
 */
export async function deductPoints(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceId?: number
): Promise<{ newPoints: number; success: boolean }> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { points: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  if (user.points < amount) {
    return { newPoints: user.points, success: false };
  }

  const newPoints = user.points - amount;
  const levelInfo = getUserLevel(newPoints);

  await prisma.users.update({
    where: { id: userId },
    data: {
      points: newPoints,
      level: levelInfo.level
    }
  });

  await prisma.point_transactions.create({
    data: {
      user_id: userId,
      amount: -amount,
      type,
      description,
      reference_id: referenceId
    }
  });

  return { newPoints, success: true };
}

/**
 * 检查用户是否有足够积分
 */
export async function hasEnoughPoints(userId: number, amount: number): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { points: true }
  });

  return user ? user.points >= amount : false;
}

/**
 * 获取用户本月AI使用配额
 */
export async function getUserMonthlyQuota(userId: number): Promise<{
  continuation: { used: number; limit: number; unlimited: boolean };
  polish: { used: number; limit: number; unlimited: boolean };
  illustration: { used: number; limit: number; unlimited: boolean };
}> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { points: true, subscription_type: true, subscription_expires: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 获取用户等级配额
  const levelInfo = getUserLevel(user.points);
  let quotas = levelInfo.quotas;

  // 如果有有效订阅，使用订阅配额
  if (user.subscription_type && user.subscription_expires && user.subscription_expires > new Date()) {
    if (user.subscription_type === 'monthly') {
      quotas = LEVEL_CONFIG[3].quotas; // 月度会员相当于Lv3
    } else if (user.subscription_type === 'yearly') {
      quotas = LEVEL_CONFIG[4].quotas; // 年度会员相当于Lv4
    }
  }

  // 获取本月使用量
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyUsage = await prisma.ai_tasks.groupBy({
    by: ['task_type'],
    where: {
      user_id: userId,
      created_at: { gte: firstDayOfMonth },
      status: { in: ['completed', 'processing'] }
    },
    _count: true
  });

  const usageMap: Record<string, number> = {};
  monthlyUsage.forEach(item => {
    usageMap[item.task_type] = item._count;
  });

  return {
    continuation: {
      used: usageMap['continuation'] || 0,
      limit: quotas.continuation,
      unlimited: quotas.continuation === -1
    },
    polish: {
      used: usageMap['polish'] || 0,
      limit: quotas.polish,
      unlimited: quotas.polish === -1
    },
    illustration: {
      used: usageMap['illustration'] || 0,
      limit: quotas.illustration,
      unlimited: quotas.illustration === -1
    }
  };
}

/**
 * 检查用户是否可以使用AI功能
 */
export async function canUseAiFeature(
  userId: number,
  featureType: 'continuation' | 'polish' | 'illustration'
): Promise<{ allowed: boolean; reason?: string }> {
  const quota = await getUserMonthlyQuota(userId);
  const feature = quota[featureType];

  // 如果是无限制，直接允许
  if (feature.unlimited) {
    return { allowed: true };
  }

  // 检查配额
  if (feature.used >= feature.limit) {
    return {
      allowed: false,
      reason: `本月${featureType === 'continuation' ? 'AI续写' : featureType === 'polish' ? 'AI润色' : 'AI插图'}次数已用完（${feature.used}/${feature.limit}）`
    };
  }

  // 检查积分（如果配额用完，可以用积分）
  const cost = AI_COST[featureType.toUpperCase() as keyof typeof AI_COST];
  const hasPoints = await hasEnoughPoints(userId, cost);

  if (!hasPoints && feature.used >= feature.limit) {
    return {
      allowed: false,
      reason: `积分不足，需要 ${cost} 积分`
    };
  }

  return { allowed: true };
}

