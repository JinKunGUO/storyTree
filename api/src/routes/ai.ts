import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const router = Router();

// JWT认证函数 - 从Authorization header中提取并验证token
const getUserId = (req: any): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ 未找到Authorization header或格式错误');
      return null;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username?: string };
    console.log('✅ Token验证成功，用户ID:', decoded.userId);
    return decoded.userId;
  } catch (error) {
    console.error('❌ Token验证失败:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Generate AI continuation options
// Generate AI continuation options
router.post('/generate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeId, storyId, context: userContext, style, count = 3 } = req.body;

  // 支持两种模式：
  // 1. 基于nodeId（已保存的章节）
  // 2. 基于storyId + context（新写作，未保存）
  if (!nodeId && !storyId) {
    return res.status(400).json({ error: 'nodeId or storyId is required' });
  }

  try {
    let context = '';
    let storyTitle = '';
    let storyDescription = '';

    if (nodeId) {
      // 模式1：基于已存在的节点
      const node = await prisma.nodes.findUnique({
        where: { id: parseInt(nodeId) },
        include: {
          story: true,
          nodes: true  // parent node
        }
      });

      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      storyTitle = node.story.title;
      storyDescription = node.story.description || '';

      // Build context from story so far
      if (node.nodes) {  // if has parent
        // Get full path
        const pathParts = node.path.split('.');
        const allNodes = await prisma.nodes.findMany({
          where: { story_id: node.story_id },
          orderBy: { path: 'asc' }
        });

        // Find nodes in the current path
        let currentPath = '';
        for (let i = 0; i < pathParts.length; i++) {
          currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
          const pathNode = allNodes.find(n => n.path === currentPath);
          if (pathNode) {
            context += `\n【${pathNode.title}】\n${pathNode.content}\n`;
          }
        }
      } else {
        context = node.content;
      }
    } else if (storyId) {
      // 模式2：基于故事ID和用户提供的上下文
      const story = await prisma.stories.findUnique({
        where: { id: parseInt(storyId) },
        include: {
          nodes: {
            orderBy: { path: 'asc' },
            take: 5  // 获取最近5个章节作为上下文
          }
        }
      });

      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      storyTitle = story.title;
      storyDescription = story.description || '';

      // 如果用户提供了上下文，使用用户的；否则使用已有章节
      if (userContext && userContext.trim().length > 0) {
        context = userContext;
      } else if (story.nodes && story.nodes.length > 0) {
        // 使用已有章节作为上下文
        context = story.nodes.map(n => `【${n.title}】\n${n.content}`).join('\n\n');
      } else {
        // 完全新的故事，使用故事描述
        context = storyDescription;
      }
    }

    // 定义AI写作风格
    const styleOptions = {
      '悬疑': '加入意外转折，营造紧张悬念的氛围，使用伏笔和暗示',
      '温情': '深化人物情感，展现细腻的人物关系，温暖治愈',
      '科幻': '融入科技元素和未来想象，理性与想象并重',
      '武侠': '展现江湖侠义，注重武打场面和人物气节',
      '现实': '贴近生活真实，细腻刻画人物心理和社会百态',
      '浪漫': '营造浪漫氛围，注重情感描写和细节刻画',
      '奇幻': '构建奇幻世界观，富有想象力和魔幻色彩',
      '脑洞': '跳出常规思路，走向出人意料的创意方向'
    };

    // 智能选择风格
    let selectedStyles: string[];
    if (style && styleOptions[style as keyof typeof styleOptions]) {
      // 用户指定了风格，生成该风格的多个版本
      selectedStyles = [style, style, style];
    } else {
      // 自动选择多样化的风格
      const allStyles = Object.keys(styleOptions);
      selectedStyles = allStyles.sort(() => Math.random() - 0.5).slice(0, count);
    }

    // 构建风格说明
    const styleInstructions = selectedStyles.map((s, i) => 
      `${i + 1}. ${s}向 - ${styleOptions[s as keyof typeof styleOptions]}`
    ).join('\n');

    // Create prompt for Claude
    const prompt = `你是一位专业的小说创作助手。请基于以下故事前文，续写${count}个不同风格的后续章节。

【故事信息】
故事标题：${storyTitle}
${storyDescription ? `故事简介：${storyDescription}` : ''}

【前文内容】
${context.substring(0, 2000)}${context.length > 2000 ? '\n...(内容过长已截断)' : ''}

【续写要求】
请续写${count}个不同方向的后续章节：

${styleInstructions}

【输出规范】
- 每个续写300-500字
- 标题简洁有力（10字以内）
- 内容与前文自然衔接
- 保持故事连贯性和人物一致性
- 语言优美流畅，富有画面感
- 只输出续写内容，不要解释和评论

【输出格式】
【方向1：${selectedStyles[0]}】
标题：XXX
内容：
XXX

【方向2：${selectedStyles[1]}】
标题：XXX
内容：
XXX

${count > 2 ? `【方向3：${selectedStyles[2]}】
标题：XXX
内容：
XXX` : ''}`;

    // Call Claude API
    let aiResponse: string;
    const startTime = Date.now();
    let tokensUsed = { input: 0, output: 0, total: 0 };
    let success = true;
    let errorMessage: string | null = null;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0.8,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      aiResponse = content.type === 'text' ? content.text : '';
      
      // 记录Token使用量
      tokensUsed = {
        input: response.usage.input_tokens || 0,
        output: response.usage.output_tokens || 0,
        total: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      };

    } catch (aiError) {
      success = false;
      errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      console.error('AI API Error:', aiError);
      
      // Return mock response for development
      aiResponse = `【方向1：悬疑向】
标题：深夜的脚步声
内容：
夜色渐深，窗外的月光被乌云遮蔽，整个房间陷入一片漆黑。我正准备起身去关闭窗户，突然听到走廊传来一阵轻微的脚步声。

那脚步声很轻，像是有人在刻意放轻脚步，但在这寂静的夜里格外清晰。我屏住呼吸，仔细辨认着声音的方向——它正朝我的房间靠近。

咔嗒。门把手轻轻转动的声音。我的心跳骤然加速，手心开始冒汗。难道是...那个传说是真的？

门缝下透进一道微弱的光，然后是一阵窸窣的响动。我紧紧盯着那道门缝，等待着即将发生的事情...

【方向2：温情向】
标题：老照片的秘密
内容：
收拾旧物时，我在抽屉深处发现了一张泛黄的照片。照片里有两个人，一个是年轻时的奶奶，另一个是个陌生男子。

我拿着照片去问母亲，她的眼眶突然红了。"那是你奶奶的初恋，"她轻声说，"他们约定好要一起去看海，但战争把他们分开了。"

"后来呢？"

"奶奶等到了他回来，但他已经娶了别人。"

我重新看向那张照片，发现背面有一行小字："等海变蓝，我就回来。"

原来，有些承诺，真的会用一辈子来守候...

【方向3：脑洞向】
标题：醒来变成一只猫
内容：
我睁开眼睛，第一反应是今天的视角怎么这么低。

第二反应是——我的手呢？！

我低头看去，只看到两只毛茸茸的爪子，还有白色的、带着黑色斑点的毛。我的尾巴？等等，我有尾巴了？

镜子里的自己是一只圆滚滚的橘白相间的猫。而这还不是最糟糕的——当我试图开口说话时，发出的却是一声："喵~"

就在这时，门被推开，一个熟悉的身影走了进来。是我的室友，他手里拿着一个猫罐头，脸上带着诡异的笑容："小橘子，今天该执行任务了。"

什么任务？！我现在是一只需要执行任务的猫？这个世界到底怎么了？`;
    }

    const responseTime = Date.now() - startTime;

    // 计算成本（Claude Haiku定价：输入$0.25/M tokens，输出$1.25/M tokens）
    const costUsd = (tokensUsed.input * 0.25 / 1000000) + (tokensUsed.output * 1.25 / 1000000);

    // 记录AI使用日志
    try {
      await prisma.ai_usage_logs.create({
        data: {
          user_id: userId,
          story_id: storyId ? parseInt(storyId) : null,
          node_id: nodeId ? parseInt(nodeId) : null,
          action_type: 'generate',
          model_name: 'claude-3-haiku-20240307',
          prompt_tokens: tokensUsed.input,
          completion_tokens: tokensUsed.output,
          total_tokens: tokensUsed.total,
          cost_usd: costUsd,
          response_time_ms: responseTime,
          success: success,
          error_message: errorMessage
        }
      });
    } catch (logError) {
      console.error('Failed to log AI usage:', logError);
      // 不影响主流程，继续执行
    }

    // Parse the response
    const options = parseAiResponse(aiResponse);

    res.json({ 
      options, 
      raw: aiResponse,
      metadata: {
        tokensUsed: tokensUsed.total,
        costUsd: costUsd.toFixed(6),
        responseTimeMs: responseTime,
        success: success
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate options' });
  }
});

// Accept an AI-generated branch
router.post('/accept', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { parentNodeId, title, content } = req.body;

  try {
    const parentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(parentNodeId) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // Generate path
    const siblingCount = await prisma.nodes.count({
      where: { parent_id: parseInt(parentNodeId) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    // Create the AI-generated node
    const node = await prisma.nodes.create({
      data: {
        story_id: parentNode.story_id,
        parent_id: parseInt(parentNodeId),
        author_id: userId,
        title,
        content,
        path: newPath,
        ai_generated: true,
        updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({ node });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create AI branch' });
  }
});

function parseAiResponse(response: string): Array<{ title: string; content: string; style: string }> {
  const options: Array<{ title: string; content: string; style: string }> = [];

  // Split by direction markers
  const directionRegex = /【[^】]+】/g;
  const parts = response.split(directionRegex).slice(1);
  const headers = response.match(directionRegex) || [];

  for (let i = 0; i < headers.length && i < parts.length; i++) {
    const style = headers[i].replace(/【|】/g, '').split('：')[1] || '未知';
    const part = parts[i].trim();

    // Extract title and content
    const titleMatch = part.match(/标题[：:]\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `续写${i + 1}`;

    const contentMatch = part.match(/内容[：:]\s*([\s\S]+)/);
    const content = contentMatch ? contentMatch[1].trim() : part;

    options.push({ title, content, style });
  }

  // Fallback if parsing fails
  if (options.length === 0) {
    options.push({
      title: 'AI续写',
      content: response,
      style: '默认'
    });
  }

  return options;
}

// 获取AI使用统计
router.get('/usage-stats', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取用户的AI使用统计
    const stats = await prisma.ai_usage_logs.aggregate({
      where: { user_id: userId },
      _sum: {
        total_tokens: true,
        cost_usd: true
      },
      _count: {
        id: true
      }
    });

    // 获取最近7天的使用情况
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStats = await prisma.ai_usage_logs.aggregate({
      where: {
        user_id: userId,
        created_at: { gte: sevenDaysAgo }
      },
      _sum: {
        total_tokens: true,
        cost_usd: true
      },
      _count: {
        id: true
      }
    });

    // 获取成功率
    const successCount = await prisma.ai_usage_logs.count({
      where: {
        user_id: userId,
        success: true
      }
    });

    const totalCount = stats._count.id || 0;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    res.json({
      total: {
        requests: totalCount,
        tokens: stats._sum.total_tokens || 0,
        cost: (stats._sum.cost_usd || 0).toFixed(6),
        successRate: successRate.toFixed(2)
      },
      recent7Days: {
        requests: recentStats._count.id || 0,
        tokens: recentStats._sum.total_tokens || 0,
        cost: (recentStats._sum.cost_usd || 0).toFixed(6)
      }
    });
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

export default router;