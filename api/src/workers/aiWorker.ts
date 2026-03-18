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
  mode?: string;
  wordCount?: number; // 期望生成字数
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
  const { taskId, userId, storyId, nodeId, context, storyTitle, storyDescription, style, count, mode, wordCount = 1500 } = job.data;

  console.log(`🚀 开始处理AI续写任务: ${taskId}, 使用${USE_QWEN ? '千问' : 'Claude'}API`);
  console.log(`📝 期望生成字数: ${wordCount}字`);

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

    // 根据模式和期望字数调整prompt
    const isChapterMode = mode === 'chapter';
    const wordCountHint = isChapterMode 
      ? `每个续写约${wordCount}字（可适当增减，但应接近此字数）`
      : `每个续写约${wordCount}字（可适当增减，但应接近此字数）`;

    // 构建prompt
    const prompt = `你是一位专业的小说创作助手。请基于以下故事前文，续写${count}个不同风格的后续${isChapterMode ? '章节' : '段落'}。

【故事信息】
故事标题：${storyTitle}
${storyDescription ? `故事简介：${storyDescription}` : ''}

【前文内容】
${context.substring(0, 2000)}${context.length > 2000 ? '\n...(内容过长已截断)' : ''}

【续写要求】
请续写${count}个不同方向的后续${isChapterMode ? '章节' : '段落'}：

${styleInstructions}

【字数要求】
${wordCountHint}

【输出规范】
- 标题简洁有力（10字以内）
- 内容与前文自然衔接
- 保持故事连贯性和人物一致性
- 语言优美流畅，富有画面感
- 严格控制字数在期望范围内（${wordCount}字左右）
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

    // 根据期望字数和生成数量动态计算max_tokens
    // 公式：(期望字数 × 生成数量 × 1.5倍token系数 + 500预留) 
    const estimatedTokens = Math.ceil(wordCount * count * 1.5 + 500);
    const maxTokens = Math.min(Math.max(estimatedTokens, 2000), 8000); // 限制在2000-8000之间
    console.log(`📊 期望字数: ${wordCount}字 × ${count}个 = ${wordCount * count}字`);
    console.log(`🔢 计算max_tokens: ${maxTokens} (估算: ${estimatedTokens})`);

    if (USE_QWEN) {
      // 使用千问API
      const qwenResponse = await callQwenAPI(prompt, maxTokens, 0.8);
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
        max_tokens: maxTokens,
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

    // 查询任务信息（用于后续处理）
    const task = await prisma.ai_tasks.findUnique({
      where: { id: taskId }
    });

    // 根据任务设置决定是否扣除积分
    const inputData = JSON.parse(task?.input_data || '{}');
    const usePoints = inputData.usePoints || false;
    const pointsCost = inputData.pointsCost || AI_COST.CONTINUATION;

    if (usePoints) {
      // 配额用完，使用积分
      console.log(`💰 配额已用完，扣除${pointsCost}积分`);
      const deductResult = await deductPoints(userId, pointsCost, 'ai_continuation', 'AI续写消耗积分', taskId);
      if (!deductResult.success) {
        console.error(`❌ 扣除积分失败，用户积分不足`);
        // 积分不足时任务已经执行，不回滚，但记录警告
      }
    } else {
      // 使用配额，不扣除积分
      console.log(`✅ 使用配额，不扣除积分（剩余配额: ${inputData.quotaRemaining || 'N/A'}）`);
    }

    // 处理任务完成逻辑

    if (task) {
      // 检查任务类型和设置
      const resultData = JSON.parse(task.result_data || '{}');
      const options = resultData.options || [];
      const inputData = JSON.parse(task.input_data || '{}');
      const publishImmediately = inputData.publishImmediately !== undefined ? inputData.publishImmediately : true;
      
      if (options.length > 0) {
        // 判断是自动接受还是手动确认
        if (task.scheduled_at) {
          // 定时任务，根据publishImmediately决定处理方式
          if (publishImmediately) {
            // 自动发布第一个选项
            console.log(`🤖 自动发布第一个AI章节: ${task.id} - ${options[0].title}`);
            await autoAcceptAiChapter(task, options[0], true);
          } else {
            // 保存所有选项为草稿
            console.log(`📝 保存所有AI章节为草稿: ${task.id} - 共${options.length}个选项`);
            await saveAllOptionsAsDraft(task, options);
          }
        } else {
          // 立即任务，发送通知等待用户确认
          console.log(`📋 等待用户手动确认: ${task.id} - ${options[0].title}`);
          await notifyAiContinuationReady(userId, taskId, storyTitle, task.story_id || undefined);
        }
      }
    } else {
      // 这是立即任务，发送通知让用户手动接受
      const taskInfo = await prisma.ai_tasks.findUnique({
        where: { id: taskId },
        select: { story_id: true }
      });
      await notifyAiContinuationReady(userId, taskId, storyTitle, taskInfo?.story_id || undefined);
    }

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
 * 保存所有AI选项为草稿
 * @param task AI任务
 * @param options 所有AI生成的选项
 */
async function saveAllOptionsAsDraft(task: any, options: any[]) {
  try {
    console.log(`📝 开始保存所有AI章节为草稿: ${task.id} - 共${options.length}个选项`);
    
    // 确定父节点ID
    let parentNodeId = task.node_id;
    
    // 如果没有指定父节点，找到最新的一章作为父节点
    if (!parentNodeId && task.story_id) {
      const latestNode = await prisma.nodes.findFirst({
        where: { 
          story_id: task.story_id,
          is_published: true
        },
        orderBy: [
          { path: 'desc' },
          { created_at: 'desc' }
        ]
      });
      
      if (latestNode) {
        parentNodeId = latestNode.id;
        console.log(`[保存草稿] 自动选择最新章节作为父节点: ${latestNode.id}`);
      }
    }

    // 计算基础路径
    let basePath = '1';
    if (parentNodeId) {
      const parentNode = await prisma.nodes.findUnique({
        where: { id: parentNodeId }
      });

      if (parentNode) {
        const siblingCount = await prisma.nodes.count({
          where: { parent_id: parentNodeId }
        });
        basePath = `${parentNode.path}.${siblingCount + 1}`;
      }
    } else {
      // 根节点
      const existingRoot = await prisma.nodes.findFirst({
        where: {
          story_id: task.story_id!,
          parent_id: null
        }
      });
      
      if (existingRoot) {
        console.log(`[保存草稿] 故事已有根节点，跳过创建`);
        return;
      }
    }

    // 创建所有选项为草稿（作为分支）
    const createdNodes = [];
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const nodePath = i === 0 ? basePath : `${basePath}.${i + 1}`;
      
      const node = await prisma.nodes.create({
        data: {
          story_id: task.story_id!,
          parent_id: parentNodeId,
          author_id: task.user_id,
          title: `${option.title} (草稿${i + 1})`,
          content: option.content,
          path: nodePath,
          ai_generated: true,
          is_published: false, // 保存为草稿
          updated_at: new Date()
        }
      });

      createdNodes.push(node);
      console.log(`✅ 草稿创建成功 ${i + 1}/${options.length}: #${node.id} - ${node.title}`);
    }
    
    // 更新任务状态
    await prisma.ai_tasks.update({
      where: { id: task.id },
      data: { 
        status: 'completed',
        result_data: JSON.stringify({
          ...JSON.parse(task.result_data || '{}'),
          savedAsDraft: true,
          createdNodeIds: createdNodes.map(n => n.id),
          publishStatus: 'draft'
        })
      }
    });

    // 发送通知
    await prisma.notifications.create({
      data: {
        user_id: task.user_id,
        type: 'ai_chapter_draft',
        title: '📝 AI章节已保存为草稿',
        content: `AI已为您创作${options.length}个章节草稿，可随时编辑和发布。`,
        link: `/story?id=${task.story_id}`,
        is_read: false
      }
    });

    console.log(`✅ 所有AI章节已保存为草稿: ${createdNodes.length}个`);
    return createdNodes;
  } catch (error) {
    console.error(`❌ 保存AI章节草稿失败:`, error);
    
    // 更新任务为失败状态
    await prisma.ai_tasks.update({
      where: { id: task.id },
      data: { 
        status: 'failed',
        error_message: `保存草稿失败: ${error instanceof Error ? error.message : String(error)}`
      }
    });
    
    throw error;
  }
}

