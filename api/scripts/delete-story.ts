import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 删除故事脚本
 * 
 * 用法：
 *   cd api
 *   npx ts-node scripts/delete-story.ts --id 5              # 按 ID 删除
 *   npx ts-node scripts/delete-story.ts --title "西游记"     # 按标题删除
 *   npx ts-node scripts/delete-story.ts --author admin      # 删除某用户的所有故事
 *   npx ts-node scripts/delete-story.ts --dry-run --id 5    # 预览模式
 * 
 * 注意：
 *   - 删除故事会同时删除所有章节（nodes）
 *   - 此操作不可逆，请谨慎使用
 *   - 建议先使用 --dry-run 预览
 */

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const STORY_ID = getArg('id');
const STORY_TITLE = getArg('title');
const AUTHOR_USERNAME = getArg('author');
const DRY_RUN = hasFlag('dry-run');
const FORCE = hasFlag('force');

interface StoryInfo {
  id: number;
  title: string;
  author: { username: string };
  _count: { nodes: number };
}

async function findStories(): Promise<StoryInfo[]> {
  const where: any = {};
  
  if (STORY_ID) {
    where.id = parseInt(STORY_ID, 10);
  }
  
  if (STORY_TITLE) {
    where.title = { contains: STORY_TITLE };
  }
  
  if (AUTHOR_USERNAME) {
    where.author = { username: AUTHOR_USERNAME };
  }
  
  if (Object.keys(where).length === 0) {
    throw new Error('请指定删除条件：--id、--title 或 --author');
  }
  
  return await prisma.stories.findMany({
    where,
    select: {
      id: true,
      title: true,
      author: { select: { username: true } },
      _count: { select: { nodes: true } }
    }
  }) as StoryInfo[];
}

async function deleteStory(storyId: number): Promise<{ nodeCount: number }> {
  // 使用事务确保数据一致性
  return await prisma.$transaction(async (tx) => {
    // 1. 删除所有相关数据（按依赖顺序）
    
    // 删除节点书签
    await tx.node_bookmarks.deleteMany({
      where: { node: { story_id: storyId } }
    });
    
    // 删除评论投票
    await tx.comment_votes.deleteMany({
      where: { comment: { node: { story_id: storyId } } }
    });
    
    // 删除评论
    await tx.comments.deleteMany({
      where: { node: { story_id: storyId } }
    });
    
    // 删除节点
    const nodeResult = await tx.nodes.deleteMany({
      where: { story_id: storyId }
    });
    
    // 删除故事关注者
    await tx.story_followers.deleteMany({
      where: { story_id: storyId }
    });
    
    // 删除协作请求
    await tx.collaboration_requests.deleteMany({
      where: { story_id: storyId }
    });
    
    // 删除协作者
    await tx.story_collaborators.deleteMany({
      where: { story_id: storyId }
    });
    
    // 删除故事
    await tx.stories.delete({
      where: { id: storyId }
    });
    
    return { nodeCount: nodeResult.count };
  });
}

async function main() {
  console.log('🗑️  StoryTree 故事删除工具\n');
  
  if (DRY_RUN) {
    console.log('🔍 [预览模式] 不会实际删除数据\n');
  }
  
  try {
    // 查找匹配的故事
    const stories = await findStories();
    
    if (stories.length === 0) {
      console.log('⚠️  没有找到匹配的故事');
      return;
    }
    
    console.log(`📖 找到 ${stories.length} 个匹配的故事:\n`);
    console.log('ID\t章节数\t作者\t\t标题');
    console.log('-'.repeat(60));
    stories.forEach(s => {
      console.log(`${s.id}\t${s._count.nodes}\t${s.author.username.padEnd(12)}\t${s.title}`);
    });
    console.log('');
    
    // 安全检查
    if (stories.length > 1 && !FORCE) {
      console.log('⚠️  将删除多个故事！如确认删除，请添加 --force 参数');
      return;
    }
    
    if (DRY_RUN) {
      console.log('✅ 预览完成，使用以下命令正式删除:');
      if (STORY_ID) {
        console.log(`   npx ts-node scripts/delete-story.ts --id ${STORY_ID}`);
      } else if (STORY_TITLE) {
        console.log(`   npx ts-node scripts/delete-story.ts --title "${STORY_TITLE}" --force`);
      } else if (AUTHOR_USERNAME) {
        console.log(`   npx ts-node scripts/delete-story.ts --author ${AUTHOR_USERNAME} --force`);
      }
      return;
    }
    
    // 执行删除
    let totalNodes = 0;
    for (const story of stories) {
      console.log(`🗑️  删除: "${story.title}" (ID: ${story.id})...`);
      const result = await deleteStory(story.id);
      totalNodes += result.nodeCount;
      console.log(`   ✅ 已删除 ${result.nodeCount} 个章节`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 删除完成汇总:');
    console.log(`   删除故事: ${stories.length} 个`);
    console.log(`   删除章节: ${totalNodes} 个`);
    console.log('='.repeat(50));
    
  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
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

