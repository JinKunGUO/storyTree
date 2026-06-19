import { test, expect } from '../fixtures/auth.fixture';
import { PAGE_REGISTRY, resolvePageUrl } from '../helpers/page-registry';
import { getTestData } from '../fixtures/test-data.fixture';

/**
 * 视觉回归测试
 *
 * 对关键页面在 PC 和 Mobile 视口下截取全页截图，与基线对比。
 * 首次运行生成基线，后续运行对比差异。
 *
 * 运行方式：
 *   npx playwright test tests/e2e/visual/                    # 对比
 *   npx playwright test tests/e2e/visual/ --update-snapshots # 更新基线
 */

// 选取核心页面做视觉回归（不是全部 28 页，避免维护成本过高）
const VISUAL_PAGES = PAGE_REGISTRY.filter(p =>
  ['public', 'auth-flow', 'commerce', 'static'].includes(p.category) && !p.params
);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
];

test.describe('视觉回归 - 公开页面', () => {
  for (const entry of VISUAL_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${entry.path} @ ${viewport.name}`, async ({ guestPage }) => {
        await guestPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await guestPage.goto(entry.path, { waitUntil: 'networkidle' });
        // 等待动画完成
        await guestPage.waitForTimeout(2000);

        // 隐藏动态内容（时间戳、计数器等）
        await guestPage.evaluate(() => {
          // 隐藏可能变化的元素
          document.querySelectorAll('[data-dynamic], .timestamp, .count, .badge-count').forEach(el => {
            (el as HTMLElement).style.visibility = 'hidden';
          });
        });

        // 截图对比
        const screenshotName = `${entry.path.replace(/[/.]/g, '-')}-${viewport.name}.png`;
        await expect(guestPage).toHaveScreenshot(screenshotName, {
          maxDiffPixelRatio: 0.02, // 允许 2% 像素差异
          fullPage: true,
          animations: 'disabled',
        });
      });
    }
  }
});

test.describe('视觉回归 - 认证页面', () => {
  // 只对不需要参数的认证页面做视觉回归
  const authVisualPages = PAGE_REGISTRY.filter(p =>
    p.auth && !p.admin && !p.params && ['user', 'creation'].includes(p.category)
  );

  for (const entry of authVisualPages) {
    test(`${entry.path} @ desktop (authenticated)`, async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize({ width: 1280, height: 720 });
      await authenticatedPage.goto(entry.path, { waitUntil: 'domcontentloaded' });
      await authenticatedPage.waitForTimeout(3000);

      // 隐藏动态内容
      await authenticatedPage.evaluate(() => {
        document.querySelectorAll('[data-dynamic], .timestamp, .count, .badge-count, .user-avatar').forEach(el => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
      });

      const screenshotName = `${entry.path.replace(/[/.]/g, '-')}-desktop-auth.png`;
      await expect(authenticatedPage).toHaveScreenshot(screenshotName, {
        maxDiffPixelRatio: 0.03, // 认证页面允许稍多差异（动态数据）
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
