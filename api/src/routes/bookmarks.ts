import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyJWT } from '../utils/auth';

const router = express.Router();
const prisma = new PrismaClient();

// 认证中间件
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '认证失败' });
  }
};

// 收藏故事
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { storyId } = req.body;

    if (!storyId) {
      return res.status(400).json({ error: '缺少故事ID' });
    }

    // 检查故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: '故事不存在' });
    }

    // 检查是否已收藏
    const existingBookmark = await prisma.bookmarks.findUnique({
      where: {
        user_id_story_id: {
          user_id: userId,
          story_id: parseInt(storyId)
        }
      }
    });

    if (existingBookmark) {
      return res.status(400).json({ error: '已经收藏过该故事' });
    }

    // 创建收藏
    const bookmark = await prisma.bookmarks.create({
      data: {
        user_id: userId,
        story_id: parseInt(storyId)
      }
    });

    res.json({
      message: '收藏成功',
      bookmark
    });
  } catch (error) {
    console.error('收藏故事失败:', error);
    res.status(500).json({ error: '收藏失败' });
  }
});

// 取消收藏
router.delete('/:storyId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { storyId } = req.params;

    // 查找收藏记录
    const bookmark = await prisma.bookmarks.findUnique({
      where: {
        user_id_story_id: {
          user_id: userId,
          story_id: parseInt(storyId)
        }
      }
    });

    if (!bookmark) {
      return res.status(404).json({ error: '未收藏该故事' });
    }

    // 删除收藏
    await prisma.bookmarks.delete({
      where: {
        id: bookmark.id
      }
    });

    res.json({ message: '取消收藏成功' });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

// 获取用户的收藏列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // 获取收藏列表
    const bookmarks = await prisma.bookmarks.findMany({
      where: { user_id: userId },
      include: {
        story: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            },
            nodes: {
              select: {
                id: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    });

    // 获取总数
    const total = await prisma.bookmarks.count({
      where: { user_id: userId }
    });

    // 格式化返回数据
    const formattedBookmarks = bookmarks.map(bookmark => ({
      id: bookmark.id,
      bookmarkedAt: bookmark.created_at,
      story: {
        id: bookmark.story.id,
        title: bookmark.story.title,
        description: bookmark.story.description,
        coverImage: bookmark.story.cover_image,
        author: bookmark.story.author,
        chapterCount: bookmark.story.nodes.length,
        createdAt: bookmark.story.created_at,
        updatedAt: bookmark.story.updated_at
      }
    }));

    res.json({
      bookmarks: formattedBookmarks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ error: '获取收藏列表失败' });
  }
});

// 检查是否已收藏某个故事
router.get('/check/:storyId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { storyId } = req.params;

    const bookmark = await prisma.bookmarks.findUnique({
      where: {
        user_id_story_id: {
          user_id: userId,
          story_id: parseInt(storyId)
        }
      }
    });

    res.json({
      isBookmarked: !!bookmark
    });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ error: '检查收藏状态失败' });
  }
});

export default router;

