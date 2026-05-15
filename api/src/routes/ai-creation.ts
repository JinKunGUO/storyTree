import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { canUseAiFeature } from '../utils/points';
import { JWT_SECRET } from '../utils/auth';
import { aiProjectBriefQueue, aiOutlineQueue, aiPasticheQueue, aiTemplateQueue } from '../utils/queue';

const router = Router();

// JWT 认证函数
const getUserId = (req: any): number | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

/**
 * 会话数据结构
 */
interface GenerationSession {
  sessionId: string;
  userId: number;
  type: 'project' | 'outline' | 'pastiche' | 'template';
  status: 'active' | 'completed' | 'abandoned';
  initialRequest: {
    type: string;
    params: any;
    timestamp: Date;
  };
  generations: Array<{
    round: number;
    content: any;
    userFeedback?: string;
    revisionType?: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// 内存存储会话（简化实现，生产环境可用 Redis）
const sessions: Map<string, GenerationSession> = new Map();

/**
 * 生成项目立项书
 */
router.post('/generate-project-brief', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyIdea, genre, targetAudience, writingStyle } = req.body;

  if (!storyIdea || storyIdea.trim().length === 0) {
    return res.status(400).json({ error: '故事想法不能为空' });
  }

  try {
    // 检查 AI 权限
    const permission = await canUseAiFeature(userId, 'continuation'); // 复用续写配额
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 创建会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: GenerationSession = {
      sessionId,
      userId,
      type: 'project',
      status: 'active',
      initialRequest: {
        type: 'project',
        params: { storyIdea, genre, targetAudience, writingStyle },
        timestamp: new Date()
      },
      generations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    sessions.set(sessionId, session);

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'generate_project_brief',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          storyIdea,
          genre,
          targetAudience,
          writingStyle
        })
      }
    });

    // 添加到队列
    await aiProjectBriefQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      storyIdea,
      genre,
      targetAudience,
      writingStyle
    });

    res.json({
      sessionId,
      taskId: task.id,
      message: '立项书正在生成中，请稍候...'
    });
  } catch (error) {
    console.error('生成项目立项书失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

/**
 * 修改项目立项书（多轮对话）
 */
router.post('/revise-project-brief', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { sessionId, feedback } = req.body;

  if (!sessionId || !feedback) {
    return res.status(400).json({ error: 'sessionId 和 feedback 是必需的' });
  }

  try {
    const session = sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: '会话不存在' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: '会话已结束' });
    }

    // 检查轮数限制
    if (session.generations.length >= 10) {
      return res.status(400).json({
        error: '已达到最大修改次数（10 次），建议基于当前结果重新生成',
        suggestion: '可以保存当前满意的版本，然后开始新的会话'
      });
    }

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'revise_project_brief',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          feedback,
          previousContent: session.generations[session.generations.length - 1]?.content
        })
      }
    });

    // 添加到队列
    await aiProjectBriefQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      feedback,
      revisionType: 'project_brief',
      previousContent: session.generations[session.generations.length - 1]?.content
    });

    res.json({
      taskId: task.id,
      message: '正在修改立项书，请稍候...'
    });
  } catch (error) {
    console.error('修改项目立项书失败:', error);
    res.status(500).json({ error: '修改失败' });
  }
});

/**
 * 生成故事大纲
 */
router.post('/generate-outline', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { genre, coreIdea, projectBrief } = req.body;

  if (!coreIdea || coreIdea.trim().length === 0) {
    return res.status(400).json({ error: '核心想法不能为空' });
  }

  try {
    // 检查 AI 权限
    const permission = await canUseAiFeature(userId, 'continuation');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 创建会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: GenerationSession = {
      sessionId,
      userId,
      type: 'outline',
      status: 'active',
      initialRequest: {
        type: 'outline',
        params: { genre, coreIdea, projectBrief },
        timestamp: new Date()
      },
      generations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    sessions.set(sessionId, session);

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'generate_outline',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          genre,
          coreIdea,
          projectBrief
        })
      }
    });

    // 添加到队列
    await aiOutlineQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      genre,
      coreIdea,
      projectBrief
    });

    res.json({
      sessionId,
      taskId: task.id,
      message: '故事大纲正在生成中，请稍候...'
    });
  } catch (error) {
    console.error('生成故事大纲失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

/**
 * 修改故事大纲（多轮对话）
 */
router.post('/revise-outline', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { sessionId, feedback } = req.body;

  if (!sessionId || !feedback) {
    return res.status(400).json({ error: 'sessionId 和 feedback 是必需的' });
  }

  try {
    const session = sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: '会话不存在' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: '会话已结束' });
    }

    // 检查轮数限制
    if (session.generations.length >= 10) {
      return res.status(400).json({
        error: '已达到最大修改次数（10 次）',
        suggestion: '可以保存当前满意的版本，然后开始新的会话'
      });
    }

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'revise_outline',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          feedback,
          previousContent: session.generations[session.generations.length - 1]?.content
        })
      }
    });

    // 添加到队列
    await aiOutlineQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      feedback,
      revisionType: 'outline',
      previousContent: session.generations[session.generations.length - 1]?.content
    });

    res.json({
      taskId: task.id,
      message: '正在修改故事大纲，请稍候...'
    });
  } catch (error) {
    console.error('修改故事大纲失败:', error);
    res.status(500).json({ error: '修改失败' });
  }
});