/**
 * 自动接受AI生成的选项并创建章节
 * @param task AI任务
 * @param firstOption 第一个选项
 * @param publishImmediately 是否立即发布（true=发布，false=草稿）
 */
async function autoAcceptAiChapter(task: any, firstOption: any, publishImmediately: boolean = true) {
  try {
    console.log(`🤖 ${publishImmediately ? '自动接受' : '手动确认'} AI生成的章节: ${task.id} - ${firstOption.title}`);
    
    // 确定父节点ID
    let parentNodeId = task.node_id;
    
    // 如果没有指定父节点，找到最新的一章作为父节点
    if (!parentNodeId && task.story_id) {
      const latestNode = await prisma.nodes.findFirst({
        where: { 
          story_id: task.story_id,
          is_published: true
        },
        orderBy: [
          { path: 'desc' },
          { created_at: 'desc' }
        ]
      });
      
      if (latestNode) {
        parentNodeId = latestNode.id;
        console.log(`[${publishImmediately ? '自动接受' : '手动确认'}] 自动选择最新章节作为父节点: ${latestNode.id}`);
      }
    }

    // 计算新路径
    let newPath = '1';
    if (parentNodeId) {
      const parentNode = await prisma.nodes.findUnique({
        where: { id: parentNodeId }
      });

      if (parentNode) {
        const siblingCount = await prisma.nodes.count({
          where: { parent_id: parentNodeId }
        });
        newPath = `${parentNode.path}.${siblingCount + 1}`;
      }
    } else {
      // 根节点
      const existingRoot = await prisma.nodes.findFirst({
        where: {
          story_id: task.story_id!,
          parent_id: null
        }
      });
      
      if (existingRoot) {
        console.log(`[${publishImmediately ? '自动接受' : '手动确认'}] 故事已有根节点，跳过创建`);
        return;
      }
    }

    // 创建节点
    const node = await prisma.nodes.create({
      data: {
        story_id: task.story_id!,
        parent_id: parentNodeId,
        author_id: task.user_id,
        title: firstOption.title,
        content: firstOption.content,
        path: newPath,
        ai_generated: true,
        is_published: publishImmediately, // 根据参数决定发布状态
        updated_at: new Date()
      }
    });

    console.log(`✅ ${publishImmediately ? '自动创建' : '草稿创建'}章节成功: #${node.id} - ${node.title}`);
    
    // 更新任务状态
    await prisma.ai_tasks.update({
      where: { id: task.id },
      data: { 
        status: 'completed',
        result_data: JSON.stringify({
          ...JSON.parse(task.result_data || '{}'),
          autoAccepted: publishImmediately,
          acceptedNodeId: node.id,
          publishStatus: publishImmediately ? 'published' : 'draft'
        })
      }
    });

    // 发送通知
    const notificationTitle = publishImmediately ? '🎉 AI章节自动创建成功' : '📝 AI章节已保存为草稿';
    const notificationContent = publishImmediately 
      ? `您的故事《${firstOption.title}》已由AI自动创建！`
      : `您的故事《${firstOption.title}》已保存为草稿，可随时编辑发布。`;

    await prisma.notifications.create({
      data: {
        user_id: task.user_id,
        type: publishImmediately ? 'ai_chapter_created' : 'ai_chapter_draft',
        title: notificationTitle,
        content: notificationContent,
        link: `/chapter?id=${node.id}`,
        is_read: false
      }
    });

    return node;
  } catch (error) {
    console.error(`❌ ${publishImmediately ? '自动接受' : '手动确认'}AI章节失败:`, error);
    
    // 更新任务为失败状态
    await prisma.ai_tasks.update({
      where: { id: task.id },
      data: { 
        status: 'failed',
        error_message: `创建章节失败: ${error instanceof Error ? error.message : String(error)}`
      }
    });
    
    throw error;
  }
}

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

    // 根据任务设置决定是否扣除积分
    const task = await prisma.ai_tasks.findUnique({
      where: { id: taskId },
      select: { input_data: true }
    });
    
    const inputData = JSON.parse(task?.input_data || '{}');
    const usePoints = inputData.usePoints || false;
    const pointsCost = inputData.pointsCost || AI_COST.POLISH;

    if (usePoints) {
      console.log(`💰 配额已用完，扣除${pointsCost}积分`);
      const deductResult = await deductPoints(userId, pointsCost, 'ai_polish', 'AI润色消耗积分', taskId);
      if (!deductResult.success) {
        console.error(`❌ 扣除积分失败，用户积分不足`);
      }
    } else {
      console.log(`✅ 使用配额，不扣除积分`);
    }

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

    // 更新章节的插图字段
    if (nodeId) {
      await prisma.nodes.update({
        where: { id: nodeId },
        data: { 
          image: imageUrl,
          updated_at: new Date()
        }
      });
      console.log(`✅ 章节插图已更新: nodeId=${nodeId}, imageUrl=${imageUrl}`);
    }

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

    // 根据任务设置决定是否扣除积分
    const task = await prisma.ai_tasks.findUnique({
      where: { id: taskId },
      select: { input_data: true }
    });
    
    const inputData = JSON.parse(task?.input_data || '{}');
    const usePoints = inputData.usePoints || false;
    const pointsCost = inputData.pointsCost || AI_COST.ILLUSTRATION;

    if (usePoints) {
      console.log(`💰 配额已用完，扣除${pointsCost}积分`);
      const deductResult = await deductPoints(userId, pointsCost, 'ai_illustration', 'AI插图消耗积分', taskId);
      if (!deductResult.success) {
        console.error(`❌ 扣除积分失败，用户积分不足`);
      }
    } else {
      console.log(`✅ 使用配额，不扣除积分`);
    }

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

  // 只匹配"【方向N：XXX】"格式的标记，避免误匹配其他【】标记
  const directionRegex = /【方向\d+：[^】]+】/g;
  const headers = response.match(directionRegex) || [];
  
  if (headers.length === 0) {
    // 如果没有找到标准格式，尝试降级解析
    console.log('⚠️ 未找到标准格式的方向标记，尝试降级解析');
    
    // 尝试按照"标题："和"内容："来分割
    const titleMatches = [...response.matchAll(/标题[：:]\s*(.+)/g)];
    const contentMatches = [...response.matchAll(/内容[：:]\s*([\s\S]+?)(?=标题[：:]|$)/g)];
    
    for (let i = 0; i < Math.min(titleMatches.length, contentMatches.length); i++) {
      options.push({
        title: titleMatches[i][1].trim(),
        content: contentMatches[i][1].trim(),
        style: '未知'
      });
    }
    
    // 如果还是解析失败，返回整个响应作为单个选项
    if (options.length === 0) {
      options.push({
        title: 'AI续写',
        content: response,
        style: '默认'
      });
    }
    
    return options;
  }

  // 标准解析：按方向标记分割
  const parts = response.split(directionRegex).slice(1);

  for (let i = 0; i < headers.length && i < parts.length; i++) {
    const style = headers[i].replace(/【|】/g, '').split('：')[1] || '未知';
    const part = parts[i].trim();

    const titleMatch = part.match(/标题[：:]\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `续写${i + 1}`;

    const contentMatch = part.match(/内容[：:]\s*([\s\S]+)/);
    const content = contentMatch ? contentMatch[1].trim() : part;

    // 只添加有实际内容的选项（内容长度至少50字）
    if (content && content.length >= 50) {
      options.push({ title, content, style });
    } else {
      console.log(`⚠️ 跳过内容过短的选项 ${i + 1}: "${title}" (${content.length}字)`);
    }
  }

  // 确保至少有一个选项
  if (options.length === 0) {
    console.log('⚠️ 解析结果为空，返回原始响应');
    options.push({
      title: 'AI续写',
      content: response,
      style: '默认'
    });
  }

  console.log(`✅ 成功解析 ${options.length} 个AI续写选项`);
  return options;
}

