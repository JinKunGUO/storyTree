# StoryTree 管理员系统使用指南

## 一、管理员账号创建

StoryTree 没有开放的管理员注册入口，管理员账号只能通过服务端脚本创建。

### 1.1 使用脚本创建管理员

在 `api/` 目录下执行：

```bash
# 使用默认配置（用户名: jinhui, 邮箱: 1025103012@qq.com, 密码: 123456）
npx ts-node scripts/create-admin.ts

# 自定义用户名、邮箱、密码
npx ts-node scripts/create-admin.ts <用户名> <邮箱> <密码>

# 示例
npx ts-node scripts/create-admin.ts admin admin@example.com MyStrongPass123
```

也可以通过环境变量传入：

```bash
ADMIN_USERNAME=admin ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=MyPass123 npx ts-node scripts/create-admin.ts
```

**脚本行为**：
- 如果用户名已存在 → 更新为管理员（upsert）
- 如果用户名不存在 → 创建新管理员
- 默认积分：999,999,999，默认等级：99
- 密码使用 bcrypt（12 轮）加密存储
- 自动设置 `isAdmin: true`，`emailVerified: true`

### 1.2 将现有用户提升为管理员

也可以直接通过数据库操作：

```sql
UPDATE users SET is_admin = 1 WHERE username = '目标用户名';
```

---

## 二、管理员登录

管理员**没有独立的登录入口**，使用与普通用户相同的登录接口。

### 2.1 Web 端登录

1. 访问 `http://localhost:3001/login.html`
2. 输入管理员邮箱和密码
3. 登录成功后，系统会在返回的用户信息中包含 `isAdmin: true`
4. 前端根据 `isAdmin` 字段显示管理入口

### 2.2 登录接口

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

返回的 JWT token 中包含 `isAdmin` 字段，后续所有管理接口通过此 token 鉴权。

### 2.3 管理后台入口

登录后访问：`http://localhost:3001/admin.html`

> 该页面会自动校验当前登录用户是否为管理员，非管理员无法访问。

### 2.4 管理员忘记密码怎么办
数据库中存储的是 bcrypt 哈希值，无法反向解密。
可以重新运行创建管理员脚本来重置密码。
该脚本使用 upsert（第 46 行），如果用户名 jinhui 已存在会直接更新密码，不会重复创建。
```
cd api && npx ts-node scripts/create-admin.ts jinhui 1025103012@qq.com 你的新密码
```
---

## 三、管理功能总览

所有管理接口均需要 `Authorization: Bearer <token>` 头，且 token 对应的用户必须具有管理员权限（`isAdmin: true`）。

### 3.1 数据统计仪表盘

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 总览数据 | GET | `/api/admin/dashboard/overview` | 用户数、故事数、章节数、评论数、会员数、待处理举报数，以及今日新增 |
| 用户增长趋势 | GET | `/api/admin/dashboard/user-growth?days=30` | 每日新增用户数 + 累计用户数曲线 |
| 内容创建统计 | GET | `/api/admin/dashboard/content-stats?days=30` | 每日新增故事数和章节数趋势 |
| 活跃用户统计 | GET | `/api/admin/dashboard/active-users?days=7` | 近期活跃用户数（按发布、评论、签到维度） |

### 3.2 用户管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 用户列表 | GET | `/api/admin/users?page=1&limit=20&search=xxx&role=admin` | 分页、搜索（用户名/邮箱/微信昵称）、角色筛选、排序 |
| 用户详情 | GET | `/api/admin/users/:id` | 用户完整信息 + 最近 10 条积分交易 |
| 封禁用户 | POST | `/api/admin/users/:id/ban` | 强制下线（清空 token）+ 标记封禁 |
| 解封用户 | POST | `/api/admin/users/:id/unban` | 移除封禁标记 |
| 重置密码 | POST | `/api/admin/users/:id/reset-password` | 重置用户密码并强制重新登录 |

