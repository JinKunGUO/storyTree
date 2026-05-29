# 测试改进方案：防止类似 Bug 再次发生

## 🎯 目标

确保未来能够在部署前发现"开发环境正常，生产环境失败"的问题。

---

## 📊 当前测试覆盖情况

### ✅ 已实现的测试

| 测试类型 | 文件 | 覆盖环境 | 用例数 |
|---------|------|---------|--------|
| 单元测试 | `api/src/routes/__tests__/auth.test.ts` | 开发 | 21 |
| 单元测试 | `api/src/utils/__tests__/auth.test.ts` | 开发 | 32 |
| 集成测试 | `api/tests/integration/static-routes.test.ts` | 开发 | 11 |
| 环境一致性 | `scripts/check-env-consistency.sh` | 开发+生产 | 5 项检查 |
| 生产冒烟测试 | `scripts/smoke-test-production.sh` | 生产 | 16 项检查 |
| E2E 测试 | `tests/e2e/email-verification.spec.ts` | 开发+staging | 9 |

**总计：272 个自动化测试通过**

### 测试架构说明

```
┌─────────────────────────────────────────────────────────┐
│                    测试金字塔                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [生产环境]  smoke-test-production.sh                    │
│             → 部署后运行，验证 Nginx 路由 + API 可用性     │
│                                                         │
│  [开发环境]  static-routes.test.ts                       │
│             → CI 中运行，验证 Express SPA fallback        │
│                                                         │
│  [代码级别]  auth.test.ts / utils tests                  │
│             → CI 中运行，验证业务逻辑正确性                │
│                                                         │
│  [配置级别]  check-env-consistency.sh                    │
│             → CI 中运行，验证开发/生产配置一致性            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 开发环境 vs 生产环境覆盖对比

| 验证项 | 开发环境（Express） | 生产环境（Nginx） |
|--------|-------------------|------------------|
| `/verify-email` 返回正确页面 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| `/register` 返回正确页面 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| `/login` 返回正确页面 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| `/reset-password` 返回正确页面 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| 未知路径 fallback 到 index.html | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| 密码要求提示存在 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| API 404 正确返回 | ✅ `static-routes.test.ts` | ✅ `smoke-test-production.sh` |
| 邮箱验证端点逻辑 | ✅ `auth.test.ts` | — |
| 密码验证规则 | ✅ `auth.test.ts` | — |
| 环境配置一致性 | ✅ `check-env-consistency.sh` | — |

---

## 🔧 已实现的测试详情

### 1. 邮箱验证端点单元测试（✅ 已实现）

**文件**：`api/src/routes/__tests__/auth.test.ts`

覆盖 5 个用例：
- `returns 400 when token is missing` — 缺少 token 返回 400
- `returns 400 when token is invalid or expired` — 无效/过期 token 返回 400
- `returns 200 and sets emailVerified to true on success` — 成功验证
- `does not return JWT token after verification` — 验证不返回 JWT token
- `skips database update when email is already verified` — 已验证时跳过更新

---

### 2. 静态文件路由集成测试（✅ 已实现）

**文件**：`api/tests/integration/static-routes.test.ts`

**覆盖环境**：开发环境（Express SPA fallback）

使用 vitest + supertest 测试 Express 应用的路由行为，覆盖 11 个用例：
- SPA 页面路由（verify-email, register, login, reset-password, forgot-password）
- Fallback 到 index.html（未知路径、根路径）
- API 路由不受影响（404 JSON、健康检查）
- 查询参数保留

**运行方式**：
```bash
cd api && npm test
```

---

### 3. 生产环境路由冒烟测试（✅ 已实现）

**文件**：`scripts/smoke-test-production.sh`

**覆盖环境**：生产环境（Nginx 路由）

部署后运行，使用 curl 直接测试生产 URL，验证 Nginx `try_files` 配置正确：
- 页面路由测试（5 个页面）
- 注册页面密码提示验证（4 项）
- Fallback 路由测试（2 项）
- API 端点可用性（3 项）
- 静态资源可访问性（2 项）

**运行方式**：
```bash
# 测试生产环境
bash scripts/smoke-test-production.sh https://storytree.online

# 测试 staging 环境
bash scripts/smoke-test-production.sh https://staging.storytree.online

