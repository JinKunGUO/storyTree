# StoryTree 全栈代码审查报告

> **项目**: StoryTree v1.0.243 (M4-BranchCompare)
> **审查范围**: 后端 API / PC 前端 / 微信小程序 全三端
> **审查日期**: 2026-05-23
> **更新日期**: 2026-05-24
> **代码规模**: ~72,000 行 / 911 文件

---

## 审查概要

| 优先级 | 数量 | 已修复 | 待修复 | 说明 |
|--------|------|--------|--------|------|
| **P0 CRITICAL** | 6 | 2 | 4 | 可直接导致安全事故或资金损失 |
| **P1 HIGH** | 14 | 1 | 13 | 明确的安全风险或功能缺陷 |
| **P2 MEDIUM** | 11 | 0 | 11 | 近期优化项 |
| **合计** | **31** | **3** | **28** | |

---

## P0 CRITICAL -- 必须立即修复

> 可直接导致安全事故或资金损失

### C1. Mock 支付回调暴露在生产环境

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/payment.ts:341` |
| **影响** | 用户可零成本获取会员/积分，造成直接资金损失 |

**问题**: `/api/payment/callback/mock` 端点无认证且无环境检查。任何人可以传入 `orderId + success:true` 直接将订单标记为已支付。

**修复建议**: 添加 `if (process.env.NODE_ENV === 'production') return res.status(404)` 或彻底删除该端点。

---

### C2. 积分扣减竞态条件（双花攻击）

| 字段 | 值 |
|------|-----|
| **状态** | :white_check_mark: **已修复** (2026-05-24) |
| **文件** | `api/src/utils/points.ts` |
| **影响** | 用户积分可透支为负数，免费使用 AI 服务 |

**问题**: `deductPoints()` 先读余额再扣减，非原子操作。并发请求可双花。`addPoints()` 同样存在 read-then-write 丢失更新风险。

**修复方案**:
- `deductPoints()`: 改用 `$transaction` + `updateMany` 条件更新（`WHERE points >= amount`），确保原子扣减。竞态时 `updateMany.count === 0` 表示余额不足，安全失败。
- `addPoints()`: 改用 `$transaction` + `{ increment: amount }` 原子增加，通知操作移到事务外。

**测试覆盖**:
- `src/utils/__tests__/points-deduct.test.ts` — 10 个测试用例（余额充足、余额不足、并发竞态、事务原子性、管理员跳过、用户不存在、负数记录、原子 increment、升级检测）
- `src/routes/__tests__/points.test.ts` — 同步更新已有 21 个测试以匹配新原子操作

---

### C3. 微信登录绕过封禁检查

| 字段 | 值 |
|------|-----|
| **状态** | :white_check_mark: **已修复** (2026-05-24) |
| **文件** | `api/src/routes/auth.ts` |
| **影响** | 被封禁用户可通过微信登录恢复完整访问权限 |

**问题**: `/wx-login` 和 `/wx-web-login` 未检查 `isBanned`。邮箱登录有封禁检查（line 375），但微信登录两条路径均跳过。

**修复方案**:
- `/wx-login` (line 783): 在 `select` 中添加 `isBanned: true, bannedReason: true`。老用户路径添加封禁检查，返回 403。
- `/wx-web-login` (line 1128): 同上，添加封禁字段查询和检查逻辑。

**测试覆盖**:
- `src/routes/__tests__/auth.test.ts`:
  - `POST /api/auth/wx-login` — 3 个测试（封禁用户返回 403、正常用户返回 200、缺少 code 返回 400）
  - `POST /api/auth/wx-web-login` — 1 个测试（封禁用户返回 403）

---

### C4. Admin API 部分路由缺少权限校验

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/admin-content.ts`, `admin-points.ts`, `admin-dashboard.ts` |
| **影响** | 普通用户可调用管理员接口 |

**问题**: 部分路由仅验证 JWT 有效性，未检查 `isAdmin`。

