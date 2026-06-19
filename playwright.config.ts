import { defineConfig, devices } from '@playwright/test';

/**
 * StoryTree E2E 测试配置
 *
 * 默认对生产环境运行，无需启动本地服务：
 *   npx playwright test                       # 对生产环境跑
 *   E2E_BASE_URL=http://localhost:3001 npx playwright test  # 对本地跑（需先启动 API）
 *
 * 按层运行：
 *   npx playwright test tests/e2e/smoke/       # 冒烟测试
 *   npx playwright test tests/e2e/crawler/     # 爬虫发现
 *   npx playwright test tests/e2e/flows/       # 用户流程
 *   npx playwright test tests/e2e/visual/      # 视觉回归
 *   npx playwright test tests/e2e/accessibility/ # 无障碍
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results/results.json' }]]
    : [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 60000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://storytree.online',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
