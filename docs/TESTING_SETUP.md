# StoryTree 测试配置指南

## Web 前端测试

### 安装依赖
```bash
cd web
npm install
```

### 运行测试
```bash
npm test                    # 运行所有测试
npm run test:watch         # 监视模式
npm run test:coverage      # 生成覆盖率报告
```

### 测试文件
- `__tests__/auth-state.test.js` - Web 前端认证状态测试

### 测试覆盖
- ✅ Token 和 user 数据同时存在检查
- ✅ 浏览器 bfcache 场景
- ✅ 跨标签页状态同步
- ✅ 注销功能

---

## 小程序端测试

### 安装依赖
```bash
cd miniprogram
npm install jsdom@24.1.3 --save-dev --legacy-peer-deps
```

### 运行测试
```bash
npm test                    # 运行所有测试
npm run test:watch         # 监视模式
npm run test:coverage      # 生成覆盖率报告
```

### 测试文件
- `src/api/__tests__/auth-state.test.ts` - 小程序认证状态测试
- `src/api/__tests__/*.test.ts` - API 测试
- `src/utils/__tests__/*.test.ts` - 工具函数测试
- `src/store/__tests__/*.test.ts` - Store 测试

### 测试覆盖
- ✅ 登录事件传播
- ✅ 页面监听 user:logged-in 事件
- ✅ 未登录状态检测
- ✅ 登录后数据加载

---

## CI/CD 配置

GitHub Actions 自动运行：
- API 测试
- 小程序测试（包含 jsdom 安装）
- Web 前端测试

配置文件：`.github/workflows/test.yml`

---

## 常见问题

### Q: 小程序测试报错 "localStorage is not defined"
A: 确保安装了 jsdom 并在 vitest.config.ts 中配置了 `environment: 'jsdom'`

### Q: Web 测试报错 "Cannot find module 'vitest'"
A: 运行 `npm install` 安装依赖

### Q: 测试失败 "jsdom is not defined"
A: 在 miniprogram 目录运行：
```bash
npm install jsdom@24.1.3 --save-dev --legacy-peer-deps
```

---

## 测试覆盖率目标

| 模块 | 当前覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| Web 前端认证状态 | 100% | 100% |
| 小程序认证状态 | 100% | 100% |
| API 测试 | 85% | 90% |
| Store 测试 | 90% | 95% |

---

**最后更新**: 2026-05-15