**修复建议**: 所有 admin 路由统一添加 `adminMiddleware`。

---

### C5. 全站 XSS 漏洞（innerHTML 直接渲染用户数据）

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | 几乎所有 `web/*.html` 文件，`innerHTML` 出现 500+ 次 |
| **影响** | 攻击者在故事/评论/用户名中注入恶意脚本，窃取 JWT Token |

**具体注入点**:

| 文件 | 位置 | 影响范围 |
|------|------|----------|
| `js/pages/chapter.js:205-216` | 章节内容 `content` | 所有读者 |
| `js/pages/chapter.js:176` | 章节标题 `title` | 所有读者 |
| `js/pages/story.js:1364` | 章节标题（未定义 `escapeHtml`） | 所有故事页访客 |
| `admin.html:679-688` | 审核队列标题/内容/用户名 | **管理员** |
| `notifications.html:456-461` | 通知标题/内容/链接 | 被通知用户 |
| `comments.js:121,125,132` | 评论者用户名（内容已转义，用户名未转义） | 所有读者 |

**修复建议**:
1. 创建全局 `escapeHtml()` 工具函数（当前存在 6+ 份重复定义，`story.js` 完全没有）
2. 所有 `innerHTML` 中的用户数据必须转义
3. 富文本场景引入 DOMPurify

---

### C6. 小程序 `userStore.user` 属性不存在（权限检查全部失效）

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/pkgWrite/pages/write/editor.vue:705-746` |
| **影响** | 编辑器权限检查完全无效 |

**问题**: 代码访问 `userStore.user`（15 处），但 store 导出的是 `userInfo`。`userStore.user` 始终为 `undefined`，导致 `isStoryAuthor` 和 `isCollaborator` 永远为 false。

**修复建议**: 全局替换 `userStore.user` 为 `userStore.userInfo`。

---

## P1 HIGH -- 本周修复

> 明确的安全风险或功能缺陷

### H1. 折扣码未验证即给予 10% 优惠

| 字段 | 值 |
|------|-----|
| **状态** | :white_check_mark: **已修复** (2026-05-24) |
| **文件** | `api/src/routes/payment.ts`, `api/src/routes/membership.ts` |
| **影响** | 任意非空 discountCode 即享 10% 折扣 |

**问题**: 传入任意非空 `discountCode` 即触发无条件 10% 折扣（代码注释为 `// TODO`）。

**修复方案**: 删除 TODO 逻辑，使 `discountAmount` 始终为 0，`finalPrice` 始终等于 `originalPrice`。`discountCode` 字段保留但不影响价格计算。

**测试覆盖**:
- `src/routes/__tests__/discount-code.test.ts` — 4 个测试用例：
  - `POST /api/payment/membership/create` — 传入 discountCode 仍收全价
  - `POST /api/payment/membership/create` — 不传 discountCode 收全价
  - `POST /api/membership/upgrade/create` — 传入 discountCode 仍收全价
  - `POST /api/membership/upgrade/create` — 不传 discountCode 收全价

---

### H2. 密码重置 Token 明文存储

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/auth.ts:554,585,625` |
| **影响** | 数据库泄露后可重置任意用户密码 |

**问题**: `hashToken()` 工具函数已存在（`utils/auth.ts:84`）但从未使用。Token 明文存储在数据库中。

**修复建议**: 存储 `hashToken(token)`，验证时比较 `hashToken(submitted)`。

---

### H3. 微信支付 XML 回调解析失败

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/payment.ts:605` |
| **影响** | 微信支付回调无法正确处理 |

**问题**: `express.json()` 全局中间件先行解析请求体，微信支付 XML 回调（`text/xml`）无法被正确读取。

**修复建议**: 为微信支付回调路由单独注册 `express.raw({ type: 'text/xml' })` 中间件。

---