**封禁/解封说明**：
- 封禁会立即清空用户的 `active_token`，使其所有设备被强制下线
- 不能封禁自己，也不能封禁其他管理员
- 重置密码后用户需要使用新密码重新登录

### 3.3 内容管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 故事列表 | GET | `/api/admin/content/stories?page=1&search=xxx&visibility=public` | 分页浏览所有故事 |
| 删除故事 | DELETE | `/api/admin/content/stories/:id` | 级联删除故事及其所有节点、评论 |
| 评论列表 | GET | `/api/admin/content/comments?page=1&deleted=false&search=xxx` | 分页浏览评论，可筛选已删除/未删除 |
| 删除评论 | DELETE | `/api/admin/content/comments/:id` | 软删除评论（标记 `is_deleted`） |
| 隐藏章节 | POST | `/api/admin/content/nodes/:id/hide` | 将章节状态设为 `HIDDEN`，记录审核人和原因 |

### 3.4 内容审核

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 审核队列 | GET | `/api/admin/review-queue` | 获取待审核节点 + 被举报节点列表 |
| 审核操作 | POST | `/api/admin/review` | 通过/驳回/下架节点，自动通知作者 |
| 举报详情 | GET | `/api/admin/reports/:nodeId` | 查看某节点的所有举报记录 |

**审核动作**：
- `approve` — 通过审核，状态设为 `APPROVED`
- `reject` — 驳回，状态设为 `REJECTED`
- `hide` — 下架隐藏，状态设为 `HIDDEN`

审核完成后系统会自动向作者发送通知。

### 3.5 积分管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 调整积分 | POST | `/api/admin/points/users/:id/adjust` | 手动增加/扣除用户积分（正数增加，负数扣除） |
| 交易记录 | GET | `/api/admin/points/transactions?page=1&userId=xxx&type=xxx` | 查询积分交易记录，支持按用户和类型筛选 |

**调整积分说明**：
- 使用数据库事务保证一致性（同时更新余额 + 创建交易记录）
- 扣除积分时会检查余额是否足够
- 交易记录中会标注 `[管理员操作]` 前缀和操作原因

### 3.6 会员管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 会员统计 | GET | `/api/admin/membership/stats` | 各等级会员数、收入统计、到期预警 |
| 会员列表 | GET | `/api/admin/membership/members?page=1&tier=pro` | 分页查看会员列表 |
| 订单列表 | GET | `/api/admin/membership/orders?page=1&status=paid` | 分页查看订单记录 |
| 调整会员 | POST | `/api/admin/membership/members/:userId/adjust` | 手动调整用户会员等级和到期时间 |

### 3.7 提现管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 提现申请列表 | GET | `/api/withdrawals/admin/requests?page=1&status=pending` | 查看所有提现申请 |
| 审核提现 | POST | `/api/withdrawals/admin/:requestId/review` | 批准/拒绝提现申请 |
| 提现统计 | GET | `/api/withdrawals/admin/stats` | 提现总额、待处理数等统计 |

### 3.8 邀请码管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 生成邀请码 | POST | `/api/invitations/admin/generate` | 批量生成管理员邀请码 |
| 邀请码列表 | GET | `/api/invitations/admin/codes` | 查看所有邀请码 |
| 启用/禁用 | PATCH | `/api/invitations/admin/codes/:code/toggle` | 切换邀请码启用状态 |
| 邀请统计 | GET | `/api/invitations/admin/stats` | 邀请相关统计数据 |
| 授权用户生成 | POST | `/api/invitations/admin/grant-permission` | 授权普通用户生成邀请码 |

---

## 四、权限控制机制

### 4.1 认证流程

```
请求 → authenticateToken 中间件 → requireAdmin 中间件 → 路由处理
```

1. **`authenticateToken`**：从 `Authorization: Bearer <token>` 解析 JWT，校验 `active_token` 实现单端互踢
2. **`requireAdmin`**：检查 `req.isAdmin` 是否为 `true`，否则返回 `403 Forbidden`

### 4.2 安全特性

