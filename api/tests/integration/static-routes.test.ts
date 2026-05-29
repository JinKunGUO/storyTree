import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock OpenAI before importing app
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {}
    }
  };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      constructor() {}
    }
  };
});

import { createApp } from '../../src/app';

describe('Static File Routes (SPA Fallback)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('SPA页面路由', () => {
    it('应该为 /verify-email 返回 verify-email.html', async () => {
      const response = await request(app)
        .get('/verify-email?token=test-token')
        .expect(200)
        .expect('Content-Type', /html/);

      // 验证返回的是 verify-email.html，不是 index.html
      expect(response.text).toContain('邮箱验证');
      expect(response.text).not.toContain('发现故事'); // index.html 的特有内容
    });

    it('应该为 /register 返回 register.html', async () => {
      const response = await request(app)
        .get('/register')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('注册');
      
      // 验证密码要求提示存在
      expect(response.text).toContain('password-requirements');
      expect(response.text).toContain('至少8个字符');
      expect(response.text).toContain('包含字母');
      expect(response.text).toContain('包含数字');
    });

    it('应该为 /login 返回 login.html', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('登录');
      expect(response.text).not.toContain('发现故事');
    });

    it('应该为 /reset-password 返回 reset-password.html', async () => {
      const response = await request(app)
        .get('/reset-password?token=test-token')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('重置密码');
      expect(response.text).not.toContain('发现故事');
    });

    it('应该为 /forgot-password 返回 forgot-password.html', async () => {
      const response = await request(app)
        .get('/forgot-password')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('忘记密码');
      expect(response.text).not.toContain('发现故事');
    });
  });

  describe('Fallback 到 index.html', () => {
    it('应该为未知路径返回 index.html', async () => {
      const response = await request(app)
        .get('/non-existent-page')
        .expect(200)
        .expect('Content-Type', /html/);

      // 验证返回的是 index.html
      expect(response.text).toContain('发现故事');
    });

    it('应该为根路径返回 index.html', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/);

      expect(response.text).toContain('发现故事');
    });
  });

  describe('API 路由不受影响', () => {
    it('应该为不存在的 API 路径返回 404 JSON', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('error', 'API not found');
    });

    it('应该正常访问健康检查端点', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('查询参数保留', () => {
    it('verify-email 路由应该保留 token 查询参数', async () => {
      const response = await request(app)
        .get('/verify-email?token=abc123&extra=param')
        .expect(200);

      // HTML 文件应该被正确返回（查询参数不影响路由）
      expect(response.text).toContain('邮箱验证');
    });

    it('reset-password 路由应该保留 token 查询参数', async () => {
      const response = await request(app)
        .get('/reset-password?token=xyz789')
        .expect(200);

      expect(response.text).toContain('重置密码');
    });
  });
});
