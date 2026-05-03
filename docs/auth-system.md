# StoryTree 用户登录系统文档

> 最后更新：2026-05-03  
> 涉及文件：`api/src/routes/auth.ts`、`api/src/routes/users.ts`、`api/src/utils/auth.ts`

---

## 一、账号模型

系统支持两种账号类型，底层共用同一张 `users` 表，字段设计完全兼容：

| 字段 | 邮箱账号 | 微信账号 |
|---|---|---|
| `email` | 必填（唯一） | `null` |
| `password` | bcrypt 加密后存储 | `null` |
| `wx_openid` | `null` | 必填（唯一） |
| `wx_unionid` | `null` | 可选（打通小程序/网页端） |
| `wx_nickname` | `null` | 微信昵称（网页端登录时写入） |
| `wx_avatar` | `null` | 微信头像（网页端登录时写入） |
| `emailVerified` | 注册后 `false`，邮件验证后 `true` | 自动 `true`（微信已完成身份认证） |

---

## 二、登录方案

### 方案 A：邮箱 + 密码登录（网页端）

**接口**：`POST /api/auth/login`

```
请求体：{ email, password }
```

**正常流程：**

```
1. 校验 email / password 非空
2. 按 email 查找用户（不存在 → 401，不暴露是否存在）
3. bcrypt.compare 验证密码（错误 → 401）
4. 检查 emailVerified 是否为 true（未验证 → 403）
5. 生成新 JWT（7天有效），写入 users.active_token
   （同时使其他端已登录的旧 token 失效）
6. 返回 { token, user }
```

**异常处理：**

| 情况 | HTTP | 响应 |
|---|---|---|
| email 或 password 为空 | 400 | `请填写邮箱和密码` |
| 邮箱不存在 | 401 | `邮箱或密码错误`（故意模糊，防枚举） |
| 密码错误 | 401 | `邮箱或密码错误` |
| 邮箱未验证 | 403 | `code: EMAIL_NOT_VERIFIED` + 自动重发验证邮件 |
| 服务端异常 | 500 | `登录失败，请稍后重试` |

---

### 方案 B：微信小程序登录

**接口**：`POST /api/auth/wx-login`

```
请求体：{ code, invitationCode? }
依赖环境变量：WX_APPID、WX_APP_SECRET
```

**正常流程：**

```
1. 小程序端调用 wx.login() 获取临时 code
2. 后端用 code 调用微信 jscode2session 接口换取 openid + session_key
3. 按 wx_openid 查找用户
   ├── 已存在 → 更新 unionid（如有变化）→ 生成 JWT → 返回
   └── 不存在（新用户）→ 自动注册：
       ├── 用户名：wx_{openid后8位}（自动去重）
       ├── email / password 均为 null
       ├── emailVerified = true
       ├── 处理邀请码奖励（如有）
       └── 生成 JWT → 返回
4. JWT 写入 active_token，返回 { token, user, isNewUser }
```

**异常处理：**

| 情况 | HTTP | 响应 |
|---|---|---|
| code 为空 | 400 | `缺少微信登录 code` |
| WX_APPID 未配置 | 500 | `服务端未配置微信 AppID/AppSecret` |
| 微信接口返回错误码 | 400 | `微信登录失败: {errmsg}` |
| 服务端异常 | 500 | `微信登录失败，请稍后重试` |

---

### 方案 C：微信网页扫码登录（网页端）

**接口**：`POST /api/auth/wx-web-login`

```
请求体：{ code }
依赖环境变量：WX_WEB_APPID、WX_WEB_APP_SECRET
（注意：必须是微信开放平台"网站应用"的凭证，不能使用小程序凭证）
```

**正常流程：**

```
前端：
1. 调用 GET /api/auth/wx-web-config 获取 { wxWebAppId, enabled }
   ├── enabled=false → 隐藏按钮（WX_WEB_APPID 未配置）
   └── enabled=true → 显示按钮
2. 用户点击按钮 → 跳转微信开放平台授权页
   URL：https://open.weixin.qq.com/connect/qrconnect?appid=...&redirect_uri=wx-callback.html
3. 用户扫码确认 → 微信回调 wx-callback.html?code=xxx&state=xxx
4. wx-callback.html 验证 state，调用 POST /api/auth/wx-web-login

后端：
5. 用 code 调用微信 OAuth2 接口换取 access_token + openid + unionid
6. 用 access_token + openid 获取微信用户昵称/头像
7. 查找用户（优先 unionid，再 openid）
   ├── 已存在 → 更新 openid/unionid/昵称/头像 → 生成 JWT → 返回
   └── 不存在 → 自动注册（同小程序流程，但无邀请码逻辑）
8. JWT 写入 active_token，返回 { token, user, isNewUser }
```

