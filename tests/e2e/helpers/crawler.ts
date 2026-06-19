import type { Page } from '@playwright/test';
import { PAGE_REGISTRY } from './page-registry';

/**
 * BFS 爬虫引擎
 *
 * 从指定起始 URL 出发，自动遍历所有可导航路径，收集：
 * - 已访问的 URL
 * - 发现的死链（4xx/5xx）
 * - JS 控制台错误
 * - 网络请求失败
 * - 覆盖率报告（已访问 vs 注册表总页面）
 */

export interface CrawlResult {
  /** 已成功访问的 URL */
  visited: Set<string>;
  /** 发现的死链 */
  deadLinks: DeadLink[];
  /** JS 错误 */
  jsErrors: JsError[];
  /** 网络失败 */
  networkFailures: NetworkFailure[];
  /** 覆盖率信息 */
  coverage: CoverageReport;
}

export interface DeadLink {
  url: string;
  status: number;
  foundOn: string;
}

export interface JsError {
  message: string;
  pageUrl: string;
}

export interface NetworkFailure {
  url: string;
  error: string;
  pageUrl: string;
}

export interface CoverageReport {
  totalPages: number;
  visitedPages: number;
  coveragePercent: number;
  missedPages: string[];
}

export interface CrawlerOptions {
  /** 最大爬取深度 */
  maxDepth?: number;
  /** 最大访问页面数 */
  maxPages?: number;
  /** 页面加载超时（ms） */
  timeout?: number;
  /** 是否包含外链检查 */
  checkExternalLinks?: boolean;
  /** 要排除的 URL 模式 */
  excludePatterns?: RegExp[];
}

const DEFAULT_OPTIONS: Required<CrawlerOptions> = {
  maxDepth: 5,
  maxPages: 100,
  timeout: 15000,
  checkExternalLinks: false,
  excludePatterns: [
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    /^(mailto|tel|javascript):/,
    /#$/,  // 纯锚点
    /logout/i,
    /api\//,  // 不爬取 API 端点
  ],
};

export class Crawler {
  private visited = new Set<string>();
  private queue: { url: string; depth: number; foundOn: string }[] = [];
  private deadLinks: DeadLink[] = [];
  private jsErrors: JsError[] = [];
  private networkFailures: NetworkFailure[] = [];
  private options: Required<CrawlerOptions>;
  private baseUrl: string;

  constructor(baseUrl: string, options: CrawlerOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 开始爬取
   */
  async crawl(page: Page, startUrl: string): Promise<CrawlResult> {
    this.queue.push({ url: this.normalizeUrl(startUrl), depth: 0, foundOn: 'start' });

    while (this.queue.length > 0 && this.visited.size < this.options.maxPages) {
      const item = this.queue.shift()!;
      if (this.visited.has(item.url)) continue;
      if (item.depth > this.options.maxDepth) continue;

      this.visited.add(item.url);
      await this.visitPage(page, item.url, item.depth, item.foundOn);
    }

    return {
      visited: this.visited,
      deadLinks: this.deadLinks,
      jsErrors: this.jsErrors,
      networkFailures: this.networkFailures,
      coverage: this.calculateCoverage(),
    };
  }

  private async visitPage(page: Page, url: string, depth: number, foundOn: string) {
    // 设置错误监听
    const pageErrors: string[] = [];
    const errorHandler = (err: Error) => pageErrors.push(err.message);
    const failHandler = (req: any) => {
      this.networkFailures.push({
        url: req.url(),
        error: req.failure()?.errorText || 'Unknown',
        pageUrl: url,
      });
    };

    page.on('pageerror', errorHandler);
    page.on('requestfailed', failHandler);

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout,
      });

      if (response) {
        const status = response.status();
        if (status >= 400) {
          this.deadLinks.push({ url, status, foundOn });
          return; // 不继续从错误页面提取链接
        }
      }

      // 等待页面稳定
      await page.waitForTimeout(500);

      // 收集 JS 错误
      for (const msg of pageErrors) {
        this.jsErrors.push({ message: msg, pageUrl: url });
      }

      // 提取页面内的链接
      const links = await this.extractLinks(page);
      for (const link of links) {
        const normalized = this.normalizeUrl(link);
        if (!this.visited.has(normalized) && this.shouldVisit(normalized)) {
          this.queue.push({ url: normalized, depth: depth + 1, foundOn: url });
        }
      }
    } catch (e) {
      // 超时或导航错误
      this.networkFailures.push({
        url,
        error: (e as Error).message,
        pageUrl: foundOn,
      });
    } finally {
      page.removeListener('pageerror', errorHandler);
      page.removeListener('requestfailed', failHandler);
    }
  }

  private async extractLinks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const links: string[] = [];
      // <a> 标签
      document.querySelectorAll('a[href]').forEach(el => {
        const href = (el as HTMLAnchorElement).href;
        if (href) links.push(href);
      });
      return links;
    });
  }

  private normalizeUrl(url: string): string {
    // 处理相对路径
    if (url.startsWith('/')) {
      url = `${this.baseUrl}${url}`;
    }
    // 移除 hash
    const hashIndex = url.indexOf('#');
    if (hashIndex > -1) {
      url = url.substring(0, hashIndex);
    }
    // 移除尾部斜杠
    return url.replace(/\/$/, '');
  }

  private shouldVisit(url: string): boolean {
    // 只爬取同域链接
    if (!url.startsWith(this.baseUrl)) return false;
    // 检查排除模式
    const path = url.replace(this.baseUrl, '');
    return !this.options.excludePatterns.some(pattern => pattern.test(path));
  }

  private calculateCoverage(): CoverageReport {
    const registeredPaths = PAGE_REGISTRY.map(p => p.path);
    const visitedPaths = [...this.visited].map(url => {
      const path = url.replace(this.baseUrl, '').split('?')[0];
      return path || '/';
    });

    const visitedSet = new Set(visitedPaths);
    const missedPages = registeredPaths.filter(p => {
      // 标准化比较
      const normalized = p === '/index.html' ? '/' : p;
      return !visitedSet.has(p) && !visitedSet.has(normalized);
    });

    return {
      totalPages: registeredPaths.length,
      visitedPages: registeredPaths.length - missedPages.length,
      coveragePercent: Math.round(((registeredPaths.length - missedPages.length) / registeredPaths.length) * 100),
      missedPages,
    };
  }
}
