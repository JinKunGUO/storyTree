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
| 删除用户 | DELETE | `/api/admin/users/:id?hardDelete=false` | 删除用户（支持软删除和硬删除） |

**封禁/解封说明**：
- 封禁会立即清空用户的 `active_token`，使其所有设备被强制下线
- 不能封禁自己，也不能封禁其他管理员
- 重置密码后用户需要使用新密码重新登录

**删除用户说明**：
- **软删除**（默认，`hardDelete=false`）：
  - 将用户名改为 `[DELETED_用户ID_时间戳]`
  - 清空邮箱、密码、头像、微信绑定等敏感信息
  - 在 bio 中记录删除时间和原用户名
  - 强制下线用户
  - 保留用户创建的内容（故事、节点等）
  
- **硬删除**（`hardDelete=true`）：
  - 彻底删除用户及其所有关联数据
  - 删除的关联数据包括：评论、评分、签到记录、关注关系、书签、通知、邀请记录、订阅、提现记录、AI 日志等
  - 用户创建的故事和节点会转移给系统用户（ID=1），保留内容不丢失
  - **此操作不可逆，请谨慎使用**

- 安全限制：不能删除自己，不能删除管理员用户

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

#### 3.4.1 审核机制详解

StoryTree 采用**智能审核机制**，大部分内容会自动通过，只有特定情况才需要管理员介入。

##### 审核触发条件

系统根据以下规则决定内容是否需要进入审核队列（`review_status = 'PENDING'`）：

| 触发条件 | 说明 | 代码位置 |
|---------|------|----------|
| **新用户** | 用户发布的前 3 篇章节**强制进入审核队列** | `api/src/utils/sensitiveWords.ts:98-100` |
| **敏感词** | 内容命中敏感词（违法、色情、暴力、广告等）时需要审核 | `api/src/utils/sensitiveWords.ts:103-108` |

**敏感词分类**（定义于 `api/src/utils/sensitiveWords.ts:7-28`）：

| 分类 | 示例关键词 |
|------|-----------|
| `illegal` | 毒品、赌博、枪支、暗杀、伪造 |
| `porn` | 色情、裸体、嫖娼 |
| `violence` | 杀人、分尸、自残、自杀 |
| `spam` | 加微信、二维码、刷单、免费送 |

##### 自动通过的情况

**老用户**（已发布 ≥3 篇章节）发布的内容，如果没有命中敏感词，会**自动通过审核**（`review_status = 'APPROVED'`），无需管理员介入。

##### 审核状态对内容可见性的影响

| 审核状态 | 普通用户 | 内容作者 | 协作者 | 管理员 |
|---------|---------|---------|--------|--------|
| `APPROVED` | ✅ 可见 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| `PENDING` | ✅ 可见 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| `REJECTED` | ❌ 不可见 | ✅ 可见（方便修改后重新提交） | ❌ 不可见 | ✅ 可见 |
| `HIDDEN` | ❌ 不可见 | ✅ 可见 | ❌ 不可见 | ✅ 可见 |

> **重要**：`PENDING` 状态的内容**仍然对所有用户可见**，审核主要是事后监管机制。

##### 树形结构中的可见性问题

⚠️ **特别注意**：当一个节点被驳回（`REJECTED`）或下架（`HIDDEN`）后，该节点对非作者用户不可见。但这会导致一个**树形结构断裂问题**：

**示例场景**：

假设有如下章节树结构：
```
根节点 (APPROVED)
├── 章节A (APPROVED)
│   ├── 章节B (REJECTED)  ← 被驳回
│   │   ├── 章节C (APPROVED)
│   │   ├── 章节D (APPROVED)
│   │   └── 章节E (APPROVED)
│   └── 章节F (APPROVED)
│       └── 章节G (APPROVED)
```

**作者视角**：可以看到所有章节（包括被驳回的章节B）