console.log('🤖 AI Worker已启动，等待任务...');

/**
 * 动态限流配置
 */
const RATE_LIMIT_CONFIG = {
  MAX_BATCH_SIZE: 10,           // 每批最多处理10个任务
  MIN_BATCH_SIZE: 3,            // 最少处理3个任务（负载低时）
  MAX_QUEUE_SIZE: 100,          // 队列最大容量
  HIGH_LOAD_THRESHOLD: 50,      // 高负载阈值（队列任务数）
  DELAY_WARNING_MINUTES: 5,     // 延迟超过5分钟发送警告
};

/**
 * 获取当前队列负载情况
 */
async function getQueueLoad(): Promise<{ total: number; waiting: number; active: number }> {
  try {
    const [continuationWaiting, continuationActive] = await Promise.all([
      aiContinuationQueue.getWaitingCount(),
      aiContinuationQueue.getActiveCount()
    ]);
    
    const [polishWaiting, polishActive] = await Promise.all([
      aiPolishQueue.getWaitingCount(),
      aiPolishQueue.getActiveCount()
    ]);
    
    const [illustrationWaiting, illustrationActive] = await Promise.all([
      aiIllustrationQueue.getWaitingCount(),
      aiIllustrationQueue.getActiveCount()
    ]);
    
    return {
      total: continuationWaiting + continuationActive + polishWaiting + polishActive + illustrationWaiting + illustrationActive,
      waiting: continuationWaiting + polishWaiting + illustrationWaiting,
      active: continuationActive + polishActive + illustrationActive
    };
  } catch (error) {
    console.error('获取队列负载失败:', error);
    return { total: 0, waiting: 0, active: 0 };
  }
}

