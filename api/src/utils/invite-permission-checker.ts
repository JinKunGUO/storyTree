import { prisma } from '../index';
import crypto from 'crypto';

/**
 * 邀请码权限检测结果
 */
export interface InvitePermissionResult {
  hasPermission: boolean;
  reason?: string;
  missingConditions?: string[];
}

/**
 * 生成随机邀请码（使用更安全的随机算法）
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
  const randomBytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

/**
 * 检查用户是否有资格生成新的个人邀请码
 * 
 * 条件（满足任一即可）：
 * 1. 码字达到 1 万字（每满 1 万字可生成一个）
 * 2. 连续签到 7 天（每连续签到 7 天可生成一个）
 */
export async function checkCanGenerateInviteCode(userId: number): Promise<{
  canGenerate: boolean;
  reason?: string;
  availableCount: number; // 可生成的邀请码数量
}> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      word_count: true,
      consecutive_days: true,
    }
  });

  if (!user) {
    return { canGenerate: false, availableCount: 0 };
  }

  let availableCount = 0;
  const reasons: string[] = [];

  // 条件 1: 每码字 1 万可生成一个邀请码
  const wordCountCodes = Math.floor(user.word_count / 10000);
  if (wordCountCodes > 0) {
    availableCount += wordCountCodes;
    reasons.push(`码字 ${user.word_count} 字，可生成${wordCountCodes}个邀请码`);
  }

  // 条件 2: 每连续签到 7 天可生成一个邀请码
  const checkinCodes = Math.floor(user.consecutive_days / 7);
  if (checkinCodes > 0) {
    availableCount += checkinCodes;
    reasons.push(`连续签到 ${user.consecutive_days} 天，可生成${checkinCodes}个邀请码`);
  }

  // 获取用户已生成且未使用的邀请码数量（只统计新版本的邀请码，max_uses = 1）
  const usedCodesCount = await prisma.invitation_codes.count({
    where: {
      created_by_id: userId,
      type: 'user',
      max_uses: 1, // 只统计新版本邀请码
      used_count: { lt: 1 }, // 统计未使用完的邀请码
    }
  });

  // 可用数量 = 理论可生成数量 - 已生成且未使用的数量
  const actualAvailableCount = Math.max(0, availableCount - usedCodesCount);

  if (actualAvailableCount > 0) {
    return {
      canGenerate: true,
      reason: reasons.join('; '),
      availableCount: actualAvailableCount
    };
  }

  return {
    canGenerate: false,
    availableCount: 0
  };
}

/**
 * 为用户生成新的个人邀请码
 */
export async function generateUserInviteCode(userId: number): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> {
  // 检查是否有资格生成
  const canGenerate = await checkCanGenerateInviteCode(userId);
  
  if (!canGenerate.canGenerate) {
    return {
      success: false,
      error: '暂不满足生成邀请码的条件（需码字 1 万字或连续签到 7 天）'
    };
  }

  try {
    // 生成邀请码
    const newCode = generateInviteCode();
    
    // 使用事务创建邀请码记录
    await prisma.$transaction(async (tx) => {
      await tx.invitation_codes.create({
        data: {
          code: newCode,
          created_by_id: userId,
          type: 'user',
          bonus_points: 50, // 默认奖励 50 积分
          max_uses: 1, // 每个用户邀请码只能使用 1 次
          is_active: true
        }
      });
    });

    return {
      success: true,
      code: newCode
    };
  } catch (error) {
    console.error('生成邀请码失败:', error);
    return {
      success: false,
      error: '生成邀请码失败，请稍后重试'
    };
  }
}

/**
 * 检查用户是否有权限生成邀请码（旧接口兼容）
 */
export async function checkInvitePermission(userId: number): Promise<InvitePermissionResult> {
  const result = await checkCanGenerateInviteCode(userId);
  
  if (result.canGenerate) {
    return {
      hasPermission: true,
      reason: result.reason
    };
  }

  // 检查是否是管理员
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { isAdmin: true }
  });

  if (user?.isAdmin) {
    return {
      hasPermission: true,
      reason: '管理员'
    };
  }

  return {
    hasPermission: false,
    missingConditions: ['码字 1 万字', '连续签到 7 天']
  };
}

/**
 * 自动检查并授予邀请码权限（旧接口兼容）
 */
export async function autoGrantInvitePermission(userId: number): Promise<void> {
  // 新逻辑不需要此函数，改为检查是否可以生成邀请码
  return;
}
