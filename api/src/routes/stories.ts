import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';
import { canViewStory, canEditStory, checkViewPermission, checkEditPermission } from '../utils/permissions';

const router = Router();

// List all stories with first node info
// 支持参数：sort(popular/trending/latest)、tag、page、pageSize
router.get('/', optionalAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const sort = (req.query.sort as string) || 'latest';
    const tag = req.query.tag as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const skip = (page - 1) * pageSize;

    // 根据 sort 参数决定 orderBy
    let orderBy: any;
    if (sort === 'popular') {
      // 热门榜：按追更数降序，再按章节数降序，再按创建时间降序
      orderBy = [
        { followers: { _count: 'desc' } },
        { nodes: { _count: 'desc' } },
        { created_at: 'desc' },
      ];
    } else if (sort === 'trending') {
      // 趋势榜：按章节数降序（更新活跃度），再按追更数降序
      orderBy = [
        { nodes: { _count: 'desc' } },
        { followers: { _count: 'desc' } },
        { created_at: 'desc' },
      ];
    } else {
      // 最新榜（默认）：按创建时间降序
      orderBy = { created_at: 'desc' };
    }

    // tag 过滤：tags 字段是逗号分隔的字符串，用 contains 匹配
    const where: any = {
      nodes: { some: { parent_id: null } },
    };
    if (tag) {
      where.tags = { contains: tag };
    }

    // 并行查询：故事列表 + 总数
    const [stories, total] = await Promise.all([
      prisma.stories.findMany({
        where,
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
              rating_count: true,
              review_status: true
            }
          },
          _count: {
            select: {
              nodes: true,
              bookmarks: true,
              followers: true,
            }
          }
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.stories.count({ where })
    ]);

    res.json({ stories, page, pageSize, total });
  } catch (error) {
    console.error('List stories error:', error);
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

// 获取平台统计数据（用于首页展示）
router.get('/stats', async (req, res) => {
  try {
    // 并行查询：故事总数、章节总数、创作者数量
    const [storyCount, nodeCount, authorCount] = await Promise.all([
      // 故事总数（有至少一个章节的故事）
      prisma.stories.count({
        where: { nodes: { some: { parent_id: null } } }
      }),
      // 章节总数
      prisma.nodes.count(),
      // 创作者数量（去重的故事作者 + 章节作者）
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT author_id) as count FROM (
          SELECT author_id FROM stories WHERE author_id IS NOT NULL
          UNION
          SELECT author_id FROM nodes WHERE author_id IS NOT NULL
        ) AS authors
      `.then(result => Number(result[0]?.count || 0))
    ]);

    res.json({
      stories: storyCount,
      chapters: nodeCount,
      authors: authorCount
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get featured stories (ordered by popularity)
router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const stories = await prisma.stories.findMany({
      where: {
        nodes: {
          some: { parent_id: null }
        }
      },
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
            review_status: true
          }
        },
        _count: {
          select: {
            nodes: true,
            followers: true
          }
        }
      },
      orderBy: [
        { followers: { _count: 'desc' } },
        { created_at: 'desc' }
      ],
      take: limit
    });

    res.json({ stories });
  } catch (error) {
    console.error('Get featured stories error:', error);
    res.status(500).json({ error: 'Failed to fetch featured stories' });
  }
});

// 获取我的故事列表（包含私密故事和协作故事）
// 注意：必须在 /:id 之前注册，否则 "my" 会被当成 id 参数
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
// 注意：必须在 /:id 之前注册，否则 "shared-with-me" 会被当成 id 参数
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

// Get story with full tree
router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
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
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查查看权限：主创作者始终有权限，其他用户需要检查
    const isAuthor = !!(userId && story.author_id === userId);
    if (!isAuthor) {
      const hasPermission = await canViewStory(userId, parseInt(id));
      if (!hasPermission) {
        return res.status(403).json({ error: '无权限查看此故事' });
      }
    }

    // 判断当前用户是否是协作者（协作者也可以看到草稿）
    let isCollaboratorForDraft = false;
    if (userId && !isAuthor) {
      const collaboratorRecord = await prisma.story_collaborators.findFirst({
        where: { story_id: parseInt(id), user_id: userId, removed_at: null }
      });
      isCollaboratorForDraft = !!collaboratorRecord;
    }
    const canSeeDrafts = isAuthor || isCollaboratorForDraft;

    // Get all nodes for this story
    // 草稿节点（is_published=false）只对作者和协作者可见
    // 被驳回/下架的节点（REJECTED/HIDDEN）对普通用户不可见
    const isAdmin = !!(req as any).isAdmin;
    const nodeWhereFilter: any = {
      story_id: parseInt(id),
      ...(canSeeDrafts ? {} : { is_published: true })
    };
    // 非管理员、非作者：过滤掉被驳回和下架的节点
    if (!isAdmin && !isAuthor) {
      nodeWhereFilter.OR = [
        { review_status: 'APPROVED' },
        { review_status: 'PENDING' },
        // 允许节点作者看到自己被驳回的内容（以便修改后重新提交）
        ...(userId ? [{ author_id: userId, review_status: { in: ['REJECTED', 'HIDDEN'] } }] : [])
      ];
    }

    const nodes = await prisma.nodes.findMany({
      where: nodeWhereFilter,
      include: {
        author: {
          select: { id: true, username: true, level: true }
        },
        _count: {
          select: { other_nodes: true, comments: true }
        }
      },
      orderBy: { path: 'asc' }
    });

    // 计算统计数据
    const totalReads = nodes.reduce((sum, n) => sum + (n.read_count || 0), 0);
    const totalWords = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);

    // 当前用户的追更状态
    let isFollowed = false;
    // 当前用户的收藏状态
    let isBookmarked = false;
    // 当前用户的协作者状态
    let isCollaborator = false;
    // 当前用户的协作申请状态
    let collaborationRequestStatus: string | null = null;
    // 协作者列表
    let collaborators: any[] = [];

    if (userId) {
      const [followerRecord, collabRequest, bookmarkRecord] = await Promise.all([
        prisma.story_followers.findUnique({
          where: { story_id_user_id: { story_id: parseInt(id), user_id: userId } }
        }),
        prisma.collaboration_requests.findUnique({
          where: { story_id_user_id: { story_id: parseInt(id), user_id: userId } }
        }),
        prisma.bookmarks.findFirst({
          where: { story_id: parseInt(id), user_id: userId }
        })
      ]);
      isFollowed = !!followerRecord;
      // isCollaboratorForDraft 已在上方查询过，直接复用
      isCollaborator = isCollaboratorForDraft;
      collaborationRequestStatus = collabRequest?.status ?? null;
      isBookmarked = !!bookmarkRecord;
    }

    // 获取协作者列表（公开展示，不限登录状态）
    const collabList = await prisma.story_collaborators.findMany({
      where: { story_id: parseInt(id), removed_at: null },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      take: 10
    });
    collaborators = collabList.map(c => c.user);

    const storyWithStats = {
      ...story,
      views: totalReads,
      likes: story._count.bookmarks,
      nodeCount: story._count.nodes,
      wordCount: totalWords,
      isAuthor,
      isFollowed,
      isBookmarked,
      isCollaborator,
      collaborationRequestStatus,
      collaborators,
    };

    res.json({ story: storyWithStats, nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// 追更故事（关注）
router.post('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { id } = req.params;
  try {
    const story = await prisma.stories.findUnique({ where: { id: parseInt(id) } });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    await prisma.story_followers.upsert({
      where: { story_id_user_id: { story_id: parseInt(id), user_id: userId } },
      create: { story_id: parseInt(id), user_id: userId },
      update: {}
    });
    res.json({ message: '追更成功', isFollowed: true });
  } catch (error) {
    console.error('Follow story error:', error);
    res.status(500).json({ error: '追更失败' });
  }
});

// 取消追更故事
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { id } = req.params;
  try {
    await prisma.story_followers.deleteMany({
      where: { story_id: parseInt(id), user_id: userId }
    });
    res.json({ message: '已取消追更' });
  } catch (error) {
    console.error('Unfollow story error:', error);
    res.status(500).json({ error: '取消追更失败' });
  }
});

// 用户主动退出共创（取消自己的协作者身份）
router.delete('/:id/collaborator', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { id } = req.params;
  try {
    const story = await prisma.stories.findUnique({ where: { id: parseInt(id) } });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    // 主创不能退出自己的故事
    if (story.author_id === userId) {
      return res.status(400).json({ error: '主创不能退出自己的故事' });
    }
    // 将协作者记录标记为已移除
    await prisma.story_collaborators.updateMany({
      where: { story_id: parseInt(id), user_id: userId, removed_at: null },
      data: { removed_at: new Date(), removed_by: userId }
    });
    // 同时将协作申请状态重置（方便日后重新申请）
    await prisma.collaboration_requests.updateMany({
      where: { story_id: parseInt(id), user_id: userId, status: 'approved' },
      data: { status: 'rejected', reviewed_at: new Date() }
    });
    res.json({ message: '已退出共创' });
  } catch (error) {
    console.error('Leave collaboration error:', error);
    res.status(500).json({ error: '退出共创失败' });
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

    // 判断当前用户是否是协作者（协作者也可以看到草稿）
    let isCollaboratorForTree = false;
    if (userId && !isAuthor) {
      const collaboratorRecord = await prisma.story_collaborators.findFirst({
        where: { story_id: parseInt(id), user_id: userId, removed_at: null }
      });
      isCollaboratorForTree = !!collaboratorRecord;
    }
    const canSeeDraftsInTree = isAuthor || isCollaboratorForTree;

    // Get all nodes with their relationships
    // 草稿节点（is_published=false）只对作者和协作者可见
    // 被驳回/下架的节点（REJECTED/HIDDEN）对普通用户不可见
    const isAdminForTree = !!(req as any).isAdmin;
    const treeNodeFilter: any = {
      story_id: parseInt(id),
      ...(canSeeDraftsInTree ? {} : { is_published: true })
    };
    if (!isAdminForTree && !isAuthor) {
      treeNodeFilter.OR = [
        { review_status: 'APPROVED' },
        { review_status: 'PENDING' },
        ...(userId ? [{ author_id: userId, review_status: { in: ['REJECTED', 'HIDDEN'] } }] : [])
      ];
    }

    const nodes = await prisma.nodes.findMany({
      where: treeNodeFilter,
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

    // First pass: create node map
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        id: node.id,
        name: node.title,
        path: node.path,
        author: node.author?.username || '未知',
        authorId: node.author_id,
        aiGenerated: node.ai_generated,
        isPublished: node.is_published,
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
    const rootNodes: any[] = [];
    nodes.forEach(node => {
      const nodeData = nodeMap.get(node.id);
      if (node.parent_id === null) {
        // Root chapter node
        rootNodes.push(nodeData);
      } else {
        // Child node
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(nodeData);
        }
      }
    });

    // 如果只有一个根章节，直接用它作为树根；
    // 如果有多个根章节（异常情况），用故事标题作为不可点击的虚拟根节点包裹
    let tree: any;
    if (rootNodes.length === 1) {
      tree = rootNodes[0];
    } else if (rootNodes.length > 1) {
      tree = {
        id: null, // null 表示虚拟根节点，前端不应跳转
        name: story.title,
        isVirtualRoot: true,
        children: rootNodes
      };
    } else {
      // 没有任何章节，返回空的虚拟根节点
      tree = {
        id: null,
        name: story.title,
        isVirtualRoot: true,
        children: []
      };
    }

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

// 关注故事（追更）
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
    const follow = await prisma.story_followers.create({
      data: {
        story_id: parseInt(id),
        user_id: userId,
        points_awarded: false // 初始未发放积分
      }
    });

    // 🎁 首次追更积分奖励：为故事作者发放积分（非作者本人追更时）
    let pointsEarned = 0;
    if (story.author_id !== userId && !follow.points_awarded) {
      try {
        const { addPoints, POINT_RULES } = await import('../utils/points');
        await addPoints(
          story.author_id,
          POINT_RULES.GET_BOOKMARK.points, // 使用收藏的积分规则（5积分）
          'get_follow',
          `故事《${story.title}》获得追更`,
          story.id
        );
        
        // 标记为已发放积分
        await prisma.story_followers.update({
          where: {
            story_id_user_id: {
              story_id: parseInt(id),
              user_id: userId
            }
          },
          data: {
            points_awarded: true
          }
        });

        pointsEarned = POINT_RULES.GET_BOOKMARK.points;
        console.log(`✅ 追更积分奖励已发放: 用户 ${story.author_id} 获得 ${pointsEarned} 积分`);
      } catch (error) {
        console.error('❌ 发放追更积分失败:', error);
        // 不阻塞追更操作，仅记录错误
      }
    } else if (story.author_id === userId) {
      console.log(`⚠️ 作者自己追更，不发放积分奖励`);
    }

    res.json({ 
      message: '关注成功',
      pointsEarned: pointsEarned > 0 ? pointsEarned : undefined
    });
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