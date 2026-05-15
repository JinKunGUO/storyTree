# Web 前端认证状态漏洞修复总结

## 问题描述

**发现时间**: 2026-05-15  
**严重程度**: 高危（权限绕过）  
**影响范围**: Web 前端所有页面

### 漏洞表现

用户注销或 token 过期后：
1. 导航栏仍显示上次登录的用户名
2. 点击"个人中心"链接可进入个人页面
3. 访问受保护资源时报 401 错误（Failed to load resource: the server responded with a status of 401 (Unauthorized)）

### 根本原因

`web/js/navbar.js` 中的 `checkAuthStatus()` 函数只检查 token 存在性，未检查 user 数据：

```javascript
// 漏洞代码
const isLoggedIn = !!(token || userStr);  // ❌ 只检查 token 或 user 任一存在
```

同时缺失两个关键监听器：
1. **pageshow 事件**：处理浏览器 bfcache 返回场景
2. **storage 事件**：处理跨标签页状态同步

## 修复方案

### 1. 代码修复（已完成）

**文件**: `web/js/navbar.js`

**关键修改**:
```javascript
// ✅ 修复后：必须同时有 token 和 user 数据
const isLoggedIn = !!(token && userStr);

// ✅ 新增：监听 pageshow 事件（处理 bfcache）
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        checkAuthStatus();
    }
});

// ✅ 新增：监听 storage 事件（跨标签页同步）
window.addEventListener('storage', function(event) {
    if (event.key === 'token' || event.key === 'user') {
        checkAuthStatus();
    }
});
```

### 2. 测试补充（已完成）

#### Web 前端测试

**文件**: `web/__tests__/auth-state.test.js`

覆盖场景：
- ✅ 只有 token 没有 user → 未登录状态
- ✅ 只有 user 没有 token → 未登录状态
- ✅ token 和 user 都存在 → 登录状态
- ✅ bfcache 返回后状态刷新
- ✅ 跨标签页 storage 事件同步
- ✅ logout 函数清除所有认证数据

**运行测试**:
```bash
cd web
npm test
```

#### 小程序端测试

**文件**: `miniprogram/src/api/__tests__/auth-state.test.ts`

覆盖场景：
- ✅ 登录事件触发和传播
- ✅ 页面监听 user:logged-in 事件
- ✅ 写作中心登录状态检测
- ✅ 邀请页登录状态检测

**运行测试**:
```bash
cd miniprogram
npm test
```

### 3. CI/CD 更新（已完成）

**文件**: `.github/workflows/test.yml`

新增 `web-frontend-tests` job：
```yaml
web-frontend-tests:
  runs-on: ubuntu-latest
  steps:
    - run: npm ci
    - run: npm test  # 运行 Web 前端测试
```

## 测试覆盖矩阵

| 测试场景 | 原有测试 | 新增测试 | 状态 |
|---------|---------|---------|------|
| 后端登录 API | ✅ | - | 已覆盖 |
| 后端注册 API | ✅ | - | 已覆盖 |
| Token 验证 | ✅ | - | 已覆盖 |
| **前端登录状态显示** | ❌ | ✅ | **已补充** |
| **前端注销状态同步** | ❌ | ✅ | **已补充** |
| **Bfcache 场景** | ❌ | ✅ | **已补充** |
| **跨标签页同步** | ❌ | ✅ | **已补充** |
| **小程序登录事件** | ❌ | ✅ | **已补充** |

## 验证步骤

### 本地验证
```bash
# 1. Web 前端测试
cd web
npm test

# 2. 小程序端测试
cd miniprogram
npm test
```

### CI/CD 验证
推送代码后，GitHub Actions 将自动运行：
- API 测试
- 小程序测试
- **Web 前端测试（新增）**

## 关键教训

### 1. 前端状态管理必须测试
认证不仅是后端 API 的问题，前端状态管理同样关键。用户可见的是前端 UI，而非 API 响应。

### 2. 浏览器行为不可假设
- **Bfcache**: 现代浏览器会缓存完整页面状态（包括 JavaScript 执行后的 DOM）
- **Storage 事件**: 跨标签页同步需要显式监听
- **Pageshow 事件**: 必须专门处理 bfcache 场景

### 3. 安全相关的 UI 状态必须测试
以下 UI 状态应纳入测试范围：
- ✅ 登录/注销状态显示
- ✅ 权限相关的按钮/菜单可见性
- ✅ Token 过期后的 UI 反馈
- ✅ 跨标签页/窗口的状态同步

### 4. 测试金字塔需要平衡
```
        ╱╲
       ╱  ╲      ← E2E 测试（需要补充）
      ╱────╲
     ╱      ╲    ← 集成测试（部分缺失）
    ╱────────╲
   ╱          ╲  ← 单元测试（已充足）
  ╱────────────╲
```

## 后续改进建议

### P0（已完成）
- ✅ 修复 navbar.js 认证状态检查逻辑
- ✅ 添加 pageshow 和 storage 事件监听
- ✅ 创建 Web 前端认证状态测试
- ✅ 创建小程序认证状态同步测试
- ✅ 更新 CI/CD 配置

### P1（本周内）
- [ ] 添加 E2E 测试（使用 Playwright 或 Cypress）
  - 完整登录流程
  - 注销后导航栏状态验证
  - Token 过期后自动跳转
- [ ] 审查其他前端状态管理逻辑（用户资料、权限控制）

### P2（本月内）
- [ ] 实现视觉回归测试（防止 UI 状态显示错误）
- [ ] 添加性能测试（认证状态检查不应阻塞页面渲染）
- [ ] 建立安全审计清单（认证/授权相关的前后端检查点）

## 文件清单

### 修改的文件
- `web/js/navbar.js` - 修复认证状态检查逻辑
- `.github/workflows/test.yml` - 新增 Web 前端测试 job

### 新增的文件
- `web/__tests__/auth-state.test.js` - Web 前端认证状态测试
- `miniprogram/src/api/__tests__/auth-state.test.ts` - 小程序认证状态测试
- `web/package.json` - Web 测试依赖配置
- `web/vitest.config.js` - Vitest 配置文件
- `docs/test-coverage-analysis.md` - 测试覆盖分析报告
- `docs/SECURITY_FIX_SUMMARY.md` - 本文档

## 参考资源

- [OWASP 认证测试指南](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/)
- [MDN: Back-forward cache](https://developer.mozilla.org/en-US/docs/Glossary/BFCache)
- [Vitest 文档](https://vitest.dev/)
- [Playwright 认证测试示例](https://playwright.dev/docs/auth)

---

**修复状态**: 已完成  
**测试状态**: 6/6 通过  
**最后更新**: 2026-05-15  
**负责人**: @jinkun