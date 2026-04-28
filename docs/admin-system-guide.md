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

