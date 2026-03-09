import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, optionalAuth, getUserId } from '../utils/middleware';

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
            parent_id: null,
            // 只显示已通过审核的节点，或者用户自己的节点
            OR: [
              { review_status: 'APPROVED' },
              ...(userId ? [{ author_id: userId }] : [])
            ]
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
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 过滤掉没有可见节点的故事
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
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
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

    res.json({ story, nodes });
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
router.get('/:id/tree', async (req, res) => {
  const { id } = req.params;

  try {
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true,
        root_node_id: true
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
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

export default router;
