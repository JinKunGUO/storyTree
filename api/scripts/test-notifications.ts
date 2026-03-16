import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNotifications() {
  console.log('🧪 测试通知功能...\n');

  // 1. 检查notifications表
  console.log('1️⃣ 检查notifications表...');
  const notificationCount = await prisma.notifications.count();
  console.log(`   ✅ 通知总数: ${notificationCount}\n`);

  // 2. 查看最新的10条通知
  console.log('2️⃣ 最新的10条通知:');
  const recentNotifications = await prisma.notifications.findMany({
    take: 10,
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: { id: true, username: true }
      }
    }
  });

  recentNotifications.forEach((n, index) => {
    const readStatus = n.is_read ? '✅已读' : '🔔未读';
    console.log(`   ${index + 1}. [${n.type}] ${n.title} ${readStatus}`);
    console.log(`      接收者: ${n.user.username} (ID: ${n.user.id})`);
    console.log(`      内容: ${n.content}`);
    console.log(`      链接: ${n.link || '无'}`);
    console.log(`      时间: ${new Date(n.created_at).toLocaleString('zh-CN')}`);
    console.log('');
  });

  // 3. 按类型统计
  console.log('3️⃣ 通知类型统计:');
  const types = await prisma.notifications.groupBy({
    by: ['type'],
    _count: { type: true }
  });

  types.forEach(t => {
    console.log(`   ${t.type}: ${t._count.type} 条`);
  });

  // 4. 按用户统计
  console.log('\n4️⃣ 用户通知统计:');
  const userStats = await prisma.notifications.groupBy({
    by: ['user_id'],
    _count: { user_id: true }
  });

  for (const stat of userStats) {
    const user = await prisma.users.findUnique({
      where: { id: stat.user_id },
      select: { username: true }
    });
    console.log(`   用户 ${user?.username || 'Unknown'} (ID: ${stat.user_id}): ${stat._count.user_id} 条通知`);
  }

  // 5. 未读通知统计
  console.log('\n5️⃣ 未读通知统计:');
  const unreadCount = await prisma.notifications.count({
    where: { is_read: false }
  });
  console.log(`   未读通知总数: ${unreadCount}`);

  // 6. 创建一条测试通知
  console.log('\n6️⃣ 创建测试通知...');
  const firstUser = await prisma.users.findFirst();
  
  if (firstUser) {
    const testNotification = await prisma.notifications.create({
      data: {
        user_id: firstUser.id,
        type: 'TEST',
        title: '🧪 测试通知',
        content: `这是一条测试通知，创建于 ${new Date().toLocaleString('zh-CN')}`,
        link: '/notifications',
        is_read: false
      }
    });

    console.log(`   ✅ 测试通知创建成功！`);
    console.log(`   通知ID: ${testNotification.id}`);
    console.log(`   接收者: ${firstUser.username} (ID: ${firstUser.id})`);
    console.log(`   标题: ${testNotification.title}`);
    console.log(`   \n   请访问 http://localhost:3000/notifications.html 查看通知`);
  } else {
    console.log('   ❌ 没有找到用户');
  }

  console.log('\n✅ 测试完成！');
}

testNotifications()
  .catch((error) => {
    console.error('❌ 测试失败:', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });

