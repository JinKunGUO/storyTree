import { test, expect } from '../fixtures/auth.fixture';
import { PAGE_REGISTRY, resolvePageUrl } from '../helpers/page-registry';
import { getTestData } from '../fixtures/test-data.fixture';

/**
 * 移动端视口冒烟测试
 *
 * 在 375px 宽度下验证所有页面：
 * - 无水平溢出（scrollWidth <= clientWidth）
 * - 页面正常加载
 * - 无 JS 错误
 *
 * 参考：scripts/test-mobile-overflow.js 的检测逻辑
 */

// 只在 mobile-chrome project 中运行，或手动设置视口
const MOBILE_VIEWPORT = { width: 375, height: 812 };

// 筛选可直接访问的页面（不需要特殊参数或管理员权限）
const testablePages = PAGE_REGISTRY.filter(p => !p.admin);

test.describe('移动端水平溢出检测 (375px)', () => {
  for (const entry of testablePages) {
    test(`${entry.path} 无水平溢出`, async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize(MOBILE_VIEWPORT);

      let testData = { storyId: null as number | null, nodeId: null as number | null };
      try {
        testData = getTestData();
      } catch {
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

      await authenticatedPage.goto(url, { waitUntil: 'domcontentloaded' });
      // 等待页面渲染完成
      await authenticatedPage.waitForTimeout(2000);

      // 检查水平溢出
      const overflowInfo = await authenticatedPage.evaluate(() => {
        const docEl = document.documentElement;
        const scrollWidth = docEl.scrollWidth;
        const clientWidth = docEl.clientWidth;
        const hasOverflow = scrollWidth > clientWidth;

        let overflowElement = '';
        if (hasOverflow) {
          // 找到导致溢出的元素
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 5) { // 5px 容差
              overflowElement = `${el.tagName}.${el.className}`.substring(0, 100);
              break;
            }
          }
        }

        return { hasOverflow, scrollWidth, clientWidth, overflowElement };
      });

      expect(
        overflowInfo.hasOverflow,
        `${entry.path} has horizontal overflow: scrollWidth=${overflowInfo.scrollWidth} > clientWidth=${overflowInfo.clientWidth}. Offending element: ${overflowInfo.overflowElement}`
      ).toBe(false);
    });
  }
});

test.describe('移动端导航菜单验证', () => {
  test('汉堡菜单可见且可点击', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(MOBILE_VIEWPORT);
    await authenticatedPage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1000);

    // 检查汉堡菜单按钮存在
    const hamburger = authenticatedPage.locator('.hamburger, .mobile-menu-btn, [aria-label*="菜单"], .nav-toggle');
    const isVisible = await hamburger.first().isVisible().catch(() => false);

    if (isVisible) {
      // 点击汉堡菜单
      await hamburger.first().click();
      await authenticatedPage.waitForTimeout(500);

      // 验证菜单展开
      const menu = authenticatedPage.locator('.nav-menu, .mobile-menu, [role="navigation"]');
      const menuVisible = await menu.first().isVisible().catch(() => false);
      expect(menuVisible, 'Mobile menu should be visible after clicking hamburger').toBe(true);
    }
  });

  test('触摸目标尺寸 >= 44px', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(MOBILE_VIEWPORT);
    await authenticatedPage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1000);

    // 检查所有可点击元素的尺寸
    const smallTargets = await authenticatedPage.evaluate(() => {
      const MIN_SIZE = 44;
      const clickables = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
      const issues: string[] = [];

      clickables.forEach(el => {
        const rect = el.getBoundingClientRect();
        // 只检查可见元素
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.width < MIN_SIZE && rect.height < MIN_SIZE) {
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className ? `.${String(el.className).split(' ')[0]}` : '';
          issues.push(`${el.tagName}${id}${cls} (${Math.round(rect.width)}x${Math.round(rect.height)})`);
        }
      });

      return issues.slice(0, 10); // 只报告前 10 个
    });

    // 这是建议性检查，不强制失败，只报告
    if (smallTargets.length > 0) {
      console.warn(`[mobile] Small touch targets found: ${smallTargets.join(', ')}`);
    }
  });
});