**异常处理：**

| 情况 | HTTP | 响应 |
|---|---|---|
| code 为空 | 400 | `缺少微信授权 code` |
| WX_WEB_APPID 未配置 | 500 | `服务端未配置微信网页端 AppID/AppSecret` |
| 微信授权失败 | 400 | `微信授权失败: {errmsg}` |
| 未能获取 openid | 400 | `未能获取微信用户标识` |
| 服务端异常 | 500 | `微信登录失败，请稍后重试` |

> **unionid 打通机制**：同一微信用户在小程序和网页端登录时，`unionid` 相同，系统会识别为同一账号，不会重复注册。

---

## 三、注册流程

**接口**：`POST /api/auth/register`

```
请求体：{ username, email?, password?, invitationCode? }
```

**字段规则：**

- `username`：必填，3-20位，仅字母/数字/下划线/连字符
- `email` + `password`：必须同时提供或同时不提供
- 无邮箱注册：`emailVerified` 自动为 `true`，无需验证

**正常流程：**

```
1. 校验字段格式（用户名、邮箱、密码强度）
2. 检查用户名/邮箱唯一性
3. bcrypt 加密密码（cost factor: 12）
4. 生成邮箱验证 token（24小时有效）
5. 事务中创建用户 + 处理邀请码奖励：
   ├── 新用户获得邀请码对应积分
   ├── 邀请人获得新用户积分的 50% 作为奖励
   ├── 记录邀请关系（invitation_records）
   └── 给邀请人发送通知
6. 异步发送验证邮件（不阻塞响应）
7. 立即生成 JWT 并返回（用户无需等待验证即可使用部分功能）
```

**邀请码逻辑：**

- 支持乐观锁防止并发超用（`used_count` 作为版本号）
- `max_uses = -1` 表示无限次数

---

## 四、邮箱验证流程

**接口**：`POST /api/auth/verify-email`

```
请求体：{ token }
```

- token 有效期：24 小时
- 已验证用户重复提交：直接返回成功（幂等）
- 验证成功后：清除 `emailVerificationToken` 和 `emailVerificationExpires`

**重新发送验证邮件：**

- 接口：`POST /api/auth/resend-verification`，请求体：`{ email }`
- 登录时若邮箱未验证，系统也会**自动重发**验证邮件

---

## 五、密码重置流程

```
1. POST /api/auth/forgot-password  { email }
   → 生成 resetToken（1小时有效），发送重置邮件
   → 邮箱不存在时也返回成功（防枚举攻击）

2. POST /api/auth/reset-password  { token, newPassword }
   → 验证 token 未过期
   → bcrypt 加密新密码，清除 resetToken
   → 返回成功
```

> 微信登录用户（`password = null`）可通过此流程首次设置密码，完成后即可使用邮箱+密码登录。

---

## 六、修改密码（登录态）

**接口**：`PUT /api/users/password`（需携带 JWT）

```
请求体：{ currentPassword, newPassword }
```

**特殊处理：**

- 微信登录用户（`password = null`）调用此接口会返回 400，并引导通过忘记密码流程设置密码
- 新密码不能与当前密码相同

---

## 七、假邮箱注册/登录的处理

### 注册时填写假邮箱

注册时系统**不会验证邮箱是否真实存在**，只校验格式（是否含 `@` 和域名）。因此用户可以用 `abc@fake.com` 这类格式正确但不存在的邮箱完成注册。

**后续影响：**

```
注册成功 → 立即返回 JWT，用户可正常使用（emailVerified = false）
           ↓
系统异步发送验证邮件到该假邮箱 → 邮件无法送达，用户收不到
           ↓
用户尝试登录 → 密码验证通过后，检查 emailVerified
           ↓
emailVerified = false → 返回 403，错误码 EMAIL_NOT_VERIFIED
                      → 同时系统再次自动重发验证邮件（仍然无法送达）
           ↓
用户被卡在"邮箱未验证"状态，无法再次登录
```

**关键结论：**