**协作者/普通用户视角**：
- ✅ 可见：根节点、章节A、章节F、章节G
- ❌ 不可见：章节B（被驳回）
- ⚠️ **问题**：章节C、D、E 虽然状态是 `APPROVED`，但由于父节点 B 不可见，这些节点在树形图中会"孤立"，无法从根节点导航到达

**实际案例**（来自数据库查询）：

故事"钢铁雄心：废皇子的长生路"的节点树：
```
├─ [9] 废太子，皇陵里的化学反应 (APPROVED)
   ├─ [10] 七步之内拳快... (APPROVED)
      ├─ [11] 那个造船的疯子... (APPROVED)
      │  ├─ [12] 疯子，死人堆里炼出的第一炉铁 (REJECTED) ← 被驳回！
      │  │  ├─ [14] 青铜纪年 (APPROVED)
      │  │  │   └─ [21] 龙脉苏醒 (APPROVED)
      │  │  │       └─ [29] 炉心燃星 (APPROVED)
      │  │  ├─ [22] 磷火燃魂... (APPROVED)
      │  │  │   └─ ... (更多子节点)
      │  └─ [17] 龙脉苏醒 (APPROVED) ← 协作者 jinkunguo 创建
      │      ├─ [18] 星髓回响 (APPROVED)
      │      └─ [28] 龙脉苏醒 (APPROVED)
```

**结果**：协作者 `xxx` 只能看到从节点 9 → 10 → 11 → 17 → 18 → 28 这条分支，因为另一条分支的节点 12 被驳回，导致其下的所有子节点（14、21、22、29 等）都无法通过树形结构访问。

##### 管理员审核建议

1. **谨慎使用驳回**：驳回中间节点会导致其所有子分支对普通用户不可见
2. **优先使用通过**：如果内容只是小问题，建议通过后私信作者修改
3. **下架用于严重违规**：`HIDDEN` 状态适用于确实需要隐藏的内容
4. **考虑树结构影响**：驳回前检查该节点是否有子节点，评估影响范围

##### 作者如何重新申请审核（被驳回后的操作流程）

当章节被管理员驳回后，作者可以通过**编辑章节内容**来自动重新触发审核流程。

**重新审核的触发机制**（代码位置：`api/src/routes/nodes.ts:351-358`）：

```typescript
// 章节编辑时会重新进行审核检查
const reviewCheck = needsReview(content, userNodeCount);
const updateData = {
  // ...
  review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
};
```

**作者操作步骤**：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 收到驳回通知 | 系统会自动发送"内容审核结果"通知到消息中心 |
| 2 | 点击通知查看详情 | 跳转到被驳回的章节页面（只有作者本人可见） |
| 3 | 点击"编辑"按钮 | 进入章节编辑页面 |
| 4 | 修改违规内容 | 根据驳回原因修改敏感词或违规内容 |
| 5 | 保存修改 | 系统自动重新检查内容 |
| 6 | 等待结果 | 根据检查结果决定新状态 |

**重新审核后的状态变化**：

| 用户类型 | 内容情况 | 新审核状态 | 说明 |
|---------|---------|-----------|------|
| 老用户（≥3 篇） | 无敏感词 | `APPROVED` ✅ | **自动通过**，无需管理员审核 |
| 老用户（≥3 篇） | 有敏感词 | `PENDING` ⏳ | 重新进入审核队列 |
| 新用户（<3 篇） | 任何内容 | `PENDING` ⏳ | 新用户前 3 篇强制审核 |

**示例场景**：

1. **场景一：老用户修改后自动通过**
   - 用户 A（已发布 10 篇章节）的章节因包含"赌博"被驳回
   - 用户 A 编辑章节，将"赌博"改为"博弈"
   - 保存后，系统检测无敏感词 → 状态自动变为 `APPROVED`
   - 章节立即对所有用户可见，**无需等待管理员审核**

