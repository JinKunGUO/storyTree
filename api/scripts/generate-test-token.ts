import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function generateTestToken() {
  const userId = 1; // 用户ID
  
  // 查询用户信息
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true
    }
  });

  if (!user) {
    console.error('❌ 用户不存在');
    process.exit(1);
  }

  // 生成token
  const token = jwt.sign(
    { 
      userId: user.id,
      username: user.username 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );

  console.log('\n✅ Token生成成功！\n');
  console.log('用户信息:');
  console.log(`  ID: ${user.id}`);
  console.log(`  用户名: ${user.username}`);
  console.log(`  邮箱: ${user.email || '未设置'}`);
  console.log('\nToken:');
  console.log(token);
  console.log('\n📋 使用方法:');
  console.log('1. 打开浏览器控制台（F12）');
  console.log('2. 在Console中执行：');
  console.log(`   localStorage.setItem('token', '${token}')`);
  console.log('3. 刷新页面即可');
  console.log('\n或者访问: http://localhost:3001/debug-token.html');
  console.log('在"重新登录"区域手动输入用户名和密码\n');

  await prisma.$disconnect();
}

generateTestToken().catch(console.error);

