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
      `/chapter?id=${node.id}`
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

// 批量审核
router.post('/review-batch', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeIds, action, note } = req.body;

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    return res.status(400).json({ error: '需要提供节点 ID 列表' });
  }

  if (nodeIds.length > 50) {
    return res.status(400).json({ error: '单次批量操作最多 50 条' });
  }

  const validActions = ['approve', 'reject', 'hide'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const statusMap: Record<string, string> = {
      approve: 'APPROVED',
      reject: 'REJECTED',
      hide: 'HIDDEN'
    };
    const newStatus = statusMap[action];

    // 批量更新
    const result = await prisma.nodes.updateMany({
      where: { id: { in: nodeIds.map((id: any) => parseInt(id)) } },
      data: {
        review_status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date(),
        review_note: note || `批量${action === 'approve' ? '通过' : action === 'reject' ? '驳回' : '下架'}`
      }
    });

    // 批量发送通知
    const nodes = await prisma.nodes.findMany({
      where: { id: { in: nodeIds.map((id: any) => parseInt(id)) } },
      select: { id: true, author_id: true, title: true }
    });

    const statusText: Record<string, string> = {
      APPROVED: '已通过',
      REJECTED: '已驳回',
      HIDDEN: '已下架'
    };

    for (const node of nodes) {
      await createNotification(
        node.author_id,
        'review',
        '内容审核结果',
        `您的内容《${node.title}》审核${statusText[newStatus]}${note ? `：${note}` : ''}`,
        `/chapter?id=${node.id}`
      );
    }

    res.json({
      success: true,
      updatedCount: result.count,
      action: newStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Batch review failed' });
  }
});

// AI 预审标签：对审核队列中的内容进行自动扫描分类
router.get('/review-queue/labels', async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { scanSensitiveWords } = await import('../utils/sensitiveWords');

    // 获取待审核内容
    const pendingNodes = await prisma.nodes.findMany({
      where: { review_status: 'PENDING' },
      select: {
        id: true,
        title: true,
        content: true,
        report_count: true,
        author: { select: { id: true, username: true } }
      },
      orderBy: { created_at: 'asc' },
      take: 100
    });

    // 为每个节点生成 AI 预审标签
    const labeled = pendingNodes.map(node => {
      const scanResult = scanSensitiveWords(node.content || '');
      const titleScan = scanSensitiveWords(node.title || '');

      let label = '待审核';
      let priority = 0; // 0=普通, 1=优先, 2=紧急

      if (scanResult.severity === 'high' || titleScan.severity === 'high') {
        label = '疑似严重违规';
        priority = 2;
      } else if (scanResult.severity === 'medium') {
        label = '疑似暴力内容';
        priority = 1;
      } else if (scanResult.severity === 'low') {
        label = '疑似广告/垃圾';
        priority = 1;
      } else if (node.report_count > 0) {
        label = `用户举报(${node.report_count}次)`;
        priority = node.report_count >= 3 ? 2 : 1;
      } else {
        label = '新用户首发';
        priority = 0;
      }

      return {
        id: node.id,
        title: node.title,
        author: node.author,
        label,
        priority,
        sensitiveWords: scanResult.words.slice(0, 5),
        categories: scanResult.categories,
        reportCount: node.report_count
      };
    });

    // 按优先级排序
    labeled.sort((a, b) => b.priority - a.priority);

    res.json({
      items: labeled,
      stats: {
        total: labeled.length,
        urgent: labeled.filter(l => l.priority === 2).length,
        priority: labeled.filter(l => l.priority === 1).length,
        normal: labeled.filter(l => l.priority === 0).length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate labels' });
  }
});

export default router;
