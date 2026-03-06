import { Job } from 'bull';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { prisma } from '../index';
import { aiContinuationQueue, aiPolishQueue, aiIllustrationQueue } from '../utils/queue';
import { notifyAiContinuationReady, notifyAiPolishReady, notifyAiIllustrationReady } from '../utils/notification';
import { deductPoints, AI_COST } from '../utils/points';

// 检测使用哪个AI服务
const USE_QWEN = !!process.env.QWEN_API_KEY;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus';

// 初始化AI客户端
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}) : null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: 120000, // 2分钟超时（DALL-E 3生成较慢）
  maxRetries: 2,   // 失败后重试2次
  ...(process.env.HTTP_PROXY && {
    httpAgent: require('https-proxy-agent').HttpsProxyAgent 
      ? new (require('https-proxy-agent').HttpsProxyAgent)(process.env.HTTP_PROXY)
      : undefined
  })
});

/**
 * 千问API响应类型
 */
interface QwenAPIResponse {
  output?: {
    text?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  code?: string;
  message?: string;
}

/**
 * 千问图像生成API响应类型
 */
interface QwenImageAPIResponse {
  output?: {
    task_id?: string;
    task_status?: string;
    results?: Array<{
      url?: string;
    }>;
    task_metrics?: {
      TOTAL?: number;
      SUCCEEDED?: number;
      FAILED?: number;
    };
    code?: string;
    message?: string;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

/**
 * 调用千问API
 */
async function callQwenAPI(prompt: string, maxTokens: number = 2000, temperature: number = 0.8): Promise<{ text: string; usage: { input: number; output: number } }> {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      input: {
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`千问API调用失败: ${response.status} ${errorText}`);
  }

  const data = await response.json() as QwenAPIResponse;
  
  if (data.code) {
    throw new Error(`千问API错误: ${data.code} - ${data.message}`);
  }

  return {
    text: data.output?.text || '',
    usage: {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    }
  };
}

/**
 * 调用千问图像生成API（通义万相）
 */
async function callQwenImageAPI(prompt: string): Promise<{ imageUrl: string }> {
  const imageModel = process.env.QWEN_IMAGE_MODEL || 'wanx-v1';
  
  console.log(`🎨 调用千问图像生成API，模型: ${imageModel}`);
  
  // 第一步：提交图像生成任务
  const submitResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable' // 异步模式
    },
    body: JSON.stringify({
      model: imageModel,
      input: {
        prompt: prompt
      },
      parameters: {
        size: '1024*1024',
        n: 1
      }
    })
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`千问图像API调用失败: ${submitResponse.status} ${errorText}`);
  }

  const submitData = await submitResponse.json() as QwenImageAPIResponse;
  
  if (submitData.output?.code) {
    throw new Error(`千问图像API错误: ${submitData.output.code} - ${submitData.output.message}`);
  }

  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error('未能获取任务ID');
  }

  console.log(`⏳ 图像生成任务已提交，任务ID: ${taskId}，开始轮询...`);

  // 第二步：轮询任务状态
  let attempts = 0;
  const maxAttempts = 60; // 最多轮询60次（2分钟）
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
    attempts++;

    const statusResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.QWEN_API_KEY}`
      }
    });

    if (!statusResponse.ok) {
      console.warn(`⚠️ 查询任务状态失败，重试中... (${attempts}/${maxAttempts})`);
      continue;
    }

    const statusData = await statusResponse.json() as QwenImageAPIResponse;
    const taskStatus = statusData.output?.task_status;

    console.log(`📊 任务状态: ${taskStatus} (${attempts}/${maxAttempts})`);

    if (taskStatus === 'SUCCEEDED') {
      const imageUrl = statusData.output?.results?.[0]?.url;
      if (!imageUrl) {
        throw new Error('未能获取图像URL');
      }
      console.log(`✅ 图像生成成功: ${imageUrl}`);
      return { imageUrl };
    } else if (taskStatus === 'FAILED') {
      throw new Error(`图像生成失败: ${statusData.output?.message || '未知错误'}`);
    }

    // 继续轮询（状态为PENDING或RUNNING）
  }

  throw new Error('图像生成超时，请稍后重试');
}

/**
 * AI续写任务数据接口
 */
interface ContinuationJobData {
  taskId: number;
  userId: number;
  storyId: number;
  nodeId?: number;
  context: string;
  storyTitle: string;
  storyDescription: string;
  style?: string;
  count: number;
}

/**
 * AI润色任务数据接口
 */
interface PolishJobData {
  taskId: number;
  userId: number;
  content: string;
  style: string;
}

/**
 * AI插图任务数据接口
 */
interface IllustrationJobData {
  taskId: number;
  userId: number;
  storyId: number;
  nodeId: number;
  chapterTitle: string;
  chapterContent: string;
}

/**
 * 处理AI续写任务
 */
aiContinuationQueue.process(async (job: Job<ContinuationJobData>) => {
  const { taskId, userId, storyId, nodeId, context, storyTitle, storyDescription, style, count } = job.data;

  console.log(`🚀 开始处理AI续写任务: ${taskId}, 使用${USE_QWEN ? '千问' : 'Claude'}API`);

  try {
    // 更新任务状态
    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: { status: 'processing', started_at: new Date() }
    });

    // 定义AI写作风格
    const styleOptions: Record<string, string> = {
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
    if (style && styleOptions[style]) {
      selectedStyles = [style, style, style];
    } else {
      const allStyles = Object.keys(styleOptions);
      selectedStyles = allStyles.sort(() => Math.random() - 0.5).slice(0, count);
    }

    const styleInstructions = selectedStyles.map((s, i) => 
      `${i + 1}. ${s}向 - ${styleOptions[s]}`
    ).join('\n');

    // 构建prompt
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

    // 调用AI API
    const startTime = Date.now();
    let aiResponse: string;
    let tokensUsed: { input: number; output: number; total: number };
    let modelName: string;

    if (USE_QWEN) {
      // 使用千问API
      const qwenResponse = await callQwenAPI(prompt, 2000, 0.8);
      aiResponse = qwenResponse.text;
      tokensUsed = {
        input: qwenResponse.usage.input,
        output: qwenResponse.usage.output,
        total: qwenResponse.usage.input + qwenResponse.usage.output
      };
      modelName = QWEN_MODEL;
    } else {
      // 使用Claude API
      if (!anthropic) {
        throw new Error('未配置AI服务，请设置QWEN_API_KEY或ANTHROPIC_API_KEY');
      }
      
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      aiResponse = content.type === 'text' ? content.text : '';
      tokensUsed = {
        input: response.usage.input_tokens || 0,
        output: response.usage.output_tokens || 0,
        total: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      };
      modelName = 'claude-3-haiku-20240307';
    }

    const responseTime = Date.now() - startTime;
    const costUsd = (tokensUsed.input * 0.25 / 1000000) + (tokensUsed.output * 1.25 / 1000000);

    // 解析AI响应
    const options = parseAiResponse(aiResponse);

    // 保存结果
    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result_data: JSON.stringify({ options, raw: aiResponse }),
        completed_at: new Date()
      }
    });

    // 记录使用日志
    await prisma.ai_usage_logs.create({
      data: {
        user_id: userId,
        story_id: storyId,
        node_id: nodeId,
        action_type: 'continuation',
        model_name: modelName,
        prompt_tokens: tokensUsed.input,
        completion_tokens: tokensUsed.output,
        total_tokens: tokensUsed.total,
        cost_usd: costUsd,
        response_time_ms: responseTime,
        success: true
      }
    });

    // 扣除积分
    await deductPoints(userId, AI_COST.CONTINUATION, 'ai_continuation', 'AI续写消耗', taskId);

    // 发送通知
    await notifyAiContinuationReady(userId, taskId, storyTitle);

    console.log(`✅ AI续写任务完成: ${taskId}`);
    return { success: true, options };

  } catch (error) {
    console.error(`❌ AI续写任务失败: ${taskId}`, error);

    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date()
      }
    });

    throw error;
  }
});

/**
 * 处理AI润色任务
 */
aiPolishQueue.process(async (job: Job<PolishJobData>) => {
  const { taskId, userId, content, style } = job.data;

  console.log(`🚀 开始处理AI润色任务: ${taskId}, 使用${USE_QWEN ? '千问' : 'Claude'}API`);

  try {
    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: { status: 'processing', started_at: new Date() }
    });

    const polishStyles: Record<string, string> = {
      concise: '精简冗余，保留核心，使文字简洁有力',
      elegant: '增加修辞，优美表达，提升文学性',
      humorous: '加入幽默元素，轻松活泼',
      serious: '严肃正式，逻辑严谨',
      poetic: '诗意化表达，富有韵律感',
      colloquial: '口语化，通俗易懂'
    };

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

【输出格式】
只输出润色后的文字，不要任何解释和说明。`;

    const startTime = Date.now();
    let polishedText: string;
    let tokensUsed: { input: number; output: number; total: number };
    let modelName: string;

    if (USE_QWEN) {
      // 使用千问API
      const qwenResponse = await callQwenAPI(prompt, 1500, 0.7);
      polishedText = qwenResponse.text;
      tokensUsed = {
        input: qwenResponse.usage.input,
        output: qwenResponse.usage.output,
        total: qwenResponse.usage.input + qwenResponse.usage.output
      };
      modelName = QWEN_MODEL;
    } else {
      // 使用Claude API
      if (!anthropic) {
        throw new Error('未配置AI服务，请设置QWEN_API_KEY或ANTHROPIC_API_KEY');
      }
      
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      const aiContent = response.content[0];
      polishedText = aiContent.type === 'text' ? aiContent.text : '';
      tokensUsed = {
        input: response.usage.input_tokens || 0,
        output: response.usage.output_tokens || 0,
        total: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      };
      modelName = 'claude-3-haiku-20240307';
    }

    const responseTime = Date.now() - startTime;
    const costUsd = (tokensUsed.input * 0.25 / 1000000) + (tokensUsed.output * 1.25 / 1000000);

    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result_data: JSON.stringify({ original: content, polished: polishedText, style }),
        completed_at: new Date()
      }
    });

    await prisma.ai_usage_logs.create({
      data: {
        user_id: userId,
        action_type: 'polish',
        model_name: modelName,
        prompt_tokens: tokensUsed.input,
        completion_tokens: tokensUsed.output,
        total_tokens: tokensUsed.total,
        cost_usd: costUsd,
        response_time_ms: responseTime,
        success: true
      }
    });

    await deductPoints(userId, AI_COST.POLISH, 'ai_polish', 'AI润色消耗', taskId);
    await notifyAiPolishReady(userId, taskId);

    console.log(`✅ AI润色任务完成: ${taskId}`);
    return { success: true, polishedText };

  } catch (error) {
    console.error(`❌ AI润色任务失败: ${taskId}`, error);

    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date()
      }
    });

    throw error;
  }
});

