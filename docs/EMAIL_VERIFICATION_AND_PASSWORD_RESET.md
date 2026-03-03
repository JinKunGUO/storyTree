# 邮箱验证和密码找回功能文档

**日期**: 2026-03-03  
**版本**: v1.2.0  
**状态**: ✅ 已完成

---

## 📋 功能概述

实现了完整的邮箱验证和密码找回功能，提升账户安全性和用户体验。

### 主要功能

1. ✅ **邮箱验证**
   - 注册时自动发送验证邮件
   - 用户点击邮件链接完成验证
   - 支持重新发送验证邮件
   - 验证链接24小时有效期

2. ✅ **密码找回**
   - 通过邮箱申请密码重置
   - 发送安全的重置链接
   - 重置链接1小时有效期
   - 密码强度验证

---

## 🗄️ 数据库字段

### users表已有字段

```prisma
model users {
  // 邮箱验证相关
  emailVerified                       Boolean         @default(false) @map("email_verified")
  emailVerificationToken              String?         @map("email_verification_token")
  emailVerificationExpires            DateTime?       @map("email_verification_expires")
  
  // 密码重置相关
  passwordResetToken                  String?         @map("password_reset_token")
  passwordResetExpires                DateTime?       @map("password_reset_expires")
}
```

### 字段说明

- `emailVerified`: 邮箱是否已验证
- `emailVerificationToken`: 邮箱验证令牌（64位十六进制）
- `emailVerificationExpires`: 验证令牌过期时间（24小时）
- `passwordResetToken`: 密码重置令牌（64位十六进制）
- `passwordResetExpires`: 重置令牌过期时间（1小时）

---

## 🔌 后端API

### 文件：`api/src/routes/auth.ts`

#### 1. 用户注册（已更新）

**端点**: `POST /api/auth/register`

**改动**:
- 生成邮箱验证token
- 自动发送验证邮件
- 返回提示信息

**请求体**:
```json
{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "message": "注册成功，请查收验证邮件",
  "user": {
    "id": 1,
    "username": "user123",
    "email": "user@example.com",
    "emailVerified": false
  },
  "token": "jwt-token"
}
```

#### 2. 邮箱验证

**端点**: `POST /api/auth/verify-email`

**请求体**:
```json
{
  "token": "64-character-hex-token"
}
```

**响应**:
```json
{
  "message": "邮箱验证成功"
}
```

**错误响应**:
- `400`: 验证链接无效或已过期
- `500`: 服务器错误

#### 3. 重新发送验证邮件

**端点**: `POST /api/auth/resend-verification`

**请求体**:
```json
{
  "email": "user@example.com"
}
```

**响应**:
```json
{
  "message": "验证邮件已重新发送，请检查邮箱"
}
```

**错误响应**:
- `404`: 用户不存在
- `400`: 邮箱已验证
- `500`: 发送邮件失败

#### 4. 申请密码重置

**端点**: `POST /api/auth/forgot-password`

**请求体**:
```json
{
  "email": "user@example.com"
}
```

**响应**:
```json
{
  "message": "如果邮箱存在，重置邮件已发送"
}
```

**安全特性**:
- 不暴露用户是否存在
- 统一返回成功消息

#### 5. 重置密码

**端点**: `POST /api/auth/reset-password`

**请求体**:
```json
{
  "token": "64-character-hex-token",
  "newPassword": "newpassword123"
}
```

**响应**:
```json
{
  "message": "密码重置成功"
}
```

**错误响应**:
- `400`: 重置链接无效或已过期
- `400`: 密码强度不足
- `500`: 服务器错误

---

## 📧 邮件模板

### 文件：`api/src/utils/auth.ts`

#### 1. 验证邮件模板

```html
<h2>欢迎注册 StoryTree！</h2>
<p>请点击下面的链接验证你的邮箱：</p>
<a href="{verificationUrl}">验证邮箱</a>
<p>此链接将在24小时后过期。</p>
```

**链接格式**: `http://localhost:3001/verify-email?token={token}`

#### 2. 密码重置邮件模板

```html
<h2>密码重置请求</h2>
<p>我们收到了你的密码重置请求。请点击下面的链接重置密码：</p>
<a href="{resetUrl}">重置密码</a>
<p>此链接将在1小时后过期。</p>
<p>如果你没有请求重置密码，请忽略此邮件。</p>
```