- **单端互踢**：同一账号新登录会使旧设备的 token 失效（通过 `active_token` 字段实现）
- **JWT 有效期**：7 天，过期需重新登录
- **密码加密**：bcrypt 12 轮加盐哈希
- **管理员不可自封**：封禁接口禁止管理员封禁自己或其他管理员

---

## 五、快速上手

```bash
# 1. 启动服务
cd api && npm run dev

# 2. 创建管理员
npx ts-node scripts/create-admin.ts admin admin@example.com MyPass123

# 3. 登录获取 token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"MyPass123"}'

# 4. 访问管理后台
open http://localhost:3001/admin.html

# 5. 调用管理接口示例：查看总览数据
curl http://localhost:3001/api/admin/dashboard/overview \
  -H "Authorization: Bearer <your-token>"
```

---

## 六、Bug 修复记录

### 6.1 【2026-05-01 修复】admin.html 登录鉴权改造

**问题**：`admin.html` 使用不存在的 `/auth/dev-login` 接口登录，导致进入页面后直接跳转到 `index.html`，无法访问管理后台。

**修复内容**：

| 修改项 | 修改前 | 修改后 |
|--------|--------|--------|
| 登录方式 | `prompt()` 弹窗 + `/auth/dev-login`（不存在） | 复用 JWT Token，从 localStorage 读取已登录 token |
| 身份验证 | 无验证 | 调用 `GET /auth/me` → 检查 `isAdmin === true` |
| 未登录处理 | 跳转 index.html | 跳转 `login.html?redirect=admin.html`（登录后自动回来） |
| API 鉴权 | `X-User-Id` 请求头（不安全） | `Authorization: Bearer <token>`（JWT 鉴权） |

**涉及文件**：`web/admin.html`

### 6.2 【2026-05-01 修复】JWT Token 中 isAdmin 始终为 false

**问题**：`api/src/routes/auth.ts` 第 305 行，Web 端登录时调用 `generateJWT(user.id, user.username, false, 'web')`，第三个参数 `isAdmin` 被**硬编码为 `false`**。无论用户在数据库中是否为管理员，JWT token 中的 `isAdmin` 永远是 `false`，导致所有管理接口返回 `403 Forbidden: Admin access required`。

**修复**：

```diff
- const token = generateJWT(user.id, user.username, false, 'web');
+ const token = generateJWT(user.id, user.username, user.isAdmin, 'web');
```

**涉及文件**：`api/src/routes/auth.ts:305`

**影响范围**：此 bug 导致所有管理员通过 Web 端登录后，以下接口全部返回 403：
- `GET /api/admin/review-queue`（内容审核队列）
- `GET /api/admin/membership/stats`（会员统计）
- `GET /api/admin/membership/members`（会员列表）
- `GET /api/admin/dashboard/*`（仪表盘数据）
- `POST /api/admin/review`（审核操作）
- 以及所有 `/api/admin/*` 路径的接口

### 6.3 【2026-05-01 修复】提现列表 API 路径错误（404）

**问题**：`admin.html` 中 `loadWithdrawalQueue()` 函数调用 `GET /withdrawals/admin/all`，但后端路由定义的路径是 `GET /withdrawals/admin/requests`，导致 404 Not Found。

**修复**：

```diff
- const data = await apiRequest('GET', '/withdrawals/admin/all');
+ const data = await apiRequest('GET', '/withdrawals/admin/requests');
```

**涉及文件**：`web/admin.html:489`

---

## 七、管理员操作指南（Step by Step）

### 7.1 首次部署 — 创建管理员账号

```bash
# 进入 api 目录
cd api

# 方式一：使用默认配置（用户名 jinhui，密码 123456）
npx ts-node scripts/create-admin.ts

# 方式二：自定义（推荐生产环境使用强密码）
npx ts-node scripts/create-admin.ts myAdmin admin@mysite.com StrongP@ss2026!
```

脚本会输出：
```
管理员创建成功:
  用户名: myAdmin
  邮箱: admin@mysite.com
  ID: 1
  积分: 999999999
  等级: 99
```

