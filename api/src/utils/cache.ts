/**
 * Redis 缓存模块
 * 
 * 提供热点数据缓存、会话管理、频率限制等功能
 */

import Redis from 'ioredis';

// Redis 客户端实例（延迟初始化）
let redisClient: Redis | null = null;

// 是否启用 Redis（未配置时降级为内存缓存）
let redisEnabled = false;

// 内存缓存（Redis 不可用时的降级方案）
const memoryCache = new Map<string, { value: string; expireAt: number }>();

/**
 * 获取 Redis 客户端实例
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('⚠️ REDIS_URL 未配置，使用内存缓存作为降级方案');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // 连接重试策略：指数退避
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNREFUSED'];
        return targetErrors.some(e => err.message.includes(e));
      },
    } as any);

    redisClient.on('connect', () => {
      console.log('✅ Redis 连接成功');
      redisEnabled = true;
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis 连接错误:', err.message);
      redisEnabled = false;
    });

    redisClient.on('close', () => {
      console.log('⚠️ Redis 连接关闭');
      redisEnabled = false;
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Redis 初始化失败:', error);
    return null;
  }
}

/**
 * 检查 Redis 是否可用
 */
export function isRedisAvailable(): boolean {
  return redisEnabled && redisClient !== null;
}

// ===== 缓存操作 =====

/**
 * 设置缓存
 * 
 * @param key - 缓存键
 * @param value - 缓存值（会被 JSON 序列化）
 * @param ttlSeconds - 过期时间（秒），默认 1 小时
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
  const serialized = JSON.stringify(value);

  if (isRedisAvailable() && redisClient) {
    await redisClient.setex(key, ttlSeconds, serialized);
  } else {
    // 内存缓存降级
    memoryCache.set(key, {
      value: serialized,
      expireAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

/**
 * 获取缓存
 * 
 * @param key - 缓存键
 * @returns 缓存值，不存在返回 null
 */
export async function getCache<T>(key: string): Promise<T | null> {
  let serialized: string | null = null;

  if (isRedisAvailable() && redisClient) {
    serialized = await redisClient.get(key);
  } else {
    // 内存缓存降级
    const cached = memoryCache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      serialized = cached.value;
    } else if (cached) {
      memoryCache.delete(key);
    }
  }

  if (!serialized) return null;

  try {
    return JSON.parse(serialized) as T;
  } catch {
    return null;
  }
}

/**
 * 删除缓存
 * 
 * @param key - 缓存键
 */
export async function deleteCache(key: string): Promise<void> {
  if (isRedisAvailable() && redisClient) {
    await redisClient.del(key);
  } else {
    memoryCache.delete(key);
  }
}

/**
 * 批量删除缓存（支持通配符）
 * 
 * @param pattern - 键模式，如 "node:*"
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (isRedisAvailable() && redisClient) {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } else {
    // 内存缓存降级：遍历删除匹配的键
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  }
}

// ===== 缓存键生成器 =====

export const CacheKeys = {
  // 章节缓存
  node: (nodeId: number) => `node:${nodeId}`,
  nodeContent: (nodeId: number) => `node:content:${nodeId}`,
  
  // 故事缓存
  story: (storyId: number) => `story:${storyId}`,
  storyNodes: (storyId: number) => `story:nodes:${storyId}`,
  
  // 用户缓存
  user: (userId: number) => `user:${userId}`,
  userProfile: (userId: number) => `user:profile:${userId}`,
  
  // 热门数据缓存
  hotStories: () => 'hot:stories',
  hotNodes: () => 'hot:nodes',
  
  // 统计数据缓存
  platformStats: () => 'stats:platform',
  storyStats: (storyId: number) => `stats:story:${storyId}`,
  
  // 频率限制
  rateLimit: (ip: string, action: string) => `rate:${action}:${ip}`,
};

// ===== 高级缓存操作 =====

/**
 * 带缓存的数据获取
 * 
 * @param key - 缓存键
 * @param fetcher - 数据获取函数（缓存未命中时调用）
 * @param ttlSeconds - 缓存过期时间（秒）
 * @returns 数据
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // 先尝试从缓存获取
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 缓存未命中，执行数据获取
  const data = await fetcher();

  // 写入缓存
  await setCache(key, data, ttlSeconds);

  return data;
}

/**
 * 频率限制检查
 * 
 * @param key - 限制键（通常包含 IP 或用户 ID）
 * @param maxRequests - 时间窗口内最大请求数
 * @param windowSeconds - 时间窗口（秒）
 * @returns 是否允许请求
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (isRedisAvailable() && redisClient) {
    const current = await redisClient.incr(key);
    
    if (current === 1) {
      // 第一次请求，设置过期时间
      await redisClient.expire(key, windowSeconds);
    }

    const ttl = await redisClient.ttl(key);
    
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } else {
    // 内存降级：简单计数
    const cached = memoryCache.get(key);
    const now = Date.now();
    
    if (!cached || cached.expireAt < now) {
      memoryCache.set(key, {
        value: '1',
        expireAt: now + windowSeconds * 1000,
      });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds };
    }

    const current = parseInt(cached.value, 10) + 1;
    cached.value = current.toString();
    
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetIn: Math.ceil((cached.expireAt - now) / 1000),
    };
  }
}

// ===== 初始化 =====

/**
 * 初始化 Redis 连接
 */
export async function initRedis(): Promise<void> {
  const client = getRedisClient();
  if (client) {
    try {
      await client.connect();
    } catch (error) {
      // 连接失败不阻塞应用启动
      console.warn('⚠️ Redis 连接失败，使用内存缓存');
    }
  }
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisEnabled = false;
  }
}

// 清理过期的内存缓存（每分钟执行一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expireAt < now) {
      memoryCache.delete(key);
    }
  }
}, 60 * 1000);