/**
 * 处理AI插图任务
 */
aiIllustrationQueue.process(async (job: Job<IllustrationJobData>) => {
  const { taskId, userId, storyId, nodeId, chapterTitle, chapterContent } = job.data;

  console.log(`🚀 开始处理AI插图任务: ${taskId}, 使用千问通义万相API`);

  try {
    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: { status: 'processing', started_at: new Date() }
    });

    // 生成图像prompt（中文，适合千问）
    const imagePrompt = await generateChineseImagePrompt(chapterTitle, chapterContent);
    console.log(`📝 图像提示词: ${imagePrompt}`);

    // 调用千问图像生成API
    const startTime = Date.now();
    const { imageUrl } = await callQwenImageAPI(imagePrompt);
    const responseTime = Date.now() - startTime;

    if (!imageUrl) {
      throw new Error('未能生成图像');
    }

    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result_data: JSON.stringify({ imageUrl, prompt: imagePrompt }),
        completed_at: new Date()
      }
    });

    await prisma.ai_usage_logs.create({
      data: {
        user_id: userId,
        story_id: storyId,
        node_id: nodeId,
        action_type: 'illustration',
        model_name: 'wanx-v1',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0.015, // 通义万相价格约0.015元/张
        response_time_ms: responseTime,
        success: true
      }
    });

    await deductPoints(userId, AI_COST.ILLUSTRATION, 'ai_illustration', 'AI插图消耗', taskId);
    await notifyAiIllustrationReady(userId, taskId, chapterTitle);

    console.log(`✅ AI插图任务完成: ${taskId}, 耗时: ${responseTime}ms`);
    return { success: true, imageUrl };

  } catch (error) {
    console.error(`❌ AI插图任务失败: ${taskId}`, error);

    await prisma.ai_tasks.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date()
      }
    });

    throw error;
  }
});

