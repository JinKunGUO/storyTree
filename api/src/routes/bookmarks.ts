import { Router } from 'express';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';
import { addPoints, POINT_RULES } from '../utils/points';

const router = Router();

// ============================================
// 故事收藏列表
// ============================================

// 获取当前用户收藏的故事列表
// GET /api/bookmarks?page=1&pageSize=20
router.get('/', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const total = await prisma.bookmarks.count({
      where: { user_id: decoded.userId },
    });

    const bookmarks = await prisma.bookmarks.findMany({
      where: { user_id: decoded.userId },
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true, avatar: true },
            },
            _count: {
              select: { nodes: true, followers: true, bookmarks: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    res.json({
      bookmarks,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('获取收藏列表错误:', error);
    res.status(500).json({ error: '获取收藏列表失败' });
  }
});

// ============================================
// 收藏章节功能
// ============================================

// 切换收藏章节状态（收藏/取消收藏）
router.post('/node/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      select: { 
        id: true, 
        title: true, 
        author_id: true,
        story_id: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查是否已经收藏该章节
    const existingBookmark = await prisma.node_bookmarks.findUnique({
      where: {
        user_id_node_id: {
          user_id: decoded.userId,
          node_id: parseInt(nodeId)
        }
      }
    });

    if (existingBookmark) {
      // 已收藏，执行取消收藏
      await prisma.node_bookmarks.delete({
        where: {
          user_id_node_id: {
            user_id: decoded.userId,
            node_id: parseInt(nodeId)
          }
        }
      });

      return res.json({ 
        message: '已取消收藏',
        bookmarked: false
      });
    }

    // 未收藏，执行收藏操作
    const bookmark = await prisma.node_bookmarks.create({
      data: {
        user_id: decoded.userId,
        node_id: parseInt(nodeId),
        points_awarded: false // 初始未发放积分
      }
    });

    // 🎁 触发积分奖励：给章节作者发放收藏积分（2积分）
    // ⚠️ 防刷分机制：只有首次收藏才发放积分
    let pointsEarned = 0;
    if (node.author_id !== decoded.userId) {
      try {
        // 检查该用户是否曾经因收藏此章节而给作者发放过积分
        const existingPointTransaction = await prisma.point_transactions.findFirst({
          where: {
            user_id: node.author_id,
            type: 'get_node_bookmark',
            reference_id: node.id,
            description: {
              contains: `章节《${node.title}》获得收藏`
            }
          }
        });

        // 只有从未发放过积分时才发放
        if (!existingPointTransaction) {
          await addPoints(
            node.author_id,
            2, // 章节收藏奖励2积分
            'get_node_bookmark',
            `章节《${node.title}》获得收藏`,
            node.id
          );
          
          // 标记为已发放积分
          await prisma.node_bookmarks.update({
            where: {
              user_id_node_id: {
                user_id: decoded.userId,
                node_id: parseInt(nodeId)
              }
            },
            data: {
              points_awarded: true
            }
          });

          pointsEarned = 2;
          console.log(`✅ 章节收藏积分奖励已发放: 用户 ${node.author_id} 获得 2 积分`);
        } else {
          console.log(`⚠️ 该用户曾收藏过此章节，不重复发放积分`);
        }
      } catch (error) {
        console.error('❌ 发放章节收藏积分失败:', error);
        // 不阻塞收藏操作，仅记录错误
      }
    }

    // 发送通知给章节作者
    if (node.author_id !== decoded.userId) {
      await prisma.notifications.create({
        data: {
          user_id: node.author_id,
          type: 'bookmark',
          title: '新收藏',
          content: `${decoded.username || '用户'} 收藏了你的章节《${node.title}》`,
          link: `/chapter?id=${nodeId}`
        }
      });
    }

    res.json({ 
      message: '收藏成功',
      bookmarked: true,
      bookmark,
      pointsEarned: pointsEarned // 实际发放的积分（首次2分，重复0分）
    });
  } catch (error) {
    console.error('收藏章节错误:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

export default router;

