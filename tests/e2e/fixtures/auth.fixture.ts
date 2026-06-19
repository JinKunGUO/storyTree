import { test as base, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(process.cwd(), '.auth');

/**
 * 认证 Fixture
 *
 * 提供三种页面上下文：
 * - authenticatedPage: 已登录的普通用户（无认证时自动 skip）
 * - adminPage: 已登录的管理员（无认证时自动 skip）
 * - guestPage: 未登录的访客（始终可用）
 */
export const test = base.extend<{
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
  adminPage: Page;
  guestPage: Page;
}>({
  authenticatedContext: async ({ browser }, use, testInfo) => {
    const statePath = path.join(AUTH_DIR, 'user.json');
    if (!fs.existsSync(statePath)) {
      testInfo.skip(true, 'Auth state not available. Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD to enable.');
      return;
    }
    const context = await browser.newContext({ storageState: statePath });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
  },

  adminPage: async ({ browser }, use, testInfo) => {
    const statePath = path.join(AUTH_DIR, 'admin.json');
    if (!fs.existsSync(statePath)) {
      const fallback = path.join(AUTH_DIR, 'user.json');
      if (!fs.existsSync(fallback)) {
        testInfo.skip(true, 'No auth state available. Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD to enable.');
        return;
      }
      const context = await browser.newContext({ storageState: fallback });
      const page = await context.newPage();
      await use(page);
      await context.close();
      return;
    }
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
