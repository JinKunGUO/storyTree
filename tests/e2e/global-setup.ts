import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright 全局设置
 *
 * 职责：
 * 1. 注册测试用户（普通用户 + 管理员）
 * 2. 登录获取 token
 * 3. 创建测试故事和章节（供需要 ID 的页面使用）
 * 4. 保存 auth storageState 到 .auth/ 目录
 * 5. 保存测试数据 ID 到 .auth/test-data.json
 */

const AUTH_DIR = path.join(process.cwd(), '.auth');

interface TestUser {
  id: number;
  username: string;
  email: string;
  token: string;
}

interface TestData {
  user: TestUser | null;
  admin: TestUser | null;
  storyId: number | null;
  nodeId: number | null;
}

async function apiRequest(baseUrl: string, endpoint: string, options: RequestInit = {}) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options.method || 'GET'} ${endpoint} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function registerAndLogin(baseUrl: string, suffix: string): Promise<TestUser | null> {
  // 优先使用环境变量中的固定测试账号（生产环境推荐）
  const envEmail = process.env.E2E_TEST_EMAIL;
  const envPassword = process.env.E2E_TEST_PASSWORD;

  if (envEmail && envPassword) {
    try {
      const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: envEmail, password: envPassword }),
      });
      return {
        id: loginRes.user?.id,
        username: loginRes.user?.username || 'e2e-tester',
        email: envEmail,
        token: loginRes.token,
      };
    } catch (e) {
      console.warn(`[global-setup] Login with env credentials failed: ${(e as Error).message}`);
    }
  }

  // 尝试动态注册（本地环境/无邮箱验证时有效）
  const ts = Date.now().toString(36).slice(-6);
  const username = `e2e${suffix}${ts}`;
  const email = `e2e${suffix}${ts}@test.storytree.online`;
  const password = 'E2eTestPass123!';

  try {
    const registerRes = await apiRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });

    // 如果注册直接返回 token（无邮箱验证）
    if (registerRes.token) {
      return {
        id: registerRes.user?.id,
        username,
        email,
        token: registerRes.token,
      };
    }

    // 尝试登录（可能本地环境无邮箱验证）
    try {
      const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      return {
        id: loginRes.user?.id,
        username,
        email,
        token: loginRes.token,
      };
    } catch {
      // 登录失败（需要邮箱验证），返回 null
      console.warn('[global-setup] Registration requires email verification. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars for production testing.');
      return null;
    }
  } catch (e) {
    console.warn(`[global-setup] Registration failed: ${(e as Error).message}`);
    return null;
  }
}

async function createTestStory(baseUrl: string, token: string): Promise<number | null> {
  try {
    const res = await apiRequest(baseUrl, '/api/stories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: `E2E Test Story ${Date.now()}`,
        description: 'Auto-generated story for E2E testing. Will be cleaned up after test run.',
        tags: ['e2e-test'],
      }),
    });
    return res.story?.id || res.id || null;
  } catch (e) {
    console.warn('[global-setup] Failed to create test story:', (e as Error).message);
    return null;
  }
}

async function createTestNode(baseUrl: string, token: string, storyId: number): Promise<number | null> {
  try {
    const res = await apiRequest(baseUrl, '/api/nodes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        story_id: storyId,
        title: `E2E Test Chapter ${Date.now()}`,
        content: '<p>This is an auto-generated chapter for E2E testing.</p>',
      }),
    });
    return res.node?.id || res.id || null;
  } catch (e) {
    console.warn('[global-setup] Failed to create test node:', (e as Error).message);
    return null;
  }
}

async function saveStorageState(baseUrl: string, user: TestUser, filename: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseUrl);
  await page.evaluate(({ token, userData }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  }, {
    token: user.token,
    userData: { id: user.id, username: user.username, email: user.email },
  });

  await context.storageState({ path: path.join(AUTH_DIR, filename) });
  await browser.close();
}

async function globalSetup(config: FullConfig) {
  const baseUrl = config.projects[0]?.use?.baseURL
    || process.env.E2E_BASE_URL
    || 'http://localhost:3001';

  console.log(`[global-setup] Target: ${baseUrl}`);

  // 确保 .auth 目录存在
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 1. 获取测试用户（优先用环境变量中的固定账号，否则尝试注册）
  console.log('[global-setup] Obtaining test user...');
  const user = await registerAndLogin(baseUrl, 'usr');

  if (!user) {
    console.warn('[global-setup] No authenticated user available. Tests requiring auth will be skipped.');
    console.warn('[global-setup] To fix: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables.');
    // 保存空的测试数据，让测试可以优雅跳过
    const testData: TestData = { user: null as any, admin: null, storyId: null, nodeId: null };
    fs.writeFileSync(path.join(AUTH_DIR, 'test-data.json'), JSON.stringify(testData, null, 2));
    return;
  }

  console.log(`[global-setup] User ready: ${user.username}`);

  // 2. 尝试获取管理员账号
  let admin: TestUser | null = null;
  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    try {
      const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: process.env.E2E_ADMIN_EMAIL,
          password: process.env.E2E_ADMIN_PASSWORD,
        }),
      });
      admin = {
        id: loginRes.user?.id,
        username: loginRes.user?.username || 'admin',
        email: process.env.E2E_ADMIN_EMAIL,
        token: loginRes.token,
      };
      console.log(`[global-setup] Admin ready: ${admin.username}`);
    } catch (e) {
      console.warn('[global-setup] Admin login failed:', (e as Error).message);
    }
  }

  // 3. 创建测试故事
  let storyId: number | null = null;
  let nodeId: number | null = null;
  storyId = await createTestStory(baseUrl, user.token);
  if (storyId) {
    console.log(`[global-setup] Test story created: ${storyId}`);
    // 4. 创建测试章节
    nodeId = await createTestNode(baseUrl, user.token, storyId);
    if (nodeId) {
      console.log(`[global-setup] Test node created: ${nodeId}`);
    }
  }

  // 5. 保存 storageState
  await saveStorageState(baseUrl, user, 'user.json');
  console.log('[global-setup] User storage state saved');

  if (admin) {
    await saveStorageState(baseUrl, admin, 'admin.json');
    console.log('[global-setup] Admin storage state saved');
  }

  // 6. 保存测试数据到共享文件
  const testData: TestData = { user, admin, storyId, nodeId };
  fs.writeFileSync(
    path.join(AUTH_DIR, 'test-data.json'),
    JSON.stringify(testData, null, 2),
  );
  console.log('[global-setup] Test data saved to .auth/test-data.json');
}

export default globalSetup;
