import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';
import { hashPassword, verifyPassword, isValidUsername, isValidPassword } from '../utils/auth';

const router = Router();

// 获取动态流（必须在 /:id 之前注册，否则 "feed" 会被当作 :id 参数）
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
          following: {
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
        `/profile.html?id=${userId}`
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

// 修改用户名
router.put('/username', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: '请提供新用户名' });
  }

  // 验证用户名格式
  const usernameValid = isValidUsername(username);
  if (!usernameValid.valid) {
    return res.status(400).json({ error: usernameValid.message });
  }

  try {
    // 检查用户名是否已被其他用户使用
    const existing = await prisma.users.findFirst({
      where: {
        username,
        NOT: { id: userId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: '用户名已被使用，请换一个' });
    }

    const user = await prisma.users.update({
      where: { id: userId },
      data: { username, updatedAt: new Date() },
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
    console.error('修改用户名错误:', error);
    res.status(500).json({ error: '修改用户名失败，请稍后重试' });
  }
});

// 修改密码（登录态，需验证当前密码）
router.put('/password', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请提供当前密码和新密码' });
  }

  // 验证新密码强度
  const passwordValid = isValidPassword(newPassword);
  if (!passwordValid.valid) {
    return res.status(400).json({ error: passwordValid.message });
  }

  try {
    // 获取当前用户的密码哈希
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 微信用户没有密码，不支持此接口
    if (!user.password) {
      return res.status(400).json({ error: '你的账号通过微信登录，尚未设置密码。请通过忘记密码流程设置密码。' });
    }

    // 验证当前密码
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: '当前密码不正确' });
    }

    // 检查新密码不能与当前密码相同
    const isSamePassword = await verifyPassword(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ error: '新密码不能与当前密码相同' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedPassword, updatedAt: new Date() }
    });

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败，请稍后重试' });
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
  const limit = parseInt(req.query.limit as string) || 100;

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
      skip: (page - 1) * limit,
      take: limit
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
