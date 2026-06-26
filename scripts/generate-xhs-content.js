/**
 * generate-xhs-content.js - AI 生成小红书笔记素材
 *
 * 从数据库读取已有故事，用 AI 生成适合小红书发布的营销文案。
 * 支持三种内容类型：
 *   1. 选择式钩子 — "这个故事有3个结局，你选哪个？" 互动型，天然引发评论
 *   2. 故事推荐 — "发现一本宝藏互动小说" 推荐型，带故事简介和链接
 *   3. 每日一树 — "今日新故事上线" 日常更新型，带亮点和引导语
 *
 * 用法：
 *   node scripts/generate-xhs-content.js [选项]
 *
 * 环境自动检测（无需手动指定 NODE_ENV）：
 *   - api/.env 存在 → 开发环境
 *   - 否则使用 api/.env.production → 生产环境
 *   - 可用 --env 手动覆盖
 *
 * 常用示例：
 *   # 生成全部3种类型，每种3条，输出到默认目录
 *   node scripts/generate-xhs-content.js
 *
 *   # 只生成选择式钩子和故事推荐，每种5条
 *   node scripts/generate-xhs-content.js --type choice,recommend --count 5
 *
 *   # 针对指定故事生成，预览模式（不写文件）
 *   node scripts/generate-xhs-content.js --story-id 501 --dry-run
 *
 *   # 只生成每日一树，输出到自定义目录
 *   node scripts/generate-xhs-content.js --type daily --output ./my-posts
 *
 *   # 生产环境 + 自定义站点URL + 指定模型
 *   node scripts/generate-xhs-content.js --site-url https://storytree.online --model qwen-plus
 *
 *   # 查看所有可用故事及其ID（确定 --story-id 用）
 *   node scripts/generate-xhs-content.js --list
 *
 * 参数：
 *   --env             指定环境变量文件（相对 api/ 目录，如 .env.production）
 *   --type            内容类型：choice | recommend | daily | all（默认 all）
 *                     支持逗号分隔多选，如 --type choice,recommend
 *   --count           每种类型生成的笔记数量（默认 3）
 *   --story-id        指定故事ID（不指定则从数据库随机选取有分支的故事）
 *   --output          输出目录（默认 ./xhs-output）
 *   --site-url        站点URL，用于生成故事链接（默认 https://storytree.online）
 *   --model           覆盖 QWEN_MODEL 环境变量（如 qwen-plus, qwen3.7-plus）
 *   --dry-run         仅打印生成内容，不写入文件
 *   --list            列出所有有分支的故事（ID、标题、节点数），用于确定 --story-id
 *
 * 输出：
 *   - JSON 文件：结构化数据，可用于程序化处理
 *   - Markdown 文件：格式化报告，可直接浏览
 *   - 文件名含时间戳，如 xhs-2025-01-15T10-30-00.json / .md
 *   - --dry-run 时直接打印到终端，不写文件
 */

const path = require('path');
const fs = require('fs');

// 将 api/node_modules 加入模块搜索路径
const apiNodeModules = path.join(__dirname, '../api/node_modules');
if (!module.paths.includes(apiNodeModules)) {
  module.paths.unshift(apiNodeModules);
}

const { PrismaClient } = require('@prisma/client');

// ============================================================
// 工具函数（提前声明，供环境变量加载使用）
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 环境变量加载（与 seed-stories.js 保持一致）
// ============================================================

const rawArgs = process.argv.slice(2);
const envFile = getArg(rawArgs, '--env');
const apiDir = path.join(__dirname, '../api');
const dotEnvPath = path.join(apiDir, '.env');
const prodEnvPath = path.join(apiDir, '.env.production');

