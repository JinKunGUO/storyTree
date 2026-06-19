/**
 * API 请求封装 (apiFetch) 测试
 *
 * 测试覆盖：
 * 1. Token 自动注入
 * 2. Content-Type 自动设置
 * 3. 401 自动跳转
 * 4. 错误响应处理
 * 5. 204 No Content 处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// 模拟浏览器环境
let apiFetch;
let sandbox;

beforeEach(() => {
  // 创建沙箱环境模拟浏览器全局对象
  sandbox = {
    localStorage: {
      _store: {},
      getItem(key) { return this._store[key] || null; },
      setItem(key, value) { this._store[key] = value; },
      removeItem(key) { delete this._store[key]; },
      clear() { this._store = {}; },
    },
    sessionStorage: {
      _store: {},
      getItem(key) { return this._store[key] || null; },
      setItem(key, value) { this._store[key] = value; },
      removeItem(key) { delete this._store[key]; },
      clear() { this._store = {}; },
    },
    window: { location: { href: '' } },
    fetch: vi.fn(),
    Promise,
    Object,
    JSON,
    Error,
    console,
  };

  const code = fs.readFileSync(path.join(__dirname, '../js/utils/api.js'), 'utf-8');
  vm.runInNewContext(code, sandbox);
  apiFetch = sandbox.apiFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Token 自动注入
// ===========================================================================
describe('Token 自动注入', () => {
  it('localStorage 有 token 时自动注入 Authorization header', async () => {
    sandbox.localStorage.setItem('token', 'test-token-123');
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    await apiFetch('/api/test');

    expect(sandbox.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      })
    );
  });

  it('sessionStorage 有 token 时自动注入', async () => {
    sandbox.sessionStorage.setItem('token', 'session-token-456');
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    await apiFetch('/api/test');

    expect(sandbox.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token-456',
        }),
      })
    );
  });

  it('无 token 时不注入 Authorization', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    await apiFetch('/api/test');

    const callHeaders = sandbox.fetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('已有 Authorization header 时不覆盖', async () => {
    sandbox.localStorage.setItem('token', 'auto-token');
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/api/test', {
      headers: { Authorization: 'Bearer custom-token' },
    });

    const callHeaders = sandbox.fetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe('Bearer custom-token');
  });
});

// ===========================================================================
// Content-Type 自动设置
// ===========================================================================
describe('Content-Type 自动设置', () => {
  it('POST + string body 自动设置 application/json', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    const callHeaders = sandbox.fetch.mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBe('application/json');
  });

  it('GET 请求不设置 Content-Type', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/api/test');

    const callHeaders = sandbox.fetch.mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBeUndefined();
  });
});

// ===========================================================================
// 401 自动跳转
// ===========================================================================
describe('401 自动跳转', () => {
  it('401 响应自动跳转到登录页', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('未登录或登录已过期');
    expect(sandbox.window.location.href).toBe('/login.html');
  });

  it('skipAuthRedirect 选项可禁用 401 跳转', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(
      apiFetch('/api/test', { skipAuthRedirect: true })
    ).rejects.toThrow();
    expect(sandbox.window.location.href).toBe('');
  });
});

// ===========================================================================
// 错误响应处理
// ===========================================================================
describe('错误响应处理', () => {
  it('非 2xx 响应抛出 Error 并包含 status', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: '资源不存在' }),
    });

    try {
      await apiFetch('/api/test');
    } catch (err) {
      expect(err.message).toBe('资源不存在');
      expect(err.status).toBe(404);
    }
  });

  it('响应 JSON 解析失败时返回通用错误', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    });

    try {
      await apiFetch('/api/test');
    } catch (err) {
      expect(err.message).toContain('请求失败');
      expect(err.status).toBe(500);
    }
  });
});

// ===========================================================================
// 204 No Content
// ===========================================================================
describe('204 No Content', () => {
  it('204 响应返回 null', async () => {
    sandbox.fetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body')),
    });

    const result = await apiFetch('/api/test', { method: 'DELETE' });
    expect(result).toBeNull();
  });
});
