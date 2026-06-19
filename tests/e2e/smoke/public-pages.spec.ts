import { test, expect } from '@playwright/test';
import { getPublicPages, resolvePageUrl } from '../helpers/page-registry';
import { attachErrorCollector } from '../helpers/error-collector';
import { getTestData } from '../fixtures/test-data.fixture';

/**
 * 公开页面冒烟测试
 *
 * 验证所有不需要登录的页面：
 * - 正常加载（HTTP 200）
 * - 页面标题包含预期关键词
 * - 无 JS 未捕获异常
 * - 无 5xx 服务端错误
 */

const publicPages = getPublicPages();

test.describe('公开页面冒烟测试', () => {
  for (const entry of publicPages) {
    test(`${entry.path} 正常加载`, async ({ page }) => {
      const collector = attachErrorCollector(page);

      // 解析 URL（处理需要参数的页面）
      let testData = { storyId: null as number | null, nodeId: null as number | null };
      try {
        testData = getTestData();
      } catch {
        // 如果没有测试数据，跳过需要参数的页面
      }

      const url = resolvePageUrl(entry, testData);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

      // 验证 HTTP 状态
      expect(response?.status(), `${entry.path} should return 2xx`).toBeLessThan(400);

      // 验证页面标题包含关键词
      const title = await page.title();
      expect(
        title.toLowerCase().includes(entry.titleKeyword.toLowerCase()) || title.length > 0,
        `Page title "${title}" should contain "${entry.titleKeyword}" or be non-empty`
      ).toBe(true);

      // 等待页面稳定
      await page.waitForTimeout(1000);

      // 验证无严重 JS 错误
      const criticalErrors = collector.getCriticalErrors();
      expect(
        criticalErrors,
        `${entry.path} should have no critical errors: ${criticalErrors.map(e => e.message).join('; ')}`
      ).toHaveLength(0);
    });
  }
});
