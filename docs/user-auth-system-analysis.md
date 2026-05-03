# StoryTree 用户登录/注册系统分析报告

> 文档生成时间：2026-05-02
> 最后更新时间：2026-05-03
> 项目版本：cb9861bd

## 一、系统概述

StoryTree 的用户认证系统是一个支持多端登录的完整解决方案，包含邮箱注册、微信小程序登录、微信网页扫码登录三种方式，并实现了账号互通、单设备互踢等高级功能。

## 二、项目结构

### 2.1 相关文件位置

| 类型 | 文件路径 | 说明 |
|------|----------|------|
| **前端-登录页** | `miniprogram/src/pages/auth/login/index.vue` | 登录页面组件 |
| **前端-注册页** | `miniprogram/src/pages/auth/register/index.vue` | 注册页面组件 |
| **前端-API封装** | `miniprogram/src/api/auth.ts` | 认证相关 API 调用 |
| **前端-状态管理** | `miniprogram/src/store/user.ts` | 用户状态 Pinia Store |
| **前端-请求封装** | `miniprogram/src/utils/request.ts` | HTTP 请求工具 |
| **后端-认证路由** | `api/src/routes/auth.ts` | 所有认证相关接口（977行） |
| **后端-认证工具** | `api/src/utils/auth.ts` | JWT、密码加密等工具函数 |
| **后端-中间件** | `api/src/utils/middleware.ts` | 认证中间件 |
| **数据库模型** | `api/prisma/schema.prisma` | Prisma 数据库 Schema |

## 三、支持的登录方式

### 3.1 邮箱 + 密码登录

**接口**: `POST /api/auth/login`

**流程**:
1. 校验 email / password 非空
2. 按 email 查找用户
3. 使用 bcrypt.compare 验证密码
4. 检查 emailVerified 是否为 true
5. 生成新 JWT，写入 active_token
6. 返回 { token, user }

**前端调用示例**:
```typescript
const res = await login({ 
  email: form.email.trim(), 
  password: form.password 
})
userStore.login(res.token, res.user)
```

### 3.2 微信小程序登录

**接口**: `POST /api/auth/wx-login`

**流程**:
1. 前端调用 `uni.login` 获取微信 code
2. 后端用 code 调用微信 jscode2session 接口换取 openid + session_key
3. 按 wx_openid 查找用户
4. 不存在则自动注册（用户名格式：`wx_${openid后8位}`）
5. 生成 JWT 并返回

**特点**:
- 微信登录自动视为已验证（emailVerified = true）
- 自动创建账号，无需额外注册步骤

### 3.3 微信网页扫码登录（Web端）

**接口**: `POST /api/auth/wx-web-login`

**流程**:
1. 使用微信开放平台 OAuth2.0 接口
2. 通过 unionid 打通小程序与网页端账号
3. 支持已有账号关联和新用户注册

**配置要求**:
- 需要微信开放平台网站应用的 AppID 和 Secret
- 需要配置回调域名

## 四、注册流程详解

**接口**: `POST /api/auth/register`

### 4.1 字段验证规则

| 字段 | 规则 | 必填 |
|------|------|------|
| username | 3-20位，仅字母/数字/下划线/连字符 | 是 |
| email | 有效邮箱格式 | 否 |
| password | 6-128位 | 是（邮箱注册时） |
| invitationCode | 有效邀请码 | 否 |

### 4.2 注册流程步骤

```
1. 字段格式验证
      ↓
2. 唯一性检查（用户名、邮箱）
      ↓
3. 密码加密（bcrypt, cost=12）
      ↓
4. 邀请码验证（如有）
      ↓
5. 事务创建用户
   ├── 创建用户记录
   ├── 处理邀请奖励（新用户+邀请人）
   └── 记录邀请关系
      ↓
6. 异步发送验证邮件
      ↓
7. 返回 JWT Token
```

### 4.3 邀请码机制

- 新用户使用邀请码注册可获得奖励积分
- 邀请人获得 50% 的奖励积分
- 支持邀请码过期时间和最大使用次数限制
- 使用乐观锁（version 字段）防止并发超用

## 五、Token/Session 管理

### 5.1 JWT Token 结构

```typescript
{
  userId: number,      // 用户 ID
  username: string,    // 用户名
  isAdmin: boolean,    // 是否管理员
  platform: string,    // 'web' | 'miniprogram'
  iat: number,         // 签发时间
  exp: number          // 过期时间（7天后）
}
```

### 5.2 单设备互踢机制

**原理**: 数据库 `users.active_token` 字段存储当前有效 token