/**
 * 获取会话详情
 */
router.get('/sessions/:sessionId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { sessionId } = req.params;

  try {
    const session = sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 获取最新的任务状态
    const tasks = await prisma.ai_tasks.findMany({
      where: {
        task_type: {
          in: ['generate_project_brief', 'revise_project_brief', 'generate_outline', 'revise_outline']
        }
      },
      orderBy: { created_at: 'desc' },
      take: 1
    });

    res.json({
      sessionId: session.sessionId,
      type: session.type,
      status: session.status,
      round: session.generations.length,
      generations: session.generations,
      lastTaskStatus: tasks[0]?.status
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 获取会话列表
 */
router.get('/sessions', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const userSessions = Array.from(sessions.values())
      .filter(s => s.userId === userId)
      .map(s => ({
        sessionId: s.sessionId,
        type: s.type,
        status: s.status,
        round: s.generations.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }));

    res.json({ sessions: userSessions });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 获取项目立项书
 */
router.get('/stories/:storyId/project-brief', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      select: {
        id: true,
        title: true,
        description: true,
        project_brief: true,
        author_id: true,
        visibility: true
      }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    // 权限检查
    const isAuthor = story.author_id === userId;
    const isPublic = story.visibility === 'public';

    if (!isAuthor && !isPublic) {
      return res.status(403).json({ error: '无权查看此故事的立项书' });
    }

    // 解析立项书 JSON
    let projectBrief = null;
    if (story.project_brief) {
      try {
        projectBrief = JSON.parse(story.project_brief);
      } catch (e) {
        console.warn('解析立项书失败:', e);
      }
    }

    res.json({
      storyId: story.id,
      title: story.title,
      description: story.description,
      projectBrief
    });
  } catch (error) {
    console.error('获取项目立项书失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 更新项目立项书
 */
router.put('/stories/:storyId/project-brief', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;
  const { projectBrief } = req.body;

  if (!projectBrief) {
    return res.status(400).json({ error: '立项书内容不能为空' });
  }

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以修改立项书' });
    }

    await prisma.stories.update({
      where: { id: parseInt(storyId) },
      data: {
        project_brief: typeof projectBrief === 'string' ? projectBrief : JSON.stringify(projectBrief)
      }
    });

    res.json({ message: '立项书已更新' });
  } catch (error) {
    console.error('更新项目立项书失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * 获取故事大纲版本列表
 */
router.get('/stories/:storyId/outlines', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      select: { author_id: true }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    // 只有作者和协作者可以查看大纲
    const isAuthor = story.author_id === userId;
    const isCollaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(storyId),
        user_id: userId,
        removed_at: null
      }
    });

    if (!isAuthor && !isCollaborator) {
      return res.status(403).json({ error: '无权查看此故事的大纲' });
    }

    const outlines = await prisma.story_outlines.findMany({
      where: { story_id: parseInt(storyId) },
      orderBy: { version: 'desc' }
    });

    res.json({
      outlines: outlines.map(o => ({
        id: o.id,
        version: o.version,
        isActive: o.is_active,
        changeNote: o.change_note,
        createdAt: o.created_at
      }))
    });
  } catch (error) {
    console.error('获取大纲版本列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 获取当前激活的大纲
 */
router.get('/stories/:storyId/outlines/active', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      select: { author_id: true }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    const isAuthor = story.author_id === userId;
    const isCollaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(storyId),
        user_id: userId,
        removed_at: null
      }
    });

    if (!isAuthor && !isCollaborator) {
      return res.status(403).json({ error: '无权查看此故事的大纲' });
    }

    const activeOutline = await prisma.story_outlines.findFirst({
      where: {
        story_id: parseInt(storyId),
        is_active: true
      }
    });

    if (!activeOutline) {
      return res.json({ outline: null });
    }

    // 解析大纲 JSON
    let outline = null;
    try {
      outline = JSON.parse(activeOutline.outline);
    } catch (e) {
      console.warn('解析大纲失败:', e);
    }

    res.json({
      outline: {
        id: activeOutline.id,
        version: activeOutline.version,
        ...outline,
        changeNote: activeOutline.change_note,
        createdAt: activeOutline.created_at
      }
    });
  } catch (error) {
    console.error('获取激活大纲失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 创建新的大纲版本
 */
router.post('/stories/:storyId/outlines', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;
  const { outline, changeNote } = req.body;

  if (!outline) {
    return res.status(400).json({ error: '大纲内容不能为空' });
  }

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以创建大纲版本' });
    }

    // 获取当前最大版本号
    const maxVersion = await prisma.story_outlines.aggregate({
      where: { story_id: parseInt(storyId) },
      _max: { version: true }
    });

    const newVersion = (maxVersion._max.version || 0) + 1;

    //  deactivate 旧版本
    await prisma.story_outlines.updateMany({
      where: { story_id: parseInt(storyId) },
      data: { is_active: false }
    });

    // 创建新版本
    const newOutline = await prisma.story_outlines.create({
      data: {
        story_id: parseInt(storyId),
        version: newVersion,
        outline: typeof outline === 'string' ? outline : JSON.stringify(outline),
        is_active: true,
        change_note: changeNote,
        created_by: userId
      }
    });

    res.json({
      id: newOutline.id,
      version: newVersion,
      message: '大纲版本已创建'
    });
  } catch (error) {
    console.error('创建大纲版本失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

/**
 * 激活指定版本的大纲
 */
router.post('/stories/:storyId/outlines/:version/activate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId, version } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    const isAuthor = story.author_id === userId;
    const isCollaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(storyId),
        user_id: userId,
        removed_at: null
      }
    });

    if (!isAuthor && !isCollaborator) {
      return res.status(403).json({ error: '无权激活大纲版本' });
    }

    // deactivate 所有版本
    await prisma.story_outlines.updateMany({
      where: { story_id: parseInt(storyId) },
      data: { is_active: false }
    });

    // 激活指定版本
    await prisma.story_outlines.updateMany({
      where: {
        story_id: parseInt(storyId),
        version: parseInt(version)
      },
      data: { is_active: true }
    });

    res.json({ message: `大纲版本 v${version} 已激活` });
  } catch (error) {
    console.error('激活大纲版本失败:', error);
    res.status(500).json({ error: '激活失败' });
  }
});

/**
 * 获取角色列表
 */
router.get('/stories/:storyId/characters', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) },
      select: { author_id: true }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    const isAuthor = story.author_id === userId;
    const isCollaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(storyId),
        user_id: userId,
        removed_at: null
      }
    });

    if (!isAuthor && !isCollaborator) {
      return res.status(403).json({ error: '无权查看此故事的角色' });
    }

    const characters = await prisma.characters.findMany({
      where: {
        story_id: parseInt(storyId),
        is_active: true
      },
      orderBy: { sort_order: 'asc' }
    });

    res.json({
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        description: c.description,
        traits: c.traits ? JSON.parse(c.traits) : null,
        background: c.background,
        relations: c.relations ? JSON.parse(c.relations) : null,
        sortOrder: c.sort_order
      }))
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

