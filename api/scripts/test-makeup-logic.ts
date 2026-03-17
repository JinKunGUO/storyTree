import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMakeupLogic() {
  console.log('🧪 测试补签逻辑修复...\n');

  // 测试场景：用户中断后补签，验证连续天数计算
  console.log('📋 测试场景：用户有 5 天连续签到，中断 2 天后补签');
  
  const testUser = await prisma.users.findUnique({
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

  if (!testUser) {
    console.log('❌ 用户 aaa 不存在');
    await prisma.$disconnect();
    return;
  }

  console.log(`   用户：${testUser.username}`);
  console.log(`   当前连续：${testUser.consecutive_days}天`);
  console.log(`   补签机会：${testUser.makeup_chances}次\n`);

  // 查看最近签到记录
  const recentRecords = await prisma.checkin_records.findMany({
    where: { user_id: testUser.id },
    orderBy: { checkin_date: 'desc' },
    take: 10
  });

  console.log('📅 最近签到记录:');
  if (recentRecords.length > 0) {
    recentRecords.forEach(r => {
      console.log(`   ${r.checkin_date.toISOString().split('T')[0]} | 连续${r.consecutive_days}天 | +${r.points_earned}分 | ${r.is_makeup ? '补签' : '正常'}`);
    });
  } else {
    console.log('   暂无记录');
  }
  console.log();

  // 测试补签逻辑的核心算法
  console.log('🔍 测试补签连续天数计算逻辑:');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 假设补签 3 天前
  const makeupDate = new Date(today);
  makeupDate.setDate(makeupDate.getDate() - 3);
  makeupDate.setHours(0, 0, 0, 0);
  
  console.log(`   今天：${today.toISOString().split('T')[0]}`);
  console.log(`   补签日期：${makeupDate.toISOString().split('T')[0]} (3 天前)`);
  
  // 获取补签日期到今天的签到记录
  const checkinRecords = await prisma.checkin_records.findMany({
    where: {
      user_id: testUser.id,
      checkin_date: {
        gte: makeupDate,
        lte: today,
      }
    },
    select: {
      checkin_date: true,
    }
  });

  console.log(`\n   补签日期到今天的签到记录 (${checkinRecords.length}条):`);
  checkinRecords.forEach(r => {
    console.log(`     ${r.checkin_date.toISOString().split('T')[0]}`);
  });

  // 构建已签到日期集合
  const checkinDates = new Set(checkinRecords.map(r => {
    const d = new Date(r.checkin_date);
    return d.toISOString().split('T')[0];
  }));

  // 添加本次补签日期
  const makeupDateStr = makeupDate.toISOString().split('T')[0];
  checkinDates.add(makeupDateStr);
  
  console.log(`\n   补签后的日期集合 (${checkinDates.size}天):`);
  checkinDates.forEach(d => console.log(`     ${d}`));

  // 从今天开始倒推，计算连续天数
  let newConsecutiveDays = 0;
  let currentDate = new Date(today);
  
  console.log(`\n   倒推计算:`);
  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const hasCheckin = checkinDates.has(dateStr);
    
    console.log(`     ${dateStr}: ${hasCheckin ? '✅' : '❌'}`);
    
    if (hasCheckin) {
      newConsecutiveDays++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      console.log(`     ⛔ 中断，停止计算`);
      break;
    }
  }

  console.log(`\n   ✅ 补签后的新连续天数：${newConsecutiveDays}天`);
  console.log();

  // 验证奖励计算
  console.log('💰 验证奖励计算:');
  function calculateCheckinReward(consecutiveDays: number): number {
    const baseReward = 10;
    if (consecutiveDays <= 7) {
      return baseReward + (consecutiveDays - 1) * 2;
    } else if (consecutiveDays <= 30) {
      return baseReward + 12 + Math.floor((consecutiveDays - 7) / 7) * 5;
    } else {
      return baseReward + 12 + 15 + Math.floor((consecutiveDays - 30) / 30) * 10;
    }
  }

  const pointsEarned = calculateCheckinReward(newConsecutiveDays);
  console.log(`   补签奖励积分：${pointsEarned}`);

  // 检查里程碑
  const milestones = [
    { days: 7, bonus: 50 },
    { days: 30, bonus: 200 },
    { days: 100, bonus: 1000 },
    { days: 365, bonus: 5000 }
  ];

  const triggeredMilestone = milestones.find(m => m.days === newConsecutiveDays);
  if (triggeredMilestone) {
    console.log(`   🎉 触发里程碑奖励：连续${triggeredMilestone.days}天，额外 +${triggeredMilestone.bonus}积分`);
  } else {
    console.log(`   未触发里程碑奖励`);
  }
  console.log();

  await prisma.$disconnect();
  
  console.log('✅ 测试完成！\n');
  console.log('📝 总结:');
  console.log('   1. 补签逻辑会从今天倒推检查所有日期');
  console.log('   2. 只有连续的日期都签到了，才会累加连续天数');
  console.log('   3. 补签可以恢复中断的连续记录');
  console.log('   4. 补签可能触发里程碑奖励');
}

testMakeupLogic();
