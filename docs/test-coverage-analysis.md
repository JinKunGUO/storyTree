# 测试覆盖缺口分析：Web 前端认证状态漏洞

## 问题概述

2026-05-15 发现严重权限漏洞：Web 前端在用户注销或 token 过期后，导航栏仍显示登录状态（用户名可见，个人中心链接可点击），但访问受保护资源时报 401 错误。

## 根本原因

`web/js/navbar.js` 中的 `checkAuthStatus()` 函数只检查 token 存在性，未检查 user 数据：

```javascript
// 漏洞代码（已修复）
function checkAuthStatus() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    // ❌ 缺少对 user 数据的检查
    const isLoggedIn = !!token;  // 漏洞：只检查 token
}
```

同时存在两个监听盲区：
1. **浏览器缓存（bfcache）**：用户使用浏览器后退按钮时，页面从 bfcache 恢复，不重新执行 JavaScript
2. **跨标签页同步**：其他标签页退出登录时，当前标签页未同步状态

## 为什么自动化测试没有发现

### 1. 后端 API 测试覆盖充足，但前端状态管理测试缺失

现有测试 `api/src/routes/__tests__/auth.test.ts` 覆盖了：
- ✅ 登录/注册 API 正确响应
- ✅ 密码错误、账号封禁等场景
- ✅ Token 生成和验证

**但未覆盖**：
- ❌ 前端 UI 在 token 过期后的状态显示
- ❌ 浏览器 bfcache 导致的认证状态残留
- ❌ 跨标签页登录/注销状态同步

### 2. CI/CD 流程缺少前端 E2E 测试

`.github/workflows/test.yml` 运行：
- ✅ 后端 API 测试
- ✅ 小程序单元测试

**但缺失**：
- ❌ Web 前端认证状态测试
- ❌ 浏览器导航行为测试（前进/后退/缓存）
- ❌ 跨标签页同步测试

### 3. 测试金字塔失衡

```
        ╱╲
       ╱  ╲      ← E2E 测试（完全缺失）
      ╱────╲
     ╱      ╲    ← 集成测试（部分缺失）
    ╱────────╲
   ╱          ╲  ← 单元测试（充足）
  ╱────────────╲
```

## 已实施的修复

### 代码修复（已完成）

**文件**: `web/js/navbar.js`

```javascript
// 修复后的代码
function checkAuthStatus() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    
    // ✅ 必须同时有 token 和 user 数据才认为是已登录状态
    const isLoggedIn = !!(token && userStr);
    
    if (isLoggedIn) {
        // 显示登录状态
    } else {
        // 清除残留数据
        if (userStr) {
            localStorage.removeItem('user');
            sessionStorage.removeItem('user');
        }
        // 显示未登录状态
    }
}

// ✅ 监听 pageshow 事件（处理 bfcache）
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        checkAuthStatus();
    }
});

// ✅ 监听 storage 事件（跨标签页同步）
window.addEventListener('storage', function(event) {
    if (event.key === 'token' || event.key === 'user') {
        checkAuthStatus();
    }
});
```

### 测试补充（新增）

#### 1. Web 前端认证状态测试

**文件**: `web/__tests__/auth-state.test.js`

覆盖场景：
- ✅ Token 和 user 数据同时存在时才显示登录状态
- ✅ 只有 token 或只有 user 时显示未登录状态
- ✅ bfcache 返回后重新检查认证状态
- ✅ 跨标签页 storage 事件同步
- ✅ logout 函数清除所有认证数据

#### 2. 小程序认证状态同步测试

**文件**: `miniprogram/src/api/__tests__/auth-state.test.ts`

覆盖场景：
- ✅ 登录事件触发和传播
- ✅ 页面监听 user:logged-in 事件
- ✅ 未登录状态检测
- ✅ 登录后数据加载

#### 3. CI/CD 流程更新

**文件**: `.github/workflows/test.yml`

新增 job：
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
| 前端登录状态显示 | ❌ | ✅ | **已补充** |
| 前端注销状态同步 | ❌ | ✅ | **已补充** |
| Bfcache 场景 | ❌ | ✅ | **已补充** |
| 跨标签页同步 | ❌ | ✅ | **已补充** |
| 小程序登录事件 | ❌ | ✅ | **已补充** |

## 关键教训

### 1. 前端状态管理必须测试

认证不仅是后端 API 的问题，前端状态管理同样关键。用户可见的是前端 UI，而非 API 响应。

### 2. 浏览器行为不可假设

- **Bfcache**: 现代浏览器会缓存完整页面状态（包括 JavaScript 执行后的 DOM）
- **Storage 事件**: 跨标签页同步需要显式监听
- **Pageshow 事件**: 必须专门处理 bfcache 场景

### 3. 安全相关的 UI 状态必须测试

以下 UI 状态应纳入测试范围：
- 登录/注销状态显示
- 权限相关的按钮/菜单可见性
- Token 过期后的 UI 反馈
- 跨标签页/窗口的状态同步

## 后续改进建议

### P0（立即执行）
- [ ] 运行新增的 Web 前端测试并确保通过
- [ ] 将认证状态测试纳入 CI/CD 必过检查
- [ ] 审查其他前端状态管理逻辑（用户资料、权限控制）

### P1（本周内）
- [ ] 添加 E2E 测试（使用 Playwright 或 Cypress）
  - 完整登录流程
  - 注销后导航栏状态验证
  - Token 过期后自动跳转
- [ ] 添加可访问性测试（确保认证状态对屏幕阅读器友好）

### P2（本月内）
- [ ] 实现视觉回归测试（防止 UI 状态显示错误）
- [ ] 添加性能测试（认证状态检查不应阻塞页面渲染）
- [ ] 建立安全审计清单（认证/授权相关的前后端检查点）

## 参考资源

- [OWASP 认证测试指南](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/)
- [MDN: Back-forward cache](https://developer.mozilla.org/en-US/docs/Glossary/BFCache)
- [Vitest 文档](https://vitest.dev/)
- [Playwright 认证测试示例](https://playwright.dev/docs/auth)

---

**文档状态**: 已完成  
**最后更新**: 2026-05-15  
**负责人**: @jinkun