/**
 * 创建角色
 */
router.post('/stories/:storyId/characters', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId } = req.params;
  const { name, role, description, traits, background, relations } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: '角色名称和角色类型是必需的' });
  }

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以创建角色' });
    }

    const character = await prisma.characters.create({
      data: {
        story_id: parseInt(storyId),
        name,
        role,
        description,
        traits: traits ? JSON.stringify(traits) : null,
        background,
        relations: relations ? JSON.stringify(relations) : null,
        created_by: userId
      }
    });

    res.json({
      id: character.id,
      message: '角色已创建'
    });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

/**
 * 更新角色
 */
router.put('/stories/:storyId/characters/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId, id } = req.params;
  const { name, role, description, traits, background, relations, sort_order } = req.body;

  try {
    const character = await prisma.characters.findUnique({
      where: { id: parseInt(id) }
    });

    if (!character || character.story_id !== parseInt(storyId)) {
      return res.status(404).json({ error: '角色不存在' });
    }

    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以修改角色' });
    }

    await prisma.characters.update({
      where: { id: parseInt(id) },
      data: {
        name: name || character.name,
        role: role || character.role,
        description: description ?? character.description,
        traits: traits !== undefined ? (traits ? JSON.stringify(traits) : null) : character.traits,
        background: background ?? character.background,
        relations: relations !== undefined ? (relations ? JSON.stringify(relations) : null) : character.relations,
        sort_order: sort_order !== undefined ? sort_order : character.sort_order
      }
    });

    res.json({ message: '角色已更新' });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * 删除角色（软删除）
 */
router.delete('/stories/:storyId/characters/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { storyId, id } = req.params;

  try {
    const character = await prisma.characters.findUnique({
      where: { id: parseInt(id) }
    });

    if (!character || character.story_id !== parseInt(storyId)) {
      return res.status(404).json({ error: '角色不存在' });
    }

    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以删除角色' });
    }

    await prisma.characters.update({
      where: { id: parseInt(id) },
      data: { is_active: false }
    });

    res.json({ message: '角色已删除' });
  } catch (error) {
    console.error('删除角色失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

/**
 * 搜索外部书籍（豆瓣/维基百科）
 */
router.post('/search-external', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { query, source = 'douban' } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: '搜索关键词不能为空' });
  }

  try {
    let results;

    if (source === 'douban') {
      const { searchBooks } = await import('../services/external/douban');
      const books = await searchBooks(query, 0, 10);
      results = books.map(book => ({
        title: book.title,
        author: book.author.join(', '),
        publisher: book.publisher,
        pubdate: book.pubdate,
        summary: book.summary,
        image: book.image,
        rating: book.rating.average,
        source: 'douban'
      }));
    } else if (source === 'wikipedia') {
      const { searchWikipedia } = await import('../services/external/wikipedia');
      const pages = await searchWikipedia(query, 10);
      results = pages.map(page => ({
        title: page.title,
        summary: page.snippet,
        url: page.url,
        source: 'wikipedia'
      }));
    } else {
      return res.status(400).json({ error: '不支持的搜索源' });
    }

    res.json({ results });
  } catch (error: any) {
    console.error('外部搜索失败:', error);
    res.status(500).json({ error: error.message || '搜索失败' });
  }
});