- 注册时：**不影响**，用户拿到 JWT 后可以立即使用所有功能
- 登录时：**被拦截**，无法登录，且无法自行解除（验证邮件永远收不到）
- 唯一出路：通过 `POST /api/auth/forgot-password` 重置密码——但该接口同样需要收到邮件，假邮箱同样无法操作

> **实际风险**：用 `abc@fake.com` 注册的账号，注册当时拿到的 JWT 可以使用，但 7 天后 token 过期、或换设备后，该账号将**永久无法再次登录**，相当于一次性账号。

---

## 八、Token 机制

### JWT 是什么

JWT（JSON Web Token）是一种无状态的身份凭证，由三部分组成：

```
Header.Payload.Signature
```

登录成功后，服务端生成 JWT 返回给前端，前端每次请求时在 Header 中携带：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

服务端收到请求后，用 `JWT_SECRET` 验证签名是否合法，从 Payload 中取出 `userId`，**不需要查数据库**就能知道是谁在请求。

### JWT Payload 结构

```json
{
  "userId": 42,
  "username": "alice",
  "isAdmin": false,
  "platform": "web",
  "iat": 1745000000,
  "exp": 1745604800
}
```

| 字段 | 含义 |
|---|---|
| `userId` | 用户 ID，所有接口的身份来源 |
| `username` | 用户名（快速展示用，以数据库为准） |
| `isAdmin` | 是否管理员 |
| `platform` | 登录端（`web` / `miniprogram`），仅作标记 |
| `iat` | 签发时间（Unix 时间戳） |
| `exp` | 过期时间，`iat + 7天` |

### 单设备互踢（active_token）

**含义**：同一账号在新设备/新浏览器登录后，之前所有设备上的登录状态立即失效，被"踢下线"。

**实现原理：**

数据库 `users` 表有一个 `active_token` 字段，记录该账号**当前有效的 token**。

```
用户在手机登录 → 生成 Token-A → 写入 users.active_token = Token-A
用户在电脑登录 → 生成 Token-B → 写入 users.active_token = Token-B

此时手机发起请求，携带 Token-A：
  ├── JWT 签名合法 ✓
  └── 查数据库：active_token = Token-B ≠ Token-A
      → 返回 401，code: TOKEN_REPLACED
      → 前端收到后弹出"账号已在其他设备登录，请重新登录"
```

**兼容性处理**：若 `active_token` 为空（旧账号在该字段加入前注册，从未重新登录），则不触发互踢，允许通过。

**两种认证中间件的区别：**

| 中间件 | 使用场景 | 是否校验 active_token |
|---|---|---|
| `authenticateToken` | 需要登录的接口 | 是，被顶替立即失效 |
| `optionalAuth` | 公开接口（登录与否都能访问） | 否，避免影响公开接口性能 |

### 获取当前用户信息

**接口**：`GET /api/auth/me`（需携带 JWT）

返回用户完整信息（不含密码哈希）。

---

## 九、环境变量配置清单

| 变量 | 说明 | 状态 |
|---|---|---|
| `JWT_SECRET` | JWT 签名密钥 | ⚠️ **当前为弱占位符，生产必须修改** |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 邮件服务配置 | 已配置（QQ邮箱） |
| `FRONTEND_URL` | 邮件中链接的前端地址 | 已配置（localhost:3001） |
| `WX_APPID` / `WX_APP_SECRET` | 微信小程序凭证 | ⚠️ **当前为占位符，需填写真实值** |
| `WX_WEB_APPID` / `WX_WEB_APP_SECRET` | 微信开放平台网站应用凭证 | ❌ **未配置，网页扫码登录不可用** |

### 邮件服务降级策略

当 `SMTP_USER` / `SMTP_PASS` 为空或占位符时，系统自动进入**开发模式**：邮件内容输出到控制台，不实际发送，不影响注册/登录流程。

---

## 十、已知配置问题（待处理）

### 问题 1：微信网页扫码登录报"AppID 参数错误"

**根因**：`WX_WEB_APPID` 未配置，原代码 fallback 到小程序 `WX_APPID`，而小程序 AppID 不能用于微信开放平台 OAuth 接口。

**已修复**：`wx-web-config` 和 `wx-web-login` 接口现在只读取 `WX_WEB_APPID`，不再 fallback。未配置时按钮自动隐藏。

**解决方案**：在微信开放平台申请网站应用后，在 `api/.env` 中添加：

