import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';
import { canViewStory, canEditStory, checkViewPermission, checkEditPermission } from '../utils/permissions';

const router = Router();

// List all stories with first node info
router.get('/', optionalAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const stories = await prisma.stories.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        nodes: {
          where: {
            parent_id: null
            // 发现页面显示所有故事，不受审核状态限制
            // 审核机制只影响节点内容的详细显示，不影响故事列表
          },
          take: 1,
          select: {
            id: true,
            title: true,
            content: true,
            rating_avg: true,
            rating_count: true,
            review_status: true
          }
        },
        _count: {
          select: {
            nodes: true,
            bookmarks: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 过滤掉没有根节点的故事（只创建了故事但还没有添加第一章）
    const filteredStories = stories.filter(s => s.nodes.length > 0);

    res.json({ stories: filteredStories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create story with first node
router.post('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, description, cover_image, firstNodeTitle, firstNodeContent } = req.body;

  try {
    // 如果提供了第一章内容，则创建故事和第一章
    if (firstNodeContent) {
      // 检查用户已发布节点数
      const userNodeCount = await prisma.nodes.count({
        where: { author_id: userId }
      });

      // 审核检查
      const reviewCheck = needsReview(firstNodeContent, userNodeCount);

      const story = await prisma.stories.create({
        data: {
          title,
          description,
          cover_image,
          author_id: userId,
          updated_at: new Date(),
          nodes: {
            create: {
              title: firstNodeTitle || '第一章',
              content: firstNodeContent,
              author_id: userId,
              path: '1',
              review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
              updated_at: new Date()
            }
          }
        },
        include: {
          nodes: true,
          author: {
            select: { id: true, username: true }
          }
        }
      });

      // Update root_node_id
      await prisma.stories.update({
        where: { id: story.id },
        data: { root_node_id: story.nodes[0].id }
      });

      return res.json({
        story: { ...story, root_node_id: story.nodes[0].id },
        review_status: reviewCheck.needReview ? 'pending' : 'approved',
        message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '发布成功'
      });
    } else {
      // 只创建故事，不创建第一章
      const story = await prisma.stories.create({
        data: {
          title,
          description,
          cover_image,
          author_id: userId,
          updated_at: new Date()
        },
        include: {
          author: {
            select: { id: true, username: true }
          }
        }
      });

      return res.json({
        story,
        message: '故事创建成功，请添加第一章'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get story with full tree
router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            nodes: true,
            bookmarks: true
          }
        }
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查查看权限：主创作者始终有权限，其他用户需要检查
    const isAuthor = userId && story.author_id === userId;
    if (!isAuthor) {
      const hasPermission = await canViewStory(userId, parseInt(id));
      if (!hasPermission) {
        return res.status(403).json({ error: '无权限查看此故事' });
      }
    }

    // Get all nodes for this story
    const nodes = await prisma.nodes.findMany({
      where: { story_id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true, level: true }
        },
        _count: {
          select: { other_nodes: true }
        }
      },
      orderBy: { path: 'asc' }
    });

    // 计算统计数据
    const totalReads = nodes.reduce((sum, n) => sum + (n.read_count || 0), 0);
    const totalWords = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);

    // 添加统计数据到story对象
    const storyWithStats = {
      ...story,
      views: totalReads,
      likes: story._count.bookmarks,
      nodeCount: story._count.nodes,
      wordCount: totalWords
    };

    res.json({ story: storyWithStats, nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Update story
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, description, cover_image } = req.body;

  try {
    // 检查故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查权限：只有作者可以编辑
    if (story.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this story' });
    }

    // 更新故事（只更新存在的字段）
    const updatedStory = await prisma.stories.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(cover_image && { cover_image })
      },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    res.json({ 
      story: updatedStory,
      message: 'Story updated successfully'
    });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Get story tree structure for visualization
router.get('/:id/tree', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true,
        root_node_id: true,
        author_id: true
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查查看权限：主创作者始终有权限，其他用户需要检查
    const isAuthor = userId && story.author_id === userId;
    if (!isAuthor) {
      const hasPermission = await canViewStory(userId, parseInt(id));
      if (!hasPermission) {
        return res.status(403).json({ error: '无权限查看此故事' });
      }
    }

    // Get all nodes with their relationships
    const nodes = await prisma.nodes.findMany({
      where: { 
        story_id: parseInt(id)
        // 移除 is_published 限制，显示所有章节（包括草稿）
      },
      include: {
        author: {
          select: { 
            id: true, 
            username: true, 
            level: true 
          }
        },
        _count: {
          select: { 
            other_nodes: true, // 子节点数量
            comments: true,
            ratings: true
          }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    // Build tree structure
    const nodeMap = new Map();
    const tree: any = {
      id: story.id,
      name: story.title,
      children: []
    };

    // First pass: create node map
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        id: node.id,
        name: node.title,
        path: node.path,
        author: node.author?.username || '未知',
        authorId: node.author_id,
        aiGenerated: node.ai_generated,
        isPublished: node.is_published, // 添加发布状态
        readCount: node.read_count || 0,
        commentCount: node._count.comments,
        ratingAvg: node.rating_avg || 0,
        ratingCount: node._count.ratings,
        branchCount: node._count.other_nodes,
        createdAt: node.created_at,
        value: node.read_count || 1, // For node size
        children: []
      });
    });

    // Second pass: build tree structure
    nodes.forEach(node => {
      const nodeData = nodeMap.get(node.id);
      if (node.parent_id === null) {
        // Root node
        tree.children.push(nodeData);
      } else {
        // Child node
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(nodeData);
        }
      }
    });

    // Calculate statistics
    const stats = {
      totalNodes: nodes.length,
      totalBranches: nodes.filter(n => n._count.other_nodes > 1).length,
      totalReads: nodes.reduce((sum, n) => sum + (n.read_count || 0), 0),
      totalComments: nodes.reduce((sum, n) => sum + n._count.comments, 0),
      aiNodes: nodes.filter(n => n.ai_generated).length,
      humanNodes: nodes.filter(n => !n.ai_generated).length,
      maxDepth: Math.max(...nodes.map(n => (n.path?.split('.').length || 1))),
      authors: [...new Set(nodes.map(n => n.author_id))].length
    };

    res.json({ tree, stats, nodes: nodes.length });
  } catch (error) {
    console.error('Get story tree error:', error);
    res.status(500).json({ error: 'Failed to fetch story tree' });
  }
});

// Get node path to root (breadcrumb)
router.get('/nodes/:nodeId/path', async (req, res) => {
  const { nodeId } = req.params;

  try {
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        story: {
          select: { id: true, title: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Build path from root to current node
    const path = [];
    let currentNode: typeof node | null = node;

    while (currentNode) {
      path.unshift({
        id: currentNode.id,
        title: currentNode.title,
        path: currentNode.path
      });

      if (currentNode.parent_id) {
        currentNode = await prisma.nodes.findUnique({
          where: { id: currentNode.parent_id },
          include: {
            story: {
              select: { id: true, title: true }
            }
          }
        });
      } else {
        currentNode = null;
      }
    }

    res.json({ 
      story: node.story,
      path 
    });
  } catch (error) {
    console.error('Get node path error:', error);
    res.status(500).json({ error: 'Failed to fetch node path' });
  }
});

// ==================== 权限管理API ====================

// 更新故事权限设置
router.put('/:id/settings', authenticateToken, checkEditPermission, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { visibility, password, allow_branch, allow_comment, auto_approve_collaborators, tags } = req.body;

  try {
    const updatedStory = await prisma.stories.update({
      where: { id: parseInt(id) },
      data: {
        ...(visibility && { visibility }),
        ...(password !== undefined && { password }),
        ...(allow_branch !== undefined && { allow_branch }),
        ...(allow_comment !== undefined && { allow_comment }),
        ...(auto_approve_collaborators !== undefined && { auto_approve_collaborators }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true }
            }
          }
        }
      }
    });

    res.json({
      story: updatedStory,
      message: '权限设置已更新'
    });
  } catch (error) {
    console.error('Update story settings error:', error);
    res.status(500).json({ error: '更新设置失败' });
  }
});

// 获取我的故事列表（包含私密故事和协作故事）
router.get('/my', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取我创建的故事
    const myStories = await prisma.stories.findMany({
      where: { author_id: userId },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: {
            nodes: true,
            bookmarks: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 获取我协作的故事
    const collaborations = await prisma.story_collaborators.findMany({
      where: { 
        user_id: userId,
        removed_at: null // 仅获取未被移除的协作
      },
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true }
            },
            _count: {
              select: {
                nodes: true,
                bookmarks: true
              }
            }
          }
        }
      }
    });

    // 合并结果，标记是否是作者
    const stories = [
      ...myStories.map(s => ({ ...s, isAuthor: true, isCollaborator: false })),
      ...collaborations.map(c => ({ ...c.story, isAuthor: false, isCollaborator: true }))
    ];

    // 按创建时间倒序排序
    stories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ stories });
  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// 获取分享给我的故事
