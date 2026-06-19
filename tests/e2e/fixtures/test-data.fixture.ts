import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(process.cwd(), '.auth');

export interface TestUser {
  id: number;
  username: string;
  email: string;
  token: string;
}

export interface TestData {
  user: TestUser | null;
  admin: TestUser | null;
  storyId: number | null;
  nodeId: number | null;
}

/**
 * 获取 global-setup 中创建的测试数据
 */
export function getTestData(): TestData {
  const dataPath = path.join(AUTH_DIR, 'test-data.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error('Test data not found. Did global-setup run successfully?');
  }
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

/**
 * 检查是否有认证用户可用
 */
export function hasAuthUser(): boolean {
  try {
    const data = getTestData();
    return data.user !== null && !!data.user.token;
  } catch {
    return false;
  }
}

/**
 * 获取需要 storyId 的页面 URL
 */
export function storyPageUrl(pagePath: string): string {
  const data = getTestData();
  if (!data.storyId) {
    throw new Error('No test story available');
  }
  return `${pagePath}?id=${data.storyId}`;
}

/**
 * 获取需要 nodeId 的页面 URL
 */
export function nodePageUrl(pagePath: string): string {
  const data = getTestData();
  if (!data.nodeId) {
    throw new Error('No test node available');
  }
  return `${pagePath}?id=${data.nodeId}`;
}
