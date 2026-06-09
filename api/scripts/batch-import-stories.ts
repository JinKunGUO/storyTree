import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 50; // 每批导入的章节数，避免大事务超时

const prisma = new PrismaClient();

/**
 * 批量导入公版书/故事到数据库
 * 
 * 用法：
 *   cd api && npx ts-node scripts/batch-import-stories.ts
 *   cd api && npx ts-node scripts/batch-import-stories.ts --file seed-data/西游记.json
 *   cd api && npx ts-node scripts/batch-import-stories.ts --admin-username admin
 *   cd api && npx ts-node scripts/batch-import-stories.ts --update   # 更新已存在的故事（删旧章→写新章→更新标签）
 *   cd api && npx ts-node scripts/batch-import-stories.ts --dry-run  # 仅检查数据，不写入
 * 
 * --update 模式说明：
 *   对于已存在的同名故事，会：
 *   1. 保留故事 ID（用户收藏/关注不丢失）
 *   2. 删除所有旧章节
 *   3. 写入新章节（来自 JSON）
 *   4. 更新标签、描述等元数据
 *   适用场景：seed-data 中的 JSON 已更新（如重新分章、标签增强），需要同步到数据库
 * 
 * JSON 数据格式：
 *   {
 *     "title": "故事标题",
 *     "description": "故事简介",
 *     "author_name": "吴承恩",       // 可选：公版书原著作者，不填则使用管理员
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
  author_name?: string;  // 公版书原著作者，如"吴承恩"、"巴金"；不填则使用管理员
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
const UPDATE_MODE = args.includes('--update');

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

/**
 * 获取或创建虚拟用户（公版书原著作者）
 * - username 直接使用中文原名（如"吴承恩"），保持原语言
 * - 虚拟用户不可登录，仅用于前端展示
 * - 如已存在则复用
 * - 权限管理仍由管理员控制
 */
async function getOrCreateVirtualUser(authorName: string, adminId: number): Promise<number> {
  // 查找是否已存在同名虚拟用户
  const existing = await prisma.users.findFirst({
    where: { username: authorName, is_virtual: true }
  });
  if (existing) {
    console.log(`  🔁 复用虚拟用户: ${authorName} (ID: ${existing.id})`);
    return existing.id;
  }

  // 生成随机强密码（虚拟用户不可登录）
  const crypto = await import('crypto');
  const randomPassword = crypto.randomBytes(32).toString('base64');

  const virtualUser = await prisma.users.create({
    data: {
      username: authorName,             // 中文原名，如"吴承恩"
      password: randomPassword,          // 不可登录的随机密码
      is_virtual: true,
      isAdmin: false,
      email: null,
      updatedAt: new Date(),
    }
  });

  console.log(`  ✨ 创建虚拟用户: ${authorName} (ID: ${virtualUser.id})`);
  return virtualUser.id;
}

