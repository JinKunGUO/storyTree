import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';
import type { Page } from '@playwright/test';

/**
 * P2 AI 流式输出测试
 *
 * 验证：
 * 1. SSEStream 客户端库正确加载
 * 2. 流式端点可达（返回 401 而非 404/500）
 * 3. 页面中不再有旧的时间预估文案
 * 4. 流式 UI 组件 CSS 正确加载
 */

/** 跳过 onboarding tour */
async function skipOnboardingTour(page: Page) {
  await page.evaluate(() => {
    const progress = { tourCompleted: true, steps: {}, completedAt: new Date().toISOString() };
    localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
  });
}

/** 关闭 driver.js 遮罩 */
async function dismissDriverOverlay(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    if (w.driverObj?.destroy) w.driverObj.destroy();
    if (w.driver?.destroy) w.driver.destroy();
    document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
    document.body.classList.remove('driver-active', 'driver-fade', 'driver-no-interaction');
    document.body.style.pointerEvents = '';
  });
  await page.waitForTimeout(300);
}

/**
 * 加载需要参数的页面（write/story），阻止因缺少参数导致的重定向。
 * 通过在页面加载前拦截 window.location 赋值来实现。
 */
async function gotoWithoutRedirect(page: Page, url: string) {
  // 拦截 setTimeout 中包含 location.href 重定向的回调
  await page.addInitScript(`
    (function() {
      var origSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = function(fn, delay) {
        if (typeof fn === 'function') {
          var src = fn.toString();
          if (src.indexOf('location.href') !== -1 || src.indexOf('location.replace') !== -1) {
            return origSetTimeout(function(){}, delay || 0);
          }
        }
        return origSetTimeout.apply(window, arguments);
      };
    })();
  `);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

test.describe('P2 AI 流式输出', () => {

  test('SSEStream 客户端库在 write 页面正确加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await gotoWithoutRedirect(authenticatedPage, '/write.html');
    await dismissDriverOverlay(authenticatedPage);

    // 验证 SSEStream 全局变量存在
    const hasSSEStream = await authenticatedPage.evaluate(() => {
      return typeof (window as any).SSEStream === 'function';
    });
    expect(hasSSEStream).toBe(true);
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('SSEStream 客户端库在 create-ai 页面正确加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    const hasSSEStream = await authenticatedPage.evaluate(() => {
      return typeof (window as any).SSEStream === 'function';
    });
    expect(hasSSEStream).toBe(true);
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('SSEStream 客户端库在 story 页面正确加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    // 提供假 id 参数防止因缺少 storyId 立即重定向
    await authenticatedPage.goto('/story.html?id=1', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1500);
    await dismissDriverOverlay(authenticatedPage);

    const hasSSEStream = await authenticatedPage.evaluate(() => {
      return typeof (window as any).SSEStream === 'function';
    });
    expect(hasSSEStream).toBe(true);
    // 不检查 critical errors，因为 storyId=1 可能不存在会产生 API 错误
  });

  test('流式端点可达 - /api/ai/stream/continuation 返回 401（未携带 token）', async ({ page }) => {
    const response = await page.request.post('/api/ai/stream/continuation', {
      data: { storyId: 1, nodeId: 1 },
      headers: { 'Content-Type': 'application/json' }
    });
    // 未认证应返回 401，不应是 404 或 500
    expect(response.status()).toBe(401);
  });

  test('流式端点可达 - /api/ai/stream/polish 返回 401', async ({ page }) => {
    const response = await page.request.post('/api/ai/stream/polish', {
      data: { content: 'test' },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(401);
  });

  test('流式端点可达 - /api/ai/stream/project-brief 返回 401', async ({ page }) => {
    const response = await page.request.post('/api/ai/stream/project-brief', {
      data: { storyIdea: 'test' },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(401);
  });

  test('流式端点可达 - /api/ai/stream/outline 返回 401', async ({ page }) => {
    const response = await page.request.post('/api/ai/stream/outline', {
      data: { coreIdea: 'test' },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(401);
  });

  test('流式端点可达 - /api/ai/stream/revise 返回 401', async ({ page }) => {
    const response = await page.request.post('/api/ai/stream/revise', {
      data: { type: 'project-brief', original: '{}', feedback: 'test' },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(response.status()).toBe(401);
  });

  test('write 页面不包含旧的时间预估文案', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await gotoWithoutRedirect(authenticatedPage, '/write.html');
    await dismissDriverOverlay(authenticatedPage);

    const pageContent = await authenticatedPage.content();
    // 不应包含具体的时间预估
    expect(pageContent).not.toContain('通常需要3-10秒');
    expect(pageContent).not.toContain('通常需要5-15秒');
    expect(pageContent).not.toContain('需要30-60秒');
    expect(pageContent).not.toContain('预计需要');
  });

  test('create-ai 页面不包含旧的时间预估文案', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await authenticatedPage.goto('/create-ai.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);
    await dismissDriverOverlay(authenticatedPage);

    const pageContent = await authenticatedPage.content();
    expect(pageContent).not.toContain('预计需要');
    expect(pageContent).not.toContain('请稍候');
    // 应包含新的加载文案
    expect(pageContent).toContain('AI 正在创作中...');
  });

  test('流式 UI CSS 样式正确加载', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await gotoWithoutRedirect(authenticatedPage, '/write.html');

    // 验证 .ai-streaming-indicator 动画样式存在
    const hasAnimation = await authenticatedPage.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'ai-pulse') {
              return true;
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
      }
      return false;
    });
    expect(hasAnimation).toBe(true);
  });

  test('SSEStream 实例化和 abort 不报错', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/', { waitUntil: 'domcontentloaded' });
    await skipOnboardingTour(authenticatedPage);
    await gotoWithoutRedirect(authenticatedPage, '/write.html');
    await dismissDriverOverlay(authenticatedPage);

    // 验证 SSEStream 可以实例化并 abort 而不抛错
    const result = await authenticatedPage.evaluate(async () => {
      try {
        const stream = new (window as any).SSEStream('/api/ai/stream/continuation', {
          body: { storyId: 1, nodeId: 1 },
          onChunk: () => {},
          onDone: () => {},
          onError: () => {}
        });
        // 立即 abort（不等待连接）
        stream.abort();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    });
    expect(result.success).toBe(true);
  });
});
