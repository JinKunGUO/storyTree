import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_AVATAR = '/assets/default-avatar.svg';

/**
 * 更新所有没有头像的用户，使用默认头像
 *
 * 用法：
 *   cd api && npx ts-node scripts/update-default-avatars.ts
 *   cd api && npx ts-node scripts/update-default-avatars.ts --dry-run
 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('👤 StoryTree 默认头像更新工具\n');

  if (dryRun) {
    console.log('🔍 [DRY RUN 模式] 仅检查，不更新数据库\n');
  }

  try {
    // 1. 统计当前没有头像的用户数量
    const usersWithoutAvatar = await prisma.users.count({
      where: {
        OR: [
          { avatar: null },
          { avatar: '' }
        ]
      }
    });

    console.log(`📊 统计结果:`);
    console.log(`   没有头像的用户: ${usersWithoutAvatar} 人`);

    if (usersWithoutAvatar === 0) {
      console.log('\n✅ 所有用户都有头像，无需更新');
      return;
    }

    // 2. 显示示例（前5个）
    const samples = await prisma.users.findMany({
      where: {
        OR: [
          { avatar: null },
          { avatar: '' }
        ]
      },
      take: 5,
      select: { id: true, username: true, avatar: true }
    });

    console.log('\n👤 示例（前5个）:');
    samples.forEach(u => {
      console.log(`   - ID: ${u.id}, 用户名: "${u.username}", 当前头像: ${u.avatar || 'null'}`);
    });

    if (dryRun) {
      console.log('\n⏹️  DRY RUN 模式，未执行更新');
      return;
    }

    // 3. 执行更新
    console.log('\n🔄 开始更新...');

    const result = await prisma.users.updateMany({
      where: {
        OR: [
          { avatar: null },
          { avatar: '' }
        ]
      },
      data: {
        avatar: DEFAULT_AVATAR
      }
    });

    console.log(`\n✅ 更新完成！`);
    console.log(`   已更新 ${result.count} 位用户的头像`);
    console.log(`   默认头像: ${DEFAULT_AVATAR}`);

  } catch (error) {
    console.error('\n❌ 执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