/**
 * 生成图像prompt（英文，用于DALL-E 3）
 */
async function generateImagePrompt(title: string, content: string): Promise<string> {
  const prompt = `基于以下小说章节，生成一个适合DALL-E 3的图像生成prompt（英文）：

章节标题：${title}
章节内容：${content.substring(0, 500)}

要求：
1. 提取关键场景和视觉元素
2. 描述具体画面（人物、环境、氛围）
3. 使用英文
4. 适合插画风格
5. 50-100词

只输出prompt，不要其他内容。`;

  try {
    if (USE_QWEN) {
      // 使用千问API
      const qwenResponse = await callQwenAPI(prompt, 200, 0.7);
      return qwenResponse.text.trim();
    } else {
      // 使用Claude API
      if (!anthropic) {
        return `Illustration for "${title}", fantasy art style, detailed, atmospheric`;
      }
      
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });

      const aiContent = response.content[0];
      return aiContent.type === 'text' ? aiContent.text.trim() : `Illustration for "${title}", fantasy art style, detailed, atmospheric`;
    }
  } catch (error) {
    console.error('生成图像prompt失败:', error);
    return `Illustration for "${title}", fantasy art style, detailed, atmospheric`;
  }
}

/**
 * 生成中文图像prompt（用于千问通义万相）
 */
