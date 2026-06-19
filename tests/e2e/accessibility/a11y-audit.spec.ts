import { test, expect } from '../fixtures/auth.fixture';
import { PAGE_REGISTRY, resolvePageUrl } from '../helpers/page-registry';
import { getTestData } from '../fixtures/test-data.fixture';

/**
 * 无障碍审计测试
 *
 * 使用 @axe-core/playwright 对所有页面进行 WCAG 2.1 AA 级别审计。
 * 报告违规项但不强制失败（作为建议性检查）。
 *
 * 依赖：npm install -D @axe-core/playwright
 */

// 动态导入 axe-core（如果未安装则跳过）
let AxeBuilder: any;
try {
  AxeBuilder = require('@axe-core/playwright').default;
} catch {
  // axe-core 未安装，测试将被跳过
}

// 选取不需要参数的页面进行审计
const AUDIT_PAGES = PAGE_REGISTRY.filter(p => !p.params && !p.admin);

test.describe('无障碍审计 (WCAG 2.1 AA)', () => {
  test.beforeEach(async () => {
    if (!AxeBuilder) {
      test.skip();
    }
  });

  // 公开页面审计
  for (const entry of AUDIT_PAGES.filter(p => !p.auth)) {
    test(`${entry.path} 无障碍检查`, async ({ guestPage }) => {
      if (!AxeBuilder) {
        test.skip();
        return;
      }

      await guestPage.goto(entry.path, { waitUntil: 'domcontentloaded' });
      await guestPage.waitForTimeout(2000);

      const results = await new AxeBuilder({ page: guestPage })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const violations = results.violations;
      const critical = violations.filter((v: any) => v.impact === 'critical' || v.impact === 'serious');

      // 报告所有违规
      if (violations.length > 0) {
        console.log(`\n[a11y] ${entry.path} - ${violations.length} violations:`);
        for (const v of violations.slice(0, 5)) {
          console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
        }
      }

      // 严重违规不应超过 5 个（逐步收紧）
      expect(
        critical.length,
        `${entry.path} has ${critical.length} critical/serious a11y violations`
      ).toBeLessThanOrEqual(5);
    });
  }

  // 认证页面审计
  for (const entry of AUDIT_PAGES.filter(p => p.auth)) {
    test(`${entry.path} 无障碍检查 (authenticated)`, async ({ authenticatedPage }) => {
      if (!AxeBuilder) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(entry.path, { waitUntil: 'domcontentloaded' });
      await authenticatedPage.waitForTimeout(2000);

      const results = await new AxeBuilder({ page: authenticatedPage })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const violations = results.violations;
      const critical = violations.filter((v: any) => v.impact === 'critical' || v.impact === 'serious');

      if (violations.length > 0) {
        console.log(`\n[a11y] ${entry.path} - ${violations.length} violations:`);
        for (const v of violations.slice(0, 5)) {
          console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
        }
      }

      expect(
        critical.length,
        `${entry.path} has ${critical.length} critical/serious a11y violations`
      ).toBeLessThanOrEqual(5);
    });
  }
});

test.describe('基础无障碍检查（无需 axe-core）', () => {
  test('所有图片有 alt 属性', async ({ guestPage }) => {
    await guestPage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForTimeout(2000);

    const imagesWithoutAlt = await guestPage.evaluate(() => {
      const images = document.querySelectorAll('img');
      const issues: string[] = [];
      images.forEach(img => {
        if (!img.alt && !img.getAttribute('role')?.includes('presentation')) {
          issues.push(img.src.split('/').pop() || 'unknown');
        }
      });
      return issues;
    });

    if (imagesWithoutAlt.length > 0) {
      console.warn(`[a11y] Images without alt: ${imagesWithoutAlt.join(', ')}`);
    }
  });

  test('表单元素有关联 label', async ({ guestPage }) => {
    await guestPage.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForTimeout(1000);

    const inputsWithoutLabel = await guestPage.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
      const issues: string[] = [];
      inputs.forEach(input => {
        const id = input.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const hasPlaceholder = input.getAttribute('placeholder');
        if (!hasLabel && !hasAriaLabel && !hasPlaceholder) {
          issues.push(`${input.tagName}#${id || 'no-id'} [type=${input.getAttribute('type')}]`);
        }
      });
      return issues;
    });

    if (inputsWithoutLabel.length > 0) {
      console.warn(`[a11y] Inputs without label: ${inputsWithoutLabel.join(', ')}`);
    }
  });

  test('页面有且仅有一个 h1', async ({ guestPage }) => {
    const pages = ['/index.html', '/discover.html', '/login.html', '/register.html'];

    for (const pagePath of pages) {
      await guestPage.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await guestPage.waitForTimeout(1000);

      const h1Count = await guestPage.locator('h1').count();
      if (h1Count !== 1) {
        console.warn(`[a11y] ${pagePath} has ${h1Count} h1 elements (expected 1)`);
      }
    }
  });
});
