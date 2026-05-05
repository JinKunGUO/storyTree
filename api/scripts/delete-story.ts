import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 删除故事脚本
 * 
 * 用法：
 *   npx ts-node scripts/delete-story.ts --id 123
 *   npx ts-node scripts/delete-story.ts --title "西游记"
 *   npx ts-node scripts/delete-story.ts --author-id 1
 *   npx ts-node scripts/delete-story.ts --id 123 --dry-run
 */

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const STORY_ID = getArg('id');
const STORY_TITLE = getArg('title');
const AUTHOR_ID = getArg('author-id');
const DRY_RUN = args.includes('--dry-run');

async function deleteStoryById(storyId: number): Promise<void> {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    include: {
      _count: {
        select: { nodes: true }
      },
      author: { select: { username: true } }
    }
  });

  if (!story) {
    console.log(`❌ 故事 ID ${storyId} 不存在`);
    return;
  }

  console.log(`📖 找到故事: "${story.title}"`);
  console.log(`   作者: ${story.author.username}`);
  console.log(`   章节数: ${story._count.nodes}`);
  console.log(`   创建时间: ${story.created_at.toISOString()}`);

  if (DRY_RUN) {
    console.log(`\n🔍 [DRY RUN] 将删除此故事及其所有章节、评论、书签等`);
    return;
  }

  // 级联删除（Prisma 会自动处理 onDelete: Cascade）
  await prisma.stories.delete({
    where: { id: storyId }
  });

  console.log(`✅ 故事 "${story.title}" 已删除`);
}

async function deleteStoriesByTitle(title: string): Promise<void> {
  const stories = await prisma.stories.findMany({
    where: {
      title: { contains: title }
    },
    include: {
      _count: { select: { nodes: true } },
      author: { select: { username: true } }
    }
  });

  if (stories.length === 0) {
    console.log(`❌ 没有找到标题包含 "${title}" 的故事`);
    return;
  }

  console.log(`📚 找到 ${stories.length} 个匹配的故事:\n`);
  stories.forEach((s, i) => {
    console.log(`   ${i + 1}. [ID: ${s.id}] "${s.title}" (${s._count.nodes} 章) - 作者: ${s.author.username}`);
  });

  if (DRY_RUN) {
    console.log(`\n🔍 [DRY RUN] 将删除以上所有故事`);
    return;
  }

  for (const story of stories) {
    await prisma.stories.delete({ where: { id: story.id } });
    console.log(`   ✅ 已删除: "${story.title}"`);
  }

  console.log(`\n✅ 共删除 ${stories.length} 个故事`);
}

async function deleteStoriesByAuthor(authorId: number): Promise<void> {
  const author = await prisma.users.findUnique({
    where: { id: authorId },
    select: { username: true }
  });

  if (!author) {
    console.log(`❌ 用户 ID ${authorId} 不存在`);
    return;
  }

  const stories = await prisma.stories.findMany({
    where: { author_id: authorId },
    include: {
      _count: { select: { nodes: true } }
    }
  });

  if (stories.length === 0) {
    console.log(`❌ 用户 "${author.username}" 没有创建任何故事`);
    return;
  }

  console.log(`📚 用户 "${author.username}" 的故事 (${stories.length} 个):\n`);
  stories.forEach((s, i) => {
    console.log(`   ${i + 1}. [ID: ${s.id}] "${s.title}" (${s._count.nodes} 章)`);
  });

  if (DRY_RUN) {
    console.log(`\n🔍 [DRY RUN] 将删除以上所有故事`);
    return;
  }

  for (const story of stories) {
    await prisma.stories.delete({ where: { id: story.id } });
    console.log(`   ✅ 已删除: "${story.title}"`);
  }

  console.log(`\n✅ 共删除 ${stories.length} 个故事`);
}

async function main() {
  console.log('🗑️  StoryTree 故事删除工具\n');

  if (DRY_RUN) {
    console.log('🔍 [DRY RUN 模式] 仅预览，不实际删除\n');
  }

  if (STORY_ID) {
    await deleteStoryById(parseInt(STORY_ID));
  } else if (STORY_TITLE) {
    await deleteStoriesByTitle(STORY_TITLE);
  } else if (AUTHOR_ID) {
    await deleteStoriesByAuthor(parseInt(AUTHOR_ID));
  } else {
    console.log('用法:');
    console.log('  npx ts-node scripts/delete-story.ts --id 123');
    console.log('  npx ts-node scripts/delete-story.ts --title "西游记"');
    console.log('  npx ts-node scripts/delete-story.ts --author-id 1');
    console.log('  npx ts-node scripts/delete-story.ts --id 123 --dry-run');
    console.log('\n参数:');
    console.log('  --id <故事ID>       删除指定 ID 的故事');
    console.log('  --title <标题>      删除标题包含指定文字的故事');
    console.log('  --author-id <用户ID> 删除指定用户的所有故事');
    console.log('  --dry-run           预览模式，不实际删除');
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

