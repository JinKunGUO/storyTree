/**
 * seed-stories.js - 批量生成种子故事树（BFS 逐层生长版）
 *
 * 使用 AI（千问/Anthropic）自动生成不同题材的分支故事，
 * 直接通过 Prisma 写入数据库，用于平台冷启动。
 *
 * 生成策略：BFS 逐层生长
 *   - 每个叶子节点有三种命运：线性续写（1个子节点）、分叉（2-3个子节点）、终止
 *   - 由 branch-prob / terminate-prob 控制概率
 *   - 受 max-depth 和 max-nodes 约束，防止失控
 *
 * 用法：
 *   # 开发环境（自动加载 api/.env）
 *   cd api && node ../scripts/seed-stories.js [选项]
 *
 *   # 生产环境（设置 NODE_ENV 或指定 env 文件）
 *   NODE_ENV=production node scripts/seed-stories.js [选项]
 *   node scripts/seed-stories.js --env .env.production [选项]
 *
 * 参数：
 *   --env             指定环境变量文件（相对 api/ 目录，如 .env.production）
 *   --count           生成故事数量（默认 5）
 *   --author-id       故事作者ID（默认 1，即管理员账号）
 *   --dry-run         仅打印生成内容，不写入数据库
 *   --max-depth       树的最大深度，不含根节点（默认 3，即最多 4 层）
 *   --max-nodes       单棵树最大节点数（默认 25）
 *   --branch-prob     叶子节点分叉的概率（默认 0.4，即 40%）
 *   --terminate-prob  叶子节点终止生长的概率（默认 0.15，即 15%）
 *   --min-branches    分叉时最少分支数（默认 2）
 *   --max-branches    分叉时最多分支数（默认 3）
 *   --model           覆盖 QWEN_MODEL 环境变量（如 qwen-plus, qwen3.7-plus）
 */

const path = require('path');
const fs = require('fs');

// 将 api/node_modules 加入模块搜索路径，使得 @prisma/client、openai 等可被 require
const apiNodeModules = path.join(__dirname, '../api/node_modules');
if (!module.paths.includes(apiNodeModules)) {
  module.paths.unshift(apiNodeModules);
}

const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');

// 加载环境变量：优先使用 --env 指定的文件，然后按 NODE_ENV 选择 .env.production 或 .env
const args = process.argv.slice(2);
const envFile = getArg(args, '--env');
const apiDir = path.join(__dirname, '../api');

if (envFile) {
  // 显式指定 env 文件
  const envPath = path.isAbsolute(envFile) ? envFile : path.join(apiDir, envFile);
  require('dotenv').config({ path: envPath });
  console.log(`📦 加载环境变量：${envPath}`);
} else if (process.env.NODE_ENV === 'production') {
  // 生产环境优先加载 .env.production
  const prodEnv = path.join(apiDir, '.env.production');
  if (fs.existsSync(prodEnv)) {
    require('dotenv').config({ path: prodEnv });
    console.log(`📦 加载环境变量：${prodEnv}`);
  } else {
    require('dotenv').config({ path: path.join(apiDir, '.env') });
    console.log(`📦 加载环境变量：${path.join(apiDir, '.env')}（.env.production 不存在）`);
  }
} else {
  // 开发环境加载 .env
  require('dotenv').config({ path: path.join(apiDir, '.env') });
  console.log(`📦 加载环境变量：${path.join(apiDir, '.env')}`);
}

const prisma = new PrismaClient();

// AI 客户端（千问 OpenAI 兼容接口）
const aiClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.QWEN_API_KEY
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://api.anthropic.com/v1',
});

let AI_MODEL = process.env.QWEN_MODEL || 'qwen3.7-plus';