```
登录时：生成新 token → 更新 active_token
      ↓
请求时：比对请求 token 与 active_token
      ↓
不匹配：返回 401 + code: 'TOKEN_REPLACED'
```

**前端处理**:
- 检测到 TOKEN_REPLACED 时清除本地登录状态
- 弹窗提示"账号已在其他设备登录"
- 跳转到登录页

### 5.3 前端 Token 存储

```typescript
const TOKEN_KEY = 'st_token'
const USER_KEY = 'st_user'

// 存储
uni.setStorageSync(TOKEN_KEY, newToken)
uni.setStorageSync(USER_KEY, JSON.stringify(info))

// 读取
const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
```

## 六、密码安全

### 6.1 加密方式

- **算法**: bcryptjs
- **Cost Factor**: 12（2^12 = 4096 次迭代）
- **特点**: 自动生成随机 salt，抗彩虹表攻击

```typescript
// 加密
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// 验证
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
```

### 6.2 密码强度验证

```typescript
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) return { valid: false, message: '密码长度至少为6位' };
  if (password.length > 128) return { valid: false, message: '密码长度不能超过128位' };
  return { valid: true };
}
```

## 七、安全措施汇总

| 安全措施 | 实现方式 | 位置 |
|----------|----------|------|
| 密码加密 | bcrypt, cost=12 | `api/src/utils/auth.ts` |
| 邮箱验证 | 验证 token，24小时有效 | `api/src/routes/auth.ts` |
| 防枚举攻击 | 统一错误信息"邮箱或密码错误" | 登录接口 |
| Token 过期 | JWT 7天有效期 | JWT 配置 |
| 单设备互踢 | active_token 机制 | 中间件 |
| 邀请码防刷 | 乐观锁 + 版本号 | 注册接口 |
| 密码重置安全 | 重置 token 1小时有效 | 忘记密码接口 |

## 八、数据库模型

### 8.1 users 表核心字段

```prisma
model users {
  id                         Int       @id @default(autoincrement())
  username                   String    @unique
  email                      String?   @unique
  password                   String?   // bcrypt 哈希
  
  // 微信相关
  wx_openid                  String?   @unique
  wx_unionid                 String?   @unique
  wx_nickname                String?
  wx_avatar                  String?
  
  // Token 管理
  active_token               String?   // 当前有效 token
  
  // 邮箱验证
  emailVerified              Boolean   @default(false)
  emailVerificationToken     String?
  emailVerificationExpires   DateTime?
  
  // 密码重置
  passwordResetToken         String?
  passwordResetExpires       DateTime?
  
  // 邀请相关
  invited_by_code            String?
}
```

### 8.2 邀请码相关表

```prisma
model invitation_codes {
  id            Int       @id @default(autoincrement())
  code          String    @unique
  created_by_id Int
  type          String
  bonus_points  Int
  max_uses      Int       // -1 表示无限
  used_count    Int       @default(0)
  expires_at    DateTime?
  is_active     Boolean   @default(true)
  version       Int       @default(0)  // 乐观锁
}

model invitation_records {
  id                Int      @id @default(autoincrement())
  inviter_id        Int
  invitee_id        Int
  invitation_code   String
  bonus_points      Int
}
```

## 九、API 接口清单

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/register` | POST | 邮箱注册 | 否 |
| `/api/auth/login` | POST | 邮箱密码登录 | 否 |
| `/api/auth/me` | GET | 获取当前用户信息 | 是 |
| `/api/auth/verify-email` | POST | 邮箱验证 | 否 |
| `/api/auth/resend-verification` | POST | 重发验证邮件 | 否 |
| `/api/auth/forgot-password` | POST | 发送密码重置邮件 | 否 |
| `/api/auth/reset-password` | POST | 重置密码 | 否 |
| `/api/auth/wx-login` | POST | 微信小程序登录 | 否 |
| `/api/auth/wx-web-login` | POST | 网页端微信扫码登录 | 否 |
| `/api/auth/bind-wx` | POST | 绑定微信到已有账号 | 是 |
| `/api/auth/wx-web-config` | GET | 获取微信网页端配置 | 否 |

## 十、环境变量配置

```bash
# JWT 配置
JWT_SECRET="your-secret-key-change-this"

# 邮件服务
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@storytree.com"

# 前端 URL
FRONTEND_URL="http://localhost:3001"

# 微信小程序
WX_APPID="your-wx-appid"
WX_APP_SECRET="your-wx-app-secret"

