import { Router } from 'express';
import { prisma } from '../index';
import { needsReview } from '../utils/sensitiveWords';
import { authenticateToken, getUserId } from '../utils/middleware';

const router = Router();

// 举报频率限制（简单内存实现，生产环境建议用Redis）
const reportLimit = new Map<string, { count: number; date: string }>();
const MAX_REPORTS_PER_DAY = 10;

// Create node (first node or branch)
router.post('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { storyId, parentId, title, content, image, path } = req.body;

  if (!storyId || !title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 验证故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // 如果是第一个节点（没有parentId）
    if (!parentId) {
      // 检查故事是否已有根节点
      const existingRoot = await prisma.nodes.findFirst({
        where: {
          story_id: parseInt(storyId),
          parent_id: null
        }
      });

      if (existingRoot) {
        return res.status(400).json({ error: '该故事已有第一章，请使用分支功能添加新章节' });
      }

      // 创建第一个节点
      const node = await prisma.nodes.create({
        data: {
          story_id: parseInt(storyId),
          parent_id: null,
          author_id: userId,
          title,
          content,
          image: image || null,
          path: path || '1',
          review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
        },
        include: {
          author: {
            select: { id: true, username: true }
          },
          story: {
            select: { id: true, title: true }
          }
        }
      });

      // 更新故事的root_node_id
      await prisma.stories.update({
        where: { id: parseInt(storyId) },
        data: { root_node_id: node.id }
      });

      return res.json({
        node,
        reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
        message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '第一章创建成功'
      });
    }

    // 如果有parentId，创建分支
    const parentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(parentId) }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 生成路径
    const siblingCount = await prisma.nodes.count({
      where: { parent_id: parseInt(parentId) }
    });
    const newPath = path || `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.nodes.create({
      data: {
        story_id: parseInt(storyId),
        parent_id: parseInt(parentId),
        author_id: userId,
        title,
        content,
        image: image || null,
        path: newPath,
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      node,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '分支创建成功'
    });
  } catch (error) {
    console.error('创建节点错误:', error);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// Update node (章节编辑)
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content, image } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 检查节点是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 检查是否是作者
    if (node.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this node' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // 准备更新数据
    const updateData: any = {
      title,
      content,
      updated_at: new Date(),
      review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
    };

    // 如果提供了image字段，则更新它
    if (image !== undefined) {
      updateData.image = image || null;
    }

    // 更新节点
    const updatedNode = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      node: updatedNode,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '更新成功'
    });
  } catch (error) {
    console.error('更新节点错误:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// Get node details with branches
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Increment read count
    await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: { read_count: { increment: 1 } }
    });

    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true, author_id: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Get branches with rating info
    const branches = await prisma.nodes.findMany({
      where: { parent_id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      },
      orderBy: [
        { rating_avg: 'desc' },
        { read_count: 'desc' }
      ]
    });

    // Get parent info for breadcrumb
    let parent = null;
    if (node.parent_id) {
      parent = await prisma.nodes.findUnique({
        where: { id: node.parent_id },
        select: { id: true, title: true }
      });
    }

    // Check if user has rated
    const userId = getUserId(req);
    let userRating = null;
    if (userId) {
      const rating = await prisma.ratings.findUnique({
        where: {
          node_id_user_id: {
            node_id: parseInt(id),
            user_id: userId
          }
        }
      });
      if (rating) userRating = rating.score;
    }

    res.json({ node, branches, parent, userRating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// Create branch
router.post('/:id/branches', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content, image } = req.body;

  try {
    const parentNode = await prisma.nodes.findUnique({
      where: { id: parseInt(id) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // Generate path: parent.path + branch number
    const siblingCount = await prisma.nodes.count({
      where: { parent_id: parseInt(id) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.nodes.create({
      data: {
        story_id: parentNode.story_id,
        parent_id: parseInt(id),
        author_id: userId,
        title,
        content,
        image,
        path: newPath,
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
          updated_at: new Date()
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      node,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '发布成功'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Rate a node
router.post('/:id/rate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { score } = req.body;

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be 1-5' });
  }

  try {
    // Upsert rating
    await prisma.ratings.upsert({
      where: {
        node_id_user_id: {
          node_id: parseInt(id),
          user_id: userId
        }
      },
      create: {
        node_id: parseInt(id),
        user_id: userId,
        score
      },
      update: {
        score
      }
    });

    // Recalculate average
    const ratings = await prisma.ratings.findMany({
      where: { node_id: parseInt(id) }
    });
    const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        rating_avg: avg,
        rating_count: ratings.length
      }
    });

    res.json({ success: true, rating_avg: avg, rating_count: ratings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rate node' });
  }
});

// 举报节点
router.post('/:id/report', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { reason, description } = req.body;

  // 映射前端的中文原因到后端的英文代码
  const reasonMap: { [key: string]: string } = {
    '垃圾广告': 'spam',
    '不当内容': 'illegal',
    '暴力血腥': 'violence',
    '色情低俗': 'porn',
    '抄袭侵权': 'copyright',
    '其他': 'other'
  };

  const mappedReason = reasonMap[reason] || reason;
  const validReasons = ['spam', 'illegal', 'porn', 'violence', 'copyright', 'other'];
  
  if (!mappedReason || !validReasons.includes(mappedReason)) {
    return res.status(400).json({ error: 'Invalid reason' });
  }

  // 检查举报频率限制
  const today = new Date().toISOString().split('T')[0];
  const limitKey = `${userId}:${today}`;
  const userLimit = reportLimit.get(limitKey);

  if (userLimit) {
    if (userLimit.count >= MAX_REPORTS_PER_DAY) {
      return res.status(429).json({ error: '今日举报次数已达上限' });
    }
    userLimit.count += 1;
  } else {
    reportLimit.set(limitKey, { count: 1, date: today });
  }

  try {
    // 检查是否重复举报
    const existingReport = await prisma.reports.findFirst({
      where: {
        node_id: parseInt(id),
        reporter_id: userId
      }
    });

    if (existingReport) {
      return res.status(400).json({ error: '您已经举报过该内容' });
    }

    // 创建举报记录
    const report = await prisma.reports.create({
      data: {
        node_id: parseInt(id),
        reporter_id: userId,
        reason: mappedReason,
        description: description || null
      }
    });

    // 更新节点举报计数
    const node = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        report_count: { increment: 1 },
        report_reasons: {
          set: JSON.stringify({
            reasons: [...(await getExistingReasons(parseInt(id))), mappedReason]
          })
        }
      }
    });

    // 如果举报次数 >= 3，自动下架
    if (node.report_count >= 3) {
      await prisma.nodes.update({
        where: { id: parseInt(id) },
        data: { review_status: 'HIDDEN' }
      });
    }

    res.json({
      success: true,
      report,
      autoHidden: node.report_count >= 3,
      remainingReports: MAX_REPORTS_PER_DAY - (reportLimit.get(limitKey)?.count || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 辅助函数：获取已有举报原因
async function getExistingReasons(nodeId: number): Promise<string[]> {
  const node = await prisma.nodes.findUnique({
    where: { id: nodeId },
    select: { report_reasons: true }
  });
  if (node?.report_reasons) {
    try {
      const parsed = JSON.parse(node.report_reasons);
      return parsed.reasons || [];
    } catch {
      return [];
    }
  }
  return [];
}

export default router;