/**
 * StoryTree Web 前端认证状态测试
 *
 * 测试场景：
 * 1. 用户注销后，导航栏应立即显示未登录状态
 * 2. Token 过期后，页面不应显示登录状态
 * 3. 浏览器缓存（bfcache）返回后，认证状态应正确刷新
 * 4. 跨标签页登录/注销状态应同步
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// 读取 navbar.js 源码
function getNavbarScript() {
  const navbarPath = path.join(__dirname, '../js/navbar.js');
  return fs.readFileSync(navbarPath, 'utf-8');
}

// 执行 navbar.js 源码
function runNavbarScript() {
  const script = getNavbarScript();
  // 使用 eval 执行，每次都是新的上下文
  eval(script);
}

describe('Web 前端认证状态管理', () => {
  beforeEach(() => {
    // 设置 DOM
    document.body.innerHTML = `
      <nav id="navbar">
        <a id="loginLink">登录</a>
        <a id="registerLink">注册</a>
        <a id="profileLink">个人中心</a>
        <a id="logoutLink">退出</a>
        <a id="myStoriesLink">我的故事</a>
        <div id="notificationIcon">🔔</div>
        <span id="notificationBadge"></span>
      </nav>
    `;
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('checkAuthStatus 函数', () => {
    it('只有 token 没有 user 时应显示未登录状态', () => {
      // 设置场景：只有 token，没有 user
      localStorage.setItem('token', 'fake-token');
      localStorage.removeItem('user');

      runNavbarScript();

      // 未登录状态：登录/注册链接应显示 (flex)
      expect(document.getElementById('loginLink').style.display).toBe('flex');
      expect(document.getElementById('registerLink').style.display).toBe('flex');
      // 个人中心/退出链接应隐藏
      expect(document.getElementById('profileLink').style.display).toBe('none');
      expect(document.getElementById('logoutLink').style.display).toBe('none');
    });

    it('只有 user 没有 token 时应显示未登录状态', () => {
      localStorage.clear();
      document.body.innerHTML = '';
      document.body.innerHTML = `
        <nav id="navbar">
          <a id="loginLink">登录</a>
          <a id="registerLink">注册</a>
          <a id="profileLink">个人中心</a>
          <a id="logoutLink">退出</a>
        </nav>
      `;

      localStorage.removeItem('token');
      localStorage.setItem('user', JSON.stringify({ username: 'test' }));

      runNavbarScript();

      // 未登录状态
      expect(document.getElementById('profileLink').style.display).toBe('none');
      expect(document.getElementById('loginLink').style.display).toBe('flex');
    });

    it('token 和 user 都存在时应显示登录状态', () => {
      localStorage.clear();
      document.body.innerHTML = '';
      document.body.innerHTML = `
        <nav id="navbar">
          <a id="loginLink">登录</a>
          <a id="registerLink">注册</a>
          <a id="profileLink">个人中心</a>
          <a id="logoutLink">退出</a>
          <a id="myStoriesLink">我的故事</a>
          <div id="notificationIcon">🔔</div>
        </nav>
      `;

      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ username: 'testuser' }));

      runNavbarScript();

      // 登录状态：个人中心/退出链接应显示
      expect(document.getElementById('profileLink').style.display).toBe('flex');
      expect(document.getElementById('logoutLink').style.display).toBe('flex');
      expect(document.getElementById('myStoriesLink').style.display).toBe('flex');
      // 登录/注册链接应隐藏
      expect(document.getElementById('loginLink').style.display).toBe('none');
      expect(document.getElementById('registerLink').style.display).toBe('none');
    });
  });

  describe('浏览器缓存 (bfcache) 场景', () => {
    it('从 bfcache 返回时应重新检查认证状态', () => {
      // 初始状态：已登录
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ username: 'testuser' }));

      runNavbarScript();

      // 验证初始为登录状态
      expect(document.getElementById('profileLink').style.display).toBe('flex');

      // 模拟用户在另一个标签页退出登录
      localStorage.clear();

      // 模拟 pageshow 事件（从 bfcache 返回）
      const pageShowEvent = new Event('pageshow');
      Object.defineProperty(pageShowEvent, 'persisted', { value: true });
      window.dispatchEvent(pageShowEvent);

      // 应更新为未登录状态
      expect(document.getElementById('loginLink').style.display).toBe('flex');
      expect(document.getElementById('profileLink').style.display).toBe('none');
    });
  });

  describe('跨标签页同步', () => {
    it('应监听 storage 事件并同步认证状态', () => {
      // 初始状态：已登录
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ username: 'testuser' }));

      runNavbarScript();

      // 验证初始为登录状态
      expect(document.getElementById('profileLink').style.display).toBe('flex');

      // 模拟 storage 事件（另一个标签页退出登录）
      localStorage.removeItem('token');
      const storageEvent = new StorageEvent('storage', {
        key: 'token',
        oldValue: 'fake-token',
        newValue: null
      });
      window.dispatchEvent(storageEvent);

      // 应更新为未登录状态
      expect(document.getElementById('profileLink').style.display).toBe('none');
      expect(document.getElementById('loginLink').style.display).toBe('flex');
    });
  });

  describe('注销功能', () => {
    it('应清除所有认证数据', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ username: 'testuser' }));

      runNavbarScript();

      // 验证初始为登录状态
      expect(localStorage.getItem('token')).toBe('fake-token');
      expect(localStorage.getItem('user')).toBe('{"username":"testuser"}');

      // 执行注销（会抛出导航错误，但数据应该被清除）
      try {
        window.logout();
      } catch (e) {
        // 忽略导航错误
      }

      // 验证数据已清除
      expect(localStorage.getItem('token')).toBe(null);
      expect(localStorage.getItem('user')).toBe(null);
      expect(sessionStorage.getItem('token')).toBe(null);
      expect(sessionStorage.getItem('user')).toBe(null);
    });
  });
});