# 微信开放平台（网页扫码登录）
WX_WEB_APPID="your-wx-web-appid"
WX_WEB_APP_SECRET="your-wx-web-app-secret"
```

---

## 十一、潜在问题与改进建议

### 🔴 高优先级问题

#### 1. 邮箱验证时机不一致（注册后可直接使用，登录时才强制验证）

**现状**: 
- 用户邮箱注册后，系统返回 JWT Token，用户可以直接登录使用
- 用户第二次使用邮箱密码登录时，系统才检查 `emailVerified` 字段
- 如果邮箱未验证，此时才拒绝登录并提示需要验证

**代码位置**:
- 注册接口 `api/src/routes/auth.ts:211-230`：注册成功后直接返回 token
- 登录接口 `api/src/routes/auth.ts:280-315`：检查 emailVerified，未验证则返回 403

```typescript
// 注册时：直接返回 token，不检查邮箱验证
res.status(201).json({
  message: '注册成功，请查收验证邮件',
  user: result,
  token: generateJWT(result.id, result.username, false, 'web')  // 直接可用
});

// 登录时：才检查邮箱验证
if (!user.emailVerified) {
  return res.status(403).json({
    error: '邮箱尚未验证，请查收验证邮件后再登录',
    code: 'EMAIL_NOT_VERIFIED',
  });
}
```

**问题**:
1. 逻辑不一致：注册后能用，退出后不能用
2. 用户困惑：为什么第一次能用，第二次不能用？
3. 安全隐患：未验证邮箱的用户可以使用系统功能

**常见做法对比**:

| 方案 | 注册后 | 登录时 | 适用场景 |
|------|--------|--------|----------|
| **方案A（当前）** | 可直接使用 | 强制验证 | ❌ 不一致 |
| **方案B（推荐）** | 不可使用，必须先验证 | 正常登录 | 安全优先 |
| **方案C** | 可使用，但功能受限 | 正常登录 | 体验优先 |

**建议改为方案B**:
```typescript
// 注册后不返回 token，提示用户验证邮箱
res.status(201).json({
  message: '注册成功！请查收验证邮件，验证后即可登录',
  requireVerification: true,
  email: result.email,
  // 不返回 token
});
```

或**方案C（折中）**：
- 注册后可以使用，但限制部分功能（如发布、评论）
- 前端显示"请验证邮箱以解锁全部功能"提示

---

#### 2. 账号绑定功能不完整（微信用户无法绑定邮箱）

**现状分析**:

| 功能 | 是否支持 | 接口 |
|------|----------|------|
| 邮箱用户绑定微信 | ✅ 支持 | `POST /api/auth/bind-wx` |
| 微信用户绑定邮箱 | ❌ 不支持 | 无 |
| 微信用户设置密码 | ❌ 不支持 | 无 |

**邮箱用户绑定微信的实现** (`api/src/routes/auth.ts:720-778`):
```typescript
router.post('/bind-wx', async (req, res) => {
  // 1. 验证用户登录态
  const decoded = jwt.verify(token, JWT_SECRET);
  // 2. 用 code 换取微信 openid
  const { openid, unionid } = wxData;
  // 3. 检查 openid 是否已被其他账号绑定
  const existing = await prisma.users.findUnique({ where: { wx_openid: openid } });
  if (existing && existing.id !== decoded.userId) {
    return res.status(409).json({ error: '该微信号已绑定其他账号' });
  }
  // 4. 更新用户的微信信息
  await prisma.users.update({
    where: { id: decoded.userId },
    data: { wx_openid: openid, wx_unionid: unionid }
  });
});
```

**绑定后是否算同一账号？**
- ✅ **是同一账号**：邮箱用户绑定微信后，`wx_openid` 和 `wx_unionid` 写入同一条用户记录
- ✅ 绑定后可以用邮箱登录，也可以用微信登录，都是同一个账号

**微信用户绑定邮箱的缺失**:
- 微信注册的用户 `email = null`，`password = null`
- 没有接口让微信用户设置邮箱和密码
- 如果微信账号出问题（如换手机、微信被封），用户将无法登录

**建议添加 `/api/auth/bind-email` 接口**:
```typescript
// POST /api/auth/bind-email
// body: { email, password }
router.post('/bind-email', authMiddleware, async (req, res) => {
  const { email, password } = req.body;
  const userId = req.user.id;
  
  // 1. 检查邮箱是否已被使用
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: '该邮箱已被其他账号使用' });
  }
  
  // 2. 生成验证 token
  const verificationToken = generateToken();
  const hashedPassword = await hashPassword(password);
  
  // 3. 更新用户信息（邮箱待验证）
  await prisma.users.update({
    where: { id: userId },
    data: {
      email,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
  });
  
  // 4. 发送验证邮件
  await sendVerificationEmail(email, verificationToken);
  
  res.json({ message: '邮箱绑定成功，请查收验证邮件' });
});
```

**绑定邮箱后**:
- 用户可以用微信登录（原有方式）
- 用户也可以用邮箱+密码登录（新增方式）
- 两种方式登录的是**同一个账号**

---

#### 3. 密码强度要求过低

**现状**: 密码只要求 6 位以上，无复杂度要求

**风险**: 容易被暴力破解

**建议**:
```typescript
// 建议的密码验证规则
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: '密码长度至少为8位' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: '密码需包含大写字母' };
  if (!/[a-z]/.test(password)) return { valid: false, message: '密码需包含小写字母' };
  if (!/[0-9]/.test(password)) return { valid: false, message: '密码需包含数字' };
  return { valid: true };
}
```

#### 4. 缺少登录频率限制

**现状**: 登录接口无频率限制

**风险**: 可被暴力破解密码

**建议**:
- 添加 IP 级别的登录频率限制（如 5次/分钟）
- 添加账号级别的登录失败锁定（如 5次失败后锁定15分钟）
- 使用 Redis 存储限制计数

```typescript
// 建议使用 express-rate-limit
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次
  message: { error: '登录尝试过于频繁，请15分钟后再试' }
});

