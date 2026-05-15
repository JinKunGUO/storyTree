/**
 * 豆瓣读书 API 封装
 * 用于搜索和获取图书信息
 */

const DOUBAN_API_BASE = 'https://api.douban.com/v2/book';
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY || '';

// 限流配置
const RATE_LIMIT = {
  maxRequests: 50, // 每小时最多 50 次请求
  windowMs: 60 * 60 * 1000, // 1 小时
};

// 请求记录
const requestLog: { timestamp: number }[] = [];

/**
 * 检查是否超过限流
 */
function checkRateLimit(): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();

  // 清理过期记录
  while (requestLog.length > 0 && now - requestLog[0].timestamp > RATE_LIMIT.windowMs) {
    requestLog.shift();
  }

  if (requestLog.length >= RATE_LIMIT.maxRequests) {
    const oldestRequest = requestLog[0].timestamp;
    const remainingSeconds = Math.ceil((RATE_LIMIT.windowMs - (now - oldestRequest)) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true };
}

/**
 * 记录请求
 */
function recordRequest() {
  requestLog.push({ timestamp: Date.now() });
}

export interface DoubanBook {
  id: string;
  title: string;
  subtitle?: string;
  author: string[];
  publisher: string;
  pubdate: string;
  pages: number;
  price: string;
  isbn13: string;
  summary: string;
  image: string;
  rating: {
    average: number;
    numRaters: number;
  };
  tags: Array<{ name: string }>;
}

/**
 * 搜索图书
 */
export async function searchBooks(query: string, start = 0, count = 10): Promise<DoubanBook[]> {
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`豆瓣 API 调用频率过高，请${rateLimit.remainingSeconds}秒后再试`);
  }

  try {
    const url = `${DOUBAN_API_BASE}/search?q=${encodeURIComponent(query)}&start=${start}&count=${count}&apikey=${DOUBAN_API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    recordRequest();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆瓣 API 请求失败：${response.status} ${errorText}`);
    }

    const data = await response.json() as { books?: any[] };
    return (data.books || []) as DoubanBook[];
  } catch (error) {
    console.error('豆瓣搜索失败:', error);
    throw error;
  }
}

/**
 * 根据 ISBN 获取图书详情
 */
export async function getBookByIsbn(isbn: string): Promise<DoubanBook> {
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`豆瓣 API 调用频率过高，请${rateLimit.remainingSeconds}秒后再试`);
  }

  try {
    const url = `${DOUBAN_API_BASE}/isbn/${isbn}?apikey=${DOUBAN_API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    recordRequest();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆瓣 API 请求失败：${response.status} ${errorText}`);
    }

    return await response.json() as DoubanBook;
  } catch (error) {
    console.error('获取图书详情失败:', error);
    throw error;
  }
}

/**
 * 根据 ID 获取图书详情
 */
export async function getBookById(id: string): Promise<DoubanBook> {
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`豆瓣 API 调用频率过高，请${rateLimit.remainingSeconds}秒后再试`);
  }

  try {
    const url = `${DOUBAN_API_BASE}/${id}?apikey=${DOUBAN_API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    recordRequest();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆瓣 API 请求失败：${response.status} ${errorText}`);
    }

    return await response.json() as DoubanBook;
  } catch (error) {
    console.error('获取图书详情失败:', error);
    throw error;
  }
}

/**
 * 获取豆瓣 API 调用状态
 */
export function getApiStatus() {
  const now = Date.now();
  const recentRequests = requestLog.filter(r => now - r.timestamp < RATE_LIMIT.windowMs).length;

  return {
    remaining: RATE_LIMIT.maxRequests - recentRequests,
    limit: RATE_LIMIT.maxRequests,
    windowMs: RATE_LIMIT.windowMs,
    resetIn: recentRequests > 0
      ? Math.max(0, RATE_LIMIT.windowMs - (now - requestLog[0].timestamp))
      : 0
  };
}