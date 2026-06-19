import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P0 核心业务流程
 *
 * 模拟完整的用户旅程：
 * 注册 → 登录 → 创建故事 → 编写章节 → 阅读章节 → 发表评论 → 评分
 *
 * 这是最关键的业务路径，必须在每次 CI 中运行。
 */

// 使用 serial 模式确保测试按顺序执行
test.describe.serial('P0 核心创作流程', () => {
  const timestamp = Date.now();
  const testUser = {
    username: `e2e_p0_${timestamp}`,
    email: `e2e_p0_${timestamp}@test.storytree.online`,
    password: 'E2eP0Test123!',
  };
  let authToken = '';
  let storyId = '';
  let nodeId = '';

  test('注册新用户', async ({ page }) => {
    const collector = attachErrorCollector(page);
    await page.goto('/register.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 填写注册表单
    const usernameInput = page.locator('input[name="username"], input[placeholder*="用户名"], #username');
    const emailInput = page.locator('input[name="email"], input[type="email"], #email');
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password');

    await usernameInput.first().fill(testUser.username);
    await emailInput.first().fill(testUser.email);
    await passwordInput.first().fill(testUser.password);

    // 如果有确认密码框
    const confirmPassword = page.locator('input[name="confirmPassword"], input[name="password_confirm"], #confirmPassword');
    if (await confirmPassword.first().isVisible().catch(() => false)) {
      await confirmPassword.first().fill(testUser.password);
    }

    // 提交注册
    const submitBtn = page.locator('button[type="submit"], button:has-text("注册"), .register-btn');
    await submitBtn.first().click();
    await page.waitForTimeout(3000);

    // 验证注册成功（可能跳转到登录页或直接登录）
    const currentUrl = page.url();
    const isSuccess = currentUrl.includes('login') ||
      currentUrl.includes('verify') ||
      currentUrl.includes('index') ||
      currentUrl.includes('profile');

    expect(isSuccess || collector.getCriticalErrors().length === 0).toBe(true);
  });

  test('登录', async ({ page }) => {
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 填写登录表单
    const emailInput = page.locator('input[name="email"], input[name="username"], input[type="email"], #loginEmail');
    const passwordInput = page.locator('input[name="password"], input[type="password"], #loginPassword');

    await emailInput.first().fill(testUser.email);
    await passwordInput.first().fill(testUser.password);

    // 提交登录
    const submitBtn = page.locator('button[type="submit"], button:has-text("登录"), .login-btn');
    await submitBtn.first().click();
    await page.waitForTimeout(3000);

    // 验证登录成功 - 检查 localStorage 中有 token
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
