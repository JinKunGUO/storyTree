/**
 * 对数据库中的单章节故事执行智能分章
 *
 * 直接操作数据库，无需依赖 seed-data JSON 文件。
 * 适用于生产环境中已导入但未分章的公版书。
 *
 * 用法：
 *   cd api && npx ts-node scripts/split-db-chapters.ts
 *   cd api && npx ts-node scripts/split-db-chapters.ts --dry-run       # 只统计不写入
 *   cd api && npx ts-node scripts/split-db-chapters.ts --story-id 123  # 只处理指定故事
 *   cd api && npx ts-node scripts/split-db-chapters.ts --min-length 5000  # 自定义最小内容阈值
 *   cd api && npx ts-node scripts/split-db-chapters.ts --limit 10      # 限制处理数量
 */

import { PrismaClient } from '@prisma/client';
import { splitIntoChapters, SplitOptions } from './split-chapters';

const prisma = new PrismaClient();

const BATCH_SIZE = 50; // 每批创建的 node 数量

// ============ 命令行参数 ============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_STORY_ID = getArg('story-id') ? parseInt(getArg('story-id')!, 10) : undefined;
const MIN_CONTENT_LENGTH = parseInt(getArg('min-length') || '3000', 10);
const LIMIT = getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined;

// 分章选项
const SPLIT_OPTIONS: SplitOptions = {
  minChapterLength: 1500,
  targetChapterLength: 6000,
  maxChapterLength: 10000,
};

// ============ 统计 ============

interface Stats {
  totalSingleChapter: number;
  skippedTooShort: number;
  skippedSplitFailed: number;
  processed: number;
  totalChaptersCreated: number;
  errors: string[];
  details: { storyId: number; title: string; contentLength: number; newChapters: number }[];
}

const stats: Stats = {
  totalSingleChapter: 0,
  skippedTooShort: 0,
  skippedSplitFailed: 0,
  processed: 0,
  totalChaptersCreated: 0,
  errors: [],
  details: [],
};

// ============ 核心逻辑 ============

async function splitStoryChapters(storyId: number, storyTitle: string, node: { id: number; content: string; author_id: number | null; }): Promise<void> {
  const content = node.content || '';

  if (content.length < MIN_CONTENT_LENGTH) {
    stats.skippedTooShort++;
    return;
  }

  // 执行分章
  const newChapters = splitIntoChapters(content, SPLIT_OPTIONS);

  if (newChapters.length <= 1) {
    stats.skippedSplitFailed++;
    return;
  }

  console.log(`  📖 "${storyTitle}" (ID: ${storyId}): ${content.length.toLocaleString()} 字 → ${newChapters.length} 章`);

  if (DRY_RUN) {
    stats.processed++;
    stats.totalChaptersCreated += newChapters.length;
    stats.details.push({ storyId, title: storyTitle, contentLength: content.length, newChapters: newChapters.length });
    return;
  }

  // 写入数据库：删除旧 node → 创建新 nodes
  try {
    // 1. 删除旧的单个 node
    await prisma.nodes.deleteMany({
      where: { story_id: storyId }
    });

    // 2. 分批创建新 nodes（链式结构）
    let rootNodeId: number | null = null;
    let prevNodeId: number | null = null;
    const authorId = node.author_id ?? 1; // fallback to admin (id=1) if null

    for (let batchStart = 0; batchStart < newChapters.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, newChapters.length);
      const batchChapters = newChapters.slice(batchStart, batchEnd);

      // 获取上一批的最后一个 node id
      if (batchStart > 0) {
        const lastNode = await prisma.nodes.findFirst({
          where: { story_id: storyId },
          orderBy: { sort_order: 'desc' },
          select: { id: true }
        });
        prevNodeId = lastNode?.id ?? null;
      }

      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < batchChapters.length; i++) {
          const globalIndex = batchStart + i;
          const chapter = batchChapters[i];

          const createdNode: { id: number } = await tx.nodes.create({
            data: {
              story_id: storyId,
              parent_id: prevNodeId,
              author_id: authorId,
              title: chapter.title,
              content: chapter.content,
              path: `${globalIndex + 1}`,
              sort_order: globalIndex + 1,
              is_published: true,
              review_status: 'APPROVED',
              updated_at: new Date()
            }
          });

          prevNodeId = createdNode.id;
          if (globalIndex === 0) rootNodeId = createdNode.id;
        }
      }, { maxWait: 10000, timeout: 30000 });
    }

    // 3. 更新故事的 root_node_id
    if (rootNodeId) {
      await prisma.stories.update({
        where: { id: storyId },
        data: { root_node_id: rootNodeId, updated_at: new Date() }
      });
    }

    stats.processed++;
    stats.totalChaptersCreated += newChapters.length;
    stats.details.push({ storyId, title: storyTitle, contentLength: content.length, newChapters: newChapters.length });
    console.log(`  ✅ 完成 (${newChapters.length} 章)`);

  } catch (err: any) {
    stats.errors.push(`故事 "${storyTitle}" (ID: ${storyId}): ${err.message}`);
    console.error(`  ❌ 失败: ${err.message}`);
  }
}

// ============ 主入口 ============

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  数据库单章节故事智能分章工具');
  console.log('='.repeat(60));
  console.log(`  最小内容阈值: ${MIN_CONTENT_LENGTH} 字`);
  console.log(`  模式: ${DRY_RUN ? '预览（不写入）' : '⚠️  执行写入'}`);
  if (SPECIFIC_STORY_ID) console.log(`  指定故事 ID: ${SPECIFIC_STORY_ID}`);
  if (LIMIT) console.log(`  处理数量限制: ${LIMIT}`);
  console.log('='.repeat(60));
  console.log('');

  // 查询所有只有 1 个 node 的故事
  let whereClause: any = {};
  if (SPECIFIC_STORY_ID) {
    whereClause = { id: SPECIFIC_STORY_ID };
  }

  const stories = await prisma.stories.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      nodes: {
        select: { id: true, content: true, author_id: true },
        orderBy: { sort_order: 'asc' }
      }
    }
  });

  // 筛选只有 1 个 node 的故事
  const singleChapterStories = stories.filter(s => s.nodes.length === 1);
  stats.totalSingleChapter = singleChapterStories.length;

  console.log(`📊 数据库中共 ${stories.length} 个故事，其中 ${singleChapterStories.length} 个只有 1 个章节`);
  console.log('');

  // 按内容长度降序排列（优先处理最大的）
  const sorted = singleChapterStories
    .map(s => ({
      ...s,
      contentLength: (s.nodes[0]?.content || '').length
    }))
    .filter(s => s.contentLength >= MIN_CONTENT_LENGTH)
    .sort((a, b) => b.contentLength - a.contentLength);

  const toProcess = LIMIT ? sorted.slice(0, LIMIT) : sorted;

  console.log(`📋 符合条件（内容≥${MIN_CONTENT_LENGTH}字）的故事: ${sorted.length} 个`);
  if (LIMIT && sorted.length > LIMIT) {
    console.log(`   限制处理前 ${LIMIT} 个`);
  }
  console.log('');

  for (const story of toProcess) {
    await splitStoryChapters(story.id, story.title, story.nodes[0]);
  }

  // 输出统计报告
  console.log('');
  console.log('='.repeat(60));
  console.log('  分章统计报告');
  console.log('='.repeat(60));
  console.log(`  数据库单章节故事总数:   ${stats.totalSingleChapter}`);
  console.log(`  跳过（内容太短）:       ${stats.skippedTooShort}`);
  console.log(`  跳过（无法分割）:       ${stats.skippedSplitFailed}`);
  console.log(`  成功分章故事数:         ${stats.processed}`);
  console.log(`  新创建章节总数:         ${stats.totalChaptersCreated}`);
  console.log('');

  if (stats.details.length > 0) {
    console.log('  分章详情（按章节数降序）:');
    console.log('  ' + '-'.repeat(56));
    const detailsSorted = stats.details.sort((a, b) => b.newChapters - a.newChapters);
    for (const d of detailsSorted.slice(0, 30)) {
      console.log(`  ${d.title.padEnd(20)} | ${d.contentLength.toLocaleString().padStart(10)} 字 → ${d.newChapters} 章`);
    }
    if (detailsSorted.length > 30) {
      console.log(`  ... 还有 ${detailsSorted.length - 30} 个`);
    }
  }

  if (stats.errors.length > 0) {
    console.log('');
    console.log('  ❌ 错误列表:');
    for (const err of stats.errors) {
      console.log(`    - ${err}`);
    }
  }

  if (DRY_RUN && stats.processed > 0) {
    console.log('');
    console.log('  💡 提示: 当前为预览模式，去掉 --dry-run 参数可执行实际写入');
  }
}

main()
  .catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