# 测试本地开发环境
bash scripts/smoke-test-production.sh http://localhost:3001
```

---

### 4. 环境一致性检查脚本（✅ 已实现）

**文件**：`scripts/check-env-consistency.sh`

**覆盖环境**：代码级别（静态分析）

检查开发环境和生产环境配置的一致性：
- Nginx 配置包含 `$uri.html`（支持无扩展名路由）
- Express SPA fallback 包含所有页面
- 后端密码验证逻辑（字母+数字）
- 前端密码验证逻辑一致性
- 验证成功后跳转到 `/login`
- 环境变量文档完整性

**运行方式**：
```bash
bash scripts/check-env-consistency.sh
```

**CI 集成**：已添加到 `.github/workflows/test.yml` 的 `env-consistency` job。

---

## 🚀 实施计划

### 第一阶段（✅ 已完成）
- [x] 补充邮箱验证端点的单元测试（`api/src/routes/__tests__/auth.test.ts`，5 个用例）
- [x] 创建部署验证清单（`scripts/deployment-checklist.md`）
- [x] 添加环境一致性检查脚本（`scripts/check-env-consistency.sh`）
- [x] 将环境检查集成到 CI（`.github/workflows/test.yml` 新增 `env-consistency` job）

### 第二阶段（✅ 已完成）
- [x] 添加静态文件路由集成测试（`api/tests/integration/static-routes.test.ts`，11 个用例）
- [x] 重构 Express app 架构（`api/src/app.ts` 分离，支持测试导入）
- [x] 创建生产环境冒烟测试脚本（`scripts/smoke-test-production.sh`，16 项检查）
- [x] 更新 vitest 配置支持集成测试路径

### 第三阶段（✅ 已完成）

**环境策略**（决策：暂不搭建独立 Staging，现有测试覆盖已足够）：
- **开发环境**（`localhost:3001`）→ CI 自动跑完整 E2E
- **生产环境**（`storytree.online`）→ 部署后自动运行冒烟测试，不创建用户

**已完成**：
- [x] 安装 Playwright，配置 `baseURL` 通过 `E2E_BASE_URL` 环境变量切换（`playwright.config.ts`）
- [x] 实现注册-验证-登录 E2E 测试（`tests/e2e/email-verification.spec.ts`，9 个用例）
- [x] CI 集成：`e2e-tests` job 已加入 `.github/workflows/test.yml`
- [x] 页面路由 E2E 验证（5 个）+ 密码提示 E2E 验证（2 个）已通过生产环境验证
- [x] 将冒烟测试集成到部署脚本（`scripts/deploy.sh` 部署完成后自动运行）

**后续可选**：
- [ ] 扩展 E2E 测试覆盖率（密码重置、登录等）
- [ ] 如项目规模增大，考虑搭建 Staging 环境或 CI 中用 Docker 模拟生产

---

## 📈 测试覆盖率

| 测试类型 | 当前状态 | 用例数 | 覆盖环境 |
|---------|---------|--------|---------|
| 单元测试（API 端点） | ✅ 已实现 | 272 | 开发 |
| 集成测试（路由） | ✅ 已实现 | 11 | 开发 |
| 环境一致性检查 | ✅ 已实现 | 5 项 | 代码级 |
| 生产冒烟测试 | ✅ 已实现 | 16 项 | 生产 |
| E2E 测试（Playwright） | ✅ 已实现 | 9（7 已验证） | 开发+staging+生产 |

---

## 📋 部署检查流程

```
代码提交 → CI 自动运行:
  ├── env-consistency (环境一致性检查)
  ├── api-tests (272 个单元测试 + 集成测试)
  ├── e2e-tests (Playwright E2E 测试，9 个用例)
  ├── miniprogram-tests
  └── web-frontend-tests

部署完成 → 自动运行（集成在 deploy.sh 中）:
  └── smoke-test-production.sh (生产环境冒烟测试，16 项检查)
```

---

## 📚 参考资源

- [Playwright 文档](https://playwright.dev/)
- [Vitest 文档](https://vitest.dev/)
- [MailHog（邮件测试）](https://github.com/mailhog/MailHog)
- [Nginx 测试最佳实践](https://www.nginx.com/blog/testing-nginx-configuration/)
