import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * 批量导入公版书/故事到数据库
 * 
 * 用法：
 *   cd api && npx ts-node scripts/batch-import-stories.ts
 *   cd api && npx ts-node scripts/batch-import-stories.ts --file seed-data/西游记.json
 *   cd api && npx ts-node scripts/batch-import-stories.ts --admin-username admin
 * 
 * JSON 数据格式：
 *   {
 *     "title": "故事标题",
 *     "description": "故事简介",
 *     "tags": "标签1,标签2",
 *     "chapters": [
 *       { "title": "第一回 ...", "content": "正文内容..." },
 *       { "title": "第二回 ...", "content": "正文内容..." }
 *     ]
 *   }
 */

interface ChapterData {
  title: string;
  content: string;
}

interface StoryData {
  title: string;
  description?: string;
  tags?: string;
  cover_image?: string;
  chapters: ChapterData[];
}

const DEFAULT_COVER = '/assets/default-cover.jpg';

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const SEED_DATA_DIR = path.join(__dirname, 'seed-data');
const SPECIFIC_FILE = getArg('file');
const ADMIN_USERNAME = getArg('admin-username') || 'admin';
const DRY_RUN = args.includes('--dry-run');

async function getAdminUser() {
  const admin = await prisma.users.findUnique({
    where: { username: ADMIN_USERNAME },
    select: { id: true, username: true, isAdmin: true }
  });
  if (!admin) {
    throw new Error(`管理员用户 "${ADMIN_USERNAME}" 不存在，请先运行 create-admin.ts`);
  }
  if (!admin.isAdmin) {
    throw new Error(`用户 "${ADMIN_USERNAME}" 不是管理员`);
  }
  return admin;
}

async function importStory(storyData: StoryData, authorId: number): Promise<{ storyId: number; nodeCount: number; wordCount: number }> {
  // 检查是否已存在同名故事（断点续传）
  const existing = await prisma.stories.findFirst({
    where: { title: storyData.title, author_id: authorId }
  });
  if (existing) {
    console.log(`  ⏭️  跳过已存在的故事: "${storyData.title}" (ID: ${existing.id})`);
    return { storyId: existing.id, nodeCount: 0, wordCount: 0 };
  }

  if (!storyData.chapters || storyData.chapters.length === 0) {
    throw new Error(`故事 "${storyData.title}" 没有章节数据`);
  }

  // 使用事务批量创建
  const result = await prisma.$transaction(async (tx) => {
    // 1. 创建故事
    const story = await tx.stories.create({
      data: {
        title: storyData.title,
        description: storyData.description || '',
        cover_image: storyData.cover_image || DEFAULT_COVER,
        tags: storyData.tags || null,
        author_id: authorId,
        visibility: 'public',
        allow_branch: true,
        allow_comment: true,
        auto_approve_collaborators: true,  // 自动批准协作申请（允许任何人协作）
        require_collaborator_review: false, // 协作者内容无需审核
        updated_at: new Date()
      }
    });

    // 2. 逐章创建节点（平级结构：所有章节都是 root 的直接子节点）
    //    结构示意: root -> [第1章, 第2章, 第3章, ...]（平级，无嵌套）
    let prevNodeId: number | null = null;
    let rootNodeId: number | null = null;
    let totalWords = 0;

    for (let i = 0; i < storyData.chapters.length; i++) {
      const chapter = storyData.chapters[i];
      // path 计算：平级结构 "1", "2", "3", ...（避免深度嵌套）
      const nodePath = `${i + 1}`;
      
      // 章节标题为空时自动生成
      const chapterTitle = chapter.title?.trim() || `第 ${i + 1} 章`;

      const createdNode: { id: number } = await tx.nodes.create({
        data: {
          story_id: story.id,
          parent_id: prevNodeId, // 每章挂在上一章下面，形成链式结构
          author_id: authorId,
          title: chapterTitle,
          content: chapter.content,
          path: nodePath,
          is_published: true,
          review_status: 'APPROVED',
          updated_at: new Date()
        }
      });

      totalWords += chapter.content.length;

      if (i === 0) {
        rootNodeId = createdNode.id;
      }
      prevNodeId = createdNode.id;
    }

    // 3. 更新故事的 root_node_id
    await tx.stories.update({
      where: { id: story.id },
      data: { root_node_id: rootNodeId }
    });

    return { storyId: story.id, nodeCount: storyData.chapters.length, wordCount: totalWords };
  });

  return result;
}

