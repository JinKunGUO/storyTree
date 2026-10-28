import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';
import { hashPassword, verifyPassword, isValidUsername, isValidPassword } from '../utils/auth';
import { getFanLevel, FAN_LEVELS } from '../utils/membership';

const router = Router();

// 参数预处理：验证 :id 参数为有效正整数
router.param('id', (req, res, next, value) => {
  const id = parseInt(value, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: '无效的用户ID' });
  }
  next();
});

// 创作排行榜（周榜/月榜）
router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const { period = 'week' } = req.query; // week 或 month
    const now = new Date();
    
    // 计算时间范围
    let startDate: Date;
    if (period === 'week') {
      // 本周一 00:00:00
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 周日是 0，转换为 6
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    } else {
      // 本月 1 号 00:00:00
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 查询用户创作统计
    const leaderboard = await prisma.$queryRaw<Array<{
      user_id: number;
      username: string;
      avatar: string | null;
      level: number;
      points: number;
      is_virtual: number;
      story_count: bigint;
      node_count: bigint;
      read_count: bigint;
      follower_count: bigint;
      total_score: number;
    }>>`
      SELECT
        u.id as user_id,
        u.username,
        u.avatar,
        u.level,
        u.points,
        u.is_virtual,
        COUNT(DISTINCT s.id) as story_count,
        COUNT(DISTINCT n.id) as node_count,
        COALESCE(SUM(n.read_count), 0) as read_count,
        (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count,
        (COUNT(DISTINCT s.id) * 10 + COUNT(DISTINCT n.id) * 5 + COALESCE(SUM(n.read_count), 0) * 2 + (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) * 3) as total_score
      FROM users u
      LEFT JOIN stories s ON s.author_id = u.id
      LEFT JOIN nodes n ON n.author_id = u.id AND n.review_status = 'APPROVED'
      WHERE u.is_banned = 0
        AND u.username NOT LIKE 'paytest%' AND u.username NOT LIKE 'test%'
      GROUP BY u.id, u.username, u.avatar, u.level, u.points, u.is_virtual
      HAVING story_count > 0 OR node_count > 0
      ORDER BY total_score DESC
      LIMIT 100
    `;

    // 转换 BigInt 为 Number，并计算粉丝等级
    const formattedLeaderboard = leaderboard.map((user, index) => {
      const followerCount = Number(user.follower_count);
      
      // 计算粉丝等级（基于粉丝数，避免额外数据库查询）
      let fanLevel = 1;
      for (let i = 7; i >= 1; i--) {
        if (followerCount >= FAN_LEVELS[i as keyof typeof FAN_LEVELS].minFollowers) {
          fanLevel = i;
          break;
        }
      }
      const fanLevelConfig = FAN_LEVELS[fanLevel as keyof typeof FAN_LEVELS];
      
      return {
        rank: index + 1,
        userId: Number(user.user_id),
        username: user.username,
        avatar: user.avatar,
        level: Number(user.level),
        points: Number(user.points),
        isVirtual: Number(user.is_virtual) === 1,
        storyCount: Number(user.story_count),
        nodeCount: Number(user.node_count),
        readCount: Number(user.read_count),
        followerCount,
        totalScore: Number(user.total_score),
        fanLevel: {
          level: fanLevel,
          name: fanLevelConfig.name,
          badge: fanLevelConfig.badge,
          color: fanLevelConfig.color
        }
      };
    });

    res.json({
      period,
      startDate,
      leaderboard: formattedLeaderboard
    });
  } catch (error) {
    console.error('获取创作排行榜失败:', error);
    console.error('错误详情:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : '无');
    res.status(500).json({ 
      error: '获取排行榜失败',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

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

    // 计算粉丝等级
    const fanLevelInfo = await getFanLevel(parseInt(id));

    res.json({
      user: {
        ...user,
        _count: {
          ...user._count,
          followers: followersCount  // 使用手动计数覆盖
        },
        fanLevel: fanLevelInfo,
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

// 获取当前用户的节点颜色偏好
router.get('/me/node-color', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { nodeColor: true }
    });

    res.json({ nodeColor: user?.nodeColor || null });
  } catch (error) {
    console.error('Get node color error:', error);
    res.status(500).json({ error: 'Failed to get node color' });
  }
});

// 设置当前用户的节点颜色偏好
router.put('/me/node-color', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeColor } = req.body;

  // 验证颜色格式（必须是有效的 hex 颜色）
  if (nodeColor && !/^#[0-9A-Fa-f]{6}$/.test(nodeColor)) {
    return res.status(400).json({ error: '无效的颜色格式，请使用 #RRGGBB 格式' });
  }

  try {
    const user = await prisma.users.update({
      where: { id: userId },
      data: { nodeColor },
      select: { id: true, username: true, nodeColor: true }
    });

    res.json({
      message: nodeColor ? '节点颜色已设置' : '节点颜色已清除',
      nodeColor: user.nodeColor
    });
  } catch (error) {
    console.error('Set node color error:', error);
    res.status(500).json({ error: 'Failed to set node color' });
  }
});

export default router;