**链接格式**: `http://localhost:3001/reset-password?token={token}`

---

## 🎨 前端页面

### 1. 邮箱验证页面

**文件**: `web/verify-email.html`

**功能**:
- 自动从URL获取token
- 显示验证进度（加载中/成功/失败）
- 验证成功后显示跳转按钮
- 验证失败时提供重发验证邮件功能

**URL格式**:
- `/verify-email?token={token}`
- `/verify-email/{token}`

**状态展示**:
1. **加载中**: 旋转图标 + "正在验证邮箱..."
2. **成功**: 绿色勾选图标 + "验证成功！"
3. **失败**: 红色叉号图标 + 错误信息 + 重发表单

### 2. 忘记密码页面

**文件**: `web/forgot-password.html`

**功能**:
- 输入邮箱地址
- 发送密码重置邮件
- 显示成功/错误消息
- 返回登录链接

**表单验证**:
- 邮箱格式验证
- 防止重复提交

### 3. 密码重置页面

**文件**: `web/reset-password.html`

**功能**:
- 从URL获取token
- 输入新密码和确认密码
- 密码可见性切换
- 密码强度提示
- 重置成功后自动跳转登录

**密码要求**:
- 最少6位
- 建议包含字母、数字和特殊字符

**URL格式**:
- `/reset-password?token={token}`
- `/reset-password/{token}`

### 4. 登录页面（已更新）

**文件**: `web/login.html`

**改动**:
- 修正"忘记密码"链接路径为 `/forgot-password.html`

---

## ⚙️ 配置说明

### 环境变量配置

**文件**: `api/.env`

```env
# JWT Secret
JWT_SECRET="your-secret-key-change-this"

# Email Configuration (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-email-password-or-app-password"
SMTP_FROM="noreply@storytree.com"

# Frontend URL
FRONTEND_URL="http://localhost:3001"
```

### Gmail配置步骤

1. **使用应用专用密码（推荐）**:
   ```
   1. 登录Google账号
   2. 访问 https://myaccount.google.com/security
   3. 启用"两步验证"
   4. 生成"应用专用密码"
   5. 使用该密码作为SMTP_PASS
   ```

2. **允许不够安全的应用（不推荐）**:
   ```
   1. 访问 https://myaccount.google.com/lesssecureapps
   2. 启用"允许不够安全的应用"
   3. 使用Google账号密码作为SMTP_PASS
   ```

### 其他邮件服务商

#### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
```

#### Yahoo
```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
```

#### QQ邮箱
```env
SMTP_HOST="smtp.qq.com"
SMTP_PORT="587"
```

#### 163邮箱
```env
SMTP_HOST="smtp.163.com"
SMTP_PORT="465"
```

---

## 🔐 安全特性

### 1. Token生成

使用 `crypto.randomBytes(32)` 生成64位十六进制token：
```typescript
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**特点**:
- 加密安全的随机数
- 64位十六进制（256位熵）
- 不可预测

### 2. Token过期机制

```typescript
// 邮箱验证：24小时
const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

// 密码重置：1小时
const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
```

### 3. 密码加密

使用bcrypt加密密码：
```typescript
// 加密密码（salt rounds = 12）
const hashedPassword = await bcrypt.hash(password, 12);

// 验证密码
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 4. 信息隐私保护

- 密码重置不暴露用户是否存在
- 统一返回成功消息
- 防止用户枚举攻击

### 5. 输入验证

```typescript
// 邮箱格式验证
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 密码强度验证
- 最少6位
- 最多128位

// 用户名验证
- 3-20位
- 只允许字母、数字、下划线、连字符
```

---

## 🔄 完整流程

### 邮箱验证流程

```
1. 用户注册
   ↓
2. 系统生成验证token
   ↓
3. 保存token和过期时间到数据库
   ↓
4. 发送验证邮件（异步）
   ↓
5. 用户收到邮件
   ↓
6. 点击验证链接
   ↓
7. 前端页面自动提取token
   ↓
8. 调用验证API
   ↓
9. 后端验证token和过期时间
   ↓
