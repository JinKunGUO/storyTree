# 🚀 StoryTree 项目启动指南

## 📋 快速启动清单

### 1. 环境准备

#### ✅ 检查系统要求
- Node.js ≥ 16.0.0
- npm ≥ 8.0.0
- SQLite (已内置)
- 现代浏览器 (Chrome/Safari/Firefox)

#### 📁 项目结构确认
```
storytree/
├── api/           # 后端服务
├── web/           # 前端页面
├── docs/          # 文档
├── scripts/       # 脚本
└── uploads/       # 上传文件
```

### 2. 安装依赖

#### 后端依赖安装
```bash
cd /Users/jinkun/storytree/api
npm install
```

#### 前端依赖（无额外依赖）
前端使用原生HTML/CSS/JS，无需额外安装

### 3. 数据库初始化

#### 重置数据库（开发环境）
```bash
cd /Users/jinkun/storytree/api
npx prisma migrate reset --force
npx prisma migrate dev --name init
```

#### 生成测试数据（可选）
```bash
# 创建测试用户和故事
node scripts/seed.js
```

### 4. 环境配置

#### 创建环境文件
```bash
cd /Users/jinkun/storytree/api
cat > .env << EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-this"
PORT=3001

# 邮件配置（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
SMTP_FROM=noreply@storytree.com
FRONTEND_URL=http://localhost:3001
EOF
```

### 5. 启动服务

#### 启动后端服务
```bash
cd /Users/jinkun/storytree/api
npm run dev
```

#### 服务启动成功提示
```
✅ Server running on http://localhost:3001
✅ Database connected
✅ All routes loaded
```

### 6. 功能测试

#### 6.1 基础功能测试
```bash
# 测试健康检查
curl http://localhost:3001/api/health

# 测试用户注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"123456"}'

# 测试用户登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

#### 6.2 浏览器测试

**1. 访问首页**
- 打开浏览器访问: `http://localhost:3001`

**2. 测试用户注册**
- 访问: `http://localhost:3001/register`
- 填写注册表单
- 提交注册

**3. 测试用户登录**
- 访问: `http://localhost:3001/login`
- 使用注册的账户登录

**4. 测试故事创作**
- 登录后点击"创作"
- 创建新故事
- 添加章节内容

**5. 测试评论功能**
- 查看任意章节
- 在评论区发表评论
- 回复他人评论

#### 6.3 移动端测试

**1. 响应式测试**
- 按F12打开开发者工具
- 切换到手机模式
- 测试移动端适配

**2. 触摸测试**
- 使用移动设备访问
- 测试触摸交互
- 测试滑动菜单

## 🎯 功能演示

### 用户认证流程
1. **注册**: `/register` → 填写表单 → 注册成功
2. **登录**: `/login` → 输入凭证 → 登录成功
3. **个人中心**: 查看用户统计信息

### 故事创作流程
1. **创建故事**: 点击"创作" → 填写故事信息
2. **添加章节**: 选择故事 → 添加新章节
3. **AI续写**: 使用AI生成章节内容

### 评论系统
1. **发表评论**: 在章节页面底部发表评论
2. **回复评论**: 点击"回复"回复他人评论
3. **管理评论**: 编辑或删除自己的评论

## 🔧 故障排除

### 常见问题

#### 端口占用
```bash
# 查看端口占用
lsof -ti:3001

# 强制释放端口
lsof -ti:3001 | xargs kill -9
```

#### 数据库问题
```bash
# 重置数据库
npx prisma migrate reset --force

# 查看数据库内容
npx prisma studio
```

#### 权限问题
```bash
# 修复文件权限
chmod -R 755 /Users/jinkun/storytree
```

### 测试数据

#### 快速测试命令
```bash
# 创建测试用户
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","email":"demo@example.com","password":"123456"}'

# 创建测试故事
curl -X POST http://localhost:3001/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{"title":"测试故事","description":"这是一个测试故事"}'

# 添加测试评论
curl -X POST http://localhost:3001/api/comments/nodes/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{"content":"这是一个很棒的章节！"}'
```

## 📱 移动端体验

### 测试方式
1. **浏览器模拟**: 使用Chrome开发者工具
2. **真实设备**: 用手机访问`http://<你的IP>:3001`
3. **响应式测试**: 测试各种屏幕尺寸

### 特色功能
- ✅ 响应式注册/登录页面
- ✅ 移动端导航菜单
- ✅ 触摸友好的交互
- ✅ 优化的加载体验

## 🎉 成功启动验证

当所有步骤完成后，你将看到：

1. **后端启动成功**: 终端显示"Server running on http://localhost:3001"
2. **数据库连接**: 无数据库错误
3. **前端访问**: 浏览器能正常访问所有页面
4. **功能测试**: 注册、登录、创作、评论全部正常

**现在你可以开始享受完整的StoryTree体验了！** 🎊