```bash
WX_WEB_APPID=wx你的网站应用AppID
WX_WEB_APP_SECRET=对应的AppSecret
```

### 问题 2：小程序微信登录无法使用

**根因**：`WX_APPID=your-wx-appid` 为占位符。

**解决方案**：替换为微信公众平台（mp.weixin.qq.com）的真实小程序 AppID 和 AppSecret。

### 问题 3：JWT_SECRET 为弱密钥

**根因**：`JWT_SECRET=your-sandbox-jwt-secret-key-change-this` 为可预测字符串。

**解决方案**：生成强随机密钥并替换：

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 十一、接口速查表

> **认证说明**：需要认证的接口必须在请求头携带 `Authorization: Bearer <token>`，token 来自登录/注册接口的返回值，前端通常存储在 `localStorage`。

| 接口 | 方法 | 说明 | 需要认证 |
|---|---|---|---|
| `/api/auth/register` | POST | 邮箱注册，返回 token + user | 否 |
| `/api/auth/login` | POST | 邮箱密码登录，返回 token + user | 否 |
| `/api/auth/me` | GET | 获取当前登录用户的完整信息 | 是 |
| `/api/auth/verify-email` | POST | 用邮件中的 token 完成邮箱验证 | 否 |
| `/api/auth/resend-verification` | POST | 重新发送邮箱验证邮件 | 否 |
| `/api/auth/forgot-password` | POST | 发送密码重置邮件（1小时有效） | 否 |
| `/api/auth/reset-password` | POST | 用重置邮件中的 token 设置新密码 | 否 |
| `/api/auth/wx-login` | POST | 微信小程序登录/注册（传入小程序 code） | 否 |
| `/api/auth/wx-web-login` | POST | 网页端微信扫码登录/注册（传入 OAuth code） | 否 |
| `/api/auth/bind-wx` | POST | 将微信绑定到当前已登录的邮箱账号 | 是 |
| `/api/auth/wx-web-config` | GET | 查询微信网页端是否已配置（决定是否显示扫码按钮） | 否 |
| `/api/users/password` | PUT | 在登录状态下修改密码（需验证当前密码） | 是 |


---

## 十二、有关问题
### 问题 1：微信登录和邮箱登录，会被判定为两个人吗
取决于是否主动绑定，分三种情况：

情况 A：先用邮箱注册，后来想用微信登录 → 默认是两个账号
邮箱注册 → users 表中 id=1，email="alice@xx.com"，wx_openid=null
微信扫码登录 → 系统找不到 unionid/openid 匹配的记录 → 自动新建 id=2，email=null
这时 id=1 和 id=2 是两个独立账号，数据完全隔离。

情况 B：调用 POST /api/auth/bind-wx 绑定 → 合并为同一账号
用邮箱登录后，调用绑定接口，把微信 openid 写入当前账号：
id=1 的账号：email="alice@xx.com" + wx_openid="oXxxx"
之后用微信扫码登录，系统通过 wx_openid 找到 id=1，登录的是同一个账号。

情况 C：先用微信小程序登录，再用微信网页扫码登录 → 自动识别为同一账号（通过 unionid）
小程序登录 → 微信返回 openid-A + unionid-U → 创建 id=1，wx_unionid="U"
网页扫码登录 → 微信返回 openid-B + unionid-U → 先查 unionid="U" → 找到 id=1
→ 不新建，直接登录 id=1
这是微信的 unionid 机制：同一个微信用户在同一开放平台主体下，unionid 永远相同，系统利用这一点打通小程序和网页端。

### 问题 2：同一用户能否同时在网页端和小程序登录？
结论：不能同时保持登录态。 当前实现是全端单一 active_token，任何新登录都会踢掉所有旧端。

---

## 十三、生产环境部署指南

从开发模式切换到生产环境时，用户登录系统需要完成以下配置修改。

### 13.1 必须修改的配置项

以下配置项在生产环境中**必须修改**，否则会导致安全漏洞或功能不可用：

| 配置项 | 开发环境值 | 生产环境要求 | 风险等级 |
|--------|-----------|-------------|----------|
| `JWT_SECRET` | `your-sandbox-jwt-secret-key-change-this` | 64 字节以上随机字符串 | 🔴 **高危** |
| `FRONTEND_URL` | `http://localhost:3001` | 实际域名（如 `https://yourdomain.com`） | 🔴 **高危** |
| `DISABLE_EMAIL` | `true` | 删除或设为 `false` | 🟡 **中危** |
| `NODE_ENV` | `development` | `production` | 🟡 **中危** |

