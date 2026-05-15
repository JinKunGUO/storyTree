/**
 * 维基百科 API 封装
 * 用于搜索和获取作品内容信息
 */

const WIKIPEDIA_API_BASE = 'https://zh.wikipedia.org/w/api.php';

// 限流配置
const RATE_LIMIT = {
  maxRequests: 100, // 每小时最多 100 次请求
  windowMs: 60 * 60 * 1000, // 1 小时
};

const requestLog: { timestamp: number }[] = [];

function checkRateLimit(): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
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

function recordRequest() {
  requestLog.push({ timestamp: Date.now() });
}

export interface WikipediaSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface WikipediaPage {
  title: string;
  extract: string;
  url: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

/**
 * 搜索维基百科
 */
export async function searchWikipedia(query: string, limit = 10): Promise<WikipediaSearchResult[]> {
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`维基百科 API 调用频率过高，请${rateLimit.remainingSeconds}秒后再试`);
  }

  try {
    const url = `${WIKIPEDIA_API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    recordRequest();

    if (!response.ok) {
      throw new Error(`维基百科 API 请求失败：${response.status}`);
    }

    const data = await response.json() as { query?: { search?: any[] } };
    return (data.query?.search || []).map((item: any) => ({
      title: item.title,
      snippet: item.snippet.replace(/<[^>]*>/g, ''), // 移除 HTML 标签
      url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
    }));
  } catch (error) {
    console.error('维基百科搜索失败:', error);
    throw error;
  }
}

/**
 * 获取页面内容
 */
export async function getWikipediaPage(title: string): Promise<WikipediaPage | null> {
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    throw new Error(`维基百科 API 调用频率过高，请${rateLimit.remainingSeconds}秒后再试`);
  }

  try {
    const url = `${WIKIPEDIA_API_BASE}?action=query&prop=extracts|pageimages&exintro=&explaintext=&piprop=original&titles=${encodeURIComponent(title)}&format=json&origin=*`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    recordRequest();

    if (!response.ok) {
      throw new Error(`维基百科 API 请求失败：${response.status}`);
    }

    const data = await response.json() as { query?: { pages?: Record<string, any> } };
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];

    if (pageId === '-1') {
      return null; // 页面不存在
    }

    const page = pages[pageId];
    return {
      title: page.title,
      extract: page.extract || '',
      url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      thumbnail: page.original
    };
  } catch (error) {
    console.error('获取维基百科页面失败:', error);
    throw error;
  }
}

/**
 * 获取 API 状态
 */
export function getApiStatus() {
  const now = Date.now();
  const recentRequests = requestLog.filter(r => now - r.timestamp < RATE_LIMIT.windowMs).length;

  return {
    remaining: RATE_LIMIT.maxRequests - recentRequests,
    limit: RATE_LIMIT.maxRequests,
    windowMs: RATE_LIMIT.windowMs
  };
}