// ============================================================
// 故事模板定义
// ============================================================
const STORY_TEMPLATES = [
  {
    genre: '悬疑推理',
    tags: '悬疑推理,短篇小说,原创',
    prompt: '写一个悬疑推理故事，有密室、线索和反转。故事在关键时刻分成不同的推理方向，每条线索指向不同的凶手。',
  },
  {
    genre: '言情',
    tags: '言情,校园,短篇小说,原创',
    prompt: '写一个校园言情故事，主角面临重要的情感选择。在告白时刻分支：不同的选择带来不同的恋爱走向和结局。',
  },
  {
    genre: '奇幻冒险',
    tags: '奇幻,冒险,短篇小说,原创',
    prompt: '写一个奇幻冒险故事，主角在一片未知大陆探险。在关键岔路口分支：选择不同的路径会遇到不同的挑战和伙伴。',
  },
  {
    genre: '科幻',
    tags: '科幻,末世,短篇小说,原创',
    prompt: '写一个近未来科幻故事，AI觉醒后人类面临抉择。在关键决策点分支：合作、对抗或逃离，走向不同的未来。',
  },
  {
    genre: '都市悬疑',
    tags: '都市,悬疑推理,短篇小说,原创',
    prompt: '写一个都市悬疑故事，普通上班族意外卷入阴谋。在发现真相的瞬间分支：报警、独自调查或选择沉默，命运截然不同。',
  },
  {
    genre: '武侠',
    tags: '武侠,江湖,短篇小说,原创',
    prompt: '写一个武侠故事，少年侠客初入江湖面临正邪之争。在师门被灭之夜分支：复仇、隐忍或投靠敌方卧底，走上不同的江湖路。',
  },
  {
    genre: '恐怖灵异',
    tags: '恐怖灵异,短篇小说,原创',
    prompt: '写一个恐怖故事，几个朋友在荒废医院探险。在遭遇诡异事件后分支：逃跑、深入探索或呼救，每条路都有不同的恐怖真相。',
  },
  {
    genre: '穿越重生',
    tags: '穿越,重生,短篇小说,原创',
    prompt: '写一个穿越故事，现代人穿越到古代面临生存挑战。在第一个重大事件中分支：依附权贵、自立门户或隐姓埋名，命运各不相同。',
  },
  {
    genre: '职场',
    tags: '职场,都市,短篇小说,原创',
    prompt: '写一个职场故事，新人在大厂面对复杂的人际和抉择。在关键项目的决策点分支：坚持原则、妥协上司或跳槽创业，职业道路分叉。',
  },
  {
    genre: '仙侠',
    tags: '仙侠,冒险,短篇小说,原创',
    prompt: '写一个仙侠修仙故事，天资平凡的少年获得奇遇。在突破瓶颈时分支：正道修行、魔道捷径或独辟蹊径，修仙之路各有险阻。',
  },
];

// ============================================================
// AI 生成函数
// ============================================================

async function generateWithAI(systemPrompt, userPrompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // 使用流式调用，避免百炼部分模型非流式调用返回 403 "free quota exhausted"
      const stream = await aiClient.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 4000,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullText += delta;
      }
      return fullText;
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
// 树节点数据结构（内存中的故事树）
// ============================================================

/**
 * @typedef {Object} TreeNode
 * @property {string} title - 章节标题
 * @property {string} content - 章节正文
 * @property {string} summary - 内容概要（供 AI 上下文使用）
 * @property {string} path - 路径，如 '1-2-1'
 * @property {number} depth - 深度，根节点为 0
 * @property {number} sortOrder - 同级排序号
 * @property {number|null} parentId - 父节点数据库 ID（写入后填充）
 * @property {number|null} dbId - 数据库节点 ID（写入后填充）
 * @property {TreeNode[]} children - 子节点列表
 */

// ============================================================
// 生长决策函数
// ============================================================

/**
 * 决定一个叶子节点的生长方式
 * @returns {'terminate'|'continue'|'branch'}
 */
function decideGrowth(depth, maxDepth, branchProb, terminateProb, currentNodes, maxNodes) {
  // 硬性约束：达到最大深度或最大节点数
  if (depth >= maxDepth || currentNodes >= maxNodes) {
    return 'terminate';
  }

  const roll = Math.random();

  // 终止概率
  if (roll < terminateProb) {
    return 'terminate';
  }

  // 分叉概率（在非终止的情况下）
  if (roll < terminateProb + branchProb) {
    return 'branch';
  }

  // 剩余情况：线性续写
  return 'continue';
}

/**
 * 随机生成分支数量
 */
