import { prisma } from '../index';

/**
 * 通知类型
 */
export enum NotificationType {
  AI_CONTINUATION_READY = 'ai_continuation_ready',
  AI_POLISH_READY = 'ai_polish_ready',
  AI_ILLUSTRATION_READY = 'ai_illustration_ready',
  LEVEL_UP = 'level_up',
  POINTS_EARNED = 'points_earned',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring'
}

/**
 * 创建通知
 */
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content: string,
  link?: string
) {
  try {
    await prisma.notifications.create({
      data: {
        user_id: userId,
        type,
        title,
        content,
        link,
        is_read: false
      }
    });
    console.log(`📬 通知已创建: ${title} (用户${userId})`);
  } catch (error) {
    console.error('创建通知失败:', error);
  }
}

/**
 * AI续写完成通知
 */
export async function notifyAiContinuationReady(
  userId: number,
  taskId: number,
  storyTitle: string,
  storyId?: number
) {
  // 如果有storyId，直接跳转到故事分支图；否则跳转到AI任务页面
  const link = storyId ? `/story.html?id=${storyId}` : `/ai-tasks.html?id=${taskId}`;
  
  await createNotification(
    userId,
    NotificationType.AI_CONTINUATION_READY,
    '🎉 您的故事有了新的分支！',
    `《${storyTitle}》的AI续写已完成，快来查看吧！`,
    link
  );
}

/**
 * AI润色完成通知
 */
export async function notifyAiPolishReady(
  userId: number,
  taskId: number
) {
  await createNotification(
    userId,
    NotificationType.AI_POLISH_READY,
    '✨ 文字润色完成！',
    `您的文字已经过AI精心润色，效果更佳！`,
    `/ai-tasks.html?id=${taskId}`
  );
}

/**
 * AI插图完成通知
 */
export async function notifyAiIllustrationReady(
  userId: number,
  taskId: number,
  chapterTitle: string
) {
  await createNotification(
    userId,
    NotificationType.AI_ILLUSTRATION_READY,
    '🎨 精美插图已生成！',
    `《${chapterTitle}》的AI插图已完成，快来欣赏吧！`,
    `/ai-tasks.html?id=${taskId}`
  );
}

/**
 * 等级升级通知
 */
export async function notifyLevelUp(
  userId: number,
  newLevel: number,
  levelName: string
) {
  await createNotification(
    userId,
    NotificationType.LEVEL_UP,
    '🎊 恭喜升级！',
    `您已升级至 Lv${newLevel} ${levelName}，解锁更多AI功能！`,
    '/profile.html'
  );
}

/**
 * 积分获得通知
 */
export async function notifyPointsEarned(
  userId: number,
  points: number,
  reason: string
) {
  await createNotification(
    userId,
    NotificationType.POINTS_EARNED,
    '💰 获得积分奖励',
    `${reason}，获得 ${points} 积分！`,
    '/profile.html'
  );
}

