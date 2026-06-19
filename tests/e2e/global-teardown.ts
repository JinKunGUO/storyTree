import * as fs from 'fs';
import * as path from 'path';
import type { FullConfig } from '@playwright/test';

/**
 * Playwright 全局清理
 *
 * 职责：
 * 1. 删除测试创建的故事和章节
 * 2. 删除测试账号（如果 API 支持）
 * 3. 清理 .auth/ 目录
 */

const AUTH_DIR = path.join(process.cwd(), '.auth');

async function apiRequest(baseUrl: string, endpoint: string, token: string, method = 'DELETE') {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function globalTeardown(config: FullConfig) {
  const baseUrl = config.projects[0]?.use?.baseURL
    || process.env.E2E_BASE_URL
    || 'http://localhost:3001';

  const testDataPath = path.join(AUTH_DIR, 'test-data.json');
  if (!fs.existsSync(testDataPath)) {
    console.log('[global-teardown] No test data to clean up');
    return;
  }

  const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  const { user, admin, storyId, nodeId } = testData;

  console.log('[global-teardown] Cleaning up test data...');

  // 删除测试章节
  if (nodeId && user?.token) {
    const ok = await apiRequest(baseUrl, `/api/nodes/${nodeId}`, user.token);
    console.log(`[global-teardown] Delete node ${nodeId}: ${ok ? 'ok' : 'skipped'}`);
  }

  // 删除测试故事
  if (storyId && user?.token) {
    const ok = await apiRequest(baseUrl, `/api/stories/${storyId}`, user.token);
    console.log(`[global-teardown] Delete story ${storyId}: ${ok ? 'ok' : 'skipped'}`);
  }

  // 尝试删除测试账号（通过 DELETE /api/auth/account）
  if (user?.token) {
    const ok = await apiRequest(baseUrl, '/api/auth/account', user.token);
    console.log(`[global-teardown] Delete user ${user.username}: ${ok ? 'ok' : 'skipped'}`);
  }
  if (admin?.token) {
    const ok = await apiRequest(baseUrl, '/api/auth/account', admin.token);
    console.log(`[global-teardown] Delete admin ${admin.username}: ${ok ? 'ok' : 'skipped'}`);
  }

  // 清理 .auth 目录（保留目录本身）
  const files = fs.readdirSync(AUTH_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(AUTH_DIR, file));
  }
  console.log('[global-teardown] Cleanup complete');
}

export default globalTeardown;