/**
 * 计算任务优先级（越小优先级越高）
 */
function calculateTaskPriority(task: any, delayMinutes: number): number {
  let priority = 5; // 基础优先级
  
  // 1. 延迟时间越长，优先级越高
  if (delayMinutes > 30) {
    priority -= 3;
  } else if (delayMinutes > 10) {
    priority -= 2;
  } else if (delayMinutes > 5) {
    priority -= 1;
  }
  
  // 2. VIP用户优先级提升
  // TODO: 可以根据用户等级或订阅状态调整
  
  // 3. 简单任务优先（润色 > 续写 > 插图）
  if (task.task_type === 'polish') {
    priority -= 1;
  } else if (task.task_type === 'illustration') {
    priority += 1;
  }
  
  return Math.max(1, Math.min(10, priority)); // 限制在1-10之间
}

/**
 * 发送延迟通知给用户
 */
async function notifyTaskDelay(userId: number, taskId: number, delayMinutes: number, estimatedMinutes: number) {
  try {
    await prisma.notifications.create({
      data: {
        user_id: userId,
        type: 'ai_task_delay',
        title: '⏰ AI任务延迟提醒',
        content: `您的AI任务已延迟 ${delayMinutes} 分钟。由于当前系统负载较高，预计还需等待约 ${estimatedMinutes} 分钟。建议您稍后查看，或选择非高峰时段（凌晨0-6点）提交任务。`,
        link: `/ai-tasks?taskId=${taskId}`,
        is_read: false
      }
    });
    console.log(`📬 已向用户 ${userId} 发送延迟通知 (任务 ${taskId})`);
  } catch (error) {
    console.error('发送延迟通知失败:', error);
  }
}

