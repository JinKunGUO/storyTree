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
    const story = await prisma.story.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.node.count({
      where: { authorId: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // 如果是第一个节点（没有parentId）
    if (!parentId) {
      // 检查故事是否已有根节点
      const existingRoot = await prisma.node.findFirst({
        where: {
          storyId: parseInt(storyId),
          parentId: null
        }
      });

      if (existingRoot) {
        return res.status(400).json({ error: '该故事已有第一章，请使用分支功能添加新章节' });
      }

      // 创建第一个节点
      const node = await prisma.node.create({
        data: {
          storyId: parseInt(storyId),
          parentId: null,
          authorId: userId,
          title,
          content,
          image: image || null,
          path: path || '1',
          reviewStatus: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
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

      // 更新故事的rootNodeId
      await prisma.story.update({
        where: { id: parseInt(storyId) },
        data: { rootNodeId: node.id }
      });

      return res.json({
        node,
        reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
        message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '第一章创建成功'
      });
    }

    // 如果有parentId，创建分支
    const parentNode = await prisma.node.findUnique({
      where: { id: parseInt(parentId) }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 生成路径
    const siblingCount = await prisma.node.count({
      where: { parentId: parseInt(parentId) }
    });
    const newPath = path || `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.node.create({
      data: {
        storyId: parseInt(storyId),
        parentId: parseInt(parentId),
        authorId: userId,
        title,
        content,
        image: image || null,
        path: newPath,
        reviewStatus: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
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

// Get node details with branches
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Increment read count
    await prisma.node.update({
      where: { id: parseInt(id) },
      data: { readCount: { increment: 1 } }
    });

    const node = await prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true, authorId: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Get branches with rating info
    const branches = await prisma.node.findMany({
      where: { parentId: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      },
      orderBy: [
        { ratingAvg: 'desc' },
        { readCount: 'desc' }
      ]
    });

    // Get parent info for breadcrumb
    let parent = null;
    if (node.parentId) {
      parent = await prisma.node.findUnique({
        where: { id: node.parentId },
        select: { id: true, title: true }
      });
    }

    // Check if user has rated
    const userId = getUserId(req);
    let userRating = null;
    if (userId) {
      const rating = await prisma.rating.findUnique({
        where: {
          nodeId_userId: {
            nodeId: parseInt(id),
            userId
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
    const parentNode = await prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.node.count({
      where: { authorId: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // Generate path: parent.path + branch number
    const siblingCount = await prisma.node.count({
      where: { parentId: parseInt(id) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.node.create({
      data: {
        storyId: parentNode.storyId,
        parentId: parseInt(id),
        authorId: userId,
        title,
        content,
        image,
        path: newPath,
        reviewStatus: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
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
    await prisma.rating.upsert({
      where: {
        nodeId_userId: {
          nodeId: parseInt(id),
          userId
        }
      },
      create: {
        nodeId: parseInt(id),
        userId,
        score
      },
      update: {
        score
      }
    });

    // Recalculate average
    const ratings = await prisma.rating.findMany({
      where: { nodeId: parseInt(id) }
    });
    const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    await prisma.node.update({
      where: { id: parseInt(id) },
      data: {
        ratingAvg: avg,
        ratingCount: ratings.length
      }
    });

    res.json({ success: true, ratingAvg: avg, ratingCount: ratings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rate node' });
  }
});

// 举报节点
router.post('/:id/report', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { reason, description } = req.body;

  const validReasons = ['spam', 'illegal', 'porn', 'violence', 'copyright', 'other'];
  if (!reason || !validReasons.includes(reason)) {
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
    const existingReport = await prisma.report.findFirst({
      where: {
        nodeId: parseInt(id),
        reporterId: userId
      }
    });

    if (existingReport) {
      return res.status(400).json({ error: '您已经举报过该内容' });
    }

    // 创建举报记录
    const report = await prisma.report.create({
      data: {
        nodeId: parseInt(id),
        reporterId: userId,
        reason,
        description: description || null
      }
    });

    // 更新节点举报计数
    const node = await prisma.node.update({
      where: { id: parseInt(id) },
      data: {
        reportCount: { increment: 1 },
        reportReasons: {
          set: JSON.stringify({
            reasons: [...(await getExistingReasons(parseInt(id))), reason]
          })
        }
      }
    });

    // 如果举报次数 >= 3，自动下架
    if (node.reportCount >= 3) {
      await prisma.node.update({
        where: { id: parseInt(id) },
        data: { reviewStatus: 'HIDDEN' }
      });
    }

    res.json({
      success: true,
      report,
      autoHidden: node.reportCount >= 3,
      remainingReports: MAX_REPORTS_PER_DAY - (reportLimit.get(limitKey)?.count || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 辅助函数：获取已有举报原因
async function getExistingReasons(nodeId: number): Promise<string[]> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { reportReasons: true }
  });
  if (node?.reportReasons) {
    try {
      const parsed = JSON.parse(node.reportReasons);
      return parsed.reasons || [];
    } catch {
      return [];
    }
  }
  return [];
}

export default router;
