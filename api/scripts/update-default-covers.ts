import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_COVER = '/assets/default-cover.png';

/**
 * 更新所有没有封面的故事，使用默认封面
 *
 * 用法：
 *   cd api && npx ts-node scripts/update-default-covers.ts
 *   cd api && npx ts-node scripts/update-default-covers.ts --dry-run
 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('📚 StoryTree 默认封面更新工具\n');

  if (dryRun) {
    console.log('🔍 [DRY RUN 模式] 仅检查，不更新数据库\n');
  }

  try {
    // 1. 统计当前没有封面的故事数量
    const storiesWithoutCover = await prisma.stories.count({
      where: {
        OR: [
          { cover_image: null },
          { cover_image: '' }
        ]
      }
    });

    console.log(`📊 统计结果:`);
    console.log(`   没有封面的故事: ${storiesWithoutCover} 本`);

    if (storiesWithoutCover === 0) {
      console.log('\n✅ 所有故事都有封面，无需更新');
      return;
    }

    // 2. 显示示例（前5个）
    const samples = await prisma.stories.findMany({
      where: {
        OR: [
          { cover_image: null },
          { cover_image: '' }
        ]
      },
      take: 5,
      select: { id: true, title: true, cover_image: true }
    });

    console.log('\n📖 示例（前5本）:');
    samples.forEach(s => {
      console.log(`   - ID: ${s.id}, 标题: "${s.title}", 当前封面: ${s.cover_image || 'null'}`);
    });

    if (dryRun) {
      console.log('\n⏹️  DRY RUN 模式，未执行更新');
      return;
    }

    // 3. 执行更新
    console.log('\n🔄 开始更新...');

    const result = await prisma.stories.updateMany({
      where: {
        OR: [
          { cover_image: null },
          { cover_image: '' }
        ]
      },
      data: {
        cover_image: DEFAULT_COVER
      }
    });

    console.log(`\n✅ 更新完成！`);
    console.log(`   已更新 ${result.count} 本故事的封面`);
    console.log(`   默认封面: ${DEFAULT_COVER}`);

  } catch (error) {
    console.error('\n❌ 执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