/**
 * 定时任务调度器 - 检查并执行到期的AI任务（优化版）
 */
async function checkScheduledTasks() {
  try {
    const now = new Date();
    
    // 1. 获取当前队列负载
    const queueLoad = await getQueueLoad();
    console.log(`📊 当前队列负载: 总计 ${queueLoad.total} (等待 ${queueLoad.waiting}, 处理中 ${queueLoad.active})`);
    
    // 2. 动态调整批处理大小
    let batchSize = RATE_LIMIT_CONFIG.MAX_BATCH_SIZE;
    
    if (queueLoad.total > RATE_LIMIT_CONFIG.HIGH_LOAD_THRESHOLD) {
      // 高负载：减少批处理大小，避免雪崩
      batchSize = RATE_LIMIT_CONFIG.MIN_BATCH_SIZE;
      console.log(`⚠️ 系统高负载，降低批处理大小至 ${batchSize}`);
    } else if (queueLoad.total > RATE_LIMIT_CONFIG.HIGH_LOAD_THRESHOLD / 2) {
      // 中等负载：适中的批处理大小
      batchSize = Math.floor((RATE_LIMIT_CONFIG.MAX_BATCH_SIZE + RATE_LIMIT_CONFIG.MIN_BATCH_SIZE) / 2);
    }
    
    // 3. 如果队列已满，暂停处理新任务
    if (queueLoad.total >= RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE) {
      console.log(`🚫 队列已满 (${queueLoad.total}/${RATE_LIMIT_CONFIG.MAX_QUEUE_SIZE})，跳过本轮调度`);
      return;
    }
    
    // 4. 查找所有到期的待处理任务
    const dueTasks = await prisma.ai_tasks.findMany({
      where: {
        status: 'pending',
        scheduled_at: {
          lte: now
        }
      },
      orderBy: {
        scheduled_at: 'asc' // 优先处理最早的任务
      },
      take: batchSize * 3 // 多取一些用于优先级排序
    });

    if (dueTasks.length === 0) {
      return; // 没有到期任务
    }
    
    console.log(`⏰ 发现 ${dueTasks.length} 个到期的定时任务`);
    
    // 5. 计算延迟时间并排序
    const tasksWithPriority = dueTasks.map(task => {
      const scheduledTime = new Date(task.scheduled_at!);
      const delayMs = now.getTime() - scheduledTime.getTime();
      const delayMinutes = Math.floor(delayMs / 60000);
      
      return {
        task,
        delayMinutes,
        priority: calculateTaskPriority(task, delayMinutes)
      };
    });
    
    // 按优先级排序（优先级数字越小越优先）
    tasksWithPriority.sort((a, b) => a.priority - b.priority);
    
    // 6. 只处理前 batchSize 个任务
    const tasksToProcess = tasksWithPriority.slice(0, batchSize);
    
    console.log(`📤 本轮将处理 ${tasksToProcess.length} 个任务 (剩余 ${dueTasks.length - tasksToProcess.length} 个待处理)`);
    
    // 7. 统计延迟严重的任务
    const delayedTasks = tasksWithPriority.filter(t => t.delayMinutes > RATE_LIMIT_CONFIG.DELAY_WARNING_MINUTES);
    if (delayedTasks.length > 0) {
      console.log(`⚠️ 有 ${delayedTasks.length} 个任务延迟超过 ${RATE_LIMIT_CONFIG.DELAY_WARNING_MINUTES} 分钟`);
    }
    
    // 8. 处理任务
    for (const { task, delayMinutes, priority } of tasksToProcess) {
      try {
        console.log(`📤 处理任务 ${task.id} (类型: ${task.task_type}, 延迟: ${delayMinutes}分钟, 优先级: ${priority})`);
        
        // 解析任务数据
        const inputData = JSON.parse(task.input_data || '{}');
        
        // 根据任务类型添加到对应的队列
        if (task.task_type === 'continuation') {
          await aiContinuationQueue.add({
            taskId: task.id,
            userId: task.user_id,
            storyId: task.story_id,
            nodeId: task.node_id || undefined,
            context: inputData.context || '',
            storyTitle: inputData.storyTitle || '',
            storyDescription: inputData.storyDescription || '',
            style: inputData.style,
            count: inputData.count || 3
          }, {
            priority: priority,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000
            }
          });
        } else if (task.task_type === 'polish') {
          await aiPolishQueue.add({
            taskId: task.id,
            userId: task.user_id,
            content: inputData.content || '',
            style: inputData.style || 'elegant'
          }, {
            priority: priority,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000
            }
          });
        } else if (task.task_type === 'illustration') {
          await aiIllustrationQueue.add({
            taskId: task.id,
            userId: task.user_id,
            storyId: task.story_id,
            nodeId: task.node_id || 0,
            chapterTitle: inputData.chapterTitle || '',
            chapterContent: inputData.chapterContent || ''
          }, {
            priority: priority,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000
            }
          });
        }
        
        console.log(`✅ 任务 ${task.id} 已添加到队列`);
        
        // 如果延迟超过阈值，发送通知
        if (delayMinutes > RATE_LIMIT_CONFIG.DELAY_WARNING_MINUTES) {
          // 估算剩余等待时间（基于当前队列长度）
          const estimatedMinutes = Math.ceil(queueLoad.waiting * 2); // 假设每个任务2分钟
          await notifyTaskDelay(task.user_id, task.id, delayMinutes, estimatedMinutes);
        }
        
      } catch (error) {
        console.error(`❌ 处理任务 ${task.id} 失败:`, error);
        
        // 标记任务为失败
        await prisma.ai_tasks.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            error_message: error instanceof Error ? error.message : '任务调度失败',
            completed_at: new Date()
          }
        });
      }
    }
    
    // 9. 如果还有很多任务未处理，记录警告
    if (dueTasks.length > batchSize * 2) {
      console.log(`⚠️ 警告: 当前有 ${dueTasks.length} 个任务待处理，系统可能需要扩容`);
    }
    
  } catch (error) {
    console.error('❌ 检查定时任务失败:', error);
  }
}

// 每分钟检查一次定时任务
const SCHEDULER_INTERVAL = 60 * 1000; // 60秒
setInterval(checkScheduledTasks, SCHEDULER_INTERVAL);

// 启动时立即检查一次
checkScheduledTasks().then(() => {
  console.log('✅ 定时任务调度器已启动，每60秒检查一次');
});

