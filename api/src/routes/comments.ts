import { Router } from 'express';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';

const router = Router();

// 获取节点的评论列表
router.get('/nodes/:node_id/comments', async (req, res) => {
  const { node_id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    let userId = null;
    if (token) {
      const decoded = verifyJWT(token);
      userId = decoded?.userId;
    }

    // 递归获取评论及其所有子评论的函数
    const getCommentsWithReplies = async (commentId: number): Promise<any[]> => {
      const replies = await prisma.comments.findMany({
        where: { parent_id: commentId },
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
      });

      // 递归获取每个回复的子回复
      const repliesWithChildren: any[] = await Promise.all(
        replies.map(async (reply): Promise<any> => {
          const childReplies: any[] = await getCommentsWithReplies(reply.id);
          return {
            ...reply,
            other_comments: childReplies
          };
        })
      );

      return repliesWithChildren;
    };

    // 获取顶级评论
    const comments = await prisma.comments.findMany({
      where: { node_id: parseInt(node_id), parent_id: null }, // 只获取顶级评论
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    // 为每个顶级评论获取所有回复（递归）
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await getCommentsWithReplies(comment.id);
        return {
          ...comment,
          other_comments: replies
        };
      })
    );

    // 为每个评论添加点赞/踩统计（递归处理所有层级）
    const addVoteStats = async (comment: any): Promise<any> => {
      const [likeCount, dislikeCount, userVote] = await Promise.all([
        prisma.comment_votes.count({
          where: { comment_id: comment.id, vote_type: 'like' }
        }),
        prisma.comment_votes.count({
          where: { comment_id: comment.id, vote_type: 'dislike' }
        }),
        userId ? prisma.comment_votes.findUnique({
          where: {
            comment_id_user_id: {
              comment_id: comment.id,
              user_id: userId
            }
          }
        }) : null
      ]);

      // 递归处理所有回复
      const repliesWithVotes = await Promise.all(
        (comment.other_comments || []).map((reply: any) => addVoteStats(reply))
      );

      return {
        ...comment,
        likeCount,
        dislikeCount,
        userVote: userVote?.vote_type || null,
        other_comments: repliesWithVotes
      };
    };

    const commentsWithVotes = await Promise.all(
      commentsWithReplies.map((comment) => addVoteStats(comment))
    );

    const totalCount = await prisma.comments.count({
      where: { node_id: parseInt(node_id), parent_id: null }
    });

    res.json({
      comments: commentsWithVotes,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('获取评论失败:', error);
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
      where: { id: parseInt(commentId) },
      include: {
        other_comments: true // 检查是否有回复
      }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.user_id !== decoded.userId && !decoded.isAdmin) {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    // 检查是否有回复
    const hasReplies = comment.other_comments && comment.other_comments.length > 0;

    if (hasReplies) {
      // 如果有回复，只标记为已删除（软删除）
      await prisma.comments.update({
        where: { id: parseInt(commentId) },
        data: {
          is_deleted: true,
          content: '[该评论已被删除]',
          updated_at: new Date()
        }
      });
      res.json({ message: '评论删除成功', softDelete: true });
    } else {
      // 如果没有回复，物理删除
      await prisma.comments.delete({
        where: { id: parseInt(commentId) }
      });
      res.json({ message: '评论删除成功', softDelete: false });
    }
  } catch (error) {
    console.error('删除评论错误:', error);
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

// 点赞或踩评论
router.post('/comments/:commentId/vote', async (req, res) => {
  const { commentId } = req.params;
  const { voteType } = req.body; // 'like' or 'dislike'
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    if (!['like', 'dislike'].includes(voteType)) {
      return res.status(400).json({ error: '无效的投票类型' });
    }

    const comment = await prisma.comments.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // 查找用户是否已经投过票
    const existingVote = await prisma.comment_votes.findUnique({
      where: {
        comment_id_user_id: {
          comment_id: parseInt(commentId),
          user_id: decoded.userId
        }
      }
    });

    if (existingVote) {
      // 如果已经投过相同的票，则取消投票
      if (existingVote.vote_type === voteType) {
        await prisma.comment_votes.delete({
          where: { id: existingVote.id }
        });
        return res.json({ message: '已取消投票', action: 'removed' });
      } else {
        // 如果投了不同的票，则更新投票
        await prisma.comment_votes.update({
          where: { id: existingVote.id },
          data: { vote_type: voteType }
        });
        return res.json({ message: '投票已更新', action: 'updated' });
      }
    }

    // 创建新的投票
    await prisma.comment_votes.create({
      data: {
        comment_id: parseInt(commentId),
        user_id: decoded.userId,
        vote_type: voteType
      }
    });

    res.json({ message: '投票成功', action: 'added' });
  } catch (error) {
    console.error('投票错误:', error);
    res.status(500).json({ error: '投票失败' });
  }
});

// 获取评论的投票统计
router.get('/comments/:commentId/votes', async (req, res) => {
  const { commentId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    const comment = await prisma.comments.findUnique({
      where: { id: parseInt(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    const [likeCount, dislikeCount] = await Promise.all([
      prisma.comment_votes.count({
        where: { comment_id: parseInt(commentId), vote_type: 'like' }
      }),
      prisma.comment_votes.count({
        where: { comment_id: parseInt(commentId), vote_type: 'dislike' }
      })
    ]);

    let userVote = null;
    if (token) {
      const decoded = verifyJWT(token);
      if (decoded) {
        const vote = await prisma.comment_votes.findUnique({
          where: {
            comment_id_user_id: {
              comment_id: parseInt(commentId),
              user_id: decoded.userId
            }
          }
        });
        userVote = vote?.vote_type || null;
      }
    }

    res.json({ likeCount, dislikeCount, userVote });
  } catch (error) {
    console.error('获取投票统计错误:', error);
    res.status(500).json({ error: '获取投票统计失败' });
  }
});

export default router;
