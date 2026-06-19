/**
 * AI 流式输出接口 (SSE)
 * 
 * 所有接口返回 text/event-stream，前端通过 fetch + ReadableStream 逐字接收。
 * 不走 BullMQ 队列，直接调用千问 API 并透传流式响应。
 * 
 * 事件格式：
 *   event: start   data: { model }
 *   event: chunk   data: { text: "增量文字" }
 *   event: done    data: { fullText, usage }
 *   event: error   data: { message }
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { canUseAiFeature, deductPoints, AI_COST } from '../utils/points';
import { JWT_SECRET } from '../utils/auth';
import { initSSEResponse, streamQwenToClient } from '../utils/qwen-stream';

const router = Router();

// JWT 认证
const getUserId = (req: Request): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch { return null; }
};

// ===================== 润色风格映射 =====================
const polishStyles: Record<string, string> = {
  concise: '精简冗余，保留核心，使文字简洁有力',
  elegant: '增加修辞，优美表达，提升文学性',
  humorous: '加入幽默元素，轻松活泼',
  serious: '严肃正式，逻辑严谨',
  poetic: '诗意化表达，富有韵律感',
  colloquial: '口语化，通俗易懂'
};

// ===================== 续写风格映射 =====================
const continuationStyles: Record<string, string> = {
  '悬疑': '加入意外转折，营造紧张悬念的氛围，使用伏笔和暗示',
  '温情': '深化人物情感，展现细腻的人物关系，温暖治愈',
  '科幻': '融入科技元素和未来想象，理性与想象并重',
  '武侠': '展现江湖侠义，注重武打场面和人物气节',
  '现实': '贴近生活真实，细腻刻画人物心理和社会百态',
  '浪漫': '营造浪漫氛围，注重情感描写和细节刻画',
  '奇幻': '构建奇幻世界观，富有想象力和魔幻色彩',
  '脑洞': '跳出常规思路，走向出人意料的创意方向'
};

/**
 * POST /api/ai/stream/continuation
 * 流式续写（单方向，逐字输出）
 */
router.post('/continuation', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { storyId, nodeId, context, style, mode = 'segment', wordCount: rawWordCount = 1500, userPrompt } = req.body;
  if (!storyId) return res.status(400).json({ error: 'storyId是必需的' });

  const wordCount = Math.min(Math.max(Number(rawWordCount) || 1500, 200), 5000);

  try {
    // 权限检查
    const permission = await canUseAiFeature(userId, 'continuation');
    if (!permission.allowed) return res.status(403).json({ error: permission.reason });

    // 获取故事信息
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      include: { nodes: { orderBy: { sort_order: 'asc' } } }
    });
    if (!story) return res.status(404).json({ error: '故事不存在' });

    // 构建上下文
    let fullContext = context || '';
    if (mode === 'chapter' && nodeId) {
      const currentNode = await prisma.nodes.findUnique({ where: { id: parseInt(nodeId) } });
      if (currentNode) {
        const recentNodes = [];
        let node: typeof currentNode | null = currentNode;
        let cnt = 0;
        while (node && cnt < 3) {
          recentNodes.unshift(node);
          cnt++;
          if (node.parent_id) {
            node = await prisma.nodes.findUnique({ where: { id: node.parent_id } });
          } else break;
        }
        fullContext = recentNodes.map(n => `【${n.title}】\n${n.content}`).join('\n\n');
      }
    } else if (!fullContext && story.nodes.length > 0) {
      const recentNodes = story.nodes.slice(-5);
      fullContext = recentNodes.map(n => `【${n.title}】\n${n.content}`).join('\n\n');
    }

    // 选择风格
    const styleDesc = style && continuationStyles[style]
      ? `${style} - ${continuationStyles[style]}`
      : '自然延续前文风格';

    const userPromptPart = userPrompt?.trim()
      ? `\n\n【用户自定义要求】\n${userPrompt.trim()}\n⚠️ 请优先满足用户的自定义要求。`
      : '';

    const prompt = `你是一位专业的小说创作助手。请基于以下故事前文，续写一段后续内容。

【故事信息】
故事标题：${story.title}
${story.description ? `故事简介：${story.description}` : ''}

【前文内容】
${fullContext.substring(0, 3000)}${fullContext.length > 3000 ? '\n...(内容过长已截断)' : ''}

【续写要求】
- 风格方向：${styleDesc}
- 字数要求：约${wordCount}字（允许±15%浮动）
- 内容与前文自然衔接，保持故事连贯性和人物一致性
- 语言优美流畅，富有画面感
- 内容分段书写，每段100-300字
- 只输出续写内容，不要任何解释、评论或标题${userPromptPart}`;

    // 初始化 SSE
    initSSEResponse(res);

    // 流式调用
    const fullText = await streamQwenToClient(res, {
      prompt,
      maxTokens: Math.min(Math.ceil(wordCount * 1.5), 4000),
      temperature: 0.85,
      timeoutMs: 90000
    });

    // 扣积分（流式完成后）
    if (fullText && permission.usePoints && permission.pointsCost) {
      await deductPoints(userId, permission.pointsCost, 'ai_continuation', 'AI续写(流式)', undefined).catch(e => {
        console.error('扣积分失败:', e);
      });
    }
  } catch (error: any) {
    console.error('流式续写失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '续写失败' });
    }
  }
});

/**
 * POST /api/ai/stream/polish
 * 流式润色
 */