### H4. 文件上传路径穿越

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/upload.ts` |
| **影响** | 可写入任意目录 |

**问题**: 文件名使用 `Date.now() + originalname`，未过滤 `../`。

**修复建议**: 使用 `path.basename(originalname)` 或 UUID 命名。

---

### H5. 邮件重发端点无频率限制

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/auth.ts:694` |
| **影响** | 可被用于耗尽 SMTP 发送配额 |

**问题**: `/resend-verification` 无 rate limiter。

**修复建议**: 添加类似 `passwordResetLimiter` 的频率限制。

---

### H6. AI Worker 无超时保护

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/workers/aiWorker.ts` |
| **影响** | 挂起的请求会阻塞整个队列 |

**问题**: AI API 调用无超时设置。

**修复建议**: 设置 30-60 秒请求超时。

---

### H7. WebSocket 连接数无限制

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/utils/websocket.ts` |
| **影响** | 可被用于资源耗尽攻击 |

**问题**: 无每用户或全局连接数限制。

**修复建议**: 限制每用户 5 个连接，全局 1000 个。

---

### H8. 签到端点竞态条件

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/checkin.ts:72-236` |
| **影响** | 并发请求可刷签到积分 |

**问题**: Read-then-write 模式，并发请求可重复签到。

**修复建议**: 包裹在事务中，使用唯一约束作为兜底。

---

### H9. 邀请码竞态条件

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/invitations.ts:501-505` |
| **影响** | 邀请码可被超量使用 |

**问题**: `used_count` 递增非原子操作。

**修复建议**: 使用 `UPDATE WHERE used_count < max_uses AND version = ?`。

---

### H10. CDN 依赖缺少 SRI 校验

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `web/write.html:15-16` |
| **影响** | CDN 被攻陷则全站沦陷 |

**问题**: Quill.js 从 CDN 加载且无 `integrity` 属性。

**修复建议**: 添加 SRI hash 或改用本地托管。

---

### H11. 小程序 AI 轮询定时器泄漏

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/pkgStory/pages/story/index.vue:831-833` |
| **影响** | 内存泄漏，后台持续轮询 |

**问题**: `onUnmounted` 未调用 `stopPollTask()`，`setInterval` 在页面离开后继续运行。

**修复建议**: 在 `onUnmounted` 中添加 `stopPollTask()`。

---

### H12. WebSocket Token 暴露在 URL 参数中

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/utils/ws-client.ts:88` |
| **影响** | JWT 可能出现在服务器日志和代理日志中 |

**问题**: JWT 通过 query string 传递。

**修复建议**: 改用 WebSocket sub-protocol 或在首条消息中发送 token。

---