2. **场景二：新用户修改后仍需审核**
   - 用户 B（仅发布 2 篇章节）的章节被驳回
   - 用户 B 编辑章节，删除违规内容
   - 保存后，因为是新用户 → 状态变为 `PENDING`
   - 需要等待管理员在审核队列中再次审核

3. **场景三：修改后仍有敏感词**
   - 用户 C 的章节因"色情"被驳回
   - 用户 C 编辑章节，但仍保留了"裸体"等词
   - 保存后，系统检测到敏感词 → 状态变为 `PENDING`
   - 重新进入审核队列等待管理员处理

**前端入口**：

- **Web 端**：章节详情页右上角"编辑"按钮（`/chapter?id=xxx`）
- **小程序**：章节详情页底部"编辑"按钮

**API 接口**：

```
PUT /api/nodes/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "修改后的标题",
  "content": "修改后的内容（删除敏感词后的版本）",
  "image": "可选的封面图URL"
}
```

**返回示例**：

自动通过时：
```
{
  "node": { "id": 12, "title": "...", "review_status": "APPROVED" },
  "reviewStatus": "approved",
  "message": "更新成功"
}
```

需要审核时：
```
{
  "node": { "id": 12, "title": "...", "review_status": "PENDING" },
  "reviewStatus": "pending",
  "message": "内容需要审核：新用户首次发布"
}
```

**注意事项**：

1. **只有作者本人可以编辑**：章节作者或故事主创才有编辑权限
2. **被驳回章节仍可编辑**：作者可以看到自己被驳回的章节并进行编辑
3. **编辑后子节点恢复可见**：如果父节点从 `REJECTED` 变为 `APPROVED`，其下的所有子节点会重新对普通用户可见
4. **无需手动申请**：系统会在保存时自动重新检查，无需额外的"申请审核"按钮

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

### 6.4 【2026-05-03 新增】管理员删除用户功能

**新增功能**：管理员可以删除用户，支持软删除和硬删除两种模式。

**后端接口**：
```
DELETE /api/admin/users/:id?hardDelete=false
```

**实现内容**：

| 组件 | 文件 | 说明 |
|------|------|------|
| 后端接口 | `api/src/routes/admin-users.ts:288-440` | 新增 `DELETE /:id` 路由，支持软删除和硬删除 |
| 前端界面 | `web/admin.html` | 新增"用户管理"选项卡，包含用户列表、搜索筛选、删除等功能 |

**软删除逻辑**：
- 用户名改为 `[DELETED_用户ID_时间戳]`
- 清空邮箱、密码、头像、微信绑定等信息
- bio 中记录删除时间和原用户名
- 清空 `active_token` 强制下线

**硬删除逻辑**（使用数据库事务）：
1. 删除关联数据：评论投票、评论、举报、积分记录、签到记录、关注关系、书签、通知、协作请求、邀请记录、订阅、提现记录、AI 日志、AI 任务、登录日志、会员权益日志、评分、分享、打赏、订单
2. 将用户创建的节点和故事转移给系统用户（ID=1）
3. 删除用户记录

**安全限制**：
- 不能删除自己
- 不能删除管理员用户

---

## 八、常用运维命令

### 8.1 管理员账户管理

```bash
cd api

# 创建默认管理员（用户名: jinhui, 密码: 123456）
npx ts-node scripts/create-admin.ts

# 自定义管理员（用户名、邮箱、密码）
npx ts-node scripts/create-admin.ts myAdmin admin@example.com StrongP@ss2026!

# 重置管理员密码（用户名已存在时会更新密码）
npx ts-node scripts/create-admin.ts jinhui 1025103012@qq.com 新密码
```

### 8.2 公版书导入

```bash
cd api

# 导入所有公版书（使用默认管理员 jinhui）
npx ts-node scripts/batch-import-stories.ts

# 指定管理员用户名导入
npx ts-node scripts/batch-import-stories.ts --admin-username jinhui

# 导入单本书
npx ts-node scripts/batch-import-stories.ts --file seed-data/西游记.json

# 预览模式（不写入数据库，仅检查数据）
npx ts-node scripts/batch-import-stories.ts --dry-run

# 导入后更新用户统计
npx ts-node scripts/recalculate-user-stats.ts
```

