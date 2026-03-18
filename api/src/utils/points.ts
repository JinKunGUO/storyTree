import { prisma } from '../index';
import { notifyLevelUp, notifyPointsEarned } from './notification';

/**
 * 用户等级配置
 * 
 * 配额设计原则：
 * - Lv4 作为会员配额计算的基准（会员配额 = Lv4配额 × 会员倍数）
 * - 等级之间有明显的递进关系
 * - 插图成本高，配额相对保守
 * - 润色成本低，高等级可以较多使用
 */
export const LEVEL_CONFIG = {
  1: {
    name: '新手作者',
    minPoints: 0,
    maxPoints: 99,
    quotas: {
      continuation: 5,   // 每月AI续写次数
      polish: 10,        // 每月AI润色次数
      illustration: 2    // 每月AI插图张数
    }
  },
  2: {
    name: '活跃作者',
    minPoints: 100,
    maxPoints: 499,
    quotas: {
      continuation: 15,
      polish: 30,
      illustration: 5
    }
  },
  3: {
    name: '专业作者',
    minPoints: 500,
    maxPoints: 1999,
    quotas: {
      continuation: 30,
      polish: 60,
      illustration: 10
    }
  },
  4: {
    name: '大师作者',
    minPoints: 2000,
    maxPoints: Infinity,
    quotas: {
      continuation: 50,   // 作为会员配额的基准值
      polish: 100,        // 作为会员配额的基准值
      illustration: 20    // 作为会员配额的基准值
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
 * 其他积分消耗规则
 */
export const POINTS_COST = {
  STORY_PIN_PER_DAY: 50,        // 故事置顶（每天）
  COMMENT_PIN: 10,              // 置顶评论（每条）
  TIP_MIN: 5,                   // 打赏最低金额
  TIP_MAX: 10000                // 打赏最高金额（单次）
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
    select: { points: true, isAdmin: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 管理员用户不扣除积分
  if (user.isAdmin) {
    console.log(`🔑 管理员用户 ${userId} 使用AI功能，不扣除积分`);
    return { newPoints: user.points, success: true };
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
 * 获取用户本月 AI 使用配额
 */
export async function getUserMonthlyQuota(userId: number): Promise<{
  continuation: { used: number; limit: number; unlimited: boolean };
  polish: { used: number; limit: number; unlimited: boolean };
  illustration: { used: number; limit: number; unlimited: boolean };
}> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { points: true, subscription_type: true, subscription_expires: true, isAdmin: true, membership_tier: true, membership_expires_at: true }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 管理员用户拥有无限配额
  if (user.isAdmin) {
    return {
      continuation: { used: 0, limit: -1, unlimited: true },
      polish: { used: 0, limit: -1, unlimited: true },
      illustration: { used: 0, limit: -1, unlimited: true }
    };
  }

  // 使用会员系统获取配额（新方式）
  if (user.membership_tier && user.membership_tier !== 'free') {
    const { getMembershipQuota } = await import('./membership');
    try {
      const membershipQuota = await getMembershipQuota(userId);
      // 确保返回正确的格式
      return {
        continuation: {
          used: membershipQuota.continuation.used,
          limit: membershipQuota.continuation.limit,
          unlimited: membershipQuota.continuation.unlimited
        },
        polish: {
          used: membershipQuota.polish.used,
          limit: membershipQuota.polish.limit,
          unlimited: membershipQuota.polish.unlimited
        },
        illustration: {
          used: membershipQuota.illustration.used,
          limit: membershipQuota.illustration.limit,
          unlimited: membershipQuota.illustration.unlimited
        }
      };
    } catch (error) {
      console.error('获取会员配额失败:', error);
      // 降级到旧逻辑
    }
  }

  // 旧逻辑：如果有有效订阅，使用订阅配额（向后兼容）
  if (user.subscription_type && user.subscription_expires && user.subscription_expires > new Date()) {
    if (user.subscription_type === 'monthly') {
      return {
        continuation: { used: 0, limit: LEVEL_CONFIG[3].quotas.continuation, unlimited: false },
        polish: { used: 0, limit: LEVEL_CONFIG[3].quotas.polish, unlimited: true },
        illustration: { used: 0, limit: LEVEL_CONFIG[3].quotas.illustration, unlimited: false }
      };
    } else if (user.subscription_type === 'yearly') {
      return {
        continuation: { used: 0, limit: LEVEL_CONFIG[4].quotas.continuation, unlimited: true },
        polish: { used: 0, limit: LEVEL_CONFIG[4].quotas.polish, unlimited: true },
        illustration: { used: 0, limit: LEVEL_CONFIG[4].quotas.illustration, unlimited: true }
      };
    }
  }

  // 获取用户等级配额
  const levelInfo = getUserLevel(user.points);
  let quotas = levelInfo.quotas;

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
 * 检查用户是否可以使用AI功能（配额+积分混合模式）
 * 
 * 规则：
 * 1. 如果配额充足，直接使用配额（免费）
 * 2. 如果配额用完，检查积分是否足够
 * 3. 如果积分也不够，返回错误
 * 
 * @returns { allowed: boolean, usePoints: boolean, pointsCost: number, reason?: string }
 */
export async function canUseAiFeature(
  userId: number,
  featureType: 'continuation' | 'polish' | 'illustration'
): Promise<{ 
  allowed: boolean; 
  usePoints: boolean;  // 是否需要使用积分
  pointsCost: number;  // 需要消耗的积分数
  quotaRemaining: number; // 剩余配额
  reason?: string 
}> {
  const quota = await getUserMonthlyQuota(userId);
  const feature = quota[featureType];
  const cost = AI_COST[featureType.toUpperCase() as keyof typeof AI_COST];

  // 如果是无限配额，直接允许（不消耗积分）
  if (feature.unlimited) {
    return { 
      allowed: true, 
      usePoints: false, 
      pointsCost: 0,
      quotaRemaining: -1 // -1表示无限
    };
  }

  const remaining = feature.limit - feature.used;

  // 情况1：配额充足，使用配额（免费）
  if (remaining > 0) {
    return { 
      allowed: true, 
      usePoints: false, 
      pointsCost: 0,
      quotaRemaining: remaining
    };
  }

  // 情况2：配额用完，检查积分
  const hasPoints = await hasEnoughPoints(userId, cost);
  
  if (hasPoints) {
    // 积分足够，允许使用（消耗积分）
    return { 
      allowed: true, 
      usePoints: true, 
      pointsCost: cost,
      quotaRemaining: 0
    };
  }

  // 情况3：配额和积分都不够
  const featureName = featureType === 'continuation' ? 'AI续写' : 
                      featureType === 'polish' ? 'AI润色' : 'AI插图';
  
  return {
    allowed: false,
    usePoints: false,
    pointsCost: 0,
    quotaRemaining: 0,
    reason: `本月${featureName}配额已用完（${feature.used}/${feature.limit}），且积分不足（需要${cost}积分）`
  };
}