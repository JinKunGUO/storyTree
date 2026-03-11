import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/auth';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🚀 开始创建管理员用户...');

    const username = 'jinhui';
    const email = '1025103012@qq.com';
    const password = '123456';

    // 检查用户是否已存在
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      console.log('⚠️  用户已存在，更新为管理员权限...');
      
      // 更新现有用户为管理员
      const updatedUser = await prisma.users.update({
        where: { id: existingUser.id },
        data: {
          isAdmin: true,
          emailVerified: true,
          points: 999999999, // 设置大量积分
          updatedAt: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          isAdmin: true,
          points: true,
          emailVerified: true
        }
      });

      console.log('✅ 用户已更新为管理员:');
      console.log(JSON.stringify(updatedUser, null, 2));
      return;
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 创建新的管理员用户
    const adminUser = await prisma.users.create({
      data: {
        username,
        email,
        password: hashedPassword,
        isAdmin: true,
        emailVerified: true, // 管理员直接验证邮箱
        points: 999999999, // 设置大量积分（接近无限）
        level: 99, // 设置最高等级
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

    console.log('✅ 管理员用户创建成功:');
    console.log(JSON.stringify(adminUser, null, 2));
    
    console.log('\n📋 登录信息:');
    console.log('用户名:', username);
    console.log('邮箱:', email);
    console.log('密码:', password);
    console.log('管理员权限: 是');
    console.log('积分额度: 999,999,999 (接近无限)');

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

