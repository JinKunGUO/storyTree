import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';

// 获取用户ID
export const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 验证是否登录
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// 验证是否为管理员
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

