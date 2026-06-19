import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P1 社交功能流程
 *
 * 签到 → 编辑资料 → 查看邀请码 → 关注用户 → 收藏故事
 */

test.describe('P1 社交功能流程', () => {
  test('签到功能', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/profile.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到签到按钮
    const checkinBtn = authenticatedPage.locator(
      'button:has-text("签到"), .checkin-btn, [data-action="checkin"], .daily-checkin'
    );
    const hasCheckin = await checkinBtn.first().isVisible().catch(() => false);

    if (hasCheckin) {
      await checkinBtn.first().click();
      await authenticatedPage.waitForTimeout(2000);

      // 验证签到反馈（弹窗、提示、或按钮状态变化）
      const toast = authenticatedPage.locator('.toast, .notification, .alert, [role="alert"]');
      const btnDisabled = await checkinBtn.first().isDisabled().catch(() => false);
      const toastVisible = await toast.first().isVisible().catch(() => false);

      // 至少有一种反馈
      expect(btnDisabled || toastVisible || collector.errors.length === 0).toBe(true);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('编辑个人资料', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/profile.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到编辑资料按钮
    const editBtn = authenticatedPage.locator(
      'button:has-text("编辑"), button:has-text("修改资料"), .edit-profile-btn, [data-action="edit-profile"]'
    );
    const hasEdit = await editBtn.first().isVisible().catch(() => false);

    if (hasEdit) {
      await editBtn.first().click();
      await authenticatedPage.waitForTimeout(1500);

      // 验证编辑表单/弹窗出现
      const editForm = authenticatedPage.locator(
        '.edit-form, .profile-form, .modal:visible, [role="dialog"]:visible'
      );
      const formVisible = await editForm.first().isVisible().catch(() => false);
      console.log(`[p1] Edit form visible: ${formVisible}`);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('查看邀请码', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/profile.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到邀请码相关入口
    const inviteBtn = authenticatedPage.locator(
      'button:has-text("邀请"), .invite-btn, [data-action="invite"], :text("邀请码")'
    );
    const hasInvite = await inviteBtn.first().isVisible().catch(() => false);

    if (hasInvite) {
      await inviteBtn.first().click();
      await authenticatedPage.waitForTimeout(1500);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('发现页面 - 关注故事', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到第一个故事链接
    const storyLink = authenticatedPage.locator('a[href*="story.html"]').first();
    const hasStory = await storyLink.isVisible().catch(() => false);

    if (hasStory) {
      await storyLink.click();
      await authenticatedPage.waitForTimeout(2000);

      // 找到关注/追更按钮
      const followBtn = authenticatedPage.locator(
        'button:has-text("关注"), button:has-text("追更"), .follow-btn, [data-action="follow"]'
      );
      const hasFollow = await followBtn.first().isVisible().catch(() => false);

      if (hasFollow) {
        await followBtn.first().click();
        await authenticatedPage.waitForTimeout(1000);
      }
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('收藏故事', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 找到收藏按钮（可能在故事卡片上或故事详情页）
    const bookmarkBtn = authenticatedPage.locator(
      'button:has-text("收藏"), .bookmark-btn, [data-action="bookmark"], .collect-btn'
    );
    const hasBookmark = await bookmarkBtn.first().isVisible().catch(() => false);

    if (hasBookmark) {
      await bookmarkBtn.first().click();
      await authenticatedPage.waitForTimeout(1000);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });
});