### 7.2 登录管理后台

**步骤**：

1. **打开登录页**：访问 `http://你的域名/login.html`
2. **输入管理员邮箱和密码**：使用创建管理员时设置的邮箱和密码登录
3. **登录成功后**：JWT Token 自动存储到 `localStorage`
4. **访问管理后台**：打开 `http://你的域名/admin.html`
5. **自动验证**：页面会自动读取 Token → 调用 `/auth/me` 验证身份 → 检查 `isAdmin` → 显示管理界面

**如果直接访问 admin.html 未登录**：
- 页面会自动跳转到 `login.html?redirect=admin.html`
- 登录成功后自动跳回管理后台

**如果登录的不是管理员账号**：
- 页面会提示"当前账号没有管理员权限，请使用管理员账号登录"
- 然后跳转到首页

### 7.3 管理后台功能区域

管理后台分为三个选项卡：

| 选项卡 | 功能 |
|--------|------|
| **内容审核** | 查看待审核内容队列、通过/驳回/下架节点、查看举报详情 |
| **提现审核** | 查看提现申请列表、通过/拒绝提现、查看用户收益详情 |
| **会员管理** | 会员统计概览、会员列表搜索与筛选、查看会员详情 |

### 7.4 内容审核操作

1. 进入管理后台，默认显示"内容审核"选项卡
2. 顶部统计卡片显示：待审核内容数、待审核提现数、已通过提现数、提现总额
3. 审核队列中每个条目显示：标题、作者、创建时间、举报次数、内容预览
4. 操作按钮：
   - **✅ 通过** → 节点状态设为 `APPROVED`，自动通知作者
   - **❌ 驳回** → 节点状态设为 `REJECTED`，自动通知作者
   - **🚫 下架** → 节点状态设为 `HIDDEN`，自动通知作者
   - **查看举报** → 弹窗显示所有举报记录（举报人、原因、说明、时间）

### 7.5 提现审核操作

1. 切换到"提现审核"选项卡
2. 列表显示所有提现申请：金额、申请用户、提现方式、提现账号、申请时间、状态
3. 对待审核（pending）的申请可以：
   - **✅ 通过** → 弹窗确认后批准
   - **❌ 拒绝** → 先展开备注输入框，填写拒绝原因后确认（拒绝必须填写原因，金额退回用户余额）
   - **📊 查看用户收益** → 弹窗显示用户收益余额、总收益、已提现、待审核、解锁次数等

### 7.6 会员管理操作

1. 切换到"会员管理"选项卡
2. 顶部统计：总会员数、今日新增、本月新增、即将到期、活跃会员、自动续费数、本月收入
3. 支持按会员等级筛选（全部/体验/月度/季度/年度/企业）
4. 支持按用户名搜索
5. 列表显示：用户名、邮箱、加入时间、会员等级、到期时间、自动续费状态

### 7.7 忘记密码

数据库中密码使用 bcrypt 哈希存储，无法反向解密。重置方法：

```bash
cd api && npx ts-node scripts/create-admin.ts jinhui 1025103012@qq.com 新密码
```

脚本使用 `upsert`，用户名已存在时直接更新密码，不会创建重复账号。

### 7.8 常见问题排查

| 现象 | 原因 | 解决方法 |
|------|------|----------|
| 访问 admin.html 跳转到 login.html | 未登录或 Token 过期 | 重新登录 |
| 访问 admin.html 跳转到 index.html | 当前登录账号不是管理员 | 用管理员账号登录 |
| 管理接口返回 403 Forbidden | JWT Token 中 isAdmin 为 false | **需要重新登录**（修复前生成的旧 Token 中 isAdmin 为 false，重新登录会生成新的正确 Token） |
| 提现列表加载失败 404 | 旧版前端缓存 | 清除浏览器缓存后刷新（已修复 API 路径） |
| 登录后 admin.html 仍显示权限不足 | 数据库中 `isAdmin` 字段为 false | 运行 `create-admin.ts` 脚本或手动 SQL 更新 |