### 8.3 删除故事

```bash
cd api

# 删除指定故事（通过故事 ID）
npx ts-node scripts/delete-story.ts --id 123

# 删除指定故事（通过标题，模糊匹配）
npx ts-node scripts/delete-story.ts --title "西游记"

# 批量删除某作者的所有故事
npx ts-node scripts/delete-story.ts --author-id 1

# 预览模式（不实际删除）
npx ts-node scripts/delete-story.ts --id 123 --dry-run
```

**注意**：删除故事会级联删除所有章节、评论、书签等关联数据。

### 8.4 删除用户

**方式一：通过管理后台**

1. 登录管理后台 `http://你的域名/admin.html`
2. 切换到"用户管理"选项卡
3. 搜索目标用户
4. 点击"删除"按钮
5. 选择软删除或硬删除

**方式二：通过 API**

```bash
# 软删除用户（保留数据，标记为已删除）
curl -X DELETE "http://localhost:3001/api/admin/users/123" \
  -H "Authorization: Bearer <admin-token>"

# 硬删除用户（彻底删除，不可恢复）
curl -X DELETE "http://localhost:3001/api/admin/users/123?hardDelete=true" \
  -H "Authorization: Bearer <admin-token>"
```

**方式三：通过脚本**

```bash
cd api

# 软删除用户
npx ts-node scripts/delete-user.ts --id 123

# 硬删除用户
npx ts-node scripts/delete-user.ts --id 123 --hard

# 通过用户名删除
npx ts-node scripts/delete-user.ts --username testuser

# 预览模式
npx ts-node scripts/delete-user.ts --id 123 --dry-run
```

### 8.5 数据库操作

```bash
cd api

# 同步数据库结构（开发环境）
npx prisma db push

# 强制重置数据库（清空所有数据）
npx prisma db push --force-reset

# 生成 Prisma Client
npx prisma generate

# 查看数据库内容
npx prisma studio
```

### 8.6 云端部署

```bash
# SSH 到云端服务器
ssh root@120.26.182.140

# 进入项目目录
cd /var/www/storytree

# 拉取最新代码
git pull origin main

# 切换到 MySQL schema
cd api
cp prisma/schema.mysql.prisma prisma/schema.prisma

# 同步数据库结构
npx prisma db push

# 重启服务
pm2 restart storytree-api
```

### 8.7 日志查看

```bash
# 查看 API 服务日志
pm2 logs storytree-api

# 查看最近 100 行日志
pm2 logs storytree-api --lines 100

# 实时查看日志
pm2 logs storytree-api --follow

# 查看错误日志
pm2 logs storytree-api --err
```

### 8.8 服务管理

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart storytree-api

# 停止服务
pm2 stop storytree-api

# 启动服务
pm2 start storytree-api

# 查看服务详情
pm2 show storytree-api
```

---

## 九、故障排查

### 9.1 常见问题

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| 导入公版书失败 | 管理员用户名不匹配 | 使用 `--admin-username jinhui` 参数 |
| 数据库连接失败 | `.env` 配置错误 | 检查 `DATABASE_URL` 环境变量 |
| 索引长度超限 | MySQL VARCHAR 字段太长 | 将 `path` 字段改为 VARCHAR(500) |
| 管理接口 403 | JWT 中 isAdmin 为 false | 重新登录获取新 Token |
| 图片上传失败 | uploads 目录权限 | `chmod 755 api/uploads` |

### 9.2 数据库连接测试

```bash
cd api

# 测试数据库连接
npx prisma db pull

# 如果成功，会显示数据库结构
# 如果失败，会显示连接错误
```

### 9.3 检查环境变量

```bash
cd api

# 查看当前环境变量
cat .env