if (envFile) {
  const envPath = path.isAbsolute(envFile) ? envFile : path.join(apiDir, envFile);
  require('dotenv').config({ path: envPath, override: true });
  console.log(`📦 加载环境变量：${envPath}`);
} else if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(prodEnvPath)) {
    require('dotenv').config({ path: prodEnvPath, override: true });
    console.log(`📦 加载环境变量：${prodEnvPath}`);
  } else {
    require('dotenv').config({ path: dotEnvPath, override: true });
    console.log(`📦 加载环境变量：${dotEnvPath}`);
  }
} else if (fs.existsSync(dotEnvPath)) {
  require('dotenv').config({ path: dotEnvPath, override: true });
  console.log(`📦 加载环境变量：${dotEnvPath}`);
} else if (fs.existsSync(prodEnvPath)) {
  require('dotenv').config({ path: prodEnvPath, override: true });
  console.log(`📦 加载环境变量：${prodEnvPath}`);
} else {
  console.error('❌ 未找到环境变量文件（.env 或 .env.production）');
}

const prisma = new PrismaClient();

// AI 模型配置
let AI_MODEL = process.env.QWEN_MODEL || 'qwen3.7-plus';

// ============================================================
// AI 调用统计
// ============================================================

let aiCallCount = 0;
let aiCallStart = 0;

// ============================================================
// AI 生成函数（与 seed-stories.js 保持一致的 SSE 流式调用）
// ============================================================