#### 13.1.1 生成强 JWT 密钥

```bash
# 在服务器上执行，生成 64 字节随机密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

将生成的密钥填入 `.env`：

```bash
JWT_SECRET=生成的128位十六进制字符串
```

> ⚠️ **警告**：使用弱密钥会导致 JWT 被伪造，攻击者可以冒充任意用户登录。

#### 13.1.2 配置正确的前端地址

```bash
# 生产环境必须使用 HTTPS
FRONTEND_URL=https://yourdomain.com
```

此配置影响：
- 邮箱验证链接的域名
- 密码重置链接的域名
- 微信登录回调地址

#### 13.1.3 启用真实邮件发送

```bash
# 删除此行或设为 false
# DISABLE_EMAIL=true
DISABLE_EMAIL=false
```

开发模式下 `DISABLE_EMAIL=true` 会将邮件输出到控制台，生产环境必须禁用此选项以发送真实邮件。

---

### 13.2 邮件服务配置

#### 13.2.1 SMTP 配置检查清单

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `SMTP_HOST` | SMTP 服务器地址 | `smtp.qq.com` / `smtp.163.com` / `smtp.gmail.com` |
| `SMTP_PORT` | SMTP 端口 | `587`（TLS）或 `465`（SSL） |
| `SMTP_USER` | 发件邮箱地址 | `noreply@yourdomain.com` |
| `SMTP_PASS` | 邮箱授权码（非登录密码） | 从邮箱设置中获取 |
| `SMTP_FROM` | 发件人显示地址 | 通常与 `SMTP_USER` 相同 |

#### 13.2.2 常见邮箱 SMTP 配置

**QQ 邮箱**：
```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@qq.com
SMTP_PASS=授权码（非QQ密码，在邮箱设置中生成）
```

**163 邮箱**：
```bash
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_USER=your-email@163.com
SMTP_PASS=授权码
```

**企业邮箱（推荐生产环境使用）**：
```bash
SMTP_HOST=smtp.exmail.qq.com  # 腾讯企业邮箱
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=邮箱密码或授权码
```

#### 13.2.3 测试邮件发送

部署后建议手动测试邮件功能：

```bash
# 1. 注册一个测试账号
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"your-real-email@example.com","password":"Test123456"}'

# 2. 检查邮箱是否收到验证邮件

# 3. 测试密码重置邮件
curl -X POST https://yourdomain.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-real-email@example.com"}'
```

---

### 13.3 微信登录配置

#### 13.3.1 微信小程序登录

在微信公众平台（mp.weixin.qq.com）获取真实凭证：

```bash
# 替换占位符
WX_APPID=wx真实的小程序AppID
WX_APP_SECRET=对应的AppSecret
```

**配置步骤**：
1. 登录微信公众平台 → 开发 → 开发管理 → 开发设置
2. 复制 AppID 和 AppSecret
3. 在"服务器域名"中添加你的后端 API 域名

#### 13.3.2 微信网页扫码登录

在微信开放平台（open.weixin.qq.com）申请网站应用：

```bash
WX_WEB_APPID=wx网站应用的AppID
WX_WEB_APP_SECRET=对应的AppSecret
```

**配置步骤**：
1. 登录微信开放平台 → 管理中心 → 网站应用 → 创建网站应用
2. 完成网站信息填写和审核
3. 在"开发配置"中设置授权回调域（如 `yourdomain.com`）
4. 复制 AppID 和 AppSecret

> ⚠️ **注意**：小程序和网站应用的 AppID/AppSecret 是不同的，不能混用。

#### 13.3.3 unionid 打通配置

如果需要小程序和网页端识别为同一用户，需要：

1. 将小程序和网站应用绑定到同一个微信开放平台账号
2. 在开放平台 → 管理中心 → 绑定公众号/小程序
3. 绑定后，同一微信用户在两端登录会返回相同的 `unionid`

---

### 13.4 数据库配置

#### 13.4.1 生产环境数据库

开发环境使用 SQLite，生产环境建议迁移到 PostgreSQL 或 MySQL：

```bash
# PostgreSQL 示例
DATABASE_URL="postgresql://user:password@localhost:5432/storytree?schema=public"

