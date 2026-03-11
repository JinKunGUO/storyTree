import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { aiContinuationQueue, aiPolishQueue, aiIllustrationQueue } from '../utils/queue';
import { canUseAiFeature, getUserMonthlyQuota, getUserLevel, hasEnoughPoints, AI_COST } from '../utils/points';

const router = Router();

// JWT认证函数
const getUserId = (req: any): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

/**
 * 提交AI续写任务（异步）
 */
router.post('/continuation/submit', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId, nodeId, context, style, count = 3, mode = 'segment', surpriseTime, publishImmediately = true } = req.body;

  if (!storyId) {
    return res.status(400).json({ error: 'storyId是必需的' });
  }

  try {
    // 检查权限
    const permission = await canUseAiFeature(userId, 'continuation');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 获取故事信息
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      include: {
        nodes: {
          orderBy: { path: 'asc' }
        }
      }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    // 构建上下文
    let fullContext = context || '';
    
    if (mode === 'chapter' && nodeId) {
      // 整章模式：获取当前节点及其前两章（共3章）
      const currentNode = await prisma.nodes.findUnique({
        where: { id: parseInt(nodeId) }
      });

      if (currentNode) {
        // 获取前三章：从当前节点向上追溯
        const recentNodes = [];
        let node: typeof currentNode | null = currentNode;
        let count = 0;

        // 向上追溯最多3章
        while (node && count < 3) {
          recentNodes.unshift(node); // 添加到数组开头，保持时间顺序
          count++;
          
          if (node.parent_id) {
            node = await prisma.nodes.findUnique({
              where: { id: node.parent_id }
            });
          } else {
            break;
          }
        }

        // 构建上下文
        fullContext = recentNodes.map(n => `【${n.title}】\n${n.content}`).join('\n\n');
        console.log(`[AI续写] 整章模式，使用前${recentNodes.length}章作为上下文，总字数: ${fullContext.length}`);
      }
    } else if (mode === 'segment') {
      // 小段落模式：仅使用当前编辑器内容
      fullContext = context || '';
      console.log(`[AI续写] 小段落模式，使用当前内容作为上下文，字数: ${fullContext.length}`);
    } else if (!fullContext && story.nodes.length > 0) {
      // 兜底：使用前5章
      const recentNodes = story.nodes.slice(-5);
      fullContext = recentNodes.map(n => `【${n.title}】\n${n.content}`).join('\n\n');
    } else if (!fullContext) {
      fullContext = story.description || '';
    }

    // 计算调度时间
    let scheduledAt: Date | undefined;
    const now = new Date();

    switch (surpriseTime) {
      case '1hour':
        scheduledAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'tonight':
        scheduledAt = new Date(now);
        scheduledAt.setHours(22, 0, 0, 0);
        if (scheduledAt < now) {
          scheduledAt.setDate(scheduledAt.getDate() + 1);
        }
        break;
      case 'tomorrow':
        scheduledAt = new Date(now);
        scheduledAt.setDate(scheduledAt.getDate() + 1);
        scheduledAt.setHours(8, 0, 0, 0);
        break;
      case null:
      case undefined:
      case 'immediate':
        scheduledAt = undefined; // 立即处理
        break;
      default:
        // 尝试解析为自定义时间（ISO格式字符串）
        try {
          const customTime = new Date(surpriseTime);
          
          // 验证时间是否有效
          if (isNaN(customTime.getTime())) {
            console.warn(`⚠️ 无效的时间格式: ${surpriseTime}，使用立即处理`);
            scheduledAt = undefined;
            break;
          }
          
          // 验证时间是否在未来
          if (customTime > now) {
            scheduledAt = customTime;
            
            // 调试日志：显示不同时区的时间
            console.log(`📅 自定义时间解析成功:`);
            console.log(`   - 原始输入: ${surpriseTime}`);
            console.log(`   - UTC时间: ${customTime.toISOString()}`);
            console.log(`   - 北京时间: ${customTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
            console.log(`   - 纽约时间: ${customTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
            console.log(`   - 时间戳: ${customTime.getTime()}`);
          } else {
            console.warn(`⚠️ 时间已过期: ${surpriseTime}（${customTime.toLocaleString('zh-CN')}），使用立即处理`);
            scheduledAt = undefined;
          }
        } catch (error) {
          console.warn(`⚠️ 解析自定义时间失败: ${surpriseTime}，错误: ${error}，使用立即处理`);
          scheduledAt = undefined;
        }
    }

    // 创建任务记录
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        story_id: parseInt(storyId),
        node_id: nodeId ? parseInt(nodeId) : null,
        task_type: 'continuation',
        status: 'pending',
        priority: surpriseTime ? 0 : 10, // 立即处理的优先级更高
        input_data: JSON.stringify({
          context: fullContext,
          storyTitle: story.title,
          storyDescription: story.description,
          style,
          count,
          mode, // 保存模式信息
          publishImmediately // 保存发布状态
        }),
        scheduled_at: scheduledAt
      }
    });

    // 添加到队列
    const delay = scheduledAt ? scheduledAt.getTime() - now.getTime() : 0;
    await aiContinuationQueue.add(
      {
        taskId: task.id,
        userId,
        storyId: parseInt(storyId),
        nodeId: nodeId ? parseInt(nodeId) : undefined,
        context: fullContext,
        storyTitle: story.title,
        storyDescription: story.description || '',
        style,
        count,
        mode
      },
      {
        delay: Math.max(delay, 0),
        priority: task.priority
      }
    );

    res.json({
      taskId: task.id,
      status: 'pending',
      scheduledAt,
      message: scheduledAt
        ? `任务已提交，将在 ${scheduledAt.toLocaleString('zh-CN')} 开始处理`
        : '任务已提交，正在处理中...'
    });
  } catch (error) {
    console.error('提交AI续写任务失败:', error);
    res.status(500).json({ error: '提交任务失败' });
  }
});

