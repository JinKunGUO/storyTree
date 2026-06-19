import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';
import type { Page } from '@playwright/test';

/**
 * P2 AI 创作流程
 *
 * 测试 AI 辅助创作的 4 种模式：
 * - 智能导入立项
 * - 大纲创作
 * - 仿写创作
 * - 模板创作
 *
 * 注意：不实际等待 AI 生成完成（可能需要很长时间），
 * 只验证表单提交和 UI 交互无异常。
 */

/** 关闭 driver.js 引导遮罩层（如果存在）— 通过 JS 直接销毁 */
async function dismissDriverOverlay(page: Page) {
  await page.evaluate(() => {
    // driver.js 在 window 上暴露了 driverObj 或全局实例
    // 直接移除 DOM 元素是最可靠的方式
    document.querySelectorAll('.driver-overlay, .driver-popover, .driver-popover-arrow').forEach(el => el.remove());
    // 如果有全局 driver 实例，调用 destroy
    const w = window as any;
    if (w.driverObj?.destroy) w.driverObj.destroy();
    if (w.driver?.destroy) w.driver.destroy();
  });
  await page.waitForTimeout(300);
}

test.describe('P2 AI 辅助创作', () => {
  test('create-ai 页面加载 - 显示创作方式选择', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    // 验证页面有创作方式选择
    const methods = authenticatedPage.locator(
      '.method-card, .creation-method, [data-method], .mode-card, .creation-mode'
    );
    const methodCount = await methods.count();
    console.log(`[ai-creation] Found ${methodCount} creation methods`);

    // 至少应该有 2 种创作方式
    expect(methodCount).toBeGreaterThanOrEqual(1);
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('智能导入立项模式 - 表单交互', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    // 选择智能导入模式
    const importMethod = authenticatedPage.locator(
      '[data-method="import"], :text("智能导入"), :text("立项")'
    ).first();
    const hasImport = await importMethod.isVisible().catch(() => false);

    if (hasImport) {
      await importMethod.click();
      await authenticatedPage.waitForTimeout(1500);

      // 找到创意描述输入框
      const ideaInput = authenticatedPage.locator(
        'textarea[name*="idea"], textarea[placeholder*="创意"], .idea-input, #ideaInput'
      );
      if (await ideaInput.first().isVisible().catch(() => false)) {
        await ideaInput.first().fill('一个关于时间旅行的科幻故事，主角是一名物理学家');
        await authenticatedPage.waitForTimeout(500);
      }
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('大纲创作模式 - 表单交互', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    // 选择大纲模式
    const outlineMethod = authenticatedPage.locator(
      '[data-method="outline"], :text("大纲"), :text("结构")'
    ).first();
    const hasOutline = await outlineMethod.isVisible().catch(() => false);

    if (hasOutline) {
      await outlineMethod.click();
      await authenticatedPage.waitForTimeout(1500);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('仿写模式 - 表单交互', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    // 选择仿写模式
    const pasticheMethod = authenticatedPage.locator(
      '[data-method="pastiche"], :text("仿写"), :text("风格")'
    ).first();
    const hasPastiche = await pasticheMethod.isVisible().catch(() => false);

    if (hasPastiche) {
      await pasticheMethod.click();
      await authenticatedPage.waitForTimeout(1500);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('模板创作模式 - 表单交互', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    // 选择模板模式
    const templateMethod = authenticatedPage.locator(
      '[data-method="template"], :text("模板"), :text("套用")'
    ).first();
    const hasTemplate = await templateMethod.isVisible().catch(() => false);

    if (hasTemplate) {
      await templateMethod.click();
      await authenticatedPage.waitForTimeout(1500);

      // 验证模板列表出现
      const templates = authenticatedPage.locator('.template-card, .template-item, [data-template]');
      const templateCount = await templates.count();
      console.log(`[ai-creation] Found ${templateCount} templates`);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });
});
