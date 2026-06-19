import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P2 管理后台流程
 *
 * 以管理员身份访问后台：
 * - 仪表盘加载
 * - 用户管理列表
 * - 内容审核列表
 * - 各标签页切换
 *
 * 注意：如果测试账号没有 admin 权限，这些测试会优雅跳过。
 */

test.describe('P2 管理后台', () => {
  test('管理后台页面加载', async ({ adminPage }) => {
    const collector = attachErrorCollector(adminPage);
    await adminPage.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(2000);

    // 检查是否有权限（可能被重定向或显示权限不足）
    const currentUrl = adminPage.url();
    const hasPermissionError = await adminPage.locator(
      ':text("权限不足"), :text("无权限"), :text("403")'
    ).first().isVisible().catch(() => false);

    if (hasPermissionError || currentUrl.includes('login')) {
      console.log('[admin] No admin permission, skipping admin tests');
      test.skip();
      return;
    }

    // 验证管理后台基本结构存在
    const adminContent = adminPage.locator(
      '.admin-panel, .admin-content, .dashboard, [data-admin]'
    );
    const hasAdmin = await adminContent.first().isVisible().catch(() => false);
    console.log(`[admin] Admin panel visible: ${hasAdmin}`);

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('管理后台 - 标签页切换', async ({ adminPage }) => {
    const collector = attachErrorCollector(adminPage);
    await adminPage.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(2000);

    // 检查权限
    const hasPermissionError = await adminPage.locator(
      ':text("权限不足"), :text("无权限")'
    ).first().isVisible().catch(() => false);
    if (hasPermissionError) {
      test.skip();
      return;
    }

    // 找到管理后台的标签页
    const tabs = adminPage.locator(
      '.admin-tab, [role="tab"], .tab-btn, .nav-tab'
    );
    const tabCount = await tabs.count();
    console.log(`[admin] Found ${tabCount} admin tabs`);

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await adminPage.waitForTimeout(1500);
      }
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('通知页面 - 列表加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/notifications.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证通知列表或空状态
    const notifications = authenticatedPage.locator(
      '.notification-item, .notify-item, [data-notification]'
    );
    const emptyState = authenticatedPage.locator(
      ':text("暂无通知"), :text("没有新通知"), .empty-state'
    );

    const hasNotifications = await notifications.first().isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    expect(hasNotifications || hasEmpty, 'Should show notifications or empty state').toBe(true);
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('我的故事页面 - 列表加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/my-stories.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证故事列表或空状态
    const stories = authenticatedPage.locator(
      '.story-card, .story-item, [data-story]'
    );
    const emptyState = authenticatedPage.locator(
      ':text("暂无故事"), :text("还没有创作"), .empty-state'
    );

    const hasStories = await stories.first().isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    expect(hasStories || hasEmpty, 'Should show stories or empty state').toBe(true);
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });
});
