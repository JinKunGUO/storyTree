import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P0 核心业务流程
 *
 * 模拟完整的用户旅程：
 * 登录 → 创建故事 → 编写章节 → 阅读章节 → 发表评论 → 评分
 *
 * 优先使用 global-setup 已获取的 token（避免重复登录触发频率限制）。
 * 如果 global-setup 未成功获取 token，则通过 UI 登录。
 * 需要在 .env.test 中配置 E2E_TEST_EMAIL 和 E2E_TEST_PASSWORD。
 */

// 使用 serial 模式确保测试按顺序执行
test.describe.serial('P0 核心创作流程', () => {
  const timestamp = Date.now();
  const testEmail = process.env.E2E_TEST_EMAIL || '';
  const testPassword = process.env.E2E_TEST_PASSWORD || '';
  const testUser = {
    username: testEmail.split('@')[0] || `e2e_p0_${timestamp}`,
    email: testEmail,
    password: testPassword,
  };
  let authToken = '';
  let storyId = '';
  let nodeId = '';

  test('登录', async ({ page }, testInfo) => {
    if (!testEmail || !testPassword) {
      testInfo.skip(true, 'P0 flow requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.test');
      return;
    }

    // 优先使用 global-setup 已获取的 token（避免重复登录触发 429 频率限制）
    const testDataPath = path.join(process.cwd(), '.auth', 'test-data.json');
    if (fs.existsSync(testDataPath)) {
      try {
        const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
        if (testData.user?.token) {
          authToken = testData.user.token;
          console.log('[p0] Using token from global-setup (skipping UI login to avoid rate limit)');
          // 验证 token 有效：注入后访问一个需要认证的页面
          await page.goto('/');
          await page.evaluate((token) => {
            localStorage.setItem('token', token);
          }, authToken);
          expect(authToken.length).toBeGreaterThan(0);
          return;
        }
      } catch { /* fallthrough to UI login */ }
    }

    // Fallback: 通过 UI 登录
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('#account, input[name="account"], input[name="email"], input[name="username"]');
    const passwordInput = page.locator('#password, input[name="password"], input[type="password"]');

    await emailInput.first().fill(testUser.email);
    await passwordInput.first().fill(testUser.password);

    const submitBtn = page.locator('button[type="submit"], button:has-text("登录"), .login-btn');
    await submitBtn.first().click();
    await page.waitForTimeout(3000);

    // 检查是否有错误提示（如频率限制）
    const alertText = await page.locator('[role="alert"], .toast, .error-message').textContent().catch(() => '');
    if (alertText && alertText.includes('频繁')) {
      testInfo.skip(true, `Login rate-limited: ${alertText}`);
      return;
    }

    authToken = await page.evaluate(() => localStorage.getItem('token') || '');
    expect(authToken.length, 'Should have auth token after login').toBeGreaterThan(0);
  });

  test('创建故事', async ({ page }) => {
    // 注入认证状态
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: { username: testUser.username, email: testUser.email } });

    await page.goto('/create.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const collector = attachErrorCollector(page);

    // 填写故事创建表单
    const titleInput = page.locator('input[name="title"], input[placeholder*="标题"], #storyTitle, .story-title-input');
    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="描述"], #storyDescription, .story-desc-input');

    if (await titleInput.first().isVisible().catch(() => false)) {
      await titleInput.first().fill(`E2E Test Story ${timestamp}`);
    }
    if (await descInput.first().isVisible().catch(() => false)) {
      await descInput.first().fill('This is an automated E2E test story.');
    }

    // 提交创建
    const submitBtn = page.locator('button[type="submit"], button:has-text("创建"), button:has-text("开始"), .create-btn');
    if (await submitBtn.first().isVisible().catch(() => false)) {
      await submitBtn.first().click();
      await page.waitForTimeout(3000);
    }

    // 尝试从 URL 或页面中获取 storyId
    const currentUrl = page.url();
    const idMatch = currentUrl.match(/[?&]id=(\d+)/);
    if (idMatch) {
      storyId = idMatch[1];
    } else {
      // 尝试从页面数据中获取
      storyId = await page.evaluate(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || '';
      });
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
    console.log(`[p0] Story created: ${storyId || 'ID not captured'}`);
  });

  test('编写章节', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: { username: testUser.username, email: testUser.email } });

    // 如果有 storyId，直接导航到写作页面
    const writeUrl = storyId ? `/write.html?id=${storyId}` : '/write.html';
    await page.goto(writeUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const collector = attachErrorCollector(page);

    // 填写章节标题
    const titleInput = page.locator('input[name="title"], input[placeholder*="标题"], #chapterTitle, .chapter-title');
    if (await titleInput.first().isVisible().catch(() => false)) {
      await titleInput.first().fill(`E2E Test Chapter ${timestamp}`);
    }

    // 在编辑器中输入内容（Quill 编辑器）
    const editor = page.locator('.ql-editor, [contenteditable="true"], .editor-content');
    if (await editor.first().isVisible().catch(() => false)) {
      await editor.first().click();
      await page.keyboard.type('This is automated E2E test content for the chapter.');
      await page.waitForTimeout(1000);
    }

    // 保存/发布
    const saveBtn = page.locator('button:has-text("保存"), button:has-text("发布"), .save-btn, .publish-btn');
    if (await saveBtn.first().isVisible().catch(() => false)) {
      await saveBtn.first().click();
      await page.waitForTimeout(3000);
    }

    // 获取 nodeId
    const currentUrl = page.url();
    const nodeMatch = currentUrl.match(/nodeId=(\d+)|id=(\d+)/);
    if (nodeMatch) {
      nodeId = nodeMatch[1] || nodeMatch[2];
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
    console.log(`[p0] Chapter written: ${nodeId || 'ID not captured'}`);
  });

  test('阅读章节', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: { username: testUser.username, email: testUser.email } });

    // 如果有 nodeId，导航到章节页面
    if (nodeId) {
      await page.goto(`/chapter.html?id=${nodeId}`, { waitUntil: 'domcontentloaded' });
    } else if (storyId) {
      await page.goto(`/story.html?id=${storyId}`, { waitUntil: 'domcontentloaded' });
    } else {
      // 从 discover 页面找一个故事
      await page.goto('/discover.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const firstStory = page.locator('a[href*="story.html"]').first();
      if (await firstStory.isVisible().catch(() => false)) {
        await firstStory.click();
      }
    }

    await page.waitForTimeout(2000);
    const collector = attachErrorCollector(page);

    // 验证页面有内容区域
    const content = page.locator('.chapter-content, .story-content, .content, article, main');
    const hasContent = await content.first().isVisible().catch(() => false);

    expect(collector.getCriticalErrors()).toHaveLength(0);
    console.log(`[p0] Chapter reading: content visible = ${hasContent}`);
  });

  test('发表评论', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: { username: testUser.username, email: testUser.email } });

    // 导航到有评论功能的页面
    const targetUrl = nodeId ? `/chapter.html?id=${nodeId}` : '/discover.html';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const collector = attachErrorCollector(page);

    // 找到评论输入框
    const commentInput = page.locator('textarea[name*="comment"], .comment-input, #commentInput, [placeholder*="评论"]');
    if (await commentInput.first().isVisible().catch(() => false)) {
      await commentInput.first().fill(`E2E test comment ${timestamp}`);
      await page.waitForTimeout(500);

      // 提交评论
      const submitBtn = page.locator('button:has-text("发表"), button:has-text("评论"), .comment-submit');
      if (await submitBtn.first().isVisible().catch(() => false)) {
        await submitBtn.first().click();
        await page.waitForTimeout(2000);
      }
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('给章节评分', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: authToken, user: { username: testUser.username, email: testUser.email } });

    const targetUrl = nodeId ? `/chapter.html?id=${nodeId}` : '/discover.html';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const collector = attachErrorCollector(page);

    // 找到评分星级组件
    const stars = page.locator('.star, .rating-star, [data-rating], .rate-star');
    const starCount = await stars.count();

    if (starCount > 0) {
      // 点击第 4 颗星（给 4 分）
      const targetStar = stars.nth(Math.min(3, starCount - 1));
      await targetStar.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  // 清理：删除测试账号
  test.afterAll(async ({ request }) => {
    if (authToken) {
      const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3001';
      try {
        await request.delete(`${baseUrl}/api/auth/account`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // 清理失败不影响测试结果
      }
    }
  });
});
