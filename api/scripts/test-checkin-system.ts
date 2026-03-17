import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCheckinSystem() {
  console.log('🧪 测试连续签到系统...\n');

  // 测试 1: 查看用户 aaa 的签到状态
  console.log('📋 测试 1: 用户 aaa 的签到状态');
  const aaaUser = await prisma.users.findUnique({
    where: { username: 'aaa' },
    select: {
      id: true,
      username: true,
      consecutive_days: true,
      last_checkin_date: true,
      makeup_chances: true,
      points: true
    }
  });

  if (aaaUser) {
    console.log(`   用户：${aaaUser.username}`);
    console.log(`   连续签到：${aaaUser.consecutive_days} 天`);
    console.log(`   最后签到：${aaaUser.last_checkin_date ? aaaUser.last_checkin_date.toISOString().split('T')[0] : '从未'}`);
    console.log(`   补签机会：${aaaUser.makeup_chances} 次`);
    console.log(`   当前积分：${aaaUser.points} 分\n`);

    // 测试 2: 查看最近 10 条签到记录
    console.log('📋 测试 2: 最近 10 条签到记录');
    const records = await prisma.checkin_records.findMany({
      where: { user_id: aaaUser.id },
      orderBy: { checkin_date: 'desc' },
      take: 10
    });

    if (records.length > 0) {
      records.forEach(r => {
        console.log(`   ${r.checkin_date.toISOString().split('T')[0]} | 连续${r.consecutive_days}天 | +${r.points_earned}分 | ${r.is_makeup ? '补签' : '正常'}`);
      });
    } else {
      console.log('   暂无签到记录');
    }
    console.log();
  } else {
    console.log('   用户 aaa 不存在\n');
  }

  // 测试 3: 验证签到奖励计算逻辑
  console.log('📋 测试 3: 签到奖励计算逻辑验证');
  const testDays = [1, 2, 3, 7, 8, 14, 15, 30, 31, 60, 100, 365];
  testDays.forEach(days => {
    let reward: number;
    const baseReward = 10;
    
    if (days <= 7) {
      reward = baseReward + (days - 1) * 2;
    } else if (days <= 30) {
      reward = baseReward + 12 + Math.floor((days - 7) / 7) * 5;
    } else {
      reward = baseReward + 12 + 15 + Math.floor((days - 30) / 30) * 10;
    }
    
    console.log(`   连续${days}天：+${reward}积分`);
  });
  console.log();

  // 测试 4: 检查里程碑奖励
  console.log('📋 测试 4: 里程碑奖励配置');
  const milestones = [
    { days: 7, bonus: 50 },
    { days: 30, bonus: 200 },
    { days: 100, bonus: 1000 },
    { days: 365, bonus: 5000 }
  ];
  milestones.forEach(m => {
    console.log(`   连续${m.days}天：额外奖励${m.bonus}积分`);
  });
  console.log();

  // 测试 5: 检查补签机会获取
  console.log('📋 测试 5: 补签机会获取规则');
  console.log('   规则：每连续签到 7 天，获得 1 次补签机会');
  console.log('   示例：');
  for (let i = 7; i <= 70; i += 7) {
    console.log(`     连续${i}天：获得${i / 7}次补签机会`);
  }
  console.log();

  await prisma.$disconnect();
  
  console.log('✅ 测试完成！\n');
}

testCheckinSystem();
