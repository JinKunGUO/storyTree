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

// 开发模式认证开关
const ENABLE_DEV_AUTH = process.env.ENABLE_DEV_AUTH === 'true' && process.env.NODE_ENV !== 'production';

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

      // active_token 为 null 或空字符串时兼容旧会话（字段刚加入，已有 token 尚未写入）
      // 只有当 active_token 有值且与当前 token 不匹配时，才判定为被顶替
      if (!user || (!!user.active_token && user.active_token !== token)) {
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

  // 方法2: 从x-user-id header获取（仅用于本地开发/测试，需要显式开启 ENABLE_DEV_AUTH=true）
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader && ENABLE_DEV_AUTH) {
    console.warn(`⚠️  开发模式认证: x-user-id=${userIdHeader}`);
    req.userId = parseInt(userIdHeader as string);
    return next();
  }

  // 未认证
  return res.status(401).json({ error: 'Not authenticated' });
}

/**
 * 可选认证中间件 - 如果有token则解析，没有也继续（校验 active_token，确保被踢出用户无法访问）
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // 方法1: 从Authorization header获取JWT token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      // 校验 active_token：查数据库确认此 token 仍是当前有效 token
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: { active_token: true, isBanned: true }
      });

      // 只有通过 active_token 校验且账号未被封禁才设置用户信息
      if (user &&
          (!user.active_token || user.active_token === token) &&
          !user.isBanned) {
        req.userId = decoded.userId;
        req.username = decoded.username;
        req.isAdmin = decoded.isAdmin;
      }
      // 如果 active_token 不匹配或账号被封禁，静默忽略（相当于未登录）
    }
  }

  // 方法2: 从x-user-id header获取（仅用于本地开发/测试，需要显式开启 ENABLE_DEV_AUTH=true）
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader && !req.userId && ENABLE_DEV_AUTH) {
    console.warn(`⚠️  开发模式认证: x-user-id=${userIdHeader}`);
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

/**
 * 安全解析整数
 * 解决 parseInt 缺少边界检查的问题
 * @param value - 待解析的值
 * @param defaultValue - 解析失败时的默认值
 * @param min - 最小值限制（可选）
 * @param max - 最大值限制（可选）
 * @returns 解析后的安全整数
 */
export function safeParseInt(
  value: string | number | undefined | null,
  defaultValue: number = 0,
  min?: number,
  max?: number
): number {
  // 处理空值
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // 转换为字符串并去除空白
  const strValue = String(value).trim();

  // 处理空字符串
  if (strValue === '') {
    return defaultValue;
  }

  // 使用 parseInt 解析
  const parsed = parseInt(strValue, 10);

  // 检查是否为有效数字
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  // 检查是否超出安全整数范围
  if (parsed < Number.MIN_SAFE_INTEGER || parsed > Number.MAX_SAFE_INTEGER) {
    return defaultValue;
  }

  // 应用最小值限制
  if (min !== undefined && parsed < min) {
    return min;
  }

  // 应用最大值限制
  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
}

/**
 * 安全解析正整数（用于ID类参数）
 * @param value - 待解析的值
 * @param defaultValue - 解析失败时的默认值
 * @returns 解析后的正整数（最小为1）
 */
export function safeParseId(value: string | number | undefined | null, defaultValue: number = 1): number {
  return safeParseInt(value, defaultValue, 1);
}

/**
 * 安全解析分页参数
 * @param value - 待解析的值
 * @param defaultValue - 默认值
 * @param max - 最大值限制（防止过大查询）
 * @returns 解析后的正整数
 */
export function safeParsePage(
  value: string | number | undefined | null,
  defaultValue: number = 1,
  max: number = 1000
): number {
  return safeParseInt(value, defaultValue, 1, max);
}

/**
 * 安全解析分页大小
 * @param value - 待解析的值
 * @param defaultValue - 默认值
 * @param max - 最大限制（通常50或100）
 * @returns 解析后的正整数
 */
export function safeParsePageSize(
  value: string | number | undefined | null,
  defaultValue: number = 20,
  max: number = 100
): number {
  return safeParseInt(value, defaultValue, 1, max);
}