function randomBranchCount(minBranches, maxBranches, currentNodes, maxNodes) {
  const available = maxNodes - currentNodes;
  const upper = Math.min(maxBranches, available);
  const lower = Math.min(minBranches, upper);
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

// ============================================================
// 故事生成核心逻辑（BFS 逐层生长）
// ============================================================

async function generateStoryTree(template, opts) {
  const { maxDepth, maxNodes, branchProb, terminateProb, minBranches, maxBranches } = opts;

  console.log(`\n📖 生成故事：${template.genre}...`);

  // ---- Step 1: 生成故事大纲 ----
  const outlinePrompt = `你是一个专业的互动小说作家。请根据要求生成一棵"故事树"的开篇大纲。

要求：
- 题材：${template.genre}
- 核心设定：${template.prompt}

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "故事标题（8字以内，吸引人）",
  "description": "故事简介（50-100字，交代背景和悬念）",
  "rootChapter": {
    "title": "第一章标题",
    "summary": "第一章内容概要（30字）"
  }
}`;

  const outlineText = await generateWithAI(
    '你是专业的互动小说作家，擅长创作多结局分支故事。只返回JSON，不加任何其他文字。',
    outlinePrompt
  );

  const outline = safeParseJSON(outlineText);
  if (!outline || !outline.title || !outline.rootChapter) {
    console.error('  ❌ 大纲解析失败，跳过');
    console.error('  原始返回:', outlineText.substring(0, 200));
    return null;
  }

  console.log(`  标题：${outline.title}`);

  // ---- Step 2: 生成根章节正文 ----
  await sleep(1000);
  const rootContent = await generateWithAI(
    '你是专业小说作家。直接输出小说正文，不要加标题、不要加任何前缀说明。文字生动有画面感，800-1200字。',
    `请写以下故事的开篇章节正文：
故事名：《${outline.title}》
故事简介：${outline.description}
本章概要：${outline.rootChapter.summary}
要求：结尾留下悬念，暗示接下来读者将面临不同的选择方向。`
  );

  // ---- 构建根节点 ----
  /** @type {TreeNode} */
  const rootNode = {
    title: outline.rootChapter.title,
    content: rootContent,
    summary: outline.rootChapter.summary,
    path: '1',
    depth: 0,
    sortOrder: 0,
    parentId: null,
    dbId: null,
    children: [],
  };

  // ---- Step 3: BFS 逐层生长 ----
  let totalNodes = 1; // 已有根节点
  let leafQueue = [rootNode]; // 当前层的叶子节点
  let layerIndex = 1;

  while (leafQueue.length > 0 && totalNodes < maxNodes) {
    const nextLeaves = [];

    for (const leaf of leafQueue) {
      if (totalNodes >= maxNodes) break;

      // 根节点 (depth=0) 必须生长，不允许终止
      // 否则故事只有一个根节点，毫无意义
      let decision;
      if (leaf.depth === 0) {
        decision = Math.random() < branchProb ? 'branch' : 'continue';
      } else {
        decision = decideGrowth(leaf.depth, maxDepth, branchProb, terminateProb, totalNodes, maxNodes);
      }

      if (decision === 'terminate') {
        // 叶子终止生长，不做任何操作
        console.log(`  终止 [${leaf.path}] ${leaf.title}`);
        continue;
      }

      // 计算当前叶子已有的子节点数，用于 path 排序
      const existingChildCount = leaf.children.length;

      if (decision === 'continue') {
        // 线性续写：生成 1 个子节点
        await sleep(1200);
        const childSortOrder = existingChildCount + 1;
        console.log(`  续写 [${leaf.path}] ${leaf.title} → [${leaf.path}-${childSortOrder}]...`);

        try {
          const childNode = await generateContinuation(leaf, outline, childSortOrder);
          leaf.children.push(childNode);
          nextLeaves.push(childNode);
          totalNodes++;
        } catch (err) {
          console.error(`    续写失败: ${err.message}`);
        }
      } else {
        // 分叉：生成 2-3 个子节点
        const branchCount = randomBranchCount(minBranches, maxBranches, totalNodes, maxNodes);
        await sleep(1000);

        console.log(`  分叉 [${leaf.path}] ${leaf.title} → ${branchCount} 个分支...`);

        try {
          const branchOutline = await generateBranchOutline(leaf, outline, branchCount);
          if (!branchOutline || !branchOutline.branches) {
            // 分叉大纲失败，降级为线性续写
            console.log(`    大纲生成失败，降级为线性续写`);
            const childSortOrder = existingChildCount + 1;
            const childNode = await generateContinuation(leaf, outline, childSortOrder);
            leaf.children.push(childNode);
            nextLeaves.push(childNode);
            totalNodes++;
          } else {
            for (let i = 0; i < branchOutline.branches.length; i++) {
              if (totalNodes >= maxNodes) break;
              await sleep(1200);
              const childSortOrder = existingChildCount + i + 1;
              console.log(`    分支 ${i + 1}/${branchOutline.branches.length}: ${branchOutline.branches[i].title}`);

              const childNode = await generateBranchContent(
                leaf, outline, branchOutline.branches[i],
                childSortOrder, branchCount
              );
              leaf.children.push(childNode);
              nextLeaves.push(childNode);
              totalNodes++;
            }
          }
        } catch (err) {
          console.error(`    分叉失败: ${err.message}`);
        }
      }
    }

    leafQueue = nextLeaves;
    layerIndex++;
  }

  const actualDepth = countTreeDepth(rootNode);
  console.log(`  📊 总节点数：${totalNodes}，实际深度：${actualDepth} 层`);

  return { outline, rootNode, totalNodes };
}

// ============================================================
// 续写生成（线性续写 1 个子节点）
// ============================================================

async function generateContinuation(parentNode, outline, sortOrder) {
  const childPath = `${parentNode.path}-${sortOrder}`;

  const prompt = `续写以下故事的下一章节：
故事名：《${outline.title}》
故事简介：${outline.description}
前情概要：${parentNode.summary}
前情正文（节选）：${parentNode.content.substring(0, 300)}...

要求：
- 承接前文情节，自然推进故事发展
- 600-1000字
- 结尾可以留下小悬念或情绪转折

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "本章标题",
  "summary": "本章内容概要（30字）",
  "content": "本章正文（600-1000字）"
}`;

  const resultText = await generateWithAI(
    '你是专业小说作家。只返回JSON，不加任何其他文字。',
    prompt
  );

  const result = safeParseJSON(resultText);
  if (result && result.title && result.content) {
    return {
      title: result.title,
      content: result.content,
      summary: result.summary || result.content.substring(0, 30),
      path: childPath,
      depth: parentNode.depth + 1,
      sortOrder: sortOrder,
      parentId: null,
      dbId: null,
      children: [],
    };
  }

  // JSON 解析失败，用原始文本兜底
  return {
    title: `第${parentNode.depth + 2}章`,
    content: resultText,
    summary: resultText.substring(0, 30),
    path: childPath,
    depth: parentNode.depth + 1,
    sortOrder: sortOrder,
    parentId: null,
    dbId: null,
    children: [],
  };
}

// ============================================================
// 分叉大纲生成
// ============================================================

async function generateBranchOutline(parentNode, outline, branchCount) {
  const prompt = `为以下故事节点设计 ${branchCount} 个不同的分支方向：

故事名：《${outline.title}》
故事简介：${outline.description}
当前节点：${parentNode.title}
当前节点概要：${parentNode.summary}

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "branches": [
    ${Array.from({ length: branchCount }, (_, i) => `{
      "title": "分支${i + 1}标题（简洁有吸引力）",
      "summary": "分支${i + 1}走向概要（30字）"
    }`).join(',\n    ')}
  ]
}`;

  const resultText = await generateWithAI(
    '你是专业的互动小说作家，擅长设计多走向的分支剧情。只返回JSON，不加任何其他文字。',
    prompt
  );

  return safeParseJSON(resultText);
}

// ============================================================
// 分支内容生成
// ============================================================

async function generateBranchContent(parentNode, outline, branchInfo, branchIndex, totalBranches) {
  const childPath = `${parentNode.path}-${branchIndex}`;

  const prompt = `续写以下故事的一个分支：

故事名：《${outline.title}》
故事简介：${outline.description}
前情概要：${parentNode.summary}
前情正文（节选）：${parentNode.content.substring(0, 300)}...

本分支方向：${branchInfo.summary}
本章标题：${branchInfo.title}

要求：
- 展现这个选择带来的独特发展，与同层其他分支形成差异
- 有明确的情节推进和情绪转折
- 600-1000字
- 结尾可以是一个小高潮或新悬念

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "本章标题",
  "summary": "本章内容概要（30字）",
  "content": "本章正文（600-1000字）"
}`;

  const resultText = await generateWithAI(
    '你是专业小说作家。只返回JSON，不加任何其他文字。',
    prompt
  );

  const result = safeParseJSON(resultText);
  if (result && result.title && result.content) {
    return {
      title: result.title,
      content: result.content,
      summary: result.summary || result.content.substring(0, 30),
      path: childPath,
      depth: parentNode.depth + 1,
      sortOrder: branchIndex - 1,
      parentId: null,
      dbId: null,
      children: [],
    };
  }

  // JSON 解析失败兜底
  return {
    title: branchInfo.title,
    content: resultText,
    summary: branchInfo.summary,
    path: childPath,
    depth: parentNode.depth + 1,
    sortOrder: branchIndex - 1,
    parentId: null,
    dbId: null,
    children: [],
  };
}

// ============================================================
// 树结构可视化（ASCII 图）
// ============================================================

function renderTreeASCII(node, prefix, isLast, isRoot) {
  let result = '';
  const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
  const title = node.title.length > 24 ? node.title.substring(0, 22) + '…' : node.title;
  const pathTag = `[${node.path}]`;
  result += `${prefix}${connector}${title} ${pathTag}\n`;

  const childPrefix = isRoot ? '' : (isLast ? '    ' : '│   ');
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childIsLast = i === node.children.length - 1;
    result += renderTreeASCII(child, prefix + childPrefix, childIsLast, false);
  }
  return result;
}

