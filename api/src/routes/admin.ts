import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';
import { authenticateToken, requireAdmin } from '../utils/middleware';

const router = Router();

// 所有路由都需要管理员权限
router.use(authenticateToken, requireAdmin);

// 获取审核队列
router.get('/review-queue', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取待审核的节点（PENDING状态）
    const pendingNodes = await prisma.nodes.findMany({
      where: { review_status: 'PENDING' },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    // 获取被举报但未处理的节点
    const reportedNodes = await prisma.nodes.findMany({
      where: {
        report_count: { gt: 0 },
        review_status: { not: 'HIDDEN' }
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { report_count: 'desc' }
    });

    res.json({
      pending: pendingNodes,
      reported: reportedNodes,
      stats: {
        pendingCount: pendingNodes.length,
        reportedCount: reportedNodes.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

// 审核操作
router.post('/review', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeId, action, note } = req.body;

  if (!nodeId || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validActions = ['approve', 'reject', 'hide'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    let newStatus: 'APPROVED' | 'REJECTED' | 'HIDDEN';
    switch (action) {
      case 'approve':
        newStatus = 'APPROVED';
        break;
      case 'reject':
        newStatus = 'REJECTED';
        break;
      case 'hide':
        newStatus = 'HIDDEN';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const node = await prisma.nodes.update({
      where: { id: parseInt(nodeId) },
      data: {
        review_status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_note: note || null
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

    // 创建审核结果通知
    const statusText = {
      'APPROVED': '已通过',
      'REJECTED': '已驳回',
      'HIDDEN': '已下架'
    }[newStatus] || newStatus;

    await createNotification(
      node.author_id,
      'review',
      '内容审核结果',
      `您的内容《${node.title}》审核${statusText}${note ? `：${note}` : ''}`,
      `/node/${node.id}`
    );

    res.json({ node });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to review node' });
  }
});

// 获取节点的举报详情
router.get('/reports/:nodeId', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeId } = req.params;

  try {
    const reports = await prisma.reports.findMany({
      where: { node_id: parseInt(nodeId) },
      include: {
        reporter: {
          select: { id: true, username: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ reports });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

export default router;