async function generateWithAI(systemPrompt, userPrompt, retries = 3) {
  const apiKey = process.env.QWEN_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const apiBase = process.env.QWEN_API_KEY
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://api.anthropic.com/v1';

  for (let i = 0; i < retries; i++) {
    try {
      aiCallCount++;
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userPrompt });

      const requestBody = {
        model: AI_MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.9,
        top_p: 0.95,
        stream: true,
      };

      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.error) {
              throw new Error(`API 错误: ${data.error.code || ''} - ${data.error.message || ''}`);
            }
            const delta = data.choices?.[0]?.delta?.content || '';
            fullText += delta;
          } catch (parseErr) {
            if (parseErr.message?.includes('API 错误')) throw parseErr;
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error('AI 返回内容为空');
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
// 数据库查询：获取有分支的故事
// ============================================================

/**
 * 获取有分支的故事（至少有一个节点拥有2+子节点）
 * 结果随机打乱，保证每次生成内容多样化
 */
async function fetchBranchingStories(limit = 20, specificStoryId = null) {
  if (specificStoryId) {
    const story = await prisma.stories.findUnique({
      where: { id: specificStoryId },
      include: {
        nodes: {
          where: { is_published: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    if (!story) {
      console.error(`❌ 故事ID=${specificStoryId} 不存在`);
      return [];
    }
    return [story];
  }

  // 查询公开、允许分支的故事
  const stories = await prisma.stories.findMany({
    where: {
      visibility: 'public',
      allow_branch: true,
    },
    include: {
      nodes: {
        where: { is_published: true },
        orderBy: { sort_order: 'asc' },
      },
    },
    take: limit * 3,
  });

  // 内存过滤：至少有一个节点拥有2+子节点
  const branchingStories = stories.filter(story => {
    const parentIds = new Map();
    for (const node of story.nodes) {
      if (node.parent_id) {
        parentIds.set(node.parent_id, (parentIds.get(node.parent_id) || 0) + 1);
      }
    }
    for (const [, count] of parentIds) {
      if (count >= 2) return true;
    }
    return false;
  });

  // 随机打乱，保证每次生成内容多样化
  shuffleArray(branchingStories);

  return branchingStories.slice(0, limit);
}

/**
 * 从故事节点中提取分支信息（用于选择式钩子）
 */
function extractBranchInfo(story) {
  const nodes = story.nodes;
  const parentMap = new Map();

  for (const node of nodes) {
    if (node.parent_id) {
      if (!parentMap.has(node.parent_id)) {
        parentMap.set(node.parent_id, []);
      }
      parentMap.get(node.parent_id).push(node);
    }
  }

  // 找到第一个有2+子节点的父节点
  for (const [parentId, children] of parentMap) {
    if (children.length >= 2) {
      const parentNode = nodes.find(n => n.id === parentId);
      return {
        parentTitle: parentNode?.title || '关键时刻',
        parentContent: parentNode?.content || '',
        branches: children.map(c => ({
          title: c.title,
          summary: c.content.substring(0, 80),
        })),
      };
    }
  }

  return null;
}

/**
 * 获取故事的根节点
 */
function getRootNode(story) {
  return story.nodes.find(n => !n.parent_id);
}

// ============================================================
// 内容类型 1：选择式钩子
// "这个故事有3个结局，你选哪个？"
// ============================================================

async function generateChoiceHook(story, siteUrl) {
  const branchInfo = extractBranchInfo(story);
  if (!branchInfo) {
    console.log(`  ⚠️ 故事 "${story.title}" 没有分支点，跳过选择式钩子`);
    return null;
  }

  const branchLabels = branchInfo.branches.map((b, i) =>
    `${String.fromCharCode(65 + i)}. ${b.title}`
  ).join('\n');

  const storyLink = `${siteUrl}/story.html?id=${story.id}`;

  const prompt = `你是一个小红书内容运营专家，擅长写爆款笔记文案。

请根据以下互动小说的分支信息，生成一条小红书"选择式钩子"笔记。

故事名：《${story.title}》
故事简介：${story.description || ''}
分支前的情节：${branchInfo.parentContent.substring(0, 200)}...
读者面临的选择：
${branchLabels}

要求：
- 开头用一个钩子句子抓住注意力（如"这个故事有${branchInfo.branches.length}个结局""你敢选哪个？"）
- 用简洁有力的语言描述每个选择的氛围或走向（2-3行即可，不要剧透太多）
- 每个选项后面加一个括号标注风格方向（如[悬疑向]、[温情向]、[反转向]）
- 结尾引导读者去故事树体验完整故事，带上链接 ${storyLink}
- 整体风格活泼有趣，符合小红书调性
- 适当使用emoji但不要过度
- 总字数控制在200-350字
- 底部给出5-8个相关话题标签

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "小红书笔记标题（20字以内，吸引点击）",
  "body": "笔记正文（200-350字，含emoji和标签）",
  "tags": ["标签1", "标签2", ...]
}`;

  const resultText = await generateWithAI(
    '你是小红书内容运营专家，擅长写互动型爆款笔记。只返回JSON，不加任何其他文字。',
    prompt
  );

  const result = safeParseJSON(resultText);
  if (!result || !result.title || !result.body) {
    console.error('  ❌ 选择式钩子解析失败');
    return null;
  }

  return {
    type: 'choice_hook',
    storyId: story.id,
    storyTitle: story.title,
    storyLink,
    ...result,
  };
}

// ============================================================
// 内容类型 2：故事推荐
// "发现一本宝藏互动小说"
// ============================================================

async function generateStoryRecommendation(story, siteUrl) {
  const rootNode = getRootNode(story);
  const rootContent = rootNode?.content?.substring(0, 200) || '';
  const storyLink = `${siteUrl}/story.html?id=${story.id}`;

  const prompt = `你是一个小红书内容运营专家，擅长写爆款笔记文案。

请根据以下互动小说的信息，生成一条小红书"故事推荐"笔记。

故事名：《${story.title}》
故事简介：${story.description || ''}
开篇节选：${rootContent}...
故事标签：${story.tags || ''}
总章节数：${story.nodes.length}

要求：
- 标题用"发现宝藏""挖到神仙""私藏推荐"等吸引眼球的词
- 正文先抛出一个引人好奇的问题或感叹
- 用2-3句话概括故事亮点（不要剧透结局）
- 强调"互动小说""你的选择决定结局"这一独特卖点
- 用简短引用1-2句开篇的金句或悬念台词
- 结尾引导去故事树阅读，带上链接 ${storyLink}
- 适当使用emoji但不要过度
- 总字数控制在200-350字
- 底部给出5-8个相关话题标签

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "小红书笔记标题（20字以内，吸引点击）",
  "body": "笔记正文（200-350字，含emoji和标签）",
  "tags": ["标签1", "标签2", ...]
}`;

  const resultText = await generateWithAI(
    '你是小红书内容运营专家，擅长写种草推荐笔记。只返回JSON，不加任何其他文字。',
    prompt
  );

  const result = safeParseJSON(resultText);
  if (!result || !result.title || !result.body) {
    console.error('  ❌ 故事推荐解析失败');
    return null;
  }

  return {
    type: 'story_recommendation',
    storyId: story.id,
    storyTitle: story.title,
    storyLink,
    ...result,
  };
}

// ============================================================
// 内容类型 3：每日一树
// "今日新故事上线"
// ============================================================

async function generateDailyStory(story, siteUrl) {
  const rootNode = getRootNode(story);
  const branchCount = new Set(story.nodes.filter(n => n.parent_id).map(n => n.parent_id)).size;
  const storyLink = `${siteUrl}/story.html?id=${story.id}`;

  const prompt = `你是一个小红书内容运营专家，擅长写日常更新笔记。

请根据以下互动小说的信息，生成一条小红书"每日新故事"笔记。

故事名：《${story.title}》
故事简介：${story.description || ''}
开篇节选：${rootNode?.content?.substring(0, 150) || ''}...
章节总数：${story.nodes.length}
分支点数：${branchCount}

要求：
- 标题用"今日新故事""每日一树""今日推荐"等格式
- 正文用轻松日常的语气，像朋友安利一样
- 简单介绍故事类型和设定（1-2句）
- 点出最吸引人的1个亮点或悬念
- 提到"分支""多结局"等互动特色
- 加一句互动引导（如"你第一反应选哪个？"）
- 结尾引导去故事树体验，带上链接 ${storyLink}
- 适当使用emoji但不要过度
- 总字数控制在150-250字（偏短，适合日常快速浏览）
- 底部给出5-8个相关话题标签

请以 JSON 格式返回（不要加 markdown 代码块标记）：
{
  "title": "小红书笔记标题（20字以内，吸引点击）",
  "body": "笔记正文（150-250字，含emoji和标签）",
  "tags": ["标签1", "标签2", ...]
}`;

  const resultText = await generateWithAI(
    '你是小红书内容运营专家，擅长写日常更新笔记。只返回JSON，不加任何其他文字。',
    prompt
  );

  const result = safeParseJSON(resultText);
  if (!result || !result.title || !result.body) {
    console.error('  ❌ 每日一树解析失败');
    return null;
  }

  return {
    type: 'daily_story',
    storyId: story.id,
    storyTitle: story.title,
    storyLink,
    ...result,
  };
}

// ============================================================
// 输出格式化
// ============================================================

function formatMarkdownReport(allResults) {
  let md = `# 小红书笔记素材\n\n`;
  md += `生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  md += `AI 模型：${AI_MODEL}\n`;
  md += `AI 调用次数：${aiCallCount}\n\n`;
  md += `---\n\n`;

  const typeNames = {
    choice_hook: '选择式钩子',
    story_recommendation: '故事推荐',
    daily_story: '每日一树',
  };

  for (const [type, results] of Object.entries(allResults)) {
    if (results.length === 0) continue;

    md += `## ${typeNames[type] || type}\n\n`;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      md += `### ${i + 1}. ${r.title}\n\n`;
      md += `> 来源故事：《${r.storyTitle}》（[ID: ${r.storyId}](${r.storyLink})）\n\n`;
      md += `${r.body}\n\n`;
      if (r.tags && r.tags.length > 0) {
        md += `标签：${r.tags.map(t => `#${t}`).join(' ')}\n\n`;
      }
      md += `---\n\n`;
    }
  }

  return md;
}

function formatJSONOutput(allResults) {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: AI_MODEL,
    aiCallCount,
    results: allResults,
  }, null, 2);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  // --list 模式：列出有分支的故事后退出（不需要 AI Key，跳过 banner）
  if (args.includes('--list')) {
    console.log('📋 查询有分支的故事...\n');
    const stories = await fetchBranchingStories(200);
    if (stories.length === 0) {
      console.log('  没有找到有分支的故事。请先用 seed-stories.js 生成故事。');
    } else {
      // 计算各列宽度
      const idWidth = Math.max(6, ...stories.map(s => String(s.id).length));

      console.log(`  ${'ID'.padEnd(idWidth)}  ${'节点数'.padStart(6)}  ${'分支点'.padStart(6)}  标题`);
      console.log(`  ${'─'.repeat(idWidth)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}  ${'─'.repeat(30)}`);

      for (const s of stories) {
        // 重新计算分支点数
        const parentCounts = new Map();
        for (const n of s.nodes) {
          if (n.parent_id) {
            parentCounts.set(n.parent_id, (parentCounts.get(n.parent_id) || 0) + 1);
          }
        }
        let branchPoints = 0;
        for (const [, c] of parentCounts) {
          if (c >= 2) branchPoints++;
        }

        const idStr = String(s.id).padEnd(idWidth);
        const nodeStr = String(s.nodes.length).padStart(6);
        const branchStr = String(branchPoints).padStart(6);
        console.log(`  ${idStr}  ${nodeStr}  ${branchStr}  ${s.title}`);
      }

      console.log(`\n  共 ${stories.length} 个有分支的故事`);
      console.log(`  💡 使用 --story-id <ID> 指定某个故事生成小红书内容`);
    }
    return; // 提前退出，不进入生成流程
  }

  const typeArg = getArg(args, '--type') || 'all';
  const count = parseInt(getArg(args, '--count') || '3');
  const storyId = getArg(args, '--story-id') ? parseInt(getArg(args, '--story-id')) : null;
  const outputDir = getArg(args, '--output') || './xhs-output';
  const siteUrl = getArg(args, '--site-url') || 'https://storytree.online';
  const dryRun = args.includes('--dry-run');

  const modelOverride = getArg(args, '--model');
  if (modelOverride) {
    AI_MODEL = modelOverride;
    console.log(`🤖 模型覆盖：${AI_MODEL}`);
  }

  // 解析 --type：支持逗号分隔多选
  const validTypeValues = ['choice', 'recommend', 'daily', 'all'];
  let types;
  if (typeArg === 'all') {
    types = ['choice', 'recommend', 'daily'];
  } else {
    types = typeArg.split(',').map(t => t.trim()).filter(t => t);
    const invalid = types.find(t => !validTypeValues.includes(t));
    if (invalid) {
      console.error(`❌ 无效的 --type 值：${invalid}，可选值：choice | recommend | daily | all`);
      process.exit(1);
    }
  }

  const typeNames = {
    choice: '选择式钩子',
    recommend: '故事推荐',
    daily: '每日一树',
  };

  console.log('📱 小红书笔记素材生成器');
  console.log('========================');
  console.log(`  生成类型：${types.map(t => typeNames[t]).join('、')}`);
  console.log(`  每类数量：${count}`);
  console.log(`  AI 模型：${AI_MODEL}`);
  console.log(`  站点URL：${siteUrl}`);
  if (storyId) console.log(`  指定故事：ID=${storyId}`);
  console.log(`  输出目录：${outputDir}`);
  console.log(`  模式：${dryRun ? '预览（不写入文件）' : '正式写入'}`);
  console.log('========================\n');

  // 检查 AI API Key
  if (!process.env.QWEN_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error('❌ 错误：未配置 QWEN_API_KEY 或 ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // 获取故事 — 取足够多以覆盖所有类型
  console.log('📚 从数据库获取故事...');
  const totalNeeded = count * types.length;
  const stories = await fetchBranchingStories(totalNeeded, storyId);

  if (stories.length === 0) {
    console.error('❌ 没有找到有分支的故事。请先用 seed-stories.js 生成故事，或指定 --story-id');
    process.exit(1);
  }

  console.log(`  找到 ${stories.length} 个有分支的故事\n`);

  // 按类型生成，每种类型从不同故事池中取（避免同一故事被所有类型重复使用）
  const allResults = {
    choice_hook: [],
    story_recommendation: [],
    daily_story: [],
  };

  const generators = {
    choice: { fn: generateChoiceHook, key: 'choice_hook' },
    recommend: { fn: generateStoryRecommendation, key: 'story_recommendation' },
    daily: { fn: generateDailyStory, key: 'daily_story' },
  };

  let totalGenerated = 0;
  let totalFailed = 0;

  // 为每种类型分配故事，尽量不重复
  let storyCursor = 0;

  for (const type of types) {
    const { fn, key } = generators[type];
    console.log(`\n📝 生成${typeNames[type]}（${count}条）...`);
    console.log('─'.repeat(40));

    let generated = 0;
    let usedStoryIds = new Set();

    // 先用当前游标位置开始取，用完后从头循环
    let tries = 0;
    const maxTries = stories.length + count;

    while (generated < count && tries < maxTries) {
      const story = stories[storyCursor % stories.length];
      storyCursor++;
      tries++;

      // 跳过本类型已用过的故事（同类型内不重复同一故事）
      if (usedStoryIds.has(story.id)) continue;
      usedStoryIds.add(story.id);

      console.log(`  [${generated + 1}/${count}] 故事：《${story.title}》(ID:${story.id})`);

      try {
        const result = await fn(story, siteUrl);
        if (result) {
          allResults[key].push(result);
          generated++;
          totalGenerated++;
          console.log(`    ✅ ${result.title}`);
        } else {
          totalFailed++;
        }
      } catch (err) {
        console.error(`    ❌ 失败: ${err.message}`);
        totalFailed++;
      }

      await sleep(1200);
    }

    if (generated < count) {
      console.log(`  ⚠️ 仅生成 ${generated}/${count} 条（可用故事不足或部分跳过）`);
    }
  }

  // 输出结果
  const elapsedSec = ((Date.now() - aiCallStart) / 1000).toFixed(1);

  console.log('\n\n========================');
  console.log(`🎉 生成完成！成功：${totalGenerated}，失败/跳过：${totalFailed}`);
  console.log(`📊 AI 调用次数：${aiCallCount}`);
  if (aiCallStart > 0) {
    console.log(`⏱️ 总耗时：${elapsedSec}s`);
  }
  console.log('========================\n');

  if (dryRun) {
    for (const [type, results] of Object.entries(allResults)) {
      if (results.length === 0) continue;
      const typeName = {
        choice_hook: '选择式钩子',
        story_recommendation: '故事推荐',
        daily_story: '每日一树',
      }[type];

      console.log(`\n=== ${typeName} ===\n`);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`【${i + 1}】${r.title}`);
        console.log(`  来源：《${r.storyTitle}》(ID:${r.storyId})`);
        console.log(`  链接：${r.storyLink}`);
        console.log(`  正文：${r.body}`);
        if (r.tags) console.log(`  标签：${r.tags.map(t => `#${t}`).join(' ')}`);
        console.log('');
      }
    }
  } else {
    const absOutputDir = path.isAbsolute(outputDir) ? outputDir : path.join(process.cwd(), outputDir);
    if (!fs.existsSync(absOutputDir)) {
      fs.mkdirSync(absOutputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    const jsonPath = path.join(absOutputDir, `xhs-${timestamp}.json`);
    fs.writeFileSync(jsonPath, formatJSONOutput(allResults), 'utf-8');
    console.log(`📄 JSON 文件：${jsonPath}`);

    const mdPath = path.join(absOutputDir, `xhs-${timestamp}.md`);
    fs.writeFileSync(mdPath, formatMarkdownReport(allResults), 'utf-8');
    console.log(`📝 Markdown 文件：${mdPath}`);

    console.log(`\n💡 提示：打开 Markdown 文件可查看格式化报告，JSON 文件可用于程序化处理`);
    console.log(`💡 发布前请配图并微调文案，确保内容符合小红书社区规范`);
  }
}

// 执行
aiCallStart = Date.now();
main()
  .catch((err) => {
    console.error('💥 致命错误:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });