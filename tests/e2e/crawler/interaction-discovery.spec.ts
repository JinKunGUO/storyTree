import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';

/** 关闭 driver.js 引导遮罩层（如果存在） */
async function dismissDriverOverlay(page: Page) {
  const overlay = page.locator('.driver-overlay, .driver-popover');
  if (await overlay.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    const skipBtn = page.locator('.driver-popover-close-btn, button:has-text("跳过"), button:has-text("关闭"), button:has-text("知道了")');
    if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await skipBtn.first().click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    for (let i = 0; i < 10; i++) {
      if (!await overlay.first().isVisible({ timeout: 300 }).catch(() => false)) break;
      const nextBtn = page.locator('.driver-popover-next-btn, .driver-popover-close-btn');
      if (await nextBtn.first().isVisible({ timeout: 300 }).catch(() => false)) {
        await nextBtn.first().click();
        await page.waitForTimeout(200);
      } else {
        await page.keyboard.press('Escape');
        break;
      }
    }
  }
}

/**
 * 交互发现测试
 *
 * 模拟真实用户点击页面上的按钮和交互元素：
 * - 发现点击后的 JS 错误
 * - 验证弹窗/模态框正常打开
 * - 检测表单提交是否有未处理异常
 */

test.describe('首页交互发现', () => {
  test('首页所有可见按钮点击无 JS 错误', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/index.html', { waitUntil: 'networkidle' });
    await authenticatedPage.waitForTimeout(1000);

    // 获取所有可见按钮
    const buttons = authenticatedPage.locator('button:visible, [role="button"]:visible');
    const count = await buttons.count();
    console.log(`[index] Found ${count} visible buttons`);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent().catch(() => '');
      // 跳过危险按钮（退出、删除等）
      if (/退出|删除|注销|logout/i.test(text || '')) continue;

      try {
        await button.click({ timeout: 3000 });
        await authenticatedPage.waitForTimeout(500);
      } catch {
        // 点击失败（可能被遮挡），跳过
      }
    }

    // 验证无 JS 异常
    const jsErrors = collector.errors.filter(e => e.type === 'js-error');
    expect(
      jsErrors,
      `Button clicks caused JS errors: ${jsErrors.map(e => e.message).join('; ')}`
    ).toHaveLength(0);
  });
});

test.describe('发现页交互发现', () => {
  test('搜索框输入和提交无异常', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1000);

    // 找到搜索输入框
    const searchInput = authenticatedPage.locator('input[type="search"], input[type="text"][placeholder*="搜索"], input[name*="search"], .search-input');
    const hasSearch = await searchInput.first().isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.first().fill('测试故事');
      await authenticatedPage.waitForTimeout(500);

      // 尝试提交搜索
      await searchInput.first().press('Enter');
      await authenticatedPage.waitForTimeout(2000);

      // 验证无 JS 异常
      const jsErrors = collector.errors.filter(e => e.type === 'js-error');
      expect(jsErrors).toHaveLength(0);
    }
  });

  test('标签筛选点击无异常', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1000);

    // 找到标签/筛选按钮
    const tags = authenticatedPage.locator('.tag, .filter-tag, [data-tag], .category-btn');
    const tagCount = await tags.count();

    if (tagCount > 0) {
      // 点击前 3 个标签
      for (let i = 0; i < Math.min(tagCount, 3); i++) {
        await tags.nth(i).click().catch(() => {});
        await authenticatedPage.waitForTimeout(800);
      }
    }

    const jsErrors = collector.errors.filter(e => e.type === 'js-error');
    expect(jsErrors).toHaveLength(0);
  });
});

test.describe('个人中心交互发现', () => {
  test('Profile 页面标签页切换无异常', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/profile.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到标签页按钮
    const tabs = authenticatedPage.locator('.tab, [role="tab"], .tab-btn, .profile-tab');
    const tabCount = await tabs.count();
    console.log(`[profile] Found ${tabCount} tabs`);

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const isVisible = await tab.isVisible().catch(() => false);
      if (!isVisible) continue;

      await tab.click().catch(() => {});
      await authenticatedPage.waitForTimeout(1000);
    }

    const jsErrors = collector.errors.filter(e => e.type === 'js-error');
    expect(
      jsErrors,
      `Tab switching caused JS errors: ${jsErrors.map(e => e.message).join('; ')}`
    ).toHaveLength(0);
  });

  test('签到按钮点击无异常', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/profile.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到签到按钮
    const checkinBtn = authenticatedPage.locator('button:has-text("签到"), .checkin-btn, [data-action="checkin"]');
    const hasCheckin = await checkinBtn.first().isVisible().catch(() => false);

    if (hasCheckin) {
      await checkinBtn.first().click();
      await authenticatedPage.waitForTimeout(2000);
    }

    const jsErrors = collector.errors.filter(e => e.type === 'js-error');
    expect(jsErrors).toHaveLength(0);
  });
});

test.describe('创作页交互发现', () => {
  test('create-ai 页面方法选择无异常', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1500);
    await dismissDriverOverlay(authenticatedPage);

    // 找到创作方式选择卡片/按钮
    const methodCards = authenticatedPage.locator('.method-card, .creation-method, [data-method]');
    const cardCount = await methodCards.count();
    console.log(`[create-ai] Found ${cardCount} method cards`);

    for (let i = 0; i < cardCount; i++) {
      const card = methodCards.nth(i);
      const isVisible = await card.isVisible().catch(() => false);
      if (!isVisible) continue;

      await card.click().catch(() => {});
      await authenticatedPage.waitForTimeout(1000);
    }

    const jsErrors = collector.errors.filter(e => e.type === 'js-error');
    expect(jsErrors).toHaveLength(0);
  });
});
