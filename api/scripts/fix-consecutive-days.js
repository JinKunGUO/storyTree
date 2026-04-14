/**
 * 修正脚本：根据实际签到记录重新计算每个用户的 consecutive_days
 * 用于修复因历史 bug 导致的脏数据
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 获取所有有签到记录的用户
  const userIds = await prisma.checkin_records.findMany({
    select: { user_id: true },
    distinct: ['user_id'],
  });

  console.log(`共找到 ${userIds.length} 个有签到记录的用户`);

  for (const { user_id } of userIds) {
    // 查该用户所有签到记录
    const records = await prisma.checkin_records.findMany({
      where: { user_id },
      select: { checkin_date: true },
    });

    // 构建本地日期字符串集合
    const checkinDates = new Set(records.map(r => toLocalDateStr(new Date(r.checkin_date))));

    // 从今天开始倒推计算连续天数
    let consecutiveDays = 0;
    let cur = new Date(today);
    while (true) {
      const ds = toLocalDateStr(cur);
      if (checkinDates.has(ds)) {
        consecutiveDays++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }

    // 读取当前值
    const user = await prisma.users.findUnique({
      where: { id: user_id },
      select: { username: true, consecutive_days: true },
    });

    console.log(`用户 ${user.username}(id=${user_id}): ${user.consecutive_days} → ${consecutiveDays}`);
    console.log(`  签到日期集合: ${[...checkinDates].sort().join(', ')}`);

    // 更新数据库
    await prisma.users.update({
      where: { id: user_id },
      data: { consecutive_days: consecutiveDays },
    });
  }

  await prisma.$disconnect();
  console.log('\n修正完成！');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