function countTreeNodes(node) {
  let count = 1;
  for (const child of node.children) {
    count += countTreeNodes(child);
  }
  return count;
}

function countTreeDepth(node) {
  if (node.children.length === 0) return 0;
  let maxChildDepth = 0;
  for (const child of node.children) {
    maxChildDepth = Math.max(maxChildDepth, countTreeDepth(child));
  }
  return maxChildDepth + 1;
}

// ============================================================
// 数据库写入（递归遍历树）
// ============================================================

async function saveStoryTree(data, template, authorId) {
  const { outline, rootNode } = data;

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

  // 递归写入所有节点
  const rootNodeRecord = await saveNodeTree(story.id, authorId, rootNode, null);

  // 更新 root_node_id
  await prisma.stories.update({
    where: { id: story.id },
    data: { root_node_id: rootNodeRecord.id },
  });

  console.log(`  ✅ 已保存：故事ID=${story.id}，节点数=${countTreeNodes(rootNode)}，深度=${countTreeDepth(rootNode)}`);
  return story.id;
}

async function saveNodeTree(storyId, authorId, treeNode, parentDbId) {
  // 写入当前节点
  const nodeRecord = await prisma.nodes.create({
    data: {
      story_id: storyId,
      parent_id: parentDbId,
      author_id: authorId,
      title: treeNode.title,
      content: treeNode.content,
      path: treeNode.path,
      sort_order: treeNode.sortOrder,
      ai_generated: true,
      is_published: true,
      review_status: 'APPROVED',
      updated_at: new Date(),
    },
  });

  treeNode.dbId = nodeRecord.id;

  // 递归写入子节点
  for (const child of treeNode.children) {
    child.parentId = nodeRecord.id;
    await saveNodeTree(storyId, authorId, child, nodeRecord.id);
  }

  return nodeRecord;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(getArg(args, '--count') || '5');
  const authorId = parseInt(getArg(args, '--author-id') || '1');
  const dryRun = args.includes('--dry-run');
  const maxDepth = parseInt(getArg(args, '--max-depth') || '3');
  const maxNodes = parseInt(getArg(args, '--max-nodes') || '25');
  const branchProb = parseFloat(getArg(args, '--branch-prob') || '0.4');
  const terminateProb = parseFloat(getArg(args, '--terminate-prob') || '0.15');
  const minBranches = parseInt(getArg(args, '--min-branches') || '2');
  const maxBranches = parseInt(getArg(args, '--max-branches') || '3');

  // 支持 --model 覆盖 .env 中的 QWEN_MODEL
  const modelOverride = getArg(args, '--model');
  if (modelOverride) {
    AI_MODEL = modelOverride;
    console.log(`🤖 模型覆盖：${AI_MODEL}`);
  }

  const opts = { maxDepth, maxNodes, branchProb, terminateProb, minBranches, maxBranches };

  console.log('🌳 StoryTree 种子故事生成器（BFS 逐层生长版）');
  console.log('================================================');
  console.log(`  生成数量：${count}`);
  console.log(`  作者ID：${authorId}`);
  console.log(`  AI模型：${AI_MODEL}`);
  console.log(`  模式：${dryRun ? '预览（不写入数据库）' : '正式写入'}`);
  console.log(`  最大深度：${maxDepth} 层（不含根节点）`);
  console.log(`  最大节点：${maxNodes} 个/树`);
  console.log(`  分叉概率：${(branchProb * 100).toFixed(0)}%`);
  console.log(`  终止概率：${(terminateProb * 100).toFixed(0)}%`);
  console.log(`  分支范围：${minBranches}-${maxBranches}`);
  console.log('================================================\n');

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
  let totalAICalls = 0;

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    console.log(`\n[${i + 1}/${count}] ============================`);

    try {
      const data = await generateStoryTree(template, opts);
      if (!data) {
        failCount++;
        continue;
      }

      if (dryRun) {
        console.log(`\n  📝 [预览] ${data.outline.title}`);
        console.log(`     描述：${data.outline.description}`);
        console.log(`     节点数：${data.totalNodes}`);
        console.log(`\n  🌳 树结构：`);
        console.log(renderTreeASCII(data.rootNode, '', false, true));
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

  console.log('\n\n================================================');
  console.log(`🎉 完成！成功：${successCount}，失败：${failCount}`);
  if (!dryRun && successCount > 0) {
    console.log(`\n💡 提示：访问 /discover.html 查看生成的故事`);
  }
  console.log('================================================');
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