### H13. 小程序无统一 Token 过期拦截器

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/api/*.ts` |
| **影响** | Token 过期后各 API 行为不一致 |

**问题**: 各 API 模块独立处理请求，无全局 401 拦截器。

**修复建议**: 在请求工具层添加统一 401 处理，自动跳转登录页。

---

### H14. WebSocket 不校验 `active_token`

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/utils/websocket.ts:269-299` |
| **影响** | 单端互踢机制在 WebSocket 层失效 |

**问题**: REST 中间件检查 `active_token`（单设备登录），但 WebSocket 鉴权跳过此步骤。

**修复建议**: 在 WebSocket `authenticate()` 函数中添加 `active_token` 比对。

---

## P2 MEDIUM -- 近期优化

> 功能优化和代码质量改进

### M1. onclick 内联处理器注入

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `web/js/pages/story.js:1379` |

**问题**: 标题中的反斜杠可以逃逸 onclick 处理器，导致 XSS。

---

### M2. 写作页 `hasUnsavedChanges` 未跟踪编辑器内容变化

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `web/js/pages/write.js:240` |

**问题**: 编辑器内容变化时未更新未保存标志，用户可能丢失内容。

---

### M3. 自动保存首次 POST 后未更新 `lastNodeId`，可能创建重复章节

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `web/js/pages/write.js:132-200` |

**问题**: 首次 POST 创建章节后 `lastNodeId` 未更新，后续保存可能创建重复数据。

---

### M4. 签到排行榜 `limit` 参数无上限

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/checkin.ts:592` |

**问题**: limit 参数无上界，允许任意大查询，影响数据库性能。

---

### M5. WebSocket `system:load` 广播服务器内部信息给所有用户

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/utils/websocket.ts:328-346` |

**问题**: 服务器负载信息广播给所有连接用户，造成信息泄露。

---

### M6. Admin 密码重置允许弱密码

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/routes/admin-users.ts:264` |

**问题**: 仅检查 `< 6` 字符，未使用 `isValidPassword()` 函数，安全策略不一致。

---

### M7. 小程序退出登录未断开 WebSocket

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/store/user.ts:91-96` |

**问题**: 退出登录时 WebSocket 连接未关闭，旧会话仍然活跃。

---

### M8. 小程序写作/创建页面无登录守卫

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `pkgWrite/pages/write/editor.vue` |

**问题**: 写作和创建页面可在未登录状态下访问。

---

### M9. 100+ `console.log` 残留含敏感数据

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | 多个文件 |

**问题**: 生产代码中残留 100+ 条 console.log，部分包含敏感数据。

---

### M10. 列表页缺少虚拟滚动

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `miniprogram/src/pages/discover/` |

**问题**: 长列表全量渲染，低端设备性能差。

---

### M11. 文件上传 MIME 类型仅检查 Content-Type（客户端可伪造）

| 字段 | 值 |
|------|-----|
| **状态** | :red_circle: 待修复 |
| **文件** | `api/src/utils/upload.ts:26-33` |

**问题**: MIME 类型校验仅检查 Content-Type 请求头，客户端可轻易伪造，可能导致 SVG XSS 攻击。

---

## 已修复问题详情

### 修复记录汇总

| 问题 ID | 修复日期 | 修改文件 | 新增测试 |
|---------|----------|----------|----------|
| C2 | 2026-05-24 | `api/src/utils/points.ts` | `points-deduct.test.ts` (10 tests), `points.test.ts` (3 tests updated) |
| C3 | 2026-05-24 | `api/src/routes/auth.ts` | `auth.test.ts` (4 tests added) |
| H1 | 2026-05-24 | `api/src/routes/payment.ts`, `membership.ts` | `discount-code.test.ts` (4 tests) |

### 测试验证结果

```
 Test Files  13 passed (13)
      Tests  256 passed (256)
   Duration  1.71s
```

全部 256 个测试通过，包括：
- 原有测试全部适配新实现（`points.test.ts` 中 3 个测试更新为匹配原子操作）
- 新增 18 个专项测试覆盖修复逻辑

---

## 修复优先级建议

### 第一批（紧急 - 下一个工作日）
- **C1** Mock 支付回调 — 加环境判断或删除端点
- **C4** Admin API 权限 — 添加 adminMiddleware
- **C5** XSS — 创建全局 `escapeHtml()` + DOMPurify
- **C6** 小程序 userStore — 全局替换属性名

### 第二批（本周内）
- **H2** Token 哈希存储
- **H4** 文件上传路径过滤
- **H5** 邮件重发限流
- **H8** 签到竞态条件
- **H9** 邀请码竞态条件
- **H14** WebSocket active_token 校验

### 第三批（下周）
- **H3** 微信支付 XML 解析
- **H6** AI Worker 超时
- **H7** WebSocket 连接数限制
- **H10** CDN SRI 校验
- **H11** 定时器泄漏
- **H12** Token URL 暴露
- **H13** 统一 401 拦截

### 第四批（近期）
- M1 ~ M11 按影响范围逐步优化

---

*报告初始生成: 2026-05-23 | 最后更新: 2026-05-24 (C2/C3/H1 修复完成)*
