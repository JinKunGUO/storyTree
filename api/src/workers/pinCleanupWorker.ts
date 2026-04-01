import { prisma } from '../db';

/**
 * 清理过期置顶的定时任务
 * 负责：
 * 1. 自动清理过期的故事置顶
 * 2. 自动清理过期的评论置顶（评论置顶是永久的，不需要清理）
 * 
 * 每小时执行一次
 */

// 每小时执行
const CHECK_INTERVAL = 60 * 60 * 1000; // 60 分钟

/**
 * 清理过期的故事置顶
 */
async function cleanupExpiredStoryPins() {
  const now = new Date();
  
  try {
    // 查找所有已过期的置顶故事
    const expiredPins = await prisma.stories.findMany({
      where: {
        pinned: true,
        pinned_until: {
          lte: now
        }
      },
      select: {
        id: true,
        title: true,
        author_id: true,
        pinned_at: true,
        pinned_until: true
      }
    });

    if (expiredPins.length === 0) {
      console.log('✅ 没有过期的置顶故事');
      return;
    }

    console.log(`🔍 发现 ${expiredPins.length} 个过期的置顶故事`);

    // 批量取消置顶
    const updatePromises = expiredPins.map(story => 
      prisma.stories.update({
        where: { id: story.id },
        data: {
          pinned: false,
          pinned_at: null,
          pinned_until: null
        }
      })
    );

    await Promise.all(updatePromises);

    console.log(`✅ 已清理 ${expiredPins.length} 个过期的置顶故事`);

    // 可选：发送通知给故事作者（如果需要）
    // for (const story of expiredPins) {
    //   await createNotification(
    //     story.author_id,
    //     'story_pin_expired',
    //     '故事置顶已到期',
    //     `您的故事《${story.title}》的置顶已到期，如需继续置顶请重新购买`,
    //     `/story?id=${story.id}`
    //   );
    // }

  } catch (error) {
    console.error('清理过期置顶故事失败:', error);
  }
}

/**
 * 主函数
 */
async function runPinCleanupWorker() {
  console.log('🕒 置顶清理定时任务启动...');
  
  // 启动时立即执行一次
  await cleanupExpiredStoryPins();
  
  // 然后每小时执行
  setInterval(async () => {
    console.log('🕐 开始执行置顶清理任务...');
    await cleanupExpiredStoryPins();
  }, CHECK_INTERVAL);
}

// 启动 Worker
runPinCleanupWorker().catch(console.error);

export { cleanupExpiredStoryPins };
