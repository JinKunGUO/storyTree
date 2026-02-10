import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Generate AI continuation options
router.post('/generate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeId, style, count = 3 } = req.body;

  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId is required' });
  }

  try {
    // Get the node content and context
    const node = await prisma.node.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        story: true,
        parent: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Build context from story so far
    let context = '';
    if (node.parent) {
      // Get full path
      const pathParts = node.path.split('.');
      const allNodes = await prisma.node.findMany({
        where: { storyId: node.storyId },
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

    // Create prompt for Claude
    const prompt = `基于以下故事前文，续写${count}个不同风格的后续章节。每个续写约300-500字。

【前文】
故事标题：${node.story.title}

${context}

请续写${count}个不同方向的后续：

风格说明：
1. 悬疑向 - 加入意外转折，营造紧张氛围
2. 温情向 - 深化人物情感，展现人物关系
3. 脑洞向 - 跳出常规思路，走向出人意料的方向

输出要求：
- 为每个续写提供一个简短的标题（10字以内）
- 内容要与前文保持连贯
- 用中文输出
- 只输出续写内容，不要解释

格式：
【方向1：风格名称】
标题：XXX
内容：
XXX

【方向2：风格名称】
标题：XXX
内容：
XXX

【方向3：风格名称】
标题：XXX
内容：
XXX`;

    // Call Claude API
    let aiResponse: string;

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
    } catch (aiError) {
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

    // Parse the response
    const options = parseAiResponse(aiResponse);

    res.json({ options, raw: aiResponse });
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
    const parentNode = await prisma.node.findUnique({
      where: { id: parseInt(parentNodeId) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // Generate path
    const siblingCount = await prisma.node.count({
      where: { parentId: parseInt(parentNodeId) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    // Create the AI-generated node
    const node = await prisma.node.create({
      data: {
        storyId: parentNode.storyId,
        parentId: parseInt(parentNodeId),
        authorId: userId,
        title,
        content,
        path: newPath,
        aiGenerated: true
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

export default router;