router.get('/shared-with-me', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 查找我作为协作者的故事（仅未被移除的）
    const collaborations = await prisma.story_collaborators.findMany({
      where: { 
        user_id: userId,
        removed_at: null
      },
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true, avatar: true }
            },
            nodes: {
              where: { parent_id: null },
              take: 1,
              select: {
                id: true,
                title: true,
                content: true,
                rating_avg: true,
                rating_count: true
              }
            },
            _count: {
              select: { nodes: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const stories = collaborations.map(c => ({
      ...c.story,
      invited_at: c.created_at
    }));

    res.json({ stories });
  } catch (error) {
    console.error('Get shared stories error:', error);
    res.status(500).json({ error: 'Failed to fetch shared stories' });
  }
});

// 添加协作者
router.post('/:id/collaborators', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { user_id, username } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查是否是故事作者
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: '只有故事作者可以添加协作者' });
    }

    // 查找目标用户（支持username或user_id）
    let targetUser;
    if (username) {
      // 通过用户名查找
      targetUser = await prisma.users.findUnique({
        where: { username: username.trim() }
      });
      if (!targetUser) {
        return res.status(404).json({ error: `用户 "${username}" 不存在` });
      }
    } else if (user_id) {
      // 通过ID查找（向后兼容）
      targetUser = await prisma.users.findUnique({
        where: { id: user_id }
      });
      if (!targetUser) {
        return res.status(404).json({ error: '用户不存在' });
      }
    } else {
      return res.status(400).json({ error: '请提供用户名或用户ID' });
    }

    // 不能将作者自己添加为协作者
    if (story.author_id === targetUser.id) {
      return res.status(400).json({ error: '不能将作者添加为协作者' });
    }

    // 检查是否已经是协作者（包括被移除的）
    const existingCollaborator = await prisma.story_collaborators.findUnique({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: targetUser.id
        }
      }
    });

    let collaborator;
    if (existingCollaborator) {
      // 如果之前被移除，重新激活
      if (existingCollaborator.removed_at) {
        collaborator = await prisma.story_collaborators.update({
          where: {
            story_id_user_id: {
              story_id: parseInt(id),
              user_id: targetUser.id
            }
          },
          data: {
            removed_at: null,
            removed_by: null
          },
          include: {
            user: {
              select: { id: true, username: true, avatar: true }
            }
          }
        });
      } else {
        return res.status(400).json({ error: '该用户已是协作者' });
      }
    } else {
      // 添加新协作者
      collaborator = await prisma.story_collaborators.create({
        data: {
          story_id: parseInt(id),
          user_id: targetUser.id,
          invited_by: userId
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });
    }

    // 自动将协作者添加为故事粉丝（追更）
    await prisma.story_followers.upsert({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: targetUser.id
        }
      },
      create: {
        story_id: parseInt(id),
        user_id: targetUser.id
      },
      update: {} // 如果已存在则不做修改
    });

    // 创建通知
    await prisma.notifications.create({
      data: {
        user_id: targetUser.id,
        type: 'COLLABORATION_INVITE',
        title: '协作邀请',
        content: `${story.title} 的作者邀请你成为协作者`,
        link: `/story?id=${story.id}`
      }
    });

    res.json({
      collaborator,
      message: '协作者添加成功'
    });
  } catch (error: any) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: '添加协作者失败' });
  }
});

