/**
 * seed-stories.js - 批量生成种子故事树
 *
 * 使用 AI（千问/Anthropic）自动生成不同题材的分支故事，
 * 直接通过 Prisma 写入数据库，用于平台冷启动。
 *
 * 用法：
 *   cd api && node ../scripts/seed-stories.js [--count 10] [--author-id 1] [--dry-run]
 *
 * 参数：
 *   --count      生成故事数量（默认 10）
 *   --author-id  故事作者ID（默认 1，即管理员账号）
 *   --dry-run    仅打印生成内容，不写入数据库
 */

const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const path = require('path');

// 加载 api/.env
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });

const prisma = new PrismaClient();

// AI 客户端（千问 OpenAI 兼容接口）
const aiClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.QWEN_API_KEY
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://api.anthropic.com/v1',
});

const AI_MODEL = process.env.QWEN_MODEL || 'qwen-plus';

// ============================================================
// 故事模板定义
// ============================================================
const STORY_TEMPLATES = [
  {
    genre: '悬疑推理',
    tags: '悬疑推理,短篇小说,原创',
    prompt: '写一个悬疑推理故事，有密室、线索和反转。故事在关键时刻分成不同的推理方向，每条线索指向不同的凶手。',
    branches: 3,
  },
  {
    genre: '言情',
    tags: '言情,校园,短篇小说,原创',
    prompt: '写一个校园言情故事，主角面临重要的情感选择。在告白时刻分支：不同的选择带来不同的恋爱走向和结局。',
    branches: 3,
  },
  {
    genre: '奇幻冒险',
    tags: '奇幻,冒险,短篇小说,原创',
    prompt: '写一个奇幻冒险故事，主角在一片未知大陆探险。在关键岔路口分支：选择不同的路径会遇到不同的挑战和伙伴。',
    branches: 3,
  },
  {
    genre: '科幻',
    tags: '科幻,末世,短篇小说,原创',
    prompt: '写一个近未来科幻故事，AI觉醒后人类面临抉择。在关键决策点分支：合作、对抗或逃离，走向不同的未来。',
    branches: 3,
  },
  {
    genre: '都市悬疑',
    tags: '都市,悬疑推理,短篇小说,原创',
    prompt: '写一个都市悬疑故事，普通上班族意外卷入阴谋。在发现真相的瞬间分支：报警、独自调查或选择沉默，命运截然不同。',
    branches: 3,
  },
  {
    genre: '武侠',
    tags: '武侠,江湖,短篇小说,原创',
    prompt: '写一个武侠故事，少年侠客初入江湖面临正邪之争。在师门被灭之夜分支：复仇、隐忍或投靠敌方卧底，走上不同的江湖路。',
    branches: 3,
  },
  {
    genre: '恐怖灵异',
    tags: '恐怖灵异,短篇小说,原创',
    prompt: '写一个恐怖故事，几个朋友在荒废医院探险。在遭遇诡异事件后分支：逃跑、深入探索或呼救，每条路都有不同的恐怖真相。',
    branches: 3,
  },
  {
    genre: '穿越重生',
    tags: '穿越,重生,短篇小说,原创',
    prompt: '写一个穿越故事，现代人穿越到古代面临生存挑战。在第一个重大事件中分支：依附权贵、自立门户或隐姓埋名，命运各不相同。',
    branches: 3,
  },
  {
    genre: '职场',
    tags: '职场,都市,短篇小说,原创',
    prompt: '写一个职场故事，新人在大厂面对复杂的人际和抉择。在关键项目的决策点分支：坚持原则、妥协上司或跳槽创业，职业道路分叉。',
    branches: 3,
  },
  {
    genre: '仙侠',
    tags: '仙侠,冒险,短篇小说,原创',
    prompt: '写一个仙侠修仙故事，天资平凡的少年获得奇遇。在突破瓶颈时分支：正道修行、魔道捷径或独辟蹊径，修仙之路各有险阻。',
    branches: 3,
  },
];