# 必需的环境变量
# DATABASE_URL=mysql://user:password@host:3306/storytree
# JWT_SECRET=your-secret-key
```

---

## 十、管理员操作指南（Step by Step）

### 10.1 首次部署 — 创建管理员账号

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

### 10.2 登录管理后台

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

### 10.3 管理后台功能区域

管理后台分为四个选项卡：

| 选项卡 | 功能 |
|--------|------|
| **内容审核** | 查看待审核内容队列、通过/驳回/下架节点、查看举报详情 |
| **提现审核** | 查看提现申请列表、通过/拒绝提现、查看用户收益详情 |
| **会员管理** | 会员统计概览、会员列表搜索与筛选、查看会员详情 |
| **用户管理** | 用户列表、搜索筛选、查看详情、封禁/解封、重置密码、删除用户 |

### 10.4 内容审核操作

1. 进入管理后台，默认显示"内容审核"选项卡
2. 顶部统计卡片显示：待审核内容数、待审核提现数、已通过提现数、提现总额
3. 审核队列中每个条目显示：标题、作者、创建时间、举报次数、内容预览
4. 操作按钮：
   - **✅ 通过** → 节点状态设为 `APPROVED`，自动通知作者
   - **❌ 驳回** → 节点状态设为 `REJECTED`，自动通知作者
   - **🚫 下架** → 节点状态设为 `HIDDEN`，自动通知作者
   - **查看举报** → 弹窗显示所有举报记录（举报人、原因、说明、时间）

### 10.5 提现审核操作

1. 切换到"提现审核"选项卡
2. 列表显示所有提现申请：金额、申请用户、提现方式、提现账号、申请时间、状态
3. 对待审核（pending）的申请可以：
   - **✅ 通过** → 弹窗确认后批准
   - **❌ 拒绝** → 先展开备注输入框，填写拒绝原因后确认（拒绝必须填写原因，金额退回用户余额）
   - **📊 查看用户收益** → 弹窗显示用户收益余额、总收益、已提现、待审核、解锁次数等

### 10.6 会员管理操作

1. 切换到"会员管理"选项卡
2. 顶部统计：总会员数、今日新增、本月新增、即将到期、活跃会员、自动续费数、本月收入
3. 支持按会员等级筛选（全部/体验/月度/季度/年度/企业）
4. 支持按用户名搜索
5. 列表显示：用户名、邮箱、加入时间、会员等级、到期时间、自动续费状态

### 10.7 用户管理操作

1. 切换到"用户管理"选项卡
2. 用户列表显示：头像、用户名、邮箱、等级、积分、会员状态、注册时间
3. 支持功能：
   - **搜索**：按用户名/邮箱/微信昵称搜索
   - **筛选**：按角色筛选（全部/管理员/普通用户）
   - **排序**：按注册时间/积分/等级/字数排序
4. 用户操作：
   - **📋 查看详情** → 弹窗显示用户完整信息和最近积分记录
   - **🚫 封禁** → 强制用户下线并标记封禁状态
   - **✅ 解封** → 移除封禁标记，用户可重新登录
   - **🔑 重置密码** → 输入新密码后重置，用户需使用新密码登录
   - **🗑️ 删除** → 删除用户账号（支持软删除和硬删除）

**删除用户操作流程**：
1. 点击用户列表中的"删除"按钮
2. 弹出确认对话框，选择删除模式：
   - **软删除**（推荐）：标记删除，保留数据用于审计
   - **硬删除**（危险）：彻底删除用户及关联数据，不可恢复
3. 硬删除需要二次确认（输入"确认删除"）
4. 删除成功后列表自动刷新

**注意事项**：
- 不能对自己执行封禁、删除操作
- 不能对其他管理员执行封禁、删除操作
- 硬删除会将用户创建的内容转移给系统用户，内容不会丢失
- 软删除的用户无法登录，但数据保留在数据库中

### 10.8 忘记密码

数据库中密码使用 bcrypt 哈希存储，无法反向解密。重置方法：

```bash
cd api && npx ts-node scripts/create-admin.ts jinhui 1025103012@qq.com 新密码
```

脚本使用 `upsert`，用户名已存在时直接更新密码，不会创建重复账号。

### 10.9 常见问题排查

| 现象 | 原因 | 解决方法 |
|------|------|----------|
| 访问 admin.html 跳转到 login.html | 未登录或 Token 过期 | 重新登录 |
| 访问 admin.html 跳转到 index.html | 当前登录账号不是管理员 | 用管理员账号登录 |
| 管理接口返回 403 Forbidden | JWT Token 中 isAdmin 为 false | **需要重新登录**（修复前生成的旧 Token 中 isAdmin 为 false，重新登录会生成新的正确 Token） |
| 提现列表加载失败 404 | 旧版前端缓存 | 清除浏览器缓存后刷新（已修复 API 路径） |
| 登录后 admin.html 仍显示权限不足 | 数据库中 `isAdmin` 字段为 false | 运行 `create-admin.ts` 脚本或手动 SQL 更新 |

---

## 十一、数据库统计查询

### 11.1 网页端与小程序端的关系

**重要说明**：网页端和小程序端**共用同一个后端 API 和数据库**，用户数据是互通的。

| 环境 | API 地址 | 数据库 |
|------|----------|--------|
| 本地开发 | `http://localhost:3001` | `api/prisma/prisma/dev.db`（SQLite） |
| 云端生产 | `http://120.26.182.140:3001` | MySQL（云端） |