// 移除协作者（软删除）
router.delete('/:id/collaborators/:userId', authenticateToken, async (req, res) => {
  const currentUserId = getUserId(req);
  const { id, userId } = req.params;

  if (!currentUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查是否是故事作者
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.author_id !== currentUserId) {
      return res.status(403).json({ error: '只有故事作者可以移除协作者' });
    }

    // 软删除协作者
    await prisma.story_collaborators.update({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: parseInt(userId)
        }
      },
      data: {
        removed_at: new Date(),
        removed_by: currentUserId
      }
    });

    res.json({ message: '协作者已移除' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: '移除协作者失败' });
  }
});

// 获取故事的协作者列表（仅未被移除的）
router.get('/:id/collaborators', authenticateToken, checkViewPermission, async (req, res) => {
  const { id } = req.params;

  try {
    const collaborators = await prisma.story_collaborators.findMany({
      where: { 
        story_id: parseInt(id),
        removed_at: null // 仅获取未被移除的协作者
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    res.json({ collaborators });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// 退出协作（软删除）
router.post('/:id/collaborators/leave', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查是否是协作者
    const collaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(id),
        user_id: userId,
        removed_at: null
      }
    });

    if (!collaborator) {
      return res.status(404).json({ error: '你不是此故事的协作者' });
    }

    // 检查是否是作者
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      select: { author_id: true }
    });

    if (story?.author_id === userId) {
      return res.status(403).json({ error: '作者不能退出自己的故事' });
    }

    // 软删除协作关系
    await prisma.story_collaborators.update({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: userId
        }
      },
      data: {
        removed_at: new Date(),
        removed_by: userId // 自己退出
      }
    });

    res.json({ message: '已退出协作' });
  } catch (error) {
    console.error('Leave collaboration error:', error);
    res.status(500).json({ error: '退出协作失败' });
  }
});

