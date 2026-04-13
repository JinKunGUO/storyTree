import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from './auth';
import { prisma } from '../index';

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
 * 同时校验 active_token，确保同账号多端互踢：新登录会使旧端 token 失效
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // 方法1: 从Authorization header获取JWT token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式

  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      // 校验 active_token：查数据库确认此 token 仍是当前有效 token
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: { active_token: true }
      });

      if (!user || user.active_token !== token) {
        // token 已被新登录替换，返回特定错误码让前端处理（弹出重新登录提示）
        return res.status(401).json({
          error: '账号已在其他设备登录，请重新登录',
          code: 'TOKEN_REPLACED'
        });
      }

      req.userId = decoded.userId;
      req.username = decoded.username;
      req.isAdmin = decoded.isAdmin;
      return next();
    }
  }

  // 方法2: 从x-user-id header获取（仅用于本地开发/测试，生产环境应禁用）
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader && process.env.NODE_ENV !== 'production') {
    req.userId = parseInt(userIdHeader as string);
    return next();
  }

  // 未认证
  return res.status(401).json({ error: 'Not authenticated' });
}

/**
 * 可选认证中间件 - 如果有token则解析，没有也继续（不校验 active_token，避免影响公开接口性能）
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