> **注意**：本地开发环境可能存在两个数据库文件：
> - `api/prisma/dev.db` - 旧路径（可能未使用）
> - `api/prisma/prisma/dev.db` - 实际使用的数据库
> 
> 请使用 `npx prisma studio` 确认实际连接的数据库。

**常见误区**：
- ❌ 小程序端和网页端是两套独立系统
- ✅ 两端共用同一后端，用户在网页端注册后，可以用同一账号登录小程序

**小程序端数据显示不全的常见原因**：
- 小程序的 `scroll-view` 组件需要明确高度才能触发"加载更多"
- 用户需要滚动到列表底部才会触发分页加载
- 首次加载只显示第一页（默认 20 条）

### 11.2 用户统计查询

#### SQLite（本地开发环境）

```bash
cd api

# 查询用户总数
sqlite3 prisma/prisma/dev.db "SELECT COUNT(*) as total_users FROM users;"

# 查询用户列表（ID、用户名、邮箱、是否管理员、注册时间）
sqlite3 -header -column prisma/prisma/dev.db \
  "SELECT id, username, email, is_admin, created_at FROM users ORDER BY id;"

# 按注册来源统计（有微信绑定 vs 仅邮箱注册）
# 注：本地 SQLite 可能没有 wx_openid 字段，需要先检查 schema
sqlite3 prisma/prisma/dev.db "SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as email_users
FROM users;"

# 查询管理员数量
sqlite3 prisma/prisma/dev.db "SELECT COUNT(*) as admin_count FROM users WHERE is_admin = 1;"

# 查询今日新增用户
sqlite3 prisma/prisma/dev.db "SELECT COUNT(*) as today_new FROM users 
  WHERE date(created_at/1000, 'unixepoch') = date('now');"
```

#### MySQL（云端生产环境）

```bash
# SSH 到云端服务器
ssh root@120.26.182.140

# 进入 MySQL
mysql -u root -p storytree

# 查询用户总数
SELECT COUNT(*) as total_users FROM users;

# 查询用户列表
SELECT id, username, email, wx_nickname, is_admin, created_at 
FROM users ORDER BY id LIMIT 50;

# 按注册来源统计
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN wx_openid IS NOT NULL THEN 1 ELSE 0 END) as wechat_users,
  SUM(CASE WHEN email IS NOT NULL AND wx_openid IS NULL THEN 1 ELSE 0 END) as email_only_users,
  SUM(CASE WHEN wx_openid IS NOT NULL AND email IS NOT NULL THEN 1 ELSE 0 END) as both_bindied
FROM users;

# 查询今日新增用户
SELECT COUNT(*) as today_new FROM users 
WHERE DATE(created_at) = CURDATE();

# 查询本周新增用户
SELECT COUNT(*) as week_new FROM users 
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

# 查询活跃用户（最近7天有登录记录）
SELECT COUNT(DISTINCT user_id) as active_users 
FROM login_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status = 'success';
```