// ============================================================
// AI 生成函数
// ============================================================

async function generateWithAI(systemPrompt, userPrompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 4000,
      });
      return response.choices[0]?.message?.content || '';
    } catch (err) {
      console.error(`  AI 调用失败 (第${i + 1}次):`, err.message);
      if (i < retries - 1) {
        await sleep(3000 * (i + 1));
      }
    }
  }
  throw new Error('AI 调用多次失败，放弃');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全解析 AI 返回的 JSON
 */
function safeParseJSON(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let jsonStr = jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch (_) {}
  // 清理控制字符后重试
  try {
    jsonStr = jsonStr
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .replace(/\t/g, '\\t')
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/(?<!\\)\n/g, '\\n');
    return JSON.parse(jsonStr);
  } catch (_) {}
  return null;
}

// ============================================================
// 故事生成核心逻辑
// ============================================================

async function generateStoryTree(template, authorId) {
  console.log(`\n📖 生成故事：${template.genre}...`);

  // Step 1: 生成故事大纲（标题 + 描述 + 根章节 + 分支概要）
  const outlinePrompt = `你是一个专业的互动小说作家。请根据要求生成一棵"故事树"的完整大纲。

要求：
- 题材：${template.genre}
- 核心设定：${template.prompt}
- 分支数量：${template.branches} 个不同走向

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "故事标题（8字以内，吸引人）",
  "description": "故事简介（50-100字，交代背景和悬念）",
  "rootChapter": {
    "title": "第一章标题",
    "summary": "第一章内容概要（30字）"
  },
  "branches": [
    {
      "title": "分支1标题",
      "summary": "分支1走向概要（30字）"
    },
    {
      "title": "分支2标题",
      "summary": "分支2走向概要（30字）"
    },
    {
      "title": "分支3标题",
      "summary": "分支3走向概要（30字）"
    }
  ]
}`;

  const outlineText = await generateWithAI(
    '你是专业的互动小说作家，擅长创作多结局分支故事。只返回JSON，不加任何其他文字。',
    outlinePrompt
  );

  const outline = safeParseJSON(outlineText);
  if (!outline || !outline.title || !outline.branches) {
    console.error('  ❌ 大纲解析失败，跳过');
    console.error('  原始返回:', outlineText.substring(0, 200));
    return null;
  }

  console.log(`  标题：${outline.title}`);
  console.log(`  分支：${outline.branches.length} 个`);

  // Step 2: 生成根章节正文
  await sleep(1000);
  const rootContent = await generateWithAI(
    '你是专业小说作家。直接输出小说正文，不要加标题、不要加任何前缀说明。文字生动有画面感，800-1200字。',
    `请写以下故事的开篇章节正文：
故事名：《${outline.title}》
故事简介：${outline.description}
本章概要：${outline.rootChapter.summary}
要求：结尾留下悬念，暗示接下来读者将面临不同的选择方向。`
  );

  // Step 3: 生成各分支章节正文
  const branchContents = [];
  for (let i = 0; i < outline.branches.length; i++) {
    await sleep(1500);
    console.log(`  生成分支 ${i + 1}/${outline.branches.length}: ${outline.branches[i].title}`);

    const branchContent = await generateWithAI(
      '你是专业小说作家。直接输出小说正文，不要加标题、不要加任何前缀说明。文字生动有画面感，600-1000字。',
      `续写以下故事的一个分支：
故事名：《${outline.title}》
前情：${outline.rootChapter.summary}
本分支方向：${outline.branches[i].summary}
本章标题：${outline.branches[i].title}
要求：展现这个选择带来的独特发展，有明确的情节推进和情绪转折。结尾可以是一个小高潮或新悬念。`
    );

    branchContents.push(branchContent);
  }

  return { outline, rootContent, branchContents };
}

// ============================================================
// 数据库写入
// ============================================================