// ==================== 故事粉丝API ====================

// 关注故事
router.post('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, title: true, author_id: true }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查是否有查看权限
    const hasPermission = await canViewStory(userId, parseInt(id));
    if (!hasPermission) {
      return res.status(403).json({ error: '无权限查看此故事' });
    }

    // 检查是否已经关注
    const existingFollow = await prisma.story_followers.findUnique({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: userId
        }
      }
    });

    if (existingFollow) {
      return res.status(400).json({ error: '已经关注过此故事' });
    }

    // 创建关注记录
    await prisma.story_followers.create({
      data: {
        story_id: parseInt(id),
        user_id: userId
      }
    });

    res.json({ message: '关注成功' });
  } catch (error) {
    console.error('Follow story error:', error);
    res.status(500).json({ error: '关注失败' });
  }
});

// 取消关注故事
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 删除关注记录
    await prisma.story_followers.delete({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: userId
        }
      }
    });

    res.json({ message: '已取消关注' });
  } catch (error) {
    console.error('Unfollow story error:', error);
    res.status(500).json({ error: '取消关注失败' });
  }
});

// 获取故事的粉丝列表
router.get('/:id/followers', optionalAuth, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  try {
    // 检查查看权限
    const hasPermission = await canViewStory(userId, parseInt(id));
    if (!hasPermission) {
      return res.status(403).json({ error: '无权限查看此故事' });
    }

    // 获取粉丝总数
    const total = await prisma.story_followers.count({
      where: { story_id: parseInt(id) }
    });

    // 获取粉丝列表（分页）
    const followers = await prisma.story_followers.findMany({
      where: { story_id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    res.json({
      followers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// 获取用户关注的故事列表
router.get('/user/:userId/followed-stories', optionalAuth, async (req, res) => {
  const currentUserId = getUserId(req);
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  try {
    // 获取关注总数
    const total = await prisma.story_followers.count({
      where: { user_id: parseInt(userId) }
    });

    // 获取关注的故事列表（分页）
    const follows = await prisma.story_followers.findMany({
      where: { user_id: parseInt(userId) },
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
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 过滤掉当前用户无权查看的故事
    const visibleFollows = [];
    for (const follow of follows) {
      const hasPermission = await canViewStory(currentUserId, follow.story_id);
      if (hasPermission) {
        visibleFollows.push(follow);
      }
    }

    res.json({
      follows: visibleFollows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Get followed stories error:', error);
    res.status(500).json({ error: 'Failed to fetch followed stories' });
  }
});

// 获取当前用户在故事中的角色
router.get('/:id/role', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      select: { 
        author_id: true,
        allow_branch: true,
        allow_comment: true
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查是否是主创
    const is_author = story.author_id === userId;

    // 检查是否是协作者 (未被移除)
    const collaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: parseInt(id),
        user_id: userId,
        removed_at: null // 关键：只查询未被移除的协作者
      }
    });
    const is_collaborator = !!collaborator;

    // 检查是否是粉丝
    const follower = await prisma.story_followers.findUnique({
      where: {
        story_id_user_id: {
          story_id: parseInt(id),
          user_id: userId
        }
      }
    });
    const is_follower = !!follower;

    // 检查是否有待处理的协作申请
    const pendingRequest = await prisma.collaboration_requests.findFirst({
      where: {
        story_id: parseInt(id),
        user_id: userId,
        status: 'pending'
      }
    });
    const has_pending_request = !!pendingRequest;

    // 获取故事粉丝数
    const follower_count = await prisma.story_followers.count({
      where: { story_id: parseInt(id) }
    });

    res.json({
      is_author,
      is_collaborator,
      is_follower,
      has_pending_request,
      follower_count,
      allow_branch: story.allow_branch,  // 添加故事设置
      allow_comment: story.allow_comment // 添加故事设置
    });
  } catch (error) {
    console.error('Get my role error:', error);
    res.status(500).json({ error: 'Failed to get role' });
  }
});

export default router;