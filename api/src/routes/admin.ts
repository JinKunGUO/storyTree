import { Router } from 'express';
import { prisma } from '../index';
import { createNotification } from './notifications';
import { verifyJWT } from '../utils/auth';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 管理员验证中间件
const requireAdmin = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isAdmin: true }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: '认证失败' });
  }
};

// 获取审核队列 - 需要管理员权限
router.get('/review-queue', requireAdmin, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取待审核的节点（PENDING状态）
    const pendingNodes = await prisma.node.findMany({
      where: { reviewStatus: 'PENDING' },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // 获取被举报但未处理的节点
    const reportedNodes = await prisma.node.findMany({
      where: {
        reportCount: { gt: 0 },
        reviewStatus: { not: 'HIDDEN' }
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      },
      orderBy: { reportCount: 'desc' }
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

// 审核操作 - 需要管理员权限
router.post('/review', requireAdmin, async (req, res) => {
  const userId = getUserId(req);
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

    const node = await prisma.node.update({
      where: { id: parseInt(nodeId) },
      data: {
        reviewStatus: newStatus,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNote: note || null
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
      node.authorId,
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

// 获取节点的举报详情 - 需要管理员权限
router.get('/reports/:nodeId', requireAdmin, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { nodeId } = req.params;

  try {
    const reports = await prisma.report.findMany({
      where: { nodeId: parseInt(nodeId) },
      include: {
        reporter: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ reports });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

export default router;
