import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const user_id = req.headers['x-user-id'];
  return user_id ? parseInt(user_id as string) : null;
};

// 创建通知的辅助函数
export async function createNotification(
  user_id: number,
  type: string,
  title: string,
  content: string,
  link?: string
) {
  try {
    await prisma.notifications.create({
      data: {
        user_id,
        type,
        title,
        content,
        link
      }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// 获取用户通知列表
router.get('/', async (req, res) => {
  const user_id = getUserId(req);
  if (!user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const notifications = await prisma.notifications.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    const unreadCount = await prisma.notifications.count({
      where: { user_id, is_read: false }
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 标记通知为已读
router.put('/:id/read', async (req, res) => {
  const user_id = getUserId(req);
  if (!user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    const notification = await prisma.notifications.findUnique({
      where: { id: parseInt(id) }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.user_id !== user_id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.notifications.update({
      where: { id: parseInt(id) },
      data: { is_read: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// 标记所有通知为已读
router.put('/read-all', async (req, res) => {
  const user_id = getUserId(req);
  if (!user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await prisma.notifications.updateMany({
      where: { user_id, is_read: false },
      data: { is_read: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// 删除通知
router.delete('/:id', async (req, res) => {
  const user_id = getUserId(req);
  if (!user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;

  try {
    const notification = await prisma.notifications.findUnique({
      where: { id: parseInt(id) }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.user_id !== user_id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.notifications.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;

