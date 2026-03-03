# StoryTree 问题修复集合

本文档汇总了开发过程中遇到的各类问题及其解决方案。

---

## 目录

1. [邮件发送500错误](#邮件发送500错误)
2. [前端路由问题](#前端路由问题)
3. [Schema命名不一致](#schema命名不一致)
4. [章节编辑功能](#章节编辑功能)
5. [分享功能500错误](#分享功能500错误)

---

## 邮件发送500错误

**日期**: 2026-03-03  
**问题**: 点击"忘记密码"后，服务器返回500错误

### 原因
`.env`文件中的SMTP配置为示例值，导致nodemailer无法连接SMTP服务器。

### 解决方案
添加开发模式支持到`api/src/utils/auth.ts`：
- 自动检测SMTP配置是否为示例值
- 开发模式：将邮件内容打印到控制台
- 生产模式：配置真实SMTP后自动发送邮件

### 修改文件
- `api/src/utils/auth.ts` - 添加开发模式检测和邮件打印

### 测试方法
1. 点击"忘记密码"
2. 查看服务器控制台获取重置链接
3. 复制链接到浏览器测试

---

## 前端路由问题

**日期**: 2026-03-03  
**问题**: 访问`/reset-password`显示主页而不是密码重置页面

### 原因
`api/src/index.ts`中的页面白名单没有包含新添加的认证页面：
- `reset-password`
- `verify-email`
- `forgot-password`

### 解决方案
将新页面添加到`possiblePages`数组：

```javascript
const possiblePages = [
    'register', 'login', 'create', 'discover', 'profile', 'admin', 
    'story', 'chapter', 'write', 'debug',
    'reset-password', 'verify-email', 'forgot-password'
];
```

### 修改文件
- `api/src/index.ts` - 更新路由白名单

---

## Schema命名不一致

**日期**: 2026-02-28  
**问题**: 数据库字段使用驼峰命名，但代码中使用下划线命名

### 原因
Prisma schema中的字段名与数据库实际字段名不一致。

### 解决方案
统一使用下划线命名：
- `authorId` → `author_id`
- `storyId` → `story_id`
- `nodeId` → `node_id`
- `userId` → `user_id`

### 修改文件
- `api/prisma/schema.prisma` - 更新所有模型字段
- 所有路由文件 - 更新字段引用

---

## 章节编辑功能

**日期**: 2026-02-28  
**问题**: 章节页面无法编辑章节内容

### 原因
缺少章节编辑API端点。

### 解决方案
添加`PUT /api/nodes/:id`端点：
- 支持编辑标题和内容
- 验证用户权限
- 更新时间戳

### 修改文件
- `api/src/routes/nodes.ts` - 添加编辑端点
- `web/chapter.html` - 添加编辑按钮和功能

---

## 分享功能500错误

**日期**: 2026-03-02  
**问题**: 点击分享按钮后返回500错误

### 原因
服务器未重启，新添加的分享路由未加载。

### 解决方案
重启服务器加载新路由：
```bash
pkill -f "ts-node.*index.ts"
npx ts-node src/index.ts
```

### 修改文件
- `api/src/routes/shares.ts` - 分享API
- `web/share.js` - 分享组件

### 经验教训
添加新路由后必须重启服务器才能生效。

---

## 通用修复流程

### 1. 后端API错误
1. 查看服务器控制台日志
2. 检查路由是否注册
3. 验证数据库字段名
4. 重启服务器

### 2. 前端路由错误
1. 检查`api/src/index.ts`的`possiblePages`
2. 验证HTML文件是否存在
3. 重启服务器

### 3. 数据库错误
1. 检查Prisma schema
2. 运行迁移：`npx prisma migrate dev`
3. 重新生成客户端：`npx prisma generate`

### 4. 邮件发送错误
1. 检查`.env`配置
2. 开发模式：查看控制台输出
3. 生产模式：验证SMTP凭据

---

## 调试技巧

### 查看服务器日志
```bash
tail -f /tmp/server.log
```

### 测试API端点
```bash
curl -X POST http://localhost:3001/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### 检查数据库
```bash
cd api
sqlite3 prisma/dev.db ".schema table_name"
```

### 重启服务器
```bash
pkill -f "ts-node.*index.ts"
cd api && npx ts-node src/index.ts
```

---

## 相关文档

- [邮箱验证和密码找回](./EMAIL_VERIFICATION_AND_PASSWORD_RESET.md)
- [分享功能实现](./SHARE_FEATURE.md)
- [书签功能实现](./BOOKMARK_FEATURE.md)
- [AI续写功能](./AI_CONTINUATION_FEATURE.md)

