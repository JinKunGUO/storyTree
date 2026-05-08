import { Router } from 'express';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';
import { addPoints, POINT_RULES } from '../utils/points';
import { safeParseId, safeParsePage, safeParsePageSize } from '../utils/middleware';

const router = Router();

// 获取节点的评论列表（优化版：单次查询 + 内存构建树结构）
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

    const nodeIdInt = safeParseId(node_id);
    const pageInt = safeParsePage(page as string);
    const limitInt = safeParsePageSize(limit as string, 20, 50);

    // ========== 第1步：分页获取顶级评论 ==========
    const topLevelComments = await prisma.comments.findMany({
      where: { node_id: nodeIdInt, parent_id: null },
      include: {
        user: {
          select: { id: true, username: true, avatar: true }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (pageInt - 1) * limitInt,
      take: limitInt
    });

    if (topLevelComments.length === 0) {
      const totalCount = await prisma.comments.count({
        where: { node_id: nodeIdInt, parent_id: null }
      });
      return res.json({
        comments: [],
        pagination: { page: pageInt, limit: limitInt, total: totalCount, totalPages: Math.ceil(totalCount / limitInt) }
      });
    }

    // 获取顶级评论的ID列表
    const topLevelIds = topLevelComments.map(c => c.id);

    // ========== 第2步：一次性获取所有子评论（所有层级）==========
    const allReplies = await prisma.comments.findMany({
      where: {
        node_id: nodeIdInt,
        parent_id: { not: null, in: topLevelIds } // 只获取当前页顶级评论的直接回复
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    // 获取所有评论ID（用于批量查询投票）
    const allCommentIds = [...topLevelIds, ...allReplies.map(r => r.id)];

    // ========== 第3步：一次性获取所有投票统计 ==========
    const voteStats = await prisma.comment_votes.groupBy({
      by: ['comment_id', 'vote_type'],
      where: { comment_id: { in: allCommentIds } },
      _count: true
    });

    // 构建投票统计 Map
    const voteCountMap = new Map<number, { likes: number; dislikes: number }>();
    for (const stat of voteStats) {
      const existing = voteCountMap.get(stat.comment_id) || { likes: 0, dislikes: 0 };
      if (stat.vote_type === 'like') {
        existing.likes = stat._count;
      } else {
        existing.dislikes = stat._count;
      }
      voteCountMap.set(stat.comment_id, existing);
    }

    // ========== 第4步：获取当前用户的投票情况 ==========
    let userVotes: Map<number, string> = new Map();
    if (userId) {
      const userVoteRecords = await prisma.comment_votes.findMany({
        where: {
          comment_id: { in: allCommentIds },
          user_id: userId
        },
        select: { comment_id: true, vote_type: true }
      });
      userVotes = new Map(userVoteRecords.map(v => [v.comment_id, v.vote_type]));
    }

    // ========== 第5步：在内存中构建评论树 ==========
    // 将评论放入 Map 方便查找
    const commentMap = new Map<number, any>();

    // 先放入顶级评论
    for (const comment of topLevelComments) {
      const votes = voteCountMap.get(comment.id) || { likes: 0, dislikes: 0 };
      commentMap.set(comment.id, {
        ...comment,
        likeCount: votes.likes,
        dislikeCount: votes.dislikes,
        userVote: userVotes.get(comment.id) || null,
        other_comments: []
      });
    }

    // 放入所有回复
    for (const reply of allReplies) {
      const votes = voteCountMap.get(reply.id) || { likes: 0, dislikes: 0 };
      commentMap.set(reply.id, {
        ...reply,
        likeCount: votes.likes,
        dislikeCount: votes.dislikes,
        userVote: userVotes.get(reply.id) || null,
        other_comments: []
      });
    }

    // 构建树结构：将回复关联到父评论
    for (const reply of allReplies) {
      if (reply.parent_id) {
        const parent = commentMap.get(reply.parent_id);
        if (parent) {
          parent.other_comments.push(commentMap.get(reply.id));
        }
      }
    }

    // 组装最终输出：顶级评论 + 其子评论
    const commentsWithTree = topLevelComments.map(c => commentMap.get(c.id));

    // ========== 第6步：获取分页统计 ==========
    const totalCount = await prisma.comments.count({
      where: { node_id: nodeIdInt, parent_id: null }
    });

    res.json({
      comments: commentsWithTree,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitInt)
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

    // 🎁 触发积分奖励：给章节作者发放评论积分（非回复且评论字数≥10字时）
    if (!parent_id && node.author_id !== decoded.userId && content.trim().length >= 10) {
      try {
        await addPoints(
          node.author_id,
          POINT_RULES.GET_COMMENT.points,
          'get_comment',
          `章节《${node.title}》获得评论`,
          node.id
        );
        console.log(`✅ 评论积分奖励已发放: 用户 ${node.author_id} 获得 ${POINT_RULES.GET_COMMENT.points} 积分 (评论字数: ${content.trim().length})`);
      } catch (error) {
        console.error('❌ 发放评论积分失败:', error);
        // 不阻塞评论操作，仅记录错误
      }
    } else if (!parent_id && node.author_id !== decoded.userId && content.trim().length < 10) {
      console.log(`⚠️ 评论字数不足10字，不发放积分奖励 (评论字数: ${content.trim().length})`);
    }

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
            link: `/story.html?id=${node.story.id}&node=${node_id}#comment-${comment.id}`
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
          link: `/story.html?id=${node.story.id}&node=${node_id}#comment-${comment.id}`
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
