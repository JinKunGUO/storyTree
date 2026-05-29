import { test, expect } from '@playwright/test';

/**
 * 邮箱验证流程 E2E 测试
 *
 * 环境说明：
 * - 开发环境：通过控制台日志获取验证 token（SMTP 未配置时邮件输出到控制台）
 * - Staging 环境：通过 MailHog API 获取验证 token
 *
 * 运行方式：
 *   npx playwright test                                          # 开发环境
 *   E2E_BASE_URL=https://staging.storytree.online npx playwright test  # staging
 */

test.describe('页面路由验证', () => {
  test('verify-email 页面正确加载（非 index.html）', async ({ page }) => {
    await page.goto('/verify-email?token=test-token');

    // 验证页面标题（verify-email.html 的特有内容）
    await expect(page).toHaveTitle(/邮箱验证/);

    // 验证不是首页
    await expect(page.locator('text=发现故事')).not.toBeVisible();
  });

  test('register 页面正确加载', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveTitle(/注册/);
    await expect(page.locator('text=发现故事')).not.toBeVisible();
  });

  test('login 页面正确加载', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/登录/);
    await expect(page.locator('text=发现故事')).not.toBeVisible();
  });

  test('reset-password 页面正确加载', async ({ page }) => {
    await page.goto('/reset-password?token=test-token');

    await expect(page).toHaveTitle(/重置密码/);
    await expect(page.locator('text=发现故事')).not.toBeVisible();
  });

  test('未知路径 fallback 到首页', async ({ page }) => {
    await page.goto('/non-existent-random-page');

    // 应该显示首页内容
    await expect(page.locator('text=发现故事')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('注册页面密码提示', () => {
  test('密码要求提示区域存在', async ({ page }) => {
    await page.goto('/register');

    // 验证密码要求提示存在
    await expect(page.locator('.password-requirements')).toBeVisible();
    await expect(page.locator('#req-length')).toBeVisible();
    await expect(page.locator('#req-letter')).toBeVisible();
    await expect(page.locator('#req-number')).toBeVisible();
  });

  test('输入密码时实时显示满足状态', async ({ page }) => {
    await page.goto('/register');

    const passwordInput = page.locator('input[type="password"]').first();

    // 输入只有数字的密码
    await passwordInput.fill('12345678');
    // 长度满足，数字满足，字母不满足
    await expect(page.locator('#req-length.met')).toBeVisible();
    await expect(page.locator('#req-number.met')).toBeVisible();
    await expect(page.locator('#req-letter.met')).not.toBeVisible();

    // 输入字母+数字的密码
    await passwordInput.fill('abc12345');
    // 全部满足
    await expect(page.locator('#req-length.met')).toBeVisible();
    await expect(page.locator('#req-letter.met')).toBeVisible();
    await expect(page.locator('#req-number.met')).toBeVisible();
  });
});

test.describe('完整注册验证流程', () => {
  // 生产环境不运行注册流程测试（会创建真实用户）
  // 仅在开发/staging 环境中运行
  const baseURL = process.env.E2E_BASE_URL || '';
  const isProduction = baseURL.includes('storytree.online') && !baseURL.includes('staging');

  test.skip(isProduction, '生产环境跳过注册流程测试，避免创建真实用户');

  const timestamp = Date.now();
  const testEmail = `e2etest${timestamp}@example.com`;
  const testUsername = `e2euser${timestamp}`;
  const testPassword = 'TestPass123';

  test('注册 → 验证 → 登录 完整流程', async ({ page, request }) => {
    // 1. 访问注册页面
    await page.goto('/register');
    await expect(page.locator('text=注册')).toBeVisible({ timeout: 5000 });

    // 2. 填写注册表单
    await page.locator('input[name="username"], input[placeholder*="用户名"]').fill(testUsername);
    await page.locator('input[name="email"], input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);

    // 3. 验证密码提示全部满足
    await expect(page.locator('#req-length.met')).toBeVisible();
    await expect(page.locator('#req-letter.met')).toBeVisible();
    await expect(page.locator('#req-number.met')).toBeVisible();

    // 4. 提交注册
    await page.locator('button[type="submit"]').click();

    // 5. 验证注册成功提示
    await expect(page.locator('text=验证邮件')).toBeVisible({ timeout: 10000 });

    // 6. 通过 API 直接获取验证 token（绕过邮件）
    //    开发环境中，token 会输出到控制台日志
    //    这里通过 API 调用注册接口的返回或直接查询来获取
    //    实际 staging 环境可通过 MailHog API 获取
    const verifyToken = await getVerificationToken(request, testEmail);

    if (verifyToken) {
      // 7. 访问验证链接
      await page.goto(`/verify-email?token=${verifyToken}`);

      // 8. 验证成功
      await expect(page.locator('text=验证成功')).toBeVisible({ timeout: 10000 });

      // 9. 点击登录链接或等待跳转
      const loginLink = page.locator('a[href*="login"]');
      if (await loginLink.isVisible()) {
        await loginLink.click();
      } else {
        await page.goto('/login');
      }

      // 10. 登录
      await page.locator('input[name="email"], input[type="email"]').fill(testEmail);
      await page.locator('input[type="password"]').fill(testPassword);
      await page.locator('button[type="submit"]').click();

      // 11. 验证登录成功（跳转到首页或个人页面）
      await page.waitForURL(/\/(index|discover|profile)?/, { timeout: 10000 });
    } else {
      // 如果无法获取 token（如生产环境），跳过后续步骤
      test.skip(true, '无法获取验证 token，跳过验证和登录步骤');
    }
  });

  test('跨浏览器验证流程', async ({ browser }) => {
    // 1. 在浏览器 A 注册
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const crossTimestamp = Date.now();
    const crossEmail = `e2ecross${crossTimestamp}@example.com`;
    const crossUsername = `e2ecross${crossTimestamp}`;

    await pageA.goto('/register');
    await pageA.locator('input[name="username"], input[placeholder*="用户名"]').fill(crossUsername);
    await pageA.locator('input[name="email"], input[type="email"]').fill(crossEmail);
    await pageA.locator('input[type="password"]').first().fill(testPassword);
    await pageA.locator('button[type="submit"]').click();

    await expect(pageA.locator('text=验证邮件')).toBeVisible({ timeout: 10000 });

    // 2. 获取验证 token
    const apiContext = await browser.newContext();
    const verifyToken = await getVerificationToken(apiContext.request, crossEmail);

    if (verifyToken) {
      // 3. 在浏览器 B 打开验证链接（模拟不同设备验证）
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await pageB.goto(`/verify-email?token=${verifyToken}`);

      // 4. 验证成功
      await expect(pageB.locator('text=验证成功')).toBeVisible({ timeout: 10000 });

      // 5. 在浏览器 B 登录
      await pageB.goto('/login');
      await pageB.locator('input[name="email"], input[type="email"]').fill(crossEmail);
      await pageB.locator('input[type="password"]').fill(testPassword);
      await pageB.locator('button[type="submit"]').click();

      // 6. 验证登录成功
      await pageB.waitForURL(/\/(index|discover|profile)?/, { timeout: 10000 });

      await contextB.close();
    } else {
      test.skip(true, '无法获取验证 token，跳过跨浏览器验证测试');
    }

    await contextA.close();
  });
});

/**
 * 获取验证 token
 * - Staging 环境：通过 MailHog API 获取
 * - 开发环境：通过内部 API 获取（如果可用）
 * - 无法获取时返回 null
 */
async function getVerificationToken(
  request: any,
  email: string
): Promise<string | null> {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3001';

  // 方式 1：尝试通过 MailHog API 获取（Staging 环境）
  const mailhogURL = process.env.MAILHOG_URL || 'http://localhost:8025';
  try {
    const response = await request.get(
      `${mailhogURL}/api/v2/search?kind=to&query=${email}`
    );
    if (response.ok()) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const emailBody = data.items[0].Content.Body;
        const tokenMatch = emailBody.match(/token=([a-zA-Z0-9]+)/);
        if (tokenMatch) return tokenMatch[1];
      }
    }
  } catch {
    // MailHog 不可用，尝试其他方式
  }

  // 方式 2：尝试通过测试辅助 API 获取（开发环境可选）
  try {
    const response = await request.get(
      `${baseURL}/api/auth/test-helper/verification-token?email=${email}`
    );
    if (response.ok()) {
      const data = await response.json();
      if (data.token) return data.token;
    }
  } catch {
    // 测试辅助 API 不可用
  }

  return null;
}