router.post('/login', loginLimiter, async (req, res) => { ... });
```

#### 5. JWT Secret 可能使用默认值

**现状**: `.env.example` 中有默认 JWT_SECRET

**风险**: 如果生产环境忘记修改，token 可被伪造

**建议**:
- 启动时检查 JWT_SECRET 是否为默认值，是则拒绝启动
- 使用环境变量验证脚本

```typescript
if (process.env.JWT_SECRET === 'your-secret-key-change-this') {
  console.error('❌ 请修改 JWT_SECRET 环境变量！');
  process.exit(1);
}
```

### 🟡 中优先级问题

#### 6. 单设备互踢可能影响用户体验

**现状**: 同一账号只能在一个设备登录

**问题**: 
- 用户可能同时使用手机和电脑
- 每次切换设备都需要重新登录

**建议**:
- 考虑按平台区分（小程序和 Web 各允许一个会话）
- 或改为多设备登录 + 设备管理功能

#### 7. 邮箱验证 Token 存储在数据库

**现状**: 验证 token 明文存储在 users 表

**风险**: 数据库泄露时可直接使用

**建议**: 存储 token 的哈希值，验证时比对哈希

```typescript
// 存储时
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
await prisma.users.update({ data: { emailVerificationToken: tokenHash } });

// 验证时
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const user = await prisma.users.findFirst({ where: { emailVerificationToken: tokenHash } });
```

#### 8. 缺少登录日志

**现状**: 无登录历史记录

**问题**: 
- 无法追踪异常登录
- 无法提供"最近登录"功能

**建议**: 添加 login_logs 表记录登录历史

```prisma
model login_logs {
  id         Int      @id @default(autoincrement())
  user_id    Int
  ip         String
  user_agent String
  platform   String   // web/miniprogram
  status     String   // success/failed
  created_at DateTime @default(now())
}
```

### 🟢 低优先级问题

#### 9. 缺少 CSRF 保护

**现状**: Web 端登录接口无 CSRF token

**风险**: 可能被 CSRF 攻击

**建议**: 对于 Web 端，添加 CSRF token 验证

#### 10. 密码重置链接可重复使用

**现状**: 重置密码后未清除 token

**风险**: 同一链接可能被重复使用

**建议**: 重置成功后立即清除 token

```typescript
await prisma.users.update({
  where: { id: user.id },
  data: {
    password: hashedPassword,
    passwordResetToken: null,      // 清除 token
    passwordResetExpires: null
  }
});
```

#### 11. 微信登录自动生成的用户名不友好

**现状**: 微信登录用户名格式为 `wx_${openid后8位}`

**问题**: 用户名不够友好，且可能重复

**建议**: 
- 使用微信昵称作为初始用户名（需处理特殊字符）
- 或引导用户首次登录后设置用户名

#### 12. 缺少账号注销功能

**现状**: 用户无法主动注销账号

**法规要求**: 根据《个人信息保护法》，需提供账号注销功能

**建议**: 添加账号注销接口和流程

---

## 十二、更新记录

### 2026-05-03 更新

#### ✅ 已完成的修复

##### 1. 修复邮箱验证时机不一致问题

**问题描述**：用户邮箱注册后直接跳转首页，没有显示邮箱验证提示，导致用户体验混乱。

**修复内容**：

| 端 | 文件 | 修改内容 |
|-----|------|----------|
| 后端 | `api/src/routes/auth.ts` | 邮箱注册时不返回 token，返回 `requireVerification: true` |
| 网页端 | `web/auth.js:177-202` | 注册成功后检查 `requireVerification`，显示验证提示并跳转登录页 |
| 小程序端 | `miniprogram/src/pages/auth/register/index.vue` | 同上，添加邮箱验证检查逻辑 |
| 类型定义 | `miniprogram/src/api/auth.ts` | `AuthResponse` 添加 `requireVerification`、`email` 字段 |

**修复后的行为**：
1. 用户邮箱注册 → 显示弹窗"验证邮件已发送" → 跳转登录页
2. 用户点击邮件验证链接 → 验证成功 → 自动登录
3. 用户使用邮箱密码登录

##### 2. 添加本地测试邮件开关

**问题描述**：本地开发时配置了真实 SMTP，邮件会发送到 QQ 邮箱，但 QQ 邮箱安全系统会拦截指向 `localhost` 的链接。

**修复内容**：

| 文件 | 修改内容 |
|------|----------|
| `api/src/utils/auth.ts:18-25` | 添加 `DISABLE_EMAIL` 环境变量检查 |
| `api/.env` | 添加 `DISABLE_EMAIL=true` 配置项 |

**使用方式**：
```bash
# 本地测试时，在 .env 中设置
DISABLE_EMAIL=true

