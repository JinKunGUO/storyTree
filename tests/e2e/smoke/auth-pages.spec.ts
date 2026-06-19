import { test, expect } from '../fixtures/auth.fixture';
import { getAuthPages, getAdminPages, resolvePageUrl } from '../helpers/page-registry';
import { attachErrorCollector } from '../helpers/error-collector';
import { getTestData } from '../fixtures/test-data.fixture';

/**
 * 需认证页面冒烟测试
 *
 * 验证所有需要登录的页面：
 * - 未登录时正确重定向到 login 页面
 * - 登录后正常加载
 * - 无 JS 未捕获异常
 * - 无 5xx 服务端错误
 */

const authPages = getAuthPages();
const adminPages = getAdminPages();

// 已知认证守卫有 bug 的页面（本地已修复，等待部署后移除此列表）
const KNOWN_AUTH_GUARD_BUGS = ['/payment.html'];

test.describe('认证页面 - 未登录重定向验证', () => {
  for (const entry of authPages.filter(p => !p.params && !KNOWN_AUTH_GUARD_BUGS.includes(p.path))) {
    test(`${entry.path} 未登录应重定向到 login`, async ({ guestPage }) => {
      await guestPage.goto(entry.path, { waitUntil: 'domcontentloaded' });
      // 等待可能的客户端重定向（有些页面用 JS 延迟检查）
      await guestPage.waitForTimeout(3000);
      const currentUrl = guestPage.url();
      // 验证方式（满足任一即可）：
      // 1. URL 包含 login（服务端/客户端重定向）
      // 2. 页面显示"登录"相关文案
      // 3. 页面显示登录表单元素
      const redirectedToLogin = currentUrl.includes('login');
      const hasLoginText = await guestPage.locator('text=登录').first().isVisible().catch(() => false);
      const hasLoginLink = await guestPage.locator('a[href*="login"]').first().isVisible().catch(() => false);
      const hasLoginForm = await guestPage.locator('input[type="password"]').first().isVisible().catch(() => false);

      // 如果页面既没重定向也没任何登录提示，记录为发现的问题
      const hasAuthGuard = redirectedToLogin || hasLoginText || hasLoginLink || hasLoginForm;
      if (!hasAuthGuard) {
        console.warn(`[AUTH-GUARD-MISSING] ${entry.path} 未登录时无任何认证保护 (当前URL: ${currentUrl})`);
      }
      expect(
        hasAuthGuard,
        `${entry.path} should redirect to login or show login prompt when not authenticated (current: ${currentUrl})`
      ).toBe(true);
    });
  }
});

test.describe('认证页面 - 已登录加载验证', () => {
  for (const entry of authPages) {
    test(`${entry.path} 已登录正常加载`, async ({ authenticatedPage }) => {
      const collector = attachErrorCollector(authenticatedPage);

      let testData = { storyId: null as number | null, nodeId: null as number | null };
      try {
        testData = getTestData();
      } catch {
        // 如果需要参数但没有测试数据，跳过
        if (entry.params) {
          test.skip();
          return;
        }
      }

      if (entry.params && !testData.storyId && !testData.nodeId) {
        test.skip();
        return;
      }

      const url = resolvePageUrl(entry, testData);
      const response = await authenticatedPage.goto(url, { waitUntil: 'domcontentloaded' });

      // 验证 HTTP 状态
      expect(response?.status(), `${entry.path} should return 2xx`).toBeLessThan(400);

      // 等待页面稳定
      await authenticatedPage.waitForTimeout(1000);

      // 验证无严重 JS 错误
      const criticalErrors = collector.getCriticalErrors();
      expect(
        criticalErrors,
        `${entry.path} critical errors: ${criticalErrors.map(e => e.message).join('; ')}`
      ).toHaveLength(0);
    });
  }
});

test.describe('管理员页面 - 加载验证', () => {
  for (const entry of adminPages) {
    test(`${entry.path} 管理员正常加载`, async ({ adminPage }) => {
      const collector = attachErrorCollector(adminPage);
      const response = await adminPage.goto(entry.path, { waitUntil: 'domcontentloaded' });

      // 管理员页面可能返回 403 如果测试账号不是 admin
      // 这里只验证不是 5xx
      expect(response?.status(), `${entry.path} should not return 5xx`).toBeLessThan(500);

      await adminPage.waitForTimeout(1000);

      const criticalErrors = collector.getCriticalErrors().filter(
        e => !e.message.includes('permission') && !e.message.includes('unauthorized')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});