async function importStory(storyData: StoryData, adminId: number): Promise<{ storyId: number; nodeCount: number; wordCount: number; wasUpdated: boolean }> {
  // 确定作者：有 author_name 则创建/复用虚拟用户，否则使用管理员
  let authorId = adminId;
  if (storyData.author_name?.trim()) {
    authorId = await getOrCreateVirtualUser(storyData.author_name.trim(), adminId);
    console.log(`  📝 作者: ${storyData.author_name.trim()} (虚拟用户 ID: ${authorId})`);
  }

  // 检查是否已存在同名故事（断点续传）
  const existing = await prisma.stories.findFirst({
    where: { title: storyData.title }
  });

  if (existing) {
    if (UPDATE_MODE) {
      // --update 模式：删除旧章节 → 重新导入新章节 → 更新故事元数据
      console.log(`  🔄 更新模式: "${storyData.title}" (ID: ${existing.id})`);

      // 删除所有旧章节
      const deleteResult = await prisma.nodes.deleteMany({
        where: { story_id: existing.id }
      });
      console.log(`  🗑️  已删除 ${deleteResult.count} 个旧章节`);

      // 更新故事元数据（标签、描述、作者）
      await prisma.stories.update({
        where: { id: existing.id },
        data: {
          description: storyData.description || existing.description,
          tags: storyData.tags || existing.tags,
          cover_image: storyData.cover_image || existing.cover_image,
          author_id: authorId,
          root_node_id: null,
          updated_at: new Date()
        }
      });

      // 重新导入章节（复用下方逻辑）
      const chapters = storyData.chapters;
      let rootNodeId: number | null = null;
      let prevNodeId: number | null = null;
      let totalWords = 0;
      let importedCount = 0;

      for (let batchStart = 0; batchStart < chapters.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chapters.length);
        const batchChapters = chapters.slice(batchStart, batchEnd);

        if (batchStart > 0) {
          const lastNode = await prisma.nodes.findFirst({
            where: { story_id: existing.id },
            orderBy: { sort_order: 'desc' },
            select: { id: true }
          });
          prevNodeId = lastNode?.id ?? null;
        }

        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < batchChapters.length; i++) {
            const globalIndex = batchStart + i;
            const chapter = batchChapters[i];
            const chapterTitle = chapter.title?.trim() || `第 ${globalIndex + 1} 章`;

            const createdNode: { id: number } = await tx.nodes.create({
              data: {
                story_id: existing.id,
                parent_id: prevNodeId,
                author_id: authorId,
                title: chapterTitle,
                content: chapter.content,
                path: `${globalIndex + 1}`,
                sort_order: globalIndex + 1,
                is_published: true,
                review_status: 'APPROVED',
                updated_at: new Date()
              }
            });

            totalWords += chapter.content.length;
            prevNodeId = createdNode.id;
            if (globalIndex === 0) rootNodeId = createdNode.id;
          }
        }, { maxWait: 10000, timeout: 30000 });

        importedCount += batchChapters.length;
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(chapters.length / BATCH_SIZE);
        console.log(`  📦 批次 ${batchNum}/${totalBatches} 完成 (${importedCount}/${chapters.length} 章)`);
      }

      if (rootNodeId) {
        await prisma.stories.update({
          where: { id: existing.id },
          data: { root_node_id: rootNodeId }
        });
      }

      console.log(`  ✅ 更新完成 (${chapters.length} 章, ${totalWords.toLocaleString()} 字)`);
      return { storyId: existing.id, nodeCount: chapters.length, wordCount: totalWords, wasUpdated: true };
    }

    // 非 update 模式：跳过或迁移作者
    if (storyData.author_name?.trim() && existing.author_id === adminId) {
      console.log(`  🔄 迁移作者: "${storyData.title}" 从管理员 → ${storyData.author_name.trim()}`);
      await prisma.stories.update({
        where: { id: existing.id },
        data: { author_id: authorId }
      });
      const nodeResult = await prisma.nodes.updateMany({
        where: { story_id: existing.id, author_id: adminId },
        data: { author_id: authorId }
      });
      console.log(`  ✅ 已更新 (故事 + ${nodeResult.count} 个章节的作者)`);
    } else {
      console.log(`  ⏭️  跳过已存在的故事: "${storyData.title}" (ID: ${existing.id})`);
    }
    return { storyId: existing.id, nodeCount: 0, wordCount: 0, wasUpdated: false };
  }

  if (!storyData.chapters || storyData.chapters.length === 0) {
    throw new Error(`故事 "${storyData.title}" 没有章节数据`);
  }

  const chapters = storyData.chapters;
  let storyId: number;
  let rootNodeId: number | null = null;
  let totalWords = 0;
  let importedCount = 0;

  // 第一步：创建故事记录（单独事务，含超时保护）
  storyId = (await prisma.$transaction(async (tx) => {
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
        auto_approve_collaborators: true,
        require_collaborator_review: false,
        updated_at: new Date()
      }
    });
    return story.id;
  }, { maxWait: 10000, timeout: 30000 }));

  console.log(`  📖 故事已创建 (ID: ${storyId})，开始分批导入 ${chapters.length} 章...`);

  // 第二步：分批导入章节，每批 BATCH_SIZE 章
  for (let batchStart = 0; batchStart < chapters.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, chapters.length);
    const batchChapters = chapters.slice(batchStart, batchEnd);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chapters.length / BATCH_SIZE);

    // 查询当前故事最后一个节点，作为本批首章的 parent
    let prevNodeId: number | null = null;
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
        const nodePath = `${globalIndex + 1}`;
        const chapterTitle = chapter.title?.trim() || `第 ${globalIndex + 1} 章`;

        const createdNode: { id: number } = await tx.nodes.create({
          data: {
            story_id: storyId,
            parent_id: prevNodeId,
            author_id: authorId,
            title: chapterTitle,
            content: chapter.content,
            path: nodePath,
            sort_order: globalIndex + 1,
            is_published: true,
            review_status: 'APPROVED',
            updated_at: new Date()
          }
        });

        totalWords += chapter.content.length;
        prevNodeId = createdNode.id;

        if (globalIndex === 0) {
          rootNodeId = createdNode.id;
        }
      }
    }, { maxWait: 10000, timeout: 30000 });

    importedCount += batchChapters.length;
    console.log(`  📦 批次 ${batchNum}/${totalBatches} 完成 (${importedCount}/${chapters.length} 章)`);
  }

  // 第三步：更新故事的 root_node_id
  if (rootNodeId) {
    await prisma.stories.update({
      where: { id: storyId },
      data: { root_node_id: rootNodeId }
    });
  }

  return { storyId, nodeCount: chapters.length, wordCount: totalWords, wasUpdated: false };
}

