import { Router } from 'express';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';

const router = Router();

// 获取节点的评论列表
router.get('/nodes/:node_id/comments', async (req, res) => {
  const { node_id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const comments = await prisma.comments.findMany({
      where: { node_id: parseInt(node_id), parent_id: null }, // 只获取顶级评论
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        other_comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    const totalCount = await prisma.comments.count({
      where: { node_id: parseInt(node_id), parent_id: null }
    });

    res.json({
      comments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取评论失败' });
  }
});

// 发表评论
router.post('/nodes/:node_id/comments', async (req, res) => {
  const { node_id } = req.params;
  const { content, parent_id } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: '评论内容不能超过500字符' });
    }

    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(node_id) },
      include: { story: { select: { id: true, allow_comment: true, author_id: true } } }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查故事是否允许评论（故事主创作者不受此限制）
    if (node.story.allow_comment === false) {
      const isStoryAuthor = node.story.author_id === decoded.userId;
      if (!isStoryAuthor) {
        return res.status(403).json({ error: '该故事已关闭评论功能' });
      }
    }

    // 验证parent_id是否存在
    if (parent_id) {
      const parentComment = await prisma.comments.findUnique({
        where: { id: parseInt(parent_id as string) }
      });
      if (!parentComment || parentComment.node_id !== parseInt(node_id)) {
        return res.status(400).json({ error: '回复的评论不存在' });
      }
    }

    const comment = await prisma.comments.create({
      data: {
        content: content.trim(),
        node_id: parseInt(node_id),
        user_id: decoded.userId,
        parent_id: parent_id ? parseInt(parent_id as string) : null,
        updated_at: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // 发送通知给被回复的用户（如果有parent_id）
    if (parent_id) {
      const parentComment = await prisma.comments.findUnique({
        where: { id: parseInt(parent_id as string) },
        include: { user: true }
      });
      
      if (parentComment && parentComment.user_id !== decoded.userId) {
        await prisma.notifications.create({
          data: {
            user_id: parentComment.user_id,
            type: 'comment_reply',
            title: '评论回复',
            content: `${decoded.username || '用户'} 回复了你的评论`,
            link: `/nodes/${node_id}`
          }
        });
      }
    }

    // 发送通知给章节作者
    if (node.author_id !== decoded.userId) {
      await prisma.notifications.create({
        data: {
          user_id: node.author_id,
          type: 'comment',
          title: '新评论',
          content: `${decoded.username || '用户'} 评论了你的章节`,
          link: `/nodes/${node_id}`
        }
      });
    }

    res.json({ message: '评论发表成功', comment });
  } catch (error) {
    console.error('发表评论错误:', error);
    res.status(500).json({ error: '发表失败' });
  }
});

// 删除评论
router.delete('/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    const comment = await prisma.comments.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.user_id !== decoded.userId && !decoded.isAdmin) {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await prisma.comments.delete({
      where: { id: parseInt(commentId) }
    });

    res.json({ message: '评论删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 更新评论
router.put('/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: '评论内容不能超过500字符' });
    }

    const comment = await prisma.comments.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.user_id !== decoded.userId) {
      return res.status(403).json({ error: '无权编辑此评论' });
    }

    const updatedComment = await prisma.comments.update({
      where: { id: parseInt(commentId) },
      data: { content: content.trim() },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    res.json({ message: '评论更新成功', comment: updatedComment });
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
});

export default router;
