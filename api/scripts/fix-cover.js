/**
 * 修复默认封面路径（JavaScript 版本）
 *
 * 使用方法：
 *   cd /var/www/storytree/api
 *   node scripts/fix-cover.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_DEFAULT_COVER = '/assets/default-cover.svg';
const NEW_DEFAULT_COVER = '/assets/default-cover.jpg';

async function main() {
  console.log('=== 修复默认封面路径 ===\n');
  console.log(`旧路径：${OLD_DEFAULT_COVER}`);
  console.log(`新路径：${NEW_DEFAULT_COVER}\n`);

  try {
    // 统计需要更新的故事数量
    const count = await prisma.stories.count({
      where: { cover_image: OLD_DEFAULT_COVER }
    });

    console.log(`发现 ${count} 个故事使用旧的默认封面路径`);

    if (count === 0) {
      console.log('✅ 无需更新，所有故事的封面路径已正确');
      return;
    }

    // 执行更新
    const result = await prisma.stories.updateMany({
      where: { cover_image: OLD_DEFAULT_COVER },
      data: { cover_image: NEW_DEFAULT_COVER }
    });

    console.log(`\n✅ 更新完成！`);
    console.log(`   已更新 ${result.count} 个故事的封面路径`);
    console.log(`   ${OLD_DEFAULT_COVER} → ${NEW_DEFAULT_COVER}`);

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();