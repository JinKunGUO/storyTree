import { prisma } from '../index';
import { WORD_MILESTONES, WORD_REWARD_RATE, MAKEUP_CHANCE_RATE } from './milestones';
import { addPoints } from './points';

/**
 * 创建通知（简化版）
 */
async function createMilestoneNotification(
  userId: number,
  title: string,
  content: string
) {
  try {
    await prisma.notifications.create({
      data: {
        user_id: userId,
        type: 'milestone',
        title,
        content,
        link: '/profile.html',
        is_read: false
      }
    });
  } catch (error) {
    console.error('创建通知失败:', error);
  }
}

/**
 * 检查并发放里程碑奖励
 */
export async function checkAndAwardMilestones(userId: number, newWordCount: number): Promise<void> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { badges: true }
  });

  if (!user) {
    return;
  }

  // 解析已有徽章
  const currentBadges: string[] = user.badges ? JSON.parse(user.badges) : [];

  for (const milestone of WORD_MILESTONES) {
    // 检查是否达成且未获得
    if (newWordCount >= milestone.words && !currentBadges.includes(milestone.badge.id)) {
      // 添加徽章
      const newBadges = [...currentBadges, milestone.badge.id];
      
      await prisma.users.update({
        where: { id: userId },
        data: { 
          badges: JSON.stringify(newBadges)
        }
      });

      // 发放积分奖励
      await addPoints(
        userId, 
        milestone.reward, 
        'milestone', 
        `达成里程碑「${milestone.badge.name}」`
      );

      // 发送通知
      await createMilestoneNotification(
        userId,
        '里程碑达成',
        `🎉 恭喜解锁徽章「${milestone.badge.emoji} ${milestone.badge.name}」，奖励${milestone.reward}积分！`
      );

      console.log(`用户 ${userId} 达成里程碑：${milestone.badge.name}`);
    }
  }
}

/**
 * 更新用户码字数并检查里程碑
 */
export async function updateWordCountAndCheckMilestones(
  userId: number, 
  wordCount: number
): Promise<void> {
  // 更新码字数
  const user = await prisma.users.update({
    where: { id: userId },
    data: {
      word_count: {
        increment: wordCount
      }
    },
    select: { word_count: true }
  });

  // 检查里程碑
  await checkAndAwardMilestones(userId, user.word_count);

  // 实时码字奖励：每1000字奖励10积分
  const wordReward = Math.floor(wordCount / 1000) * WORD_REWARD_RATE;
  if (wordReward > 0) {
    await addPoints(userId, wordReward, 'word_count', `码字奖励（${wordCount}字）`);
  }

  // 补签机会奖励：每1000字获得1次补签机会
  const makeupChances = Math.floor(wordCount / 1000) * MAKEUP_CHANCE_RATE;
  if (makeupChances > 0) {
    await prisma.users.update({
      where: { id: userId },
      data: {
        makeup_chances: {
          increment: makeupChances
        }
      }
    });
  }
}