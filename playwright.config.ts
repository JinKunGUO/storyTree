import { defineConfig, devices } from '@playwright/test';

/**
 * StoryTree E2E 测试配置
 *
 * 环境切换：
 *   开发环境：E2E_BASE_URL=http://localhost:3001 npx playwright test
 *   Staging：E2E_BASE_URL=https://staging.storytree.online npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 本地开发时自动启动服务 */
  ...(process.env.E2E_BASE_URL ? {} : {
    webServer: {
      command: 'cd api && npm run dev',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  }),
});
