# 自动化测试与 CI/CD 使用指南

## 概览

项目使用 [Vitest](https://vitest.dev/) 作为统一测试框架，覆盖 API 后端和小程序前端两个子项目。

| 子项目 | 测试文件数 | 测试用例数 | 覆盖模块 |
|--------|-----------|-----------|---------|
| API 后端 | 7 | 160 | 纯函数验证、权限矩阵、注册/登录流程 |
| 小程序前端 | 11 | 121 | 工具函数、路由映射、Pinia Store、API 调用 |
| **合计** | **18** | **281** | |

---

## 快速开始

### 运行 API 后端测试

```bash
cd api

# 运行所有测试
npm test

# 监听模式（文件变动自动重跑）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 运行小程序前端测试

```bash
cd miniprogram

# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

覆盖率报告生成在 `coverage/` 目录下，打开 `coverage/index.html` 可查看详细结果。

---

## 测试文件结构

测试文件采用就近原则，放在源码目录的 `__tests__/` 子目录中：

```
api/
  vitest.config.ts
  tests/
    setup.ts                    # 全局 setup：环境变量 + Prisma mock
    helpers/
      prisma-mock.ts            # 类型化的 Prisma mock 访问器
      express-mock.ts           # mockRequest / mockResponse / mockNext
  src/
    utils/__tests__/
      middleware.test.ts         # safeParseInt 系列 + requireAdmin
      auth.test.ts              # 验证函数 + JWT + bcrypt
      points.test.ts            # getUserLevel 边界值 + 常量
      sensitiveWords.test.ts    # 敏感词扫描/屏蔽/审核
      milestones.test.ts        # 里程碑查找 + 徽章
      permissions.test.ts       # canViewStory 可见性矩阵
    routes/__tests__/
      auth.test.ts              # 注册/登录 HTTP 接口测试

miniprogram/
  vitest.config.ts
  tests/
    setup.ts                    # 全局 setup：uni 对象 mock
    mocks/
      request.ts                # HTTP 请求模块 mock
  src/
    utils/__tests__/
      helpers.test.ts           # 12 个工具函数
      routes.test.ts            # resolveSubpackagePath
    api/__tests__/
      nodes.test.ts             # buildSubTree 纯函数
      auth.test.ts              # 认证 API 调用
      stories.test.ts           # 故事 API 调用
      users.test.ts             # 用户 API 调用
      checkin.test.ts           # 签到 API 调用
      ai.test.ts                # AI API 调用
    pkgStory/api/__tests__/
      comments.test.ts          # 评论 API（voteType 映射）
    store/__tests__/
      user.test.ts              # 用户 Store 计算属性 + actions
      app.test.ts               # 应用 Store 阅读设置
```

---

## 添加新测试

### API 后端：纯函数测试

适用于不依赖数据库的工具函数，零 mock 成本：

```ts
// api/src/utils/__tests__/myUtil.test.ts
import { describe, it, expect } from 'vitest'
import { myFunction } from '../myUtil'

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('hello')).toBe('HELLO')
  })

  it('handles edge case', () => {
    expect(myFunction('')).toBe('')
  })
})
```

### API 后端：需要 Prisma mock 的测试

对于依赖数据库的函数，Prisma 已在 `tests/setup.ts` 中全局 mock，直接使用即可：

```ts
// api/src/utils/__tests__/myFeature.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { myDbFunction } from '../myFeature'
import { prisma } from '../../index'

describe('myDbFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data when found', async () => {
    // 设置 mock 返回值
    (prisma.users.findUnique as any).mockResolvedValue({ id: 1, username: 'test' })

    const result = await myDbFunction(1)
    expect(result).toEqual({ id: 1, username: 'test' })
  })
})
```

Express 中间件/路由测试可使用 `tests/helpers/` 中的工厂函数：

```ts
import { mockRequest, mockResponse, mockNext } from '../../../tests/helpers/express-mock'
```

### 小程序前端：纯函数测试

```ts
// miniprogram/src/utils/__tests__/myHelper.test.ts
import { describe, it, expect } from 'vitest'
import { myHelper } from '../myHelper'

describe('myHelper', () => {
  it('works correctly', () => {
    expect(myHelper('input')).toBe('output')
  })
})
```

### 小程序前端：Pinia Store 测试

```ts
// miniprogram/src/store/__tests__/myStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMyStore } from '../myStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useMyStore', () => {
  it('computed property works', () => {
    const store = useMyStore()
    expect(store.someComputed).toBe(true)
  })
})
```

### 小程序前端：API 模块测试

```ts
// miniprogram/src/api/__tests__/myApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 用 vi.hoisted 定义 mock，确保 vi.mock 工厂可引用
const mockHttp = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({} as any)),
  post: vi.fn(() => Promise.resolve({} as any)),
}))

vi.mock('@/utils/request', () => ({ default: mockHttp }))

// 必须在 vi.mock 之后导入
import { myApiFunction } from '../myApi'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('myApiFunction', () => {
  it('calls correct URL', async () => {
    await myApiFunction({ id: 1 })
    expect(mockHttp.get).toHaveBeenCalledWith('/api/my-endpoint', { id: 1 })
  })
})
```

---

## Mock 策略说明

### API 后端

| Mock 对象 | 实现方式 | 文件 |
|-----------|---------|------|
| Prisma Client | `vi.mock('../src/db')` 全局替换 | `tests/setup.ts` |
| Express index | `vi.mock('../src/index')` 阻止服务器启动 | `tests/setup.ts` |
| 环境变量 | setup 中直接设置 `process.env` | `tests/setup.ts` |
| Request/Response | 工厂函数创建 mock 对象 | `tests/helpers/express-mock.ts` |

`tests/setup.ts` 在所有测试之前执行，设置了：
- `JWT_SECRET` — 避免 auth 模块在无配置时报错
- `NODE_ENV=test` — 标识测试环境
- `DISABLE_EMAIL=true` — 阻止真实邮件发送
- Prisma 全局 mock — 所有 `prisma.*` 调用返回 `undefined`，单个测试用 `mockResolvedValue` 覆盖

### 小程序前端

| Mock 对象 | 实现方式 | 文件 |
|-----------|---------|------|
| `uni` 全局 | `vi.stubGlobal('uni', ...)` | `tests/setup.ts` |
| `getCurrentPages` | `vi.stubGlobal` | `tests/setup.ts` |
| Storage | Map 模拟，`beforeEach` 清空 | `tests/setup.ts` |
| HTTP 请求 | 各测试文件内 `vi.mock('@/utils/request')` | 每个测试文件 |
| `import.meta.env` | `vitest.config.ts` 中 `define` | `vitest.config.ts` |

---

## CI/CD

### GitHub Actions 工作流

配置文件：`.github/workflows/test.yml`

**触发条件**：推送到 `main` 或 `develop` 分支，以及向这两个分支提交 PR。

**并行 Job**：

| Job | 工作目录 | 步骤 |
|-----|---------|------|
| `api-tests` | `api/` | npm ci → prisma generate → npm test → 上传覆盖率 |
| `miniprogram-tests` | `miniprogram/` | npm ci --legacy-peer-deps → npm test → 上传覆盖率 |

两个 Job 并行运行，互不阻塞。覆盖率报告作为 Artifact 上传，可在 Actions 页面下载查看。

### 启用 PR 状态检查

在 GitHub 仓库中配置 PR 合并保护规则，确保测试通过才能合并：

1. 进入仓库 **Settings → Branches → Branch protection rules**
2. 点击 **Add rule**，Branch name pattern 填 `main`
3. 勾选 **Require status checks to pass before merging**
4. 搜索并勾选 `api-tests` 和 `miniprogram-tests`
5. 点击 **Create**

配置后，PR 必须两个 Job 都通过才能合并。

### 本地验证 CI 行为

提交前可本地模拟 CI 流程：

```bash
# API 后端
cd api
npm ci
npx prisma generate
npm test

# 小程序前端
cd miniprogram
npm ci --legacy-peer-deps
npm test
```

---

## 常见问题

### Q: 运行测试时出现 `EADDRINUSE` 错误

A: 确保 `api/tests/setup.ts` 中已 mock `../src/index`，阻止 Express 服务器在测试中启动。如果新增的路由文件导入了未 mock 的模块导致服务器启动，需要在 setup.ts 中补充 mock。

### Q: 小程序测试中 `uni is not defined`

A: 确保 `miniprogram/tests/setup.ts` 被正确加载。检查 `vitest.config.ts` 中 `setupFiles` 路径是否正确。如果新测试文件引用了未 mock 的 `uni` 方法，在 setup.ts 的 `uniMock` 对象中补充。

### Q: API 测试中 Prisma mock 不生效

A: 检查 mock 路径。源码中 `import { prisma } from '../index'` 对应的 mock 路径是 `../src/index`（从 setup.ts 角度），而不是 `@prisma/client`。如果某个测试文件需要覆盖全局 mock，可在该文件中用 `vi.mock('../../index', ...)` 重新定义。

### Q: 小程序 API 测试中 `Cannot read properties of undefined`

A: 确保 `vi.mock('@/utils/request', ...)` 写在 `import` 语句之前。Vitest 会自动提升 `vi.mock` 调用，但 mock 工厂中引用的变量需要用 `vi.hoisted()` 包裹：

```ts
const mockHttp = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/utils/request', () => ({ default: mockHttp }))
```

### Q: 如何只运行某个测试文件

```bash
# API 后端
cd api && npx vitest run src/utils/__tests__/auth.test.ts

# 小程序前端
cd miniprogram && npx vitest run src/utils/__tests__/helpers.test.ts
```

### Q: 如何跳过某个测试

```ts
it.skip('暂时跳过', () => { ... })
// 或
describe.skip('整组跳过', () => { ... })
```

### Q: npm ci 在小程序端失败

A: 小程序端存在 echarts 版本冲突（echarts-for-weixin 要求 v5，项目使用 v6），需加 `--legacy-peer-deps`：

```bash
npm ci --legacy-peer-deps
```

CI 工作流中已配置此参数。