async function generateChineseImagePrompt(title: string, content: string): Promise<string> {
  const prompt = `你是一位专业的插画师。请基于以下小说章节，生成一个适合图像生成的中文提示词。

【章节标题】
${title}

【章节内容】
${content.substring(0, 500)}${content.length > 500 ? '\n...(内容过长已截断)' : ''}

【要求】
1. 提取章节中的关键视觉元素（人物、场景、氛围）
2. 描述具体的画面构图和细节
3. 使用中文描述
4. 适合小说插画风格（唯美、细腻、有故事感）
5. 50-100字

【输出格式】
只输出中文提示词，不要任何解释和说明。

示例：
"古风庭院，月光下，一位白衣少年独自站在梅花树下，神情忧郁，远处灯火阑珊，水墨画风格，细腻唯美"`;

  try {
    // 使用千问API生成中文prompt
    const qwenResponse = await callQwenAPI(prompt, 200, 0.7);
    let chinesePrompt = qwenResponse.text.trim();
    
    // 如果生成的prompt太短，添加一些通用的风格描述
    if (chinesePrompt.length < 30) {
      chinesePrompt = `${chinesePrompt}，小说插画风格，细腻唯美，富有故事感`;
    }
    
    console.log(`📝 生成的中文提示词: ${chinesePrompt}`);
    return chinesePrompt;
  } catch (error) {
    console.error('生成中文图像prompt失败:', error);
    // 降级方案：直接使用章节标题和简单描述
    return `${title}，小说插画，唯美细腻，富有故事感和氛围感`;
  }
}

/**
 * 解析AI续写响应
 */
function parseAiResponse(response: string): Array<{ title: string; content: string; style: string }> {
  const options: Array<{ title: string; content: string; style: string }> = [];

  const directionRegex = /【[^】]+】/g;
  const parts = response.split(directionRegex).slice(1);
  const headers = response.match(directionRegex) || [];

  for (let i = 0; i < headers.length && i < parts.length; i++) {
    const style = headers[i].replace(/【|】/g, '').split('：')[1] || '未知';
    const part = parts[i].trim();

    const titleMatch = part.match(/标题[：:]\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `续写${i + 1}`;

    const contentMatch = part.match(/内容[：:]\s*([\s\S]+)/);
    const content = contentMatch ? contentMatch[1].trim() : part;

    options.push({ title, content, style });
  }

  if (options.length === 0) {
    options.push({
      title: 'AI续写',
      content: response,
      style: '默认'
    });
  }

  return options;
}

console.log('🤖 AI Worker已启动，等待任务...');