10. 更新emailVerified为true
    ↓
11. 清除token和过期时间
    ↓
12. 显示验证成功
```

### 密码找回流程

```
1. 用户点击"忘记密码"
   ↓
2. 输入邮箱地址
   ↓
3. 系统生成重置token
   ↓
4. 保存token和过期时间到数据库
   ↓
5. 发送重置邮件
   ↓
6. 用户收到邮件
   ↓
7. 点击重置链接
   ↓
8. 前端页面自动提取token
   ↓
9. 用户输入新密码
   ↓
10. 调用重置API
    ↓
11. 后端验证token和过期时间
    ↓
12. 加密新密码
    ↓
13. 更新密码
    ↓
14. 清除token和过期时间
    ↓
15. 显示重置成功
    ↓
16. 3秒后跳转登录页
```

---

## 🧪 测试指南

### 前置条件

1. **配置SMTP**:
   ```bash
   cd api
   cp .env.example .env
   # 编辑.env文件，填写SMTP配置
   ```

2. **启动服务器**:
   ```bash
   cd api
   npm install
   npx ts-node src/index.ts
   ```

### 测试邮箱验证

#### 测试1: 注册并验证邮箱

1. 访问 `http://localhost:3001/register.html`
2. 填写注册信息
3. 点击"立即注册"
4. 检查邮箱收到验证邮件
5. 点击邮件中的验证链接
6. 验证成功，显示绿色勾选图标

**预期结果**:
- ✅ 注册成功提示"请查收验证邮件"
- ✅ 邮箱收到验证邮件
- ✅ 点击链接后显示"邮箱验证成功"
- ✅ 数据库中`email_verified`为`true`

#### 测试2: 重新发送验证邮件

1. 在验证页面验证失败后
2. 在底部输入邮箱
3. 点击"重新发送"
4. 检查邮箱收到新的验证邮件

**预期结果**:
- ✅ 提示"验证邮件已发送"
- ✅ 邮箱收到新邮件
- ✅ 新token可以正常验证

#### 测试3: 过期token

1. 修改数据库中的`email_verification_expires`为过去时间
2. 尝试验证
3. 应该显示"验证链接无效或已过期"

### 测试密码找回

#### 测试4: 申请密码重置

1. 访问 `http://localhost:3001/login.html`
2. 点击"忘记密码？"
3. 输入注册邮箱
4. 点击"发送重置邮件"
5. 检查邮箱收到重置邮件

**预期结果**:
- ✅ 提示"重置邮件已发送"
- ✅ 邮箱收到重置邮件
- ✅ 数据库中有`password_reset_token`

#### 测试5: 重置密码

1. 点击邮件中的重置链接
2. 输入新密码
3. 确认密码
4. 点击"重置密码"
5. 等待3秒自动跳转
6. 使用新密码登录

**预期结果**:
- ✅ 显示"密码重置成功"
- ✅ 3秒后跳转到登录页
- ✅ 可以使用新密码登录
- ✅ 旧密码无法登录

#### 测试6: 密码强度验证

1. 在重置页面输入少于6位的密码
2. 点击提交
3. 应该显示"密码长度至少为6位"

#### 测试7: 密码不一致

1. 输入新密码
2. 确认密码输入不同的值
3. 点击提交
4. 应该显示"两次输入的密码不一致"

### API测试

#### 使用curl测试

```bash
# 1. 注册用户
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. 验证邮箱
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "your-token-here"}'

# 3. 重发验证邮件
curl -X POST http://localhost:3001/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 4. 申请密码重置
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 5. 重置密码
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-token-here",
    "newPassword": "newpassword123"
  }'
```

---

## 📊 数据库查询

### 查看验证状态

```sql
-- 查看所有用户的邮箱验证状态
SELECT id, username, email, email_verified, 
       email_verification_expires
FROM users;

-- 查看未验证的用户
SELECT id, username, email, created_at
FROM users
WHERE email_verified = 0;

-- 查看过期的验证token
SELECT id, username, email
FROM users
WHERE email_verification_token IS NOT NULL
  AND email_verification_expires < datetime('now');
```

### 清理过期token

