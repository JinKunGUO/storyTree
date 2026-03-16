import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';

const router = Router();

// 获取用户信息
router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const currentUserId = getUserId(req);

  try {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            authored_stories: true,
            authored_nodes: true,
            following: true,
            followers: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 手动计算关注者数量（修复Prisma _count问题）
    const followersCount = await prisma.follows.count({
      where: { following_id: parseInt(id) }
    });

    // 检查当前用户是否已关注
    let isFollowing = false;
    if (currentUserId) {
      const follow = await prisma.follows.findUnique({
        where: {
          follower_id_following_id: {
            follower_id: currentUserId,
            following_id: parseInt(id)
          }
        }
      });
      isFollowing = !!follow;
    }

    res.json({
      user: {
        ...user,
        _count: {
          ...user._count,
          followers: followersCount  // 使用手动计数覆盖
        },
        isFollowing,
        isSelf: currentUserId === parseInt(id)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// 关注用户
router.post('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const targetId = parseInt(id);

  if (userId === targetId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  try {
    const follow = await prisma.follows.create({
      data: {
        follower_id: userId,
        following_id: targetId
      }
    });

    // 获取关注者信息
    const follower = await prisma.users.findUnique({
      where: { id: userId },
      select: { username: true }
    });

    // 创建通知
    if (follower) {
      await createNotification(
        targetId,
        'follow',
        '新粉丝',
        `${follower.username} 关注了你`,
        `/user/${userId}`
      );
    }

    res.json({ success: true, follow });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Already following' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// 取消关注
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    await prisma.follows.delete({
      where: {
        follower_id_following_id: {
          follower_id: userId,
          following_id: parseInt(id)
        }
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Not following' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// 更新个人资料
router.put('/profile', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { bio } = req.body;

  try {
    const user = await prisma.users.update({
      where: { id: userId },
      data: { bio },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true
      }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 获取关注列表
router.get('/:id/following', async (req, res) => {
  const { id } = req.params;

  try {
    const following = await prisma.follows.findMany({
      where: { follower_id: parseInt(id) },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatar: true,
            _count: {
              select: { followers: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      following: following.map(f => ({
        ...f.following,
        followedAt: f.created_at
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// 获取粉丝列表
router.get('/:id/followers', async (req, res) => {
  const { id } = req.params;

  try {
    const followers = await prisma.follows.findMany({
      where: { following_id: parseInt(id) },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatar: true,
            _count: {
              select: { followers: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      followers: followers.map(f => ({
        ...f.follower,
        followedAt: f.created_at
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch followers list' });
  }
});

// 获取动态流
router.get('/feed/me', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取关注的人的最新节点
    const feed = await prisma.nodes.findMany({
      where: {
        author: {
          followers: {
            some: {
              follower_id: userId
            }
          }
        },
        review_status: 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    res.json({ feed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// 获取用户创作的故事
router.get('/:id/stories', async (req, res) => {
  const { id } = req.params;

  try {
    const stories = await prisma.stories.findMany({
      where: { author_id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            nodes: true,
            bookmarks: true  // 收藏数作为点赞数
          }
        },
        nodes: {
          select: {
            read_count: true  // 获取所有节点的浏览量
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 处理故事数据，计算总浏览量
    const processedStories = stories.map(story => {
      // 计算总浏览量（所有节点read_count之和）
      const totalViews = story.nodes.reduce((sum, node) => sum + (node.read_count || 0), 0);
      
      return {
        ...story,
        views: totalViews,  // 添加浏览量字段
        likes: story._count.bookmarks  // 收藏数作为点赞数
      };
    });

    res.json({ stories: processedStories });
  } catch (error) {
    console.error('获取用户故事错误:', error);
    res.status(500).json({ error: 'Failed to fetch user stories' });
  }
});

// 获取用户参与创作的章节
router.get('/:id/nodes', async (req, res) => {
  const { id } = req.params;

  try {
    const nodes = await prisma.nodes.findMany({
      where: { 
        author_id: parseInt(id),
        review_status: 'APPROVED'
      },
      include: {
        story: {
          select: { id: true, title: true }
        },
        author: {
          select: { id: true, username: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    res.json({ nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user nodes' });
  }
});

// 获取用户协作的故事列表
router.get('/:id/collaborated-stories', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 100;

  try {
    // 获取协作故事（未被移除）
    const collaborations = await prisma.story_collaborators.findMany({
      where: {
        user_id: parseInt(id),
        removed_at: null // 仅未被移除的
      },
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true, avatar: true }
            },
            _count: {
              select: {
                nodes: true,
                bookmarks: true,
                followers: true
              }
            },
            nodes: {
              select: {
                read_count: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 处理故事数据，计算总浏览量
    const stories = collaborations.map(collab => {
      const story = collab.story;
      const totalViews = story.nodes.reduce((sum, node) => sum + (node.read_count || 0), 0);
      
      return {
        ...story,
        views: totalViews,
        likes: story._count.bookmarks,
        collaborated_at: collab.created_at
      };
    });

    res.json({
      stories,
      total: collaborations.length
    });
  } catch (error) {
    console.error('Get collaborated stories error:', error);
    res.status(500).json({ error: 'Failed to fetch collaborated stories' });
  }
});

export default router;
