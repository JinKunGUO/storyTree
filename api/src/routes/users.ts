import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 获取用户信息
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const currentUserId = getUserId(req);

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            stories: true,
            nodes: true,
            following: true,
            followers: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 检查当前用户是否已关注
    let isFollowing = false;
    if (currentUserId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: parseInt(id)
          }
        }
      });
      isFollowing = !!follow;
    }

    res.json({
      user: {
        ...user,
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
router.post('/:id/follow', async (req, res) => {
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
    const follow = await prisma.follow.create({
      data: {
        followerId: userId,
        followingId: targetId
      }
    });

    // 获取关注者信息
    const follower = await prisma.user.findUnique({
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
router.delete('/:id/follow', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: parseInt(id)
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
router.put('/profile', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { bio } = req.body;

  try {
    const user = await prisma.user.update({
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
    const following = await prisma.follow.findMany({
      where: { followerId: parseInt(id) },
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
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      following: following.map(f => ({
        ...f.following,
        followedAt: f.createdAt
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
    const followers = await prisma.follow.findMany({
      where: { followingId: parseInt(id) },
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
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      followers: followers.map(f => ({
        ...f.follower,
        followedAt: f.createdAt
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch followers list' });
  }
});

// 获取动态流
router.get('/feed/me', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取关注的人的最新节点
    const feed = await prisma.node.findMany({
      where: {
        author: {
          followers: {
            some: {
              followerId: userId
            }
          }
        },
        reviewStatus: 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'desc' },
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
    const stories = await prisma.story.findMany({
      where: { authorId: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            nodes: true
          }
        },
        nodes: {
          where: { parentId: null },
          take: 1,
          select: {
            id: true,
            title: true,
            ratingAvg: true,
            ratingCount: true,
            readCount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ stories });
  } catch (error) {
    console.error('获取用户故事错误:', error);
    res.status(500).json({ error: 'Failed to fetch user stories' });
  }
});

// 获取用户参与创作的章节
router.get('/:id/nodes', async (req, res) => {
  const { id } = req.params;

  try {
    const nodes = await prisma.node.findMany({
      where: { 
        authorId: parseInt(id),
        reviewStatus: 'APPROVED'
      },
      include: {
        story: {
          select: { id: true, title: true }
        },
        author: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({ nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user nodes' });
  }
});

export default router;
