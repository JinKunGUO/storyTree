import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin, safeParsePage, safeParseLimit } from '../utils/middleware';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

/**
 * 获取故事列表（分页、搜索）
 * GET /api/admin/stories?page=1&limit=20&search=xxx&visibility=public|private
 */
router.get('/stories', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const visibility = req.query.visibility as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (visibility && ['public', 'private', 'password'].includes(visibility)) {
      where.visibility = visibility;
    }

    const [stories, total] = await Promise.all([
      prisma.stories.findMany({
        where,
        include: {
          author: {
            select: { id: true, username: true, avatar: true },
          },
          _count: {
            select: {
              nodes: true,
              bookmarks: true,
              followers: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stories.count({ where }),
    ]);

    res.json({
      stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取故事列表失败:', error);
    res.status(500).json({ error: '获取故事列表失败' });
  }
});

/**
 * 删除违规故事（级联删除所有节点、评论等）
 * DELETE /api/admin/stories/:id
 * Body: { reason?: string }
 */
router.delete('/stories/:id', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    if (isNaN(storyId)) {
      return res.status(400).json({ error: '无效的故事 ID' });
    }

    const story = await prisma.stories.findUnique({
      where: { id: storyId },
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { nodes: true } },
      },
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    // 级联删除（schema 中已配置 onDelete: Cascade）
    await prisma.stories.delete({ where: { id: storyId } });

    res.json({
      message: `故事「${story.title}」已删除`,
      deletedNodesCount: story._count.nodes,
    });
  } catch (error) {
    console.error('删除故事失败:', error);
    res.status(500).json({ error: '删除故事失败' });
  }
});

/**
 * 获取评论列表（分页、筛选举报评论）
 * GET /api/admin/comments?page=1&limit=20&reported=true&deleted=false
 */
router.get('/comments', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const deleted = req.query.deleted as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (deleted === 'true') {
      where.is_deleted = true;
    } else if (deleted === 'false') {
      where.is_deleted = false;
    }

    if (search) {
      where.content = { contains: search };
    }

    const [comments, total] = await Promise.all([
      prisma.comments.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
          node: {
            select: {
              id: true,
              title: true,
              story_id: true,
              story: { select: { id: true, title: true } },
            },
          },
          _count: {
            select: { votes: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.comments.count({ where }),
    ]);

    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({ error: '获取评论列表失败' });
  }
});

/**
 * 删除违规评论（软删除）
 * DELETE /api/admin/comments/:id
 */
router.delete('/comments/:id', async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: '无效的评论 ID' });
    }

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: {
        user: { select: { id: true, username: true } },
      },
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 软删除
    await prisma.comments.update({
      where: { id: commentId },
      data: { is_deleted: true },
    });

    res.json({ message: '评论已删除' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

/**
 * 隐藏违规章节
 * POST /api/admin/nodes/:id/hide
 * Body: { reason?: string }
 */
router.post('/nodes/:id/hide', async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: '无效的章节 ID' });
    }

    const node = await prisma.nodes.findUnique({
      where: { id: nodeId },
      include: {
        author: { select: { id: true, username: true } },
        story: { select: { id: true, title: true } },
      },
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const reason = req.body.reason || '违反社区规范';

    await prisma.nodes.update({
      where: { id: nodeId },
      data: {
        review_status: 'HIDDEN',
        reviewed_by: req.userId,
        reviewed_at: new Date(),
        review_note: reason,
      },
    });

    res.json({
      message: `章节「${node.title}」已隐藏`,
      reason,
    });
  } catch (error) {
    console.error('隐藏章节失败:', error);
    res.status(500).json({ error: '隐藏章节失败' });
  }
});

export default router;

