import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 删除用户脚本
 * 
 * 用法：
 *   npx ts-node scripts/delete-user.ts --id 123
 *   npx ts-node scripts/delete-user.ts --username testuser
 *   npx ts-node scripts/delete-user.ts --id 123 --hard
 *   npx ts-node scripts/delete-user.ts --id 123 --dry-run
 */

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const USER_ID = getArg('id');
const USERNAME = getArg('username');
const HARD_DELETE = args.includes('--hard');
const DRY_RUN = args.includes('--dry-run');

async function findUser(userId?: number, username?: string) {
  if (userId) {
    return prisma.users.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            authored_stories: true,
            authored_nodes: true,
            comments: true,
          }
        }
      }
    });
  }
  if (username) {
    return prisma.users.findUnique({
      where: { username },
      include: {
        _count: {
          select: {
            authored_stories: true,
            authored_nodes: true,
            comments: true,
          }
        }
      }
    });
  }
  return null;
}

async function softDeleteUser(userId: number, username: string): Promise<void> {
  const timestamp = Date.now();
  const deletedUsername = `[DELETED_${userId}_${timestamp}]`;

  await prisma.users.update({
    where: { id: userId },
    data: {
      username: deletedUsername,
      email: null,
      password: null,
      avatar: null,
      wx_openid: null,
      wx_unionid: null,
      wx_nickname: null,
      wx_avatar: null,
      active_token: null,
      bio: `[已删除] 原用户名: ${username}, 删除时间: ${new Date().toISOString()}`,
      updatedAt: new Date()
    }
  });

  console.log(`✅ 用户 "${username}" 已软删除`);
  console.log(`   新用户名: ${deletedUsername}`);
}

async function hardDeleteUser(userId: number, username: string): Promise<void> {
  // 使用事务确保数据一致性
  await prisma.$transaction(async (tx) => {
    // 1. 删除关联数据
    await tx.comment_votes.deleteMany({ where: { user_id: userId } });
    await tx.comments.deleteMany({ where: { user_id: userId } });
    await tx.reports.deleteMany({ where: { reporter_id: userId } });
    await tx.point_transactions.deleteMany({ where: { user_id: userId } });
    await tx.checkin_records.deleteMany({ where: { user_id: userId } });
    await tx.follows.deleteMany({ where: { OR: [{ follower_id: userId }, { following_id: userId }] } });
    await tx.bookmarks.deleteMany({ where: { user_id: userId } });
    await tx.node_bookmarks.deleteMany({ where: { user_id: userId } });
    await tx.notifications.deleteMany({ where: { user_id: userId } });
    await tx.story_followers.deleteMany({ where: { user_id: userId } });
    await tx.collaboration_requests.deleteMany({ where: { user_id: userId } });
    await tx.story_collaborators.deleteMany({ where: { user_id: userId } });
    await tx.invitation_records.deleteMany({ where: { OR: [{ inviter_id: userId }, { invitee_id: userId }] } });
    await tx.invitation_codes.deleteMany({ where: { created_by_id: userId } });
    await tx.user_subscriptions.deleteMany({ where: { user_id: userId } });
    await tx.withdrawal_requests.deleteMany({ where: { user_id: userId } });
    await tx.ai_usage_logs.deleteMany({ where: { user_id: userId } });
    await tx.ai_tasks.deleteMany({ where: { user_id: userId } });
    await tx.login_logs.deleteMany({ where: { user_id: userId } });
    await tx.membership_benefits_log.deleteMany({ where: { user_id: userId } });
    await tx.ratings.deleteMany({ where: { user_id: userId } });
    await tx.shares.deleteMany({ where: { user_id: userId } });
    await tx.tips.deleteMany({ where: { OR: [{ sender_id: userId }, { receiver_id: userId }] } });
    await tx.orders.deleteMany({ where: { user_id: userId } });
    await tx.delete_requests.deleteMany({ where: { requester_id: userId } });

    // 2. 将用户创建的节点和故事转移给系统用户（ID=1）
    const systemUserId = 1;
    await tx.nodes.updateMany({
      where: { author_id: userId },
      data: { author_id: systemUserId }
    });
    await tx.stories.updateMany({
      where: { author_id: userId },
      data: { author_id: systemUserId }
    });

    // 3. 删除用户
    await tx.users.delete({ where: { id: userId } });
  });

  console.log(`✅ 用户 "${username}" 已硬删除`);
  console.log(`   用户创建的内容已转移给系统用户`);
}

async function main() {
  console.log('🗑️  StoryTree 用户删除工具\n');

  if (DRY_RUN) {
    console.log('🔍 [DRY RUN 模式] 仅预览，不实际删除\n');
  }

  const userId = USER_ID ? parseInt(USER_ID) : undefined;
  const user = await findUser(userId, USERNAME);

  if (!user) {
    if (userId) {
      console.log(`❌ 用户 ID ${userId} 不存在`);
    } else if (USERNAME) {
      console.log(`❌ 用户名 "${USERNAME}" 不存在`);
    } else {
      console.log('用法:');
      console.log('  npx ts-node scripts/delete-user.ts --id 123');
      console.log('  npx ts-node scripts/delete-user.ts --username testuser');
      console.log('  npx ts-node scripts/delete-user.ts --id 123 --hard');
      console.log('  npx ts-node scripts/delete-user.ts --id 123 --dry-run');
      console.log('\n参数:');
      console.log('  --id <用户ID>     删除指定 ID 的用户');
      console.log('  --username <用户名> 删除指定用户名的用户');
      console.log('  --hard            硬删除（彻底删除，不可恢复）');
      console.log('  --dry-run         预览模式，不实际删除');
    }
    return;
  }

  console.log(`👤 找到用户: "${user.username}"`);
  console.log(`   ID: ${user.id}`);
  console.log(`   邮箱: ${user.email || '(无)'}`);
  console.log(`   管理员: ${user.isAdmin ? '是' : '否'}`);
  console.log(`   创建故事: ${user._count.authored_stories} 个`);
  console.log(`   创建章节: ${user._count.authored_nodes} 个`);
  console.log(`   发表评论: ${user._count.comments} 条`);
  console.log(`   注册时间: ${user.createdAt.toISOString()}`);

  // 安全检查
  if (user.isAdmin) {
    console.log(`\n❌ 不能删除管理员用户`);
    return;
  }

  const deleteMode = HARD_DELETE ? '硬删除' : '软删除';
  console.log(`\n📋 删除模式: ${deleteMode}`);

  if (DRY_RUN) {
    if (HARD_DELETE) {
      console.log(`🔍 [DRY RUN] 将彻底删除此用户及其所有关联数据`);
      console.log(`   用户创建的故事和章节将转移给系统用户`);
    } else {
      console.log(`🔍 [DRY RUN] 将标记此用户为已删除（保留数据）`);
    }
    return;
  }

  if (HARD_DELETE) {
    await hardDeleteUser(user.id, user.username);
  } else {
    await softDeleteUser(user.id, user.username);
  }
}

main()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error.message || error);
    prisma.$disconnect();
    process.exit(1);
  });