# 邮件内容将输出到后端控制台，包含验证链接
# 生产环境部署时删除或设为 false
```

---

#### 🔴 新发现的问题

##### 1. QQ 邮箱安全拦截 localhost 链接

**问题描述**：
- 当 `FRONTEND_URL=http://localhost:3001` 时，发送的验证邮件链接指向 localhost
- QQ 邮箱的安全检查系统（`xmspamchecklogicsvr/xmsafejump`）会拦截这类链接
- 用户点击"验证邮箱"按钮后显示 `{"head":{"ret":-5002,"msg":"Invalid url"}}`

**影响范围**：本地开发环境 + 使用 QQ 邮箱接收验证邮件

**临时解决方案**：
1. 设置 `DISABLE_EMAIL=true`，从后端控制台获取验证链接
2. 或使用其他邮箱（如 Gmail）进行测试

**根本解决方案**：生产环境必须配置正确的域名
```bash
FRONTEND_URL=https://your-domain.com
```

##### 2. 生产环境 FRONTEND_URL 配置缺失

**问题描述**：
- `api/.env.production` 中 `FRONTEND_URL=https://YOUR_DOMAIN.com` 是占位符
- 如果部署时忘记修改，验证邮件链接将无效

**建议**：
- 部署文档中强调必须修改此配置
- 或在启动时检查是否为占位符值

```typescript
if (process.env.FRONTEND_URL?.includes('YOUR_DOMAIN')) {
  console.error('❌ 请配置正确的 FRONTEND_URL！');
  process.exit(1);
}
```

---

## 十三、总结

### 系统优点

1. ✅ 支持多种登录方式，用户体验好
2. ✅ 使用 bcrypt 加密密码，安全性较高
3. ✅ 实现了单设备互踢，防止账号共享
4. ✅ 邮箱验证机制完善
5. ✅ 邀请系统设计合理，有防刷机制
6. ✅ 通过 unionid 打通多端账号

### 已完成的改进（2026-05-03）

1. ✅ ~~**邮箱验证时机不一致**~~ → 已修复，注册后必须先验证邮箱才能登录
2. ✅ 添加了 `DISABLE_EMAIL` 开关，方便本地开发测试

### 仍需改进

1. ⚠️ **账号绑定功能不完整**：微信用户无法绑定邮箱
2. ⚠️ 加强密码强度要求
3. ⚠️ 添加登录频率限制
4. ⚠️ 检查生产环境 JWT_SECRET
5. ⚠️ 添加登录日志功能
6. ⚠️ 考虑多设备登录支持
7. ⚠️ 添加账号注销功能
8. ⚠️ **生产环境 FRONTEND_URL 配置检查**（新增）

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + UniApp |
| 后端 | Express + TypeScript |
| 数据库 | SQLite（开发）/ MySQL（生产）+ Prisma ORM |
| 认证 | JWT + bcryptjs |
| 邮件 | Nodemailer + SMTP |

