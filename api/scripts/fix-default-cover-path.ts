/**
 * 修复数据库中错误的默认封面路径
 *
 * 问题：数据库中存储的默认封面路径是 `/assets/default-cover.svg`，
 *       但实际文件是 `default-cover.jpg`
 *
 * 使用方法：
 *   cd api
 *   npx ts-node scripts/fix-default-cover-path.ts
 *
 *  dry-run 模式（仅查看不执行）：
 *   npx ts-node scripts/fix-default-cover-path.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_DEFAULT_COVER = '/assets/default-cover.svg';
const NEW_DEFAULT_COVER = '/assets/default-cover.jpg';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('=== 修复默认封面路径 ===\n');
  console.log(`旧路径：${OLD_DEFAULT_COVER}`);
  console.log(`新路径：${NEW_DEFAULT_COVER}\n`);

  // 统计需要更新的故事数量
  const count = await prisma.stories.count({
    where: {
      cover_image: OLD_DEFAULT_COVER
    }
  });

  console.log(`发现 ${count} 个故事使用旧的默认封面路径`);

  if (count === 0) {
    console.log('✅ 无需更新，所有故事的封面路径已正确');
    return;
  }

  if (isDryRun) {
    console.log('\n🔍 Dry-run 模式：不会执行实际更新');

    // 显示受影响的故事
    const stories = await prisma.stories.findMany({
      where: {
        cover_image: OLD_DEFAULT_COVER
      },
      select: {
        id: true,
        title: true,
        cover_image: true
      },
      take: 10
    });

    console.log('\n受影响的故事（最多显示 10 个）：');
    stories.forEach(story => {
      console.log(`  - [${story.id}] ${story.title}: ${story.cover_image}`);
    });

    if (count > 10) {
      console.log(`  ... 还有 ${count - 10} 个故事`);
    }

    return;
  }

  // 执行更新
  const result = await prisma.stories.updateMany({
    where: {
      cover_image: OLD_DEFAULT_COVER
    },
    data: {
      cover_image: NEW_DEFAULT_COVER
    }
  });

  console.log(`\n✅ 更新完成！`);
  console.log(`   已更新 ${result.count} 个故事的封面路径`);
  console.log(`   ${OLD_DEFAULT_COVER} → ${NEW_DEFAULT_COVER}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());