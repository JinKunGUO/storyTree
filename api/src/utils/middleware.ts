import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from './auth';

// 扩展Request类型以包含userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      username?: string;
      isAdmin?: boolean;
    }
  }
}

/**
 * 认证中间件 - 从Authorization header或x-user-id header获取用户信息
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // 方法1: 从Authorization header获取JWT token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式

  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.username = decoded.username;
      req.isAdmin = decoded.isAdmin;
      return next();
    }
  }

  // 方法2: 从x-user-id header获取（用于开发/测试）
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader) {
    req.userId = parseInt(userIdHeader as string);
    return next();
  }

  // 未认证
  return res.status(401).json({ error: 'Not authenticated' });
}

/**
 * 可选认证中间件 - 如果有token则解析，没有也继续
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // 方法1: 从Authorization header获取JWT token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.username = decoded.username;
      req.isAdmin = decoded.isAdmin;
    }
  }

  // 方法2: 从x-user-id header获取
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader && !req.userId) {
    req.userId = parseInt(userIdHeader as string);
  }

  next();
}

/**
 * 管理员权限中间件
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}

/**
 * 辅助函数 - 从请求中获取用户ID
 */
export function getUserId(req: Request): number | null {
  return req.userId || null;
}