/**
 * 生成仿写方案
 */
router.post('/generate-pastiche', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { bookName, pasticheType = 'pastiche', innovation } = req.body;

  if (!bookName || bookName.trim().length === 0) {
    return res.status(400).json({ error: '书名不能为空' });
  }

  try {
    // 检查 AI 权限
    const permission = await canUseAiFeature(userId, 'continuation');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 创建会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: GenerationSession = {
      sessionId,
      userId,
      type: 'pastiche',
      status: 'active',
      initialRequest: {
        type: 'pastiche',
        params: { bookName, pasticheType, innovation },
        timestamp: new Date()
      },
      generations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    sessions.set(sessionId, session);

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'generate_pastiche',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          bookName,
          pasticheType,
          innovation
        })
      }
    });

    // 添加到队列
    await aiPasticheQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      bookName,
      pasticheType,
      innovation
    });

    res.json({
      sessionId,
      taskId: task.id,
      message: '正在分析原作并生成仿写方案，请稍候...'
    });
  } catch (error) {
    console.error('生成仿写方案失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

/**
 * 基于模板生成
 */
router.post('/generate-from-template', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { templateId, protagonistName, coreConflict } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: '模板 ID 不能为空' });
  }

  try {
    // 检查 AI 权限
    const permission = await canUseAiFeature(userId, 'continuation');
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    // 获取模板
    const template = await prisma.story_templates.findUnique({
      where: { id: parseInt(templateId) }
    });

    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    // 创建会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: GenerationSession = {
      sessionId,
      userId,
      type: 'template',
      status: 'active',
      initialRequest: {
        type: 'template',
        params: { templateId, protagonistName, coreConflict },
        timestamp: new Date()
      },
      generations: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    sessions.set(sessionId, session);

    // 创建任务
    const task = await prisma.ai_tasks.create({
      data: {
        user_id: userId,
        task_type: 'generate_from_template',
        status: 'pending',
        priority: 15,
        input_data: JSON.stringify({
          sessionId,
          template: template.framework,
          protagonistName,
          coreConflict
        })
      }
    });

    // 添加到队列
    await aiTemplateQueue.add({
      taskId: task.id,
      sessionId,
      userId,
      template: JSON.parse(template.framework),
      protagonistName,
      coreConflict
    });

    res.json({
      sessionId,
      taskId: task.id,
      message: '正在基于模板生成故事，请稍候...'
    });
  } catch (error) {
    console.error('基于模板生成失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

/**
 * 获取模板列表
 */
router.get('/templates', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const templates = await prisma.story_templates.findMany({
      where: { is_public: true },
      orderBy: { id: 'asc' }
    });

    res.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        genre: t.genre
      }))
    });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;