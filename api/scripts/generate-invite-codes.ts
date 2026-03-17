/**
 * 批量生成邀请码脚本
 * 用法: npx ts-node scripts/generate-invite-codes.ts [数量] [积分] [最大使用次数] [有效天数]
 * 示例: npx ts-node scripts/generate-invite-codes.ts 100 100 1 30
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 生成随机邀请码
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function main() {
  // 从命令行参数获取配置
  const count = parseInt(process.argv[2]) || 10;
  const bonusPoints = parseInt(process.argv[3]) || 100;
  const maxUses = parseInt(process.argv[4]) || 1;
  const expiresInDays = parseInt(process.argv[5]) || 30;

  console.log('📝 批量生成邀请码');
  console.log('==================');
  console.log(`数量: ${count}`);
  console.log(`奖励积分: ${bonusPoints}`);
  console.log(`最大使用次数: ${maxUses === -1 ? '无限' : maxUses}`);
  console.log(`有效期: ${expiresInDays > 0 ? expiresInDays + '天' : '永久'}`);
  console.log('');

  // 获取管理员用户
  const admin = await prisma.users.findFirst({
    where: { isAdmin: true }
  });

  if (!admin) {
    console.error('❌ 错误: 未找到管理员用户');
    console.log('请先创建管理员用户或运行: npx ts-node scripts/create-admin.ts');
    process.exit(1);
  }

  console.log(`✅ 使用管理员账号: ${admin.username} (ID: ${admin.id})`);
  console.log('');

  const expiresAt = expiresInDays > 0 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code = generateInviteCode();
    
    // 确保不重复
    while (await prisma.invitation_codes.findUnique({ where: { code } }) || codes.includes(code)) {
      code = generateInviteCode();
    }

    await prisma.invitation_codes.create({
      data: {
        code,
        created_by_id: admin.id,
        type: 'admin',
        bonus_points: bonusPoints,
        max_uses: maxUses,
        expires_at: expiresAt,
        is_active: true
      }
    });

    codes.push(code);
    
    // 每10个显示一次进度
    if ((i + 1) % 10 === 0 || i === count - 1) {
      console.log(`✅ 已生成 ${i + 1}/${count} 个邀请码`);
    }
  }

  console.log('');
  console.log('🎉 邀请码生成完成！');
  console.log('');
  console.log('生成的邀请码:');
  console.log('==================');
  
  // 每行显示5个
  for (let i = 0; i < codes.length; i += 5) {
    console.log(codes.slice(i, i + 5).join('  '));
  }

  console.log('');
  console.log('💾 邀请码已保存到数据库');
  console.log('📊 可以在管理后台查看和管理这些邀请码');
}

main()
  .catch((error) => {
    console.error('❌ 生成邀请码失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

