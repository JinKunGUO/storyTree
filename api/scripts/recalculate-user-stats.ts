import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 里程碑配置
const MILESTONES = [
  { words: 10000, badge: 'rookie', points: 50 },
  { words: 50000, badge: 'achiever', points: 200 },
  { words: 100000, badge: 'diligent', points: 500 },
  { words: 200000, badge: 'professional', points: 1200 },
  { words: 500000, badge: 'signed', points: 3500 },
  { words: 1000000, badge: 'master', points: 10000 },
  { words: 2000000, badge: 'legend', points: 25000 }
];

async function recalculateUserStats() {
  console.log('开始重新计算用户统计数据...\n');

  // 获取所有用户
  const users = await prisma.users.findMany({
    select: {
      id: true,
      username: true,
      email: true
    }
  });

  console.log(`找到 ${users.length} 个用户\n`);

  for (const user of users) {
    console.log(`处理用户: ${user.username} (ID: ${user.id})`);

    // 查询用户的所有非AI生成的章节
    const nodes = await prisma.nodes.findMany({
      where: {
        author_id: user.id,
        ai_generated: false
      },
      select: {
        content: true
      }
    });

    // 计算总字数
    const totalWordCount = nodes.reduce((sum, node) => sum + node.content.length, 0);
    console.log(`  - 非AI章节数: ${nodes.length}`);
    console.log(`  - 总字数: ${totalWordCount}`);

    // 计算码字奖励（每1000字10积分）
    const wordRewardPoints = Math.floor(totalWordCount / 1000) * 10;
    
    // 计算补签机会（每1000字1次）
    const makeupChances = Math.floor(totalWordCount / 1000);

    // 计算里程碑奖励
    const unlockedBadges: string[] = [];
    let milestonePoints = 0;
    
    for (const milestone of MILESTONES) {
      if (totalWordCount >= milestone.words) {
        unlockedBadges.push(milestone.badge);
        milestonePoints += milestone.points;
      }
    }

    // 总积分 = 码字奖励 + 里程碑奖励
    const totalPoints = wordRewardPoints + milestonePoints;

    console.log(`  - 码字奖励积分: ${wordRewardPoints}`);
    console.log(`  - 里程碑奖励积分: ${milestonePoints}`);
    console.log(`  - 总积分: ${totalPoints}`);
    console.log(`  - 补签机会: ${makeupChances}`);
    console.log(`  - 解锁徽章: ${unlockedBadges.join(', ') || '无'}`);

    // 更新用户数据
    await prisma.users.update({
      where: { id: user.id },
      data: {
        word_count: totalWordCount,
        points: totalPoints,
        makeup_chances: makeupChances,
        badges: unlockedBadges.length > 0 ? JSON.stringify(unlockedBadges) : null
      }
    });

    console.log(`  ✅ 更新完成\n`);
  }

  console.log('所有用户统计数据重新计算完成！');
  await prisma.$disconnect();
}

recalculateUserStats().catch((error) => {
  console.error('重新计算统计数据失败:', error);
  prisma.$disconnect();
  process.exit(1);
});

