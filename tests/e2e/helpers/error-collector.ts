import type { Page } from '@playwright/test';

/**
 * 错误收集器
 *
 * 在每个页面加载时自动收集：
 * - 未捕获的 JS 异常 (pageerror)
 * - console.error 日志
 * - 网络请求失败
 * - 4xx/5xx 响应
 */

export interface CollectedError {
  type: 'js-error' | 'console-error' | 'network-failure' | 'http-error';
  message: string;
  url?: string;
  status?: number;
  timestamp: number;
}

export class ErrorCollector {
  errors: CollectedError[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.attach();
  }

  private attach() {
    // 未捕获 JS 异常
    this.page.on('pageerror', (error) => {
      this.errors.push({
        type: 'js-error',
        message: error.message,
        timestamp: Date.now(),
      });
    });

    // console.error
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // 过滤掉常见的无害错误
        if (this.isIgnoredConsoleError(text)) return;
        this.errors.push({
          type: 'console-error',
          message: text,
          timestamp: Date.now(),
        });
      }
    });

    // 网络请求失败（DNS/连接/超时）
    this.page.on('requestfailed', (request) => {
      const failure = request.failure();
      this.errors.push({
        type: 'network-failure',
        message: failure?.errorText || 'Unknown network error',
        url: request.url(),
        timestamp: Date.now(),
      });
    });

    // HTTP 4xx/5xx 响应
    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const url = response.url();
        // 过滤掉预期的 401（未登录页面）和 favicon
        if (this.isIgnoredHttpError(url, status)) return;
        this.errors.push({
          type: 'http-error',
          message: `HTTP ${status}`,
          url,
          status,
          timestamp: Date.now(),
        });
      }
    });
  }

  private isIgnoredConsoleError(text: string): boolean {
    const ignored = [
      'Failed to load resource',  // 已被 response handler 捕获
      'net::ERR_',                // 已被 requestfailed 捕获
      'favicon.ico',              // favicon 缺失不影响功能
      'ResizeObserver',           // 常见无害警告
    ];
    return ignored.some(pattern => text.includes(pattern));
  }

  private isIgnoredHttpError(url: string, status: number): boolean {
    // 未登录时的 401 是预期行为
    if (status === 401 && url.includes('/api/')) return true;
    // favicon 404
    if (status === 404 && url.includes('favicon')) return true;
    // 健康检查
    if (url.includes('/api/health')) return true;
    return false;
  }

  /**
   * 获取严重错误（JS 异常 + 5xx）
   */
  getCriticalErrors(): CollectedError[] {
    return this.errors.filter(e =>
      e.type === 'js-error' || (e.type === 'http-error' && (e.status || 0) >= 500)
    );
  }

  /**
   * 获取所有错误
   */
  getAllErrors(): CollectedError[] {
    return [...this.errors];
  }

  /**
   * 重置收集器
   */
  reset() {
    this.errors = [];
  }

  /**
   * 生成错误摘要
   */
  getSummary(): string {
    if (this.errors.length === 0) return 'No errors collected';
    const grouped = {
      'js-error': 0,
      'console-error': 0,
      'network-failure': 0,
      'http-error': 0,
    };
    for (const e of this.errors) {
      grouped[e.type]++;
    }
    return Object.entries(grouped)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
  }
}

/**
 * 快捷函数：为页面创建错误收集器
 */
export function attachErrorCollector(page: Page): ErrorCollector {
  return new ErrorCollector(page);
}