/**
 * 提交AI润色任务（同步快速处理）
 */
router.post('/polish', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { content, style = 'elegant' } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  try {
    // 检查权限
    const permission = await canUseAiFeature(userId, 'polish');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'polish',
        status: 'pending',
        priority: 20, // 润色任务高优先级
        input_data: JSON.stringify({ content, style })
      }
    });

    // 添加到队列（同步等待）
    const job = await aiPolishQueue.add(
      {
        taskId: task.id,
        userId,
        content,
        style
      },
      {
        priority: 20
      }
    );

    // 等待任务完成（最多30秒）
    const result = await job.finished();

    // 获取结果
    const completedTask = await prisma.ai_tasks.findUnique({
      where: { id: task.id }
    });

    if (completedTask?.result_data) {
      const resultData = JSON.parse(completedTask.result_data);
      res.json({
        taskId: task.id,
        original: resultData.original,
        polished: resultData.polished,
        style: resultData.style
      });
    } else {
      res.status(500).json({ error: '润色失败' });
    }
  } catch (error) {
    console.error('AI润色失败:', error);
    res.status(500).json({ error: '润色失败' });
  }
});

/**
 * 提交AI插图任务（异步）
 */
router.post('/illustration/submit', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId, nodeId, chapterTitle, chapterContent } = req.body;

  if (!storyId || !nodeId || !chapterTitle || !chapterContent) {
    return res.status(400).json({ error: '参数不完整' });
  }

  try {
    // 检查权限
    const permission = await canUseAiFeature(userId, 'illustration');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        story_id: parseInt(storyId),
        node_id: parseInt(nodeId),
        task_type: 'illustration',
        status: 'pending',
        priority: 5,
        input_data: JSON.stringify({ chapterTitle, chapterContent })
      }
    });

    // 添加到队列
    await aiIllustrationQueue.add({
      taskId: task.id,
      userId,
      storyId: parseInt(storyId),
      nodeId: parseInt(nodeId),
      chapterTitle,
      chapterContent
    });

    res.json({
      taskId: task.id,
      status: 'pending',
      message: '插图生成任务已提交，完成后将通知您'
    });
  } catch (error) {
    console.error('提交AI插图任务失败:', error);
    res.status(500).json({ error: '提交任务失败' });
  }
});

/**
 * 查询任务状态
 */
