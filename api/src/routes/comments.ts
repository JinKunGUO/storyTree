import { Router } from 'express';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';

const router = Router();

// 获取节点的评论列表
router.get('/nodes/:nodeId/comments', async (req, res) => {
  const { nodeId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const comments = await prisma.comment.findMany({
      where: { nodeId: parseInt(nodeId), parentId: null }, // 只获取顶级评论
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    const totalCount = await prisma.comment.count({
      where: { nodeId: parseInt(nodeId), parentId: null }
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
router.post('/nodes/:nodeId/comments', async (req, res) => {
  const { nodeId } = req.params;
  const { content, parentId } = req.body;
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

    const node = await prisma.node.findUnique({
      where: { id: parseInt(nodeId) }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 验证parentId是否存在
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parseInt(parentId as string) }
      });
      if (!parentComment || parentComment.nodeId !== parseInt(nodeId)) {
        return res.status(400).json({ error: '回复的评论不存在' });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        nodeId: parseInt(nodeId),
        userId: decoded.userId,
        parentId: parentId ? parseInt(parentId as string) : null
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

    // 发送通知给被回复的用户（如果有parentId）
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parseInt(parentId as string) },
        include: { user: true }
      });
      
      if (parentComment && parentComment.userId !== decoded.userId) {
        await prisma.notification.create({
          data: {
            userId: parentComment.userId,
            type: 'comment_reply',
            title: '评论回复',
            content: `${decoded.username || '用户'} 回复了你的评论`,
            link: `/nodes/${nodeId}`
          }
        });
      }
    }

    // 发送通知给章节作者
    if (node.authorId !== decoded.userId) {
      await prisma.notification.create({
        data: {
          userId: node.authorId,
          type: 'comment',
          title: '新评论',
          content: `${decoded.username || '用户'} 评论了你的章节`,
          link: `/nodes/${nodeId}`
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

    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.userId !== decoded.userId && !decoded.isAdmin) {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await prisma.comment.delete({
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

    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.userId !== decoded.userId) {
      return res.status(403).json({ error: '无权编辑此评论' });
    }

    const updatedComment = await prisma.comment.update({
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