async function saveStoryTree(data, template, authorId) {
  const { outline, rootContent, branchContents } = data;

  // 创建故事
  const story = await prisma.stories.create({
    data: {
      title: outline.title,
      description: outline.description,
      cover_image: '/assets/default-cover.jpg',
      author_id: authorId,
      visibility: 'public',
      tags: template.tags,
      ai_assisted_created: true,
      ai_creation_method: 'template',
      allow_branch: true,
      allow_comment: true,
      updated_at: new Date(),
    },
  });

  // 创建根节点
  const rootNode = await prisma.nodes.create({
    data: {
      story_id: story.id,
      parent_id: null,
      author_id: authorId,
      title: outline.rootChapter.title,
      content: rootContent,
      path: '1',
      sort_order: 0,
      ai_generated: true,
      is_published: true,
      review_status: 'APPROVED',
      updated_at: new Date(),
    },
  });

  // 更新 root_node_id
  await prisma.stories.update({
    where: { id: story.id },
    data: { root_node_id: rootNode.id },
  });

  // 创建分支节点
  for (let i = 0; i < outline.branches.length; i++) {
    await prisma.nodes.create({
      data: {
        story_id: story.id,
        parent_id: rootNode.id,
        author_id: authorId,
        title: outline.branches[i].title,
        content: branchContents[i],
        path: `1-${i + 1}`,
        sort_order: i,
        ai_generated: true,
        is_published: true,
        review_status: 'APPROVED',
        updated_at: new Date(),
      },
    });
  }

  console.log(`  ✅ 已保存：故事ID=${story.id}，根节点ID=${rootNode.id}，分支=${outline.branches.length}个`);
  return story.id;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(getArg(args, '--count') || '10');
  const authorId = parseInt(getArg(args, '--author-id') || '1');
  const dryRun = args.includes('--dry-run');

  console.log('🌳 StoryTree 种子故事生成器');
  console.log('================================');
  console.log(`  生成数量：${count}`);
  console.log(`  作者ID：${authorId}`);
  console.log(`  AI模型：${AI_MODEL}`);
  console.log(`  模式：${dryRun ? '预览（不写入数据库）' : '正式写入'}`);
  console.log('================================\n');

  // 检查 AI API Key
  if (!process.env.QWEN_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error('❌ 错误：未配置 QWEN_API_KEY 或 ANTHROPIC_API_KEY');
    console.error('   请在 api/.env 中配置 AI 服务密钥');
    process.exit(1);
  }

  // 检查作者是否存在
  if (!dryRun) {
    const author = await prisma.users.findUnique({ where: { id: authorId } });
    if (!author) {
      console.error(`❌ 错误：作者ID=${authorId} 不存在`);
      console.error('   请指定有效的 --author-id，或先创建用户');
      process.exit(1);
    }
    console.log(`👤 作者：${author.username}\n`);
  }

  // 循环生成
  const templates = shuffleArray([...STORY_TEMPLATES]);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    console.log(`\n[${i + 1}/${count}] ============================`);

    try {
      const data = await generateStoryTree(template, authorId);
      if (!data) {
        failCount++;
        continue;
      }

      if (dryRun) {
        console.log(`  📝 [预览] ${data.outline.title}`);
        console.log(`     描述：${data.outline.description}`);
        console.log(`     根章节：${data.rootContent.substring(0, 80)}...`);
        console.log(`     分支数：${data.branchContents.length}`);
        successCount++;
      } else {
        await saveStoryTree(data, template, authorId);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ 生成失败: ${err.message}`);
      failCount++;
    }

    // 请求间隔，避免 API 限流
    if (i < count - 1) {
      await sleep(2000);
    }
  }

  console.log('\n\n================================');
  console.log(`🎉 完成！成功：${successCount}，失败：${failCount}`);
  if (!dryRun && successCount > 0) {
    console.log(`\n💡 提示：访问 /discover.html 查看生成的故事`);
  }
  console.log('================================');
}

// ============================================================
// 工具函数
// ============================================================

function getArg(args, name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 执行
main()
  .catch((err) => {
    console.error('💥 致命错误:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