router.get('/tasks/:taskId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { taskId } = req.params;

  try {
    const task = await prisma.ai_tasks.findUnique({
      where: { id: parseInt(taskId) }
    });

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.user_id !== userId) {
      return res.status(403).json({ error: '无权访问此任务' });
    }

    let result = null;
    if (task.result_data) {
      result = JSON.parse(task.result_data);
    }

    res.json({
      taskId: task.id,
      taskType: task.task_type,
      status: task.status,
      createdAt: task.created_at,
      scheduledAt: task.scheduled_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      result,
      errorMessage: task.error_message
    });
  } catch (error) {
    console.error('查询任务失败:', error);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * 获取我的任务列表
 */
router.get('/tasks', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { taskType, status, page = 1, limit = 20 } = req.query;

  try {
    const where: any = { user_id: userId };
    if (taskType) where.task_type = taskType;
    if (status) where.status = status;

    const tasks = await prisma.ai_tasks.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    const total = await prisma.ai_tasks.count({ where });

    res.json({
      tasks: tasks.map(task => ({
        taskId: task.id,
        taskType: task.task_type,
        status: task.status,
        createdAt: task.created_at,
        completedAt: task.completed_at,
        hasResult: !!task.result_data
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 获取用户AI配额信息
 */
router.get('/quota', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { points: true, level: true, subscription_type: true, subscription_expires: true }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const levelInfo = getUserLevel(user.points);
    const quota = await getUserMonthlyQuota(userId);

    res.json({
      level: {
        current: levelInfo.level,
        name: levelInfo.name,
        progress: levelInfo.progress,
        nextLevelPoints: levelInfo.nextLevelPoints
      },
      points: user.points,
      subscription: {
        type: user.subscription_type,
        expires: user.subscription_expires,
        active: user.subscription_expires && user.subscription_expires > new Date()
      },
      quota: {
        continuation: {
          used: quota.continuation.used,
          limit: quota.continuation.limit,
          remaining: quota.continuation.unlimited ? -1 : Math.max(0, quota.continuation.limit - quota.continuation.used),
          unlimited: quota.continuation.unlimited
        },
        polish: {
          used: quota.polish.used,
          limit: quota.polish.limit,
          remaining: quota.polish.unlimited ? -1 : Math.max(0, quota.polish.limit - quota.polish.used),
          unlimited: quota.polish.unlimited
        },
        illustration: {
          used: quota.illustration.used,
          limit: quota.illustration.limit,
          remaining: quota.illustration.unlimited ? -1 : Math.max(0, quota.illustration.limit - quota.illustration.used),
          unlimited: quota.illustration.unlimited
        }
      },
      costs: {
        continuation: AI_COST.CONTINUATION,
        polish: AI_COST.POLISH,
        illustration: AI_COST.ILLUSTRATION
      }
    });
  } catch (error) {
    console.error('获取配额信息失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 接受AI续写结果（创建节点）
 * @param publishImmediately 是否立即发布（true=发布，false=草稿，默认true）
 */
router.post('/continuation/accept', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { taskId, optionIndex, publishImmediately = true } = req.body;

  try {
    const task = await prisma.ai_tasks.findUnique({
      where: { id: parseInt(taskId) }
    });

    if (!task || task.user_id !== userId) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ error: '任务未完成' });
    }

    const resultData = JSON.parse(task.result_data || '{}');
    const options = resultData.options || [];

    if (optionIndex < 0 || optionIndex >= options.length) {
      return res.status(400).json({ error: '选项索引无效' });
    }

    const selectedOption = options[optionIndex];

    // 确定父节点ID
    let parentNodeId = task.node_id;
    
    // 如果没有指定父节点（从章节目录创作），找到最新的一章作为父节点
    if (!parentNodeId && task.story_id) {
      const latestNode = await prisma.nodes.findFirst({
        where: { 
          story_id: task.story_id,
          is_published: true // 只考虑已发布的章节
        },
        orderBy: [
          { path: 'desc' }, // 按路径降序，获取最后一章
          { created_at: 'desc' } // 如果路径相同，按创建时间降序
        ]
      });
      
      if (latestNode) {
        parentNodeId = latestNode.id;
        console.log(`[AI续写] 自动选择最新章节作为父节点: ${latestNode.id} (${latestNode.title})`);
      }
    }

    // 创建节点
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
      // 如果没有任何章节，这是第一章
      const existingRoot = await prisma.nodes.findFirst({
        where: {
          story_id: task.story_id!,
          parent_id: null
        }
      });
      
      if (existingRoot) {
        return res.status(400).json({ error: '故事已有第一章，无法创建新的根节点' });
      }
    }

    const node = await prisma.nodes.create({
      data: {
        story_id: task.story_id!,
        parent_id: parentNodeId,
        author_id: userId,
        title: selectedOption.title,
        content: selectedOption.content,
        path: newPath,
        ai_generated: true,
        is_published: publishImmediately, // 根据参数决定发布状态
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

    // 如果是第一章，更新故事的root_node_id
    if (!parentNodeId) {
      await prisma.stories.update({
        where: { id: task.story_id! },
        data: { root_node_id: node.id }
      });
    }

    res.json({ 
      node,
      publishStatus: publishImmediately ? 'published' : 'draft',
      message: publishImmediately ? '章节已发布' : '章节已保存为草稿'
    });
  } catch (error) {
    console.error('接受AI续写失败:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

/**
 * AI分支推荐
 * 分析所有分支的质量，推荐最佳分支路径
 */
router.post('/recommend-branch', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { nodeId } = req.body;

  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId是必需的' });
  }

  try {
    // 获取当前节点
    const currentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) }
    });

    if (!currentNode) {
      return res.status(404).json({ error: '节点不存在' });
    }

    // 获取所有子分支
    const branches = await prisma.nodes.findMany({
      where: { parent_id: parseInt(nodeId) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            comments: true,
            ratings: true
          }
        }
      }
    });

    if (branches.length === 0) {
      return res.json({
        recommended: null,
        alternatives: [],
        message: '当前章节还没有分支'
      });
    }

    // 计算每个分支的综合得分
    const calculateBranchScore = (branch: any) => {
      // 权重配置
      const readWeight = 0.4;      // 阅读量权重
      const ratingWeight = 0.4;    // 评分权重
      const commentWeight = 0.2;   // 评论数权重

      // 对数归一化阅读量（避免极端值）
      const readScore = Math.log(branch.read_count + 1) * readWeight * 10;
      
      // 评分得分（0-5分）
      const ratingScore = (branch.rating_avg || 0) * ratingWeight * 10;
      
      // 对数归一化评论数
      const commentScore = Math.log(branch._count.comments + 1) * commentWeight * 10;

      const totalScore = readScore + ratingScore + commentScore;

      return {
        ...branch,
        score: totalScore,
        scoreBreakdown: {
          readScore: readScore.toFixed(2),
          ratingScore: ratingScore.toFixed(2),
          commentScore: commentScore.toFixed(2),
          totalScore: totalScore.toFixed(2)
        }
      };
    };

    // 计算所有分支得分并排序
    const scoredBranches = branches
      .map(calculateBranchScore)
      .sort((a, b) => b.score - a.score);

    // 获取推荐分支（得分最高）
    const recommended = scoredBranches[0];
    const alternatives = scoredBranches.slice(1, 4); // 最多3个备选

    // 生成推荐理由
    let reason = '基于';
    const reasons = [];
    
    if (recommended.read_count > 50) {
      reasons.push(`高阅读量(${recommended.read_count}次)`);
    }
    if (recommended.rating_avg && recommended.rating_avg >= 4.0) {
      reasons.push(`高评分(${recommended.rating_avg.toFixed(1)}分)`);
    }
    if (recommended._count.comments > 5) {
      reasons.push(`活跃讨论(${recommended._count.comments}条评论)`);
    }
    
    if (reasons.length > 0) {
      reason += reasons.join('、');
    } else {
      reason = '综合数据分析';
    }
    
    reason += '，推荐此分支作为最佳阅读路径';

    res.json({
      recommended: {
        id: recommended.id,
        title: recommended.title,
        author: recommended.author,
        readCount: recommended.read_count,
        rating: recommended.rating_avg,
        commentCount: recommended._count.comments,
        score: recommended.score,
        scoreBreakdown: recommended.scoreBreakdown,
        aiGenerated: recommended.ai_generated
      },
      alternatives: alternatives.map(alt => ({
        id: alt.id,
        title: alt.title,
        author: alt.author,
        readCount: alt.read_count,
        rating: alt.rating_avg,
        commentCount: alt._count.comments,
        score: alt.score,
        scoreBreakdown: alt.scoreBreakdown,
        aiGenerated: alt.ai_generated
      })),
      reason,
      totalBranches: branches.length
    });
  } catch (error) {
    console.error('AI分支推荐失败:', error);
    res.status(500).json({ error: '推荐失败' });
  }
});

export default router;