### 11.3 内容统计查询

#### SQLite（本地开发环境）

```bash
cd api

# 综合统计（用户数、故事数、章节数）
sqlite3 prisma/prisma/dev.db "SELECT 
  'users' as table_name, COUNT(*) as count FROM users 
  UNION ALL SELECT 'stories', COUNT(*) FROM stories 
  UNION ALL SELECT 'nodes', COUNT(*) FROM nodes
  UNION ALL SELECT 'comments', COUNT(*) FROM comments;"

# 查询故事列表（含章节数）
sqlite3 -header -column prisma/prisma/dev.db \
  "SELECT s.id, s.title, u.username as author, 
    (SELECT COUNT(*) FROM nodes WHERE story_id = s.id) as node_count 
   FROM stories s 
   JOIN users u ON s.author_id = u.id 
   ORDER BY s.id;"

# 查询每个用户的创作统计
sqlite3 -header -column prisma/prisma/dev.db \
  "SELECT u.id, u.username, 
    (SELECT COUNT(*) FROM stories WHERE author_id = u.id) as story_count,
    (SELECT COUNT(*) FROM nodes WHERE author_id = u.id) as node_count,
    u.word_count
   FROM users u ORDER BY node_count DESC;"
```

#### MySQL（云端生产环境）

```bash
# 综合统计
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM stories) as total_stories,
  (SELECT COUNT(*) FROM nodes) as total_nodes,
  (SELECT COUNT(*) FROM comments WHERE is_deleted = 0) as total_comments;

# 热门故事排行（按追更数）
SELECT s.id, s.title, u.username as author,
  (SELECT COUNT(*) FROM story_followers WHERE story_id = s.id) as followers,
  (SELECT COUNT(*) FROM nodes WHERE story_id = s.id) as chapters
FROM stories s
JOIN users u ON s.author_id = u.id
ORDER BY followers DESC
LIMIT 20;

# 活跃创作者排行（按章节数）
SELECT u.id, u.username, u.word_count,
  COUNT(n.id) as node_count
FROM users u
LEFT JOIN nodes n ON n.author_id = u.id
GROUP BY u.id
ORDER BY node_count DESC
LIMIT 20;
```

### 11.4 通过 API 查询统计

更推荐通过管理后台 API 获取统计数据，避免直接操作数据库：

```bash
# 获取管理员 Token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' | jq -r '.token')

# 获取仪表盘总览数据
curl -s http://localhost:3001/api/admin/dashboard/overview \
  -H "Authorization: Bearer $TOKEN" | jq

# 返回示例：
# {
#   "users": { "total": 100, "today": 5 },
#   "stories": { "total": 50, "today": 2 },
#   "nodes": { "total": 500, "today": 10 },
#   "comments": { "total": 200, "today": 8 },
#   "members": { "total": 20 },
#   "pendingReports": 3
# }

# 获取用户增长趋势（最近30天）
curl -s "http://localhost:3001/api/admin/dashboard/user-growth?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq

# 获取内容创建统计
curl -s "http://localhost:3001/api/admin/dashboard/content-stats?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 11.5 Prisma Studio（可视化查看）

最简单的方式是使用 Prisma Studio 可视化查看数据库：

```bash
cd api

# 启动 Prisma Studio（会自动打开浏览器）
npx prisma studio

# 默认地址：http://localhost:5555
# 可以可视化浏览和编辑所有表的数据
```
