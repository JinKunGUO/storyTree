/**
 * 数据迁移脚本：将现有的所有章节标记为已发布
 * 
 * 运行方式：
 * cd api && npx ts-node scripts/update-existing-nodes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始更新现有章节的发布状态...');

  // 更新所有现有章节为已发布状态
  const result = await prisma.nodes.updateMany({
    where: {
      is_published: false
    },
    data: {
      is_published: true
    }
  });

  console.log(`✅ 成功更新 ${result.count} 个章节为已发布状态`);
}

main()
  .catch((e) => {
    console.error('❌ 更新失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

