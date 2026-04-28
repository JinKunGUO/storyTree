import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/auth';

const prisma = new PrismaClient();

/**
 * 创建或更新管理员用户
 *
 * 支持通过命令行参数或环境变量传入配置：
 *   npx ts-node scripts/create-admin.ts [username] [email] [password]
 *
 * 环境变量（优先级低于命令行参数）：
 *   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * 默认值：username=jinhui, email=1025103012@qq.com, password=123456
 */

// 解析命令行参数（跳过前两个：node 和脚本路径）
const args = process.argv.slice(2);

const username = args[0] || process.env.ADMIN_USERNAME || 'jinhui';
const email = args[1] || process.env.ADMIN_EMAIL || '1025103012@qq.com';
const password = args[2] || process.env.ADMIN_PASSWORD || '123456';

// 管理员默认配置
const ADMIN_POINTS = 999999999;
const ADMIN_LEVEL = 99;

async function createAdminUser() {
  try {
    console.log('🚀 开始创建管理员用户...');
    console.log(`   用户名: ${username}`);
    console.log(`   邮箱:   ${email}`);
    console.log(`   积分:   ${ADMIN_POINTS.toLocaleString()}`);
    console.log(`   等级:   ${ADMIN_LEVEL}`);
    console.log('');

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 使用 upsert：存在则更新，不存在则创建
    const adminUser = await prisma.users.upsert({
      where: { username },
      update: {
        email,
        password: hashedPassword,
        isAdmin: true,
        emailVerified: true,
        points: ADMIN_POINTS,
        level: ADMIN_LEVEL,
        updatedAt: new Date()
      },
      create: {
        username,
        email,
        password: hashedPassword,
        isAdmin: true,
        emailVerified: true,
        points: ADMIN_POINTS,
        level: ADMIN_LEVEL,
        bio: '系统管理员',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        points: true,
        level: true,
        emailVerified: true,
        createdAt: true
      }
    });

    console.log('✅ 管理员用户已就绪:');
    console.log(JSON.stringify(adminUser, null, 2));

    console.log('\n📋 登录信息:');
    console.log(`   用户名: ${username}`);
    console.log(`   邮箱:   ${email}`);
    console.log(`   密码:   ${password}`);
    console.log('   管理员权限: 是');
    console.log(`   积分额度: ${ADMIN_POINTS.toLocaleString()}`);

  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
createAdminUser()
  .then(() => {
    console.log('\n🎉 脚本执行完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

