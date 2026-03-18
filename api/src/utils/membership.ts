import { prisma } from '../index';
import { LEVEL_CONFIG, getUserLevel } from './points';

/**
 * 会员等级配置
 */
export const MEMBERSHIP_TIERS = {
  free: {
    name: '免费用户',
    price: 0,
    duration: 0, // 天
    quotaMultiplier: 1, // 配额倍数
    benefits: ['基础功能']
  },
  trial: {
    name: '体验会员',
    price: 9.9,
    duration: 7, // 天
    quotaMultiplier: 1.2, // Lv3 配额 + 20%
    benefits: [
      '会员徽章 (铜色)',
      'AI 响应速度优先',
      '去除广告'
    ]
  },
  monthly: {
    name: '月度会员',
    price: 39,
    duration: 30,
    quotaMultiplier: 1.5, // Lv4 配额 + 50%
    benefits: [
      '会员徽章 (银色)',
      'AI 模型选择',
      '高级编辑器功能',
      '批量操作功能',
      '优先客服支持'
    ]
  },
  quarterly: {
    name: '季度会员',
    price: 99,
    duration: 90,
    quotaMultiplier: 1.8, // Lv4 配额 + 80%
    benefits: [
      '月度会员全部特权',
      '导出功能 (PDF/EPUB/DOCX)',
      '数据分析报表',
      '粉丝画像分析'
    ]
  },
  yearly: {
    name: '年度会员',
    price: 388,
    duration: 365,
    quotaMultiplier: -1, // 无限
    benefits: [
      '季度会员全部特权',
      '会员徽章 (金色)',
      '版本历史功能',
      '敏感词审核优先通过',
      '专属客服通道',
      '每月赠送 500 积分'
    ]
  },
  enterprise: {
    name: '企业版/创作团队版',
    price: 999,
    duration: 365,
    quotaMultiplier: -1, // 无限
    maxAccounts: 5,
    benefits: [
      '年度会员全部特权',
      '会员徽章 (钻石)',
      '团队协作增强功能',
      '多账号管理面板',
      '品牌定制选项',
      '优先功能体验资格',
      '专属客服经理'
    ]
  }
};

/**
 * 获取用户的会员等级
 */
export async function getMembershipTier(userId: number): Promise<{
  tier: string;
  name: string;
  expiresAt: Date | null;
  isActive: boolean;
}> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      membership_tier: true,
      membership_expires_at: true,
      isAdmin: true
    }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 管理员用户视为企业版会员
  if (user.isAdmin) {
    return {
      tier: 'enterprise',
      name: MEMBERSHIP_TIERS.enterprise.name,
      expiresAt: null,
      isActive: true
    };
  }

  const tier = user.membership_tier || 'free';
  const expiresAt = user.membership_expires_at;
  const isActive = expiresAt ? new Date(expiresAt) > new Date() : false;

  return {
    tier,
    name: MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS]?.name || '免费用户',
    expiresAt,
    isActive
  };
}

/**
 * 检查会员功能权限
 */
export async function checkMembershipFeature(
  userId: number,
  feature: string
): Promise<{ allowed: boolean; reason?: string }> {
  const membership = await getMembershipTier(userId);

  // 免费用户的基础功能检查
  if (membership.tier === 'free') {
    const basicFeatures = ['basic_editor', 'basic_ai', 'comment', 'bookmark'];
    if (basicFeatures.includes(feature)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: '此功能需要成为会员'
    };
  }

  // 会员功能检查
  const tierBenefits = MEMBERSHIP_TIERS[membership.tier as keyof typeof MEMBERSHIP_TIERS]?.benefits || [];
  
  // 将功能映射到权益
  const featureMap: Record<string, string> = {
    'advanced_editor': '高级编辑器功能',
    'batch_operations': '批量操作功能',
    'export_pdf': '导出功能 (PDF/EPUB/DOCX)',
    'export_epub': '导出功能 (PDF/EPUB/DOCX)',
    'export_docx': '导出功能 (PDF/EPUB/DOCX)',
    'analytics': '数据分析报表',
    'fan_analytics': '粉丝画像分析',
    'version_history': '版本历史功能',
    'priority_support': '优先客服支持',
    'ai_model_selection': 'AI 模型选择'
  };

  const requiredBenefit = featureMap[feature];
  if (!requiredBenefit) {
    // 未知功能，默认允许
    return { allowed: true };
  }

  // 检查会员等级是否有此权益
  const hasBenefit = tierBenefits.some(benefit => 
    benefit.includes(requiredBenefit) || 
    (membership.tier !== 'free' && benefit.includes('全部特权'))
  );

  if (hasBenefit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `此功能需要更高等级的会员`
  };
}

/**
 * 获取会员配额（结合用户等级和会员等级）
 */
export async function getMembershipQuota(userId: number): Promise<{
  continuation: { used: number; limit: number; unlimited: boolean };
  polish: { used: number; limit: number; unlimited: boolean };
  illustration: { used: number; limit: number; unlimited: boolean };
}> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      points: true,
      membership_tier: true,
      membership_expires_at: true,
      isAdmin: true
    }
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

  // 获取用户等级配额（Lv4 作为基础）
  const levelInfo = getUserLevel(user.points);
  let baseQuotas = LEVEL_CONFIG[4].quotas; // 默认使用 Lv4 配额作为基础

  // 检查会员状态
  const membership = await getMembershipTier(userId);
  
  if (membership.isActive && membership.tier !== 'free') {
    const tierConfig = MEMBERSHIP_TIERS[membership.tier as keyof typeof MEMBERSHIP_TIERS];
    const multiplier = tierConfig.quotaMultiplier;

    // 如果是无限配额
    if (multiplier === -1) {
      return {
        continuation: { used: 0, limit: -1, unlimited: true },
        polish: { used: 0, limit: -1, unlimited: true },
        illustration: { used: 0, limit: -1, unlimited: true }
      };
    }

    // 计算会员配额（Lv4 基础配额 * 会员倍数）
    baseQuotas = {
      continuation: Math.floor(LEVEL_CONFIG[4].quotas.continuation * multiplier),
      polish: LEVEL_CONFIG[4].quotas.polish, // 润色保持无限
      illustration: Math.floor(LEVEL_CONFIG[4].quotas.illustration * multiplier)
    };
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
      limit: baseQuotas.continuation,
      unlimited: baseQuotas.continuation === -1
    },
    polish: {
      used: usageMap['polish'] || 0,
      limit: baseQuotas.polish,
      unlimited: baseQuotas.polish === -1
    },
    illustration: {
      used: usageMap['illustration'] || 0,
      limit: baseQuotas.illustration,
      unlimited: baseQuotas.illustration === -1
    }
  };
}

/**
 * 获取会员权益列表
 */
export function getMembershipBenefits(tier?: string): Array<{
  tier: string;
  name: string;
  price: number;
  benefits: string[];
  quotaDescription: string;
}> {
  const tiers = tier ? [tier] : Object.keys(MEMBERSHIP_TIERS);
  
  return tiers.map(tierKey => {
    const tierConfig = MEMBERSHIP_TIERS[tierKey as keyof typeof MEMBERSHIP_TIERS];
    let quotaDescription = '';
    
    if (tierKey === 'free') {
      quotaDescription = '按用户等级 (Lv1-Lv4) 分配配额';
    } else if (tierConfig.quotaMultiplier === -1) {
      quotaDescription = '全部无限';
    } else {
      const baseQuota = LEVEL_CONFIG[4].quotas;
      quotaDescription = `Lv4 配额 × ${tierConfig.quotaMultiplier} 倍`;
      quotaDescription += `\n续写：${Math.floor(baseQuota.continuation * tierConfig.quotaMultiplier)} 次/月`;
      quotaDescription += `\n润色：无限`;
      quotaDescription += `\n插图：${Math.floor(baseQuota.illustration * tierConfig.quotaMultiplier)} 张/月`;
    }
    
    return {
      tier: tierKey,
      name: tierConfig.name,
      price: tierConfig.price,
      benefits: tierConfig.benefits,
      quotaDescription
    };
  });
}

/**
 * 升级会员
 */
export async function upgradeMembership(
  userId: number,
  tier: string,
  orderId: string,
  paidPrice: number,
  originalPrice: number,
  discountCode?: string
): Promise<{ success: boolean; expiresAt?: Date }> {
  const tierConfig = MEMBERSHIP_TIERS[tier as keyof typeof MEMBERSHIP_TIERS];
  
  if (!tierConfig) {
    throw new Error('无效的会员等级');
  }

  if (tier === 'trial') {
    // 检查是否已使用过体验会员
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { has_used_trial: true }
    });

    if (user?.has_used_trial) {
      throw new Error('体验会员仅限使用一次');
    }
  }

  // 计算过期时间
  const now = new Date();
  const expiresAt = new Date(now.getTime() + tierConfig.duration * 24 * 60 * 60 * 1000);

  // 开启事务
  await prisma.$transaction(async (tx) => {
    // 创建订阅记录
    await tx.user_subscriptions.create({
      data: {
        user_id: userId,
        tier,
        status: 'active',
        started_at: now,
        expires_at: expiresAt,
        auto_renew: false,
        order_id: orderId,
        original_price: originalPrice,
        paid_price: paidPrice,
        discount_code: discountCode
      }
    });

    // 更新用户会员状态
    await tx.users.update({
      where: { id: userId },
      data: {
        membership_tier: tier,
        membership_started_at: now,
        membership_expires_at: expiresAt,
        has_used_trial: tier === 'trial' ? true : undefined
      }
    });

    // 如果是年度会员，赠送积分
    if (tier === 'yearly') {
      await tx.point_transactions.create({
        data: {
          user_id: userId,
          amount: 500,
          type: 'membership_bonus',
          description: '年度会员赠送积分'
        }
      });

      await tx.users.update({
        where: { id: userId },
        data: {
          points: { increment: 500 }
        }
      });
    }
  });

  return { success: true, expiresAt };
}

/**
 * 取消自动续费
 */
export async function cancelAutoRenew(userId: number): Promise<{ success: boolean }> {
  await prisma.users.update({
    where: { id: userId },
    data: {
      membership_auto_renew: false
    }
  });

  return { success: true };
}

/**
 * 检查会员是否有效
 */
export async function isValidMembership(userId: number, tier?: string): Promise<boolean> {
  const membership = await getMembershipTier(userId);
  
  if (!membership.isActive) {
    return false;
  }

  if (tier && membership.tier !== tier) {
    // 检查是否更高等级
    const tierOrder = ['free', 'trial', 'monthly', 'quarterly', 'yearly', 'enterprise'];
    const currentIndex = tierOrder.indexOf(membership.tier);
    const requiredIndex = tierOrder.indexOf(tier);
    
    return currentIndex >= requiredIndex;
  }

  return true;
}

/**
 * 记录会员权益使用
 */
export async function logMembershipBenefit(
  userId: number,
  benefitType: string
): Promise<void> {
  const membership = await getMembershipTier(userId);
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { level: true }
  });

  await prisma.membership_benefits_log.create({
    data: {
      user_id: userId,
      benefit_type: benefitType,
      membership_tier: membership.tier,
      user_level: user?.level || 1
    }
  });
}