# MySQL 示例
DATABASE_URL="mysql://user:password@localhost:3306/storytree"
```

#### 13.4.2 数据库迁移

```bash
# 1. 修改 prisma/schema.prisma 中的 provider
# datasource db {
#   provider = "postgresql"  # 或 "mysql"
#   url      = env("DATABASE_URL")
# }

# 2. 生成迁移
npx prisma migrate deploy

# 3. 生成客户端
npx prisma generate
```

---

### 13.5 生产环境 .env 模板

```bash
# ===================================
# 生产环境配置模板
# ===================================

# 环境标识
NODE_ENV=production

# 数据库（建议使用 PostgreSQL）
DATABASE_URL="postgresql://user:password@db-host:5432/storytree"

# JWT 密钥（必须是强随机字符串）
JWT_SECRET=用node生成的64字节随机密钥

# 前端地址（必须是 HTTPS）
FRONTEND_URL=https://yourdomain.com

# API 基础地址
API_URL=https://api.yourdomain.com
API_BASE_URL=https://api.yourdomain.com

# ===================================
# 邮件配置
# ===================================
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=邮箱授权码
SMTP_FROM=noreply@yourdomain.com

# 禁用开发模式（必须删除或设为 false）
# DISABLE_EMAIL=true

# ===================================
# 微信小程序配置
# ===================================
WX_APPID=wx真实小程序AppID
WX_APP_SECRET=真实AppSecret

# ===================================
# 微信网页扫码登录配置
# ===================================
WX_WEB_APPID=wx网站应用AppID
WX_WEB_APP_SECRET=网站应用AppSecret

# ===================================
# 微信支付配置（如需要）
# ===================================
WX_PAY_MCH_ID=商户号
WX_PAY_API_KEY=API密钥

# ===================================
# 支付宝配置（如需要）
# ===================================
# 生产环境使用正式网关
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_APP_ID=正式应用AppID
ALIPAY_PRIVATE_KEY=应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_CALLBACK_URL=https://api.yourdomain.com/api/payments/alipay/callback

# ===================================
# AI 配置
# ===================================
QWEN_API_KEY=你的通义千问API密钥
QWEN_MODEL=qwen-plus
```

---

### 13.6 部署检查清单

部署前请逐项确认：

#### 安全配置
- [ ] `JWT_SECRET` 已更换为 64 字节以上随机密钥
- [ ] `NODE_ENV` 设为 `production`
- [ ] `DISABLE_EMAIL` 已删除或设为 `false`
- [ ] 数据库密码使用强密码
- [ ] API 使用 HTTPS

#### 邮件功能
- [ ] SMTP 配置填写正确
- [ ] 测试邮件发送成功
- [ ] `FRONTEND_URL` 指向正确的前端域名

#### 微信登录
- [ ] 小程序 AppID/AppSecret 已配置（如需要小程序登录）
- [ ] 网站应用 AppID/AppSecret 已配置（如需要网页扫码登录）
- [ ] 微信后台已配置服务器域名和回调域名
- [ ] 小程序和网站应用已绑定到同一开放平台（如需要 unionid 打通）

#### 数据库
- [ ] 生产数据库已创建
- [ ] 数据库迁移已执行
- [ ] 数据库连接正常

#### 功能测试
- [ ] 邮箱注册 → 收到验证邮件 → 验证成功
- [ ] 邮箱登录正常
- [ ] 微信小程序登录正常（如已配置）
- [ ] 微信网页扫码登录正常（如已配置）
- [ ] 密码重置邮件发送成功
- [ ] 管理员登录和管理功能正常

---

### 13.7 常见部署问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 邮件发送失败 | SMTP 配置错误或授权码过期 | 检查 SMTP 配置，重新生成授权码 |
| 微信登录报错 | AppID/AppSecret 错误或域名未配置 | 检查微信后台配置 |
| JWT 验证失败 | 密钥不一致（多实例部署） | 确保所有实例使用相同的 `JWT_SECRET` |
| 验证链接无法访问 | `FRONTEND_URL` 配置错误 | 修改为正确的前端域名 |
| 邮件被当作垃圾邮件 | 发件域名未配置 SPF/DKIM | 配置邮件域名的 DNS 记录 |
| 微信 unionid 不一致 | 小程序和网站应用未绑定 | 在开放平台绑定到同一主体 |