async function main() {
  console.log('📚 StoryTree 批量导入工具\n');

  if (DRY_RUN) {
    console.log('🔍 [DRY RUN 模式] 仅检查数据，不写入数据库\n');
  }
  if (UPDATE_MODE) {
    console.log('🔄 [UPDATE 模式] 已存在的故事将被更新（删旧章→写新章→更新元数据）\n');
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
      .filter(f => f.endsWith('.json') && !f.startsWith('._'))
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
  let updated = 0;
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
      } else if (result.wasUpdated) {
        updated++;
        totalNodes += result.nodeCount;
        totalWords += result.wordCount;
      } else {
        totalStories++;
        totalNodes += result.nodeCount;
        totalWords += result.wordCount;
        console.log(`  ✅ 导入成功 (ID: ${result.storyId}, ${result.nodeCount} 章, ${result.wordCount.toLocaleString()} 字)`);
      }
    } catch (error: any) {
      failed++;
      const errorMsg = error.message || String(error);
      const errorCode = error.code || '';
      console.log(`  ❌ 导入失败: ${errorMsg}`);
      if (errorCode) console.log(`     错误代码: ${errorCode}`);
      if (error.meta) console.log(`     详情: ${JSON.stringify(error.meta)}`);

      // 如果是连接断开错误，尝试重连后继续处理后续文件
      if (errorCode === 'P1017' || errorMsg.includes('closed the connection') || errorMsg.includes('Connection')) {
        console.log('  🔄 检测到数据库连接断开，等待 2 秒后重连...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await prisma.$queryRaw`SELECT 1`;
          console.log('  ✅ 数据库连接已恢复');
        } catch {
          // 如果查不到，重新连接
          await prisma.$connect();
          console.log('  ✅ 数据库重新连接成功');
        }
      }
    }
  }

  // 4. 汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 导入完成汇总:');
  console.log(`   新增导入: ${totalStories} 部故事`);
  if (updated > 0) console.log(`   增量更新: ${updated} 部故事`);
  console.log(`   总章节数: ${totalNodes}`);
  console.log(`   总字数:   ${totalWords.toLocaleString()}`);
  if (skipped > 0) console.log(`   已跳过:   ${skipped} 部（已存在，未使用 --update）`);
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

