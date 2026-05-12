// 检查故事总数的简单脚本
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const total = await prisma.stories.count();
    console.log('总故事数:', total);

    const admin = await prisma.users.findFirst({ where: { isAdmin: true } });
    if (admin) {
      const adminStories = await prisma.stories.count({ where: { author_id: admin.id } });
      console.log('管理员发布的故事数（公版书）:', adminStories);
    } else {
      console.log('未找到管理员用户');
    }

    // 显示最近导入的5本书
    const recent = await prisma.stories.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, title: true, created_at: true }
    });
    console.log('\n最近导入的5本书:');
    recent.forEach(s => console.log(`  - ${s.title} (ID: ${s.id})`));

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