router.post('/polish', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { content, style = 'elegant' } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });

  try {
    const permission = await canUseAiFeature(userId, 'polish');
    if (!permission.allowed) return res.status(403).json({ error: permission.reason });

    const styleDesc = polishStyles[style] || polishStyles.elegant;

    const prompt = `你是一位专业的文字润色专家。请对以下文字进行润色，风格要求：${styleDesc}

【原文】
${content}

【润色要求】
1. 保留原文核心意思和内容
2. 优化语言表达，提升可读性
3. 修正语法错误和不通顺之处
4. 符合"${style}"风格
5. 字数与原文相近（±10%）

只输出润色后的文字，不要任何解释和说明。`;

    initSSEResponse(res);

    const fullText = await streamQwenToClient(res, {
      prompt,
      maxTokens: 1500,
      temperature: 0.7,
      timeoutMs: 30000
    });

    if (fullText && permission.usePoints && permission.pointsCost) {
      await deductPoints(userId, permission.pointsCost, 'ai_polish', 'AI润色(流式)', undefined).catch(e => {
        console.error('扣积分失败:', e);
      });
    }
  } catch (error: any) {
    console.error('流式润色失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '润色失败' });
    }
  }
});

/**
 * POST /api/ai/stream/project-brief
 * 流式生成立项书
 */
router.post('/project-brief', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { title, genre, description, targetAudience, additionalInfo } = req.body;
  if (!title) return res.status(400).json({ error: '标题是必需的' });

  try {
    const permission = await canUseAiFeature(userId, 'creation');
    if (!permission.allowed) return res.status(403).json({ error: permission.reason });

    const prompt = `你是一位专业的网文编辑和策划人。用户有一个故事想法，需要整理成规范的项目立项书，并基于立项书推导生成故事大纲。

【用户输入】
标题：${title}
${genre ? `类型：${genre}` : ''}
${description ? `简介：${description}` : ''}
${targetAudience ? `目标读者：${targetAudience}` : ''}
${additionalInfo ? `补充信息：${additionalInfo}` : ''}

请生成一份完整的项目立项书，包含以下内容（使用 JSON 格式输出）：
{
  "title": "故事标题",
  "genre": "类型",
  "logline": "一句话概述（30字以内）",
  "synopsis": "故事梗概（200-300字）",
  "theme": "核心主题",
  "targetAudience": "目标读者群",
  "uniqueSellingPoint": "独特卖点",
  "tone": "风格基调",
  "setting": "时代背景和世界观设定",
  "estimatedLength": "预计篇幅（如：20万字）"
}

只输出 JSON，不要其他内容。`;

    initSSEResponse(res);

    await streamQwenToClient(res, {
      prompt,
      maxTokens: 2000,
      temperature: 0.8,
      timeoutMs: 60000
    });
  } catch (error: any) {
    console.error('流式生成立项书失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '生成失败' });
    }
  }
});

/**
 * POST /api/ai/stream/outline
 * 流式生成大纲
 */
router.post('/outline', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { storyId, projectBrief, chapterCount = 10 } = req.body;
  if (!projectBrief && !storyId) return res.status(400).json({ error: '需要立项书或storyId' });

  try {
    const permission = await canUseAiFeature(userId, 'creation');
    if (!permission.allowed) return res.status(403).json({ error: permission.reason });

    let briefInfo = '';
    if (projectBrief) {
      briefInfo = typeof projectBrief === 'string' ? projectBrief : JSON.stringify(projectBrief, null, 2);
    } else if (storyId) {
      const story = await prisma.stories.findUnique({ where: { id: parseInt(storyId) } });
      if (story) {
        briefInfo = `标题：${story.title}\n简介：${story.description || ''}`;
      }
    }

    const prompt = `你是一位专业的网文编辑和策划人。用户需要生成一份完整的故事大纲。

【立项书信息】
${briefInfo}

请生成一份包含 ${chapterCount} 章的故事大纲，使用 JSON 格式输出：
{
  "chapters": [
    {
      "number": 1,
      "title": "章节标题",
      "summary": "章节概要（50-100字）",
      "keyEvents": ["关键事件1", "关键事件2"],
      "characters": ["出场角色1", "出场角色2"]
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "role": "主角/配角/反派",
      "description": "角色简介（30-50字）"
    }
  ],
  "worldBuilding": "世界观设定概述（100-200字）"
}

只输出 JSON，不要其他内容。`;

    initSSEResponse(res);

    await streamQwenToClient(res, {
      prompt,
      maxTokens: 4000,
      temperature: 0.8,
      timeoutMs: 90000
    });
  } catch (error: any) {
    console.error('流式生成大纲失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '生成失败' });
    }
  }
});

/**
 * POST /api/ai/stream/revise
 * 流式修改（通用：立项书/大纲修改）
 */
router.post('/revise', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { type, original, feedback } = req.body;
  if (!original || !feedback) return res.status(400).json({ error: '原内容和修改意见是必需的' });

  try {
    const permission = await canUseAiFeature(userId, 'creation');
    if (!permission.allowed) return res.status(403).json({ error: permission.reason });

    const typeLabel = type === 'outline' ? '故事大纲' : '项目立项书';
    const originalStr = typeof original === 'string' ? original : JSON.stringify(original, null, 2);

    const prompt = `你是一位专业的网文编辑和策划人。用户已经有一个${typeLabel}，现在提出了修改意见。

【当前${typeLabel}】
${originalStr}

【用户修改意见】
${feedback}

请根据用户的修改意见，输出修改后的完整${typeLabel}。保持原有的 JSON 格式不变，只修改需要调整的内容。

只输出修改后的 JSON，不要其他内容。`;

    initSSEResponse(res);

    await streamQwenToClient(res, {
      prompt,
      maxTokens: 4000,
      temperature: 0.7,
      timeoutMs: 60000
    });
  } catch (error: any) {
    console.error('流式修改失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '修改失败' });
    }
  }
});

export default router;