async function main() {
  console.log('📚 StoryTree 批量导入工具\n');

  if (DRY_RUN) {
    console.log('🔍 [DRY RUN 模式] 仅检查数据，不写入数据库\n');
  }

  // 1. 获取管理员用户
  const admin = await getAdminUser();
  console.log(`✅ 管理员用户: ${admin.username} (ID: ${admin.id})\n`);

  // 2. 读取 JSON 文件列表
  let files: string[] = [];
  if (SPECIFIC_FILE) {
    const filePath = path.isAbsolute(SPECIFIC_FILE) ? SPECIFIC_FILE : path.join(SEED_DATA_DIR, SPECIFIC_FILE);
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    files = [filePath];
  } else {
    if (!fs.existsSync(SEED_DATA_DIR)) {
      console.log(`📁 创建 seed-data 目录: ${SEED_DATA_DIR}`);
      fs.mkdirSync(SEED_DATA_DIR, { recursive: true });
      console.log('\n⚠️  seed-data 目录为空，请先放入 JSON 数据文件');
      console.log('   JSON 格式示例见脚本头部注释');
      return;
    }
    files = fs.readdirSync(SEED_DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(SEED_DATA_DIR, f));
  }

  if (files.length === 0) {
    console.log('⚠️  没有找到 JSON 数据文件');
    return;
  }

  console.log(`📖 找到 ${files.length} 个数据文件:\n`);
  files.forEach(f => console.log(`   - ${path.basename(f)}`));
  console.log('');

  // 3. 逐个导入
  let totalStories = 0;
  let totalNodes = 0;
  let totalWords = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filename = path.basename(file);
    console.log(`📥 导入: ${filename}`);

    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const storyData: StoryData = JSON.parse(raw);

      // 验证数据
      if (!storyData.title) throw new Error('缺少 title 字段');
      if (!storyData.chapters || !Array.isArray(storyData.chapters)) throw new Error('缺少 chapters 数组');
      if (storyData.chapters.length === 0) throw new Error('chapters 为空');

      const emptyChapters = storyData.chapters.filter(c => !c.content || c.content.trim().length === 0);
      if (emptyChapters.length > 0) {
        console.log(`  ⚠️  ${emptyChapters.length} 个章节内容为空，将跳过`);
        storyData.chapters = storyData.chapters.filter(c => c.content && c.content.trim().length > 0);
      }

      console.log(`  📖 "${storyData.title}" - ${storyData.chapters.length} 章`);

      if (DRY_RUN) {
        const words = storyData.chapters.reduce((sum, c) => sum + c.content.length, 0);
        console.log(`  📊 总字数: ${words.toLocaleString()}`);
        totalWords += words;
        totalNodes += storyData.chapters.length;
        totalStories++;
        continue;
      }

      const result = await importStory(storyData, admin.id);
      if (result.nodeCount === 0) {
        skipped++;
      } else {
        totalStories++;
        totalNodes += result.nodeCount;
        totalWords += result.wordCount;
        console.log(`  ✅ 导入成功 (ID: ${result.storyId}, ${result.nodeCount} 章, ${result.wordCount.toLocaleString()} 字)`);
      }
    } catch (error: any) {
      failed++;
      // 显示更详细的错误信息
      const errorMsg = error.message || String(error);
      const errorCode = error.code || '';
      console.log(`  ❌ 导入失败: ${errorMsg}`);
      if (errorCode) console.log(`     错误代码: ${errorCode}`);
      // 如果是 Prisma 错误，显示更多信息
      if (error.meta) console.log(`     详情: ${JSON.stringify(error.meta)}`);
    }
  }

  // 4. 汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 导入完成汇总:');
  console.log(`   成功导入: ${totalStories} 部故事`);
  console.log(`   总章节数: ${totalNodes}`);
  console.log(`   总字数:   ${totalWords.toLocaleString()}`);
  if (skipped > 0) console.log(`   已跳过:   ${skipped} 部（已存在）`);
  if (failed > 0) console.log(`   失败:     ${failed} 部`);
  console.log('='.repeat(50));

  if (!DRY_RUN && totalStories > 0) {
    console.log('\n💡 提示: 导入完成后建议运行以下命令更新用户统计:');
    console.log('   npx ts-node scripts/recalculate-user-stats.ts');
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