```sql
-- 清理过期的邮箱验证token
UPDATE users
SET email_verification_token = NULL,
    email_verification_expires = NULL
WHERE email_verification_expires < datetime('now');

-- 清理过期的密码重置token
UPDATE users
SET password_reset_token = NULL,
    password_reset_expires = NULL
WHERE password_reset_expires < datetime('now');
```

---

## 🚀 后续优化建议

### 1. 邮件队列

使用消息队列（如Bull、RabbitMQ）异步处理邮件发送：
```typescript
import Bull from 'bull';

const emailQueue = new Bull('email', {
  redis: { host: 'localhost', port: 6379 }
});

// 添加邮件任务
await emailQueue.add({
  to: email,
  subject: '邮箱验证',
  html: emailContent
});
```

**优点**:
- 提高响应速度
- 失败重试机制
- 流量控制

### 2. 邮件模板引擎

使用Handlebars或EJS渲染邮件模板：
```typescript
import handlebars from 'handlebars';

const template = handlebars.compile(emailTemplate);
const html = template({
  username: user.username,
  verificationUrl: url
});
```

### 3. 邮件发送统计

记录邮件发送状态：
```prisma
model email_logs {
  id          Int      @id @default(autoincrement())
  user_id     Int
  email_type  String   // verification, password_reset
  status      String   // sent, failed, opened, clicked
  sent_at     DateTime @default(now())
  opened_at   DateTime?
  clicked_at  DateTime?
}
```

### 4. 邮箱验证提醒

在用户登录时提醒未验证邮箱：
```typescript
if (!user.emailVerified) {
  return res.json({
    user,
    token,
    warning: '您的邮箱尚未验证，请查收验证邮件'
  });
}
```

### 5. 限制重发频率

防止邮件发送滥用：
```typescript
const lastSent = await prisma.email_logs.findFirst({
  where: {
    user_id: user.id,
    email_type: 'verification',
    sent_at: { gte: new Date(Date.now() - 5 * 60 * 1000) }
  }
});

if (lastSent) {
  return res.status(429).json({ 
    error: '发送过于频繁，请5分钟后再试' 
  });
}
```

### 6. 多语言支持

根据用户语言偏好发送邮件：
```typescript
const i18n = {
  'zh-CN': {
    subject: '邮箱验证',
    greeting: '欢迎注册 StoryTree！'
  },
  'en-US': {
    subject: 'Email Verification',
    greeting: 'Welcome to StoryTree!'
  }
};

const lang = user.language || 'zh-CN';
const text = i18n[lang];
```

---

## 📝 文件清单

### 后端文件

1. ✅ `api/src/routes/auth.ts` - 认证路由（已更新）
2. ✅ `api/src/utils/auth.ts` - 认证工具函数（已存在）
3. ✅ `api/.env.example` - 环境变量示例（已更新）

### 前端文件

4. ✅ `web/verify-email.html` - 邮箱验证页面（新建）
5. ✅ `web/forgot-password.html` - 忘记密码页面（新建）
6. ✅ `web/reset-password.html` - 密码重置页面（新建）
7. ✅ `web/login.html` - 登录页面（已更新）

### 文档

8. ✅ `docs/EMAIL_VERIFICATION_AND_PASSWORD_RESET.md` - 功能文档（本文件）

---

## 📌 总结

### 实现内容

- ✅ 完整的邮箱验证流程
- ✅ 完整的密码找回流程
- ✅ 3个新增前端页面
- ✅ 4个新增API端点
- ✅ 邮件模板和发送功能
- ✅ Token生成和验证机制
- ✅ 安全性保护措施

### 代码量

- **后端**: ~150行新增代码
- **前端**: ~800行（3个页面）
- **配置**: 环境变量配置
- **文档**: 完整功能文档

### 安全特性

- ✅ 加密安全的token生成
- ✅ Token过期机制
- ✅ 密码加密存储
- ✅ 输入验证和消毒
- ✅ 信息隐私保护
- ✅ 防止用户枚举

---

**功能已完成！** 🎉 

用户现在可以：
- ✅ 注册后收到验证邮件
- ✅ 点击链接验证邮箱
- ✅ 重新发送验证邮件
- ✅ 通过邮箱找回密码
- ✅ 安全地重置密码

系统提供了完整的账户安全保护机制！

