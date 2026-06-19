import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 自动加载 .env.test 文件中的环境变量（避免每次手动 export）
 * 优先级：命令行 export > .env.test 文件
 */
const envFile = path.join(__dirname, '.env.test');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * StoryTree E2E 测试配置
 *
 * 使用方式：
 *   npm run test:e2e:smoke    # 日常使用（推荐）
 *   npm run test:e2e          # 完整测试（需 .env.test 中配置账号）
 *
 * 配置文件 .env.test 示例：
 *   E2E_BASE_URL=https://storytree.online
 *   E2E_TEST_EMAIL=your-test@example.com
 *   E2E_TEST_PASSWORD=your-password
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
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
