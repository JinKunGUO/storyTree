# 🌳 StoryTree

分支式AI协作小说创作平台 - 让故事拥有无限可能

## 📖 项目简介

StoryTree 是一个创新的小说创作平台，允许多个作者在同一个故事的不同节点创建分支剧情，并结合AI辅助续写功能，打造树状结构的交互式故事体验。

### ✨ 核心特性

- 🌿 **分支式创作**：每个章节都可以有多个续写分支，形成树状故事结构
- 🤖 **AI协作**：集成AI生成多个续写选项，作者可选择采用
- ⭐ **评分系统**：读者可以为每个章节评分，引导最佳剧情走向
- 🔍 **智能搜索**：快速找到感兴趣的故事和章节
- 👥 **社交功能**：关注作者、查看动态、接收通知
- 🛡️ **内容审核**：管理员后台、自动审核、举报系统
- 📱 **响应式设计**：支持桌面和移动设备访问

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 14.0 (或 SQLite 用于开发)
- npm >= 9.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd storytree
```

2. **安装后端依赖**
```bash
cd api
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

4. **初始化数据库**
```bash
npm run db:push
```

5. **启动后端服务**
```bash
npm run dev
```

6. **访问应用**
- 前台：打开 `web/index.html`
- 管理后台：打开 `web/admin.html`

## 📁 项目结构

```
storytree/
├── api/                    # 后端服务
│   ├── prisma/            # 数据库模型和迁移
│   │   └── schema.prisma  # Prisma数据模型
│   ├── src/
│   │   ├── routes/        # API路由
│   │   │   ├── auth.ts    # 认证
│   │   │   ├── stories.ts # 故事管理
│   │   │   ├── nodes.ts   # 章节管理
│   │   │   ├── ai.ts      # AI生成
│   │   │   ├── admin.ts   # 管理员
│   │   │   ├── users.ts   # 用户管理
│   │   │   ├── upload.ts  # 图片上传
│   │   │   ├── search.ts  # 搜索
│   │   │   └── notifications.ts # 通知
│   │   ├── utils/         # 工具函数
│   │   │   ├── upload.ts  # 上传工具
│   │   │   ├── auth.ts    # 权限验证
│   │   │   └── sensitiveWords.ts # 敏感词
│   │   └── index.ts       # 入口文件
│   └── package.json
├── web/                   # 前端页面
│   ├── index.html        # 用户前台
│   └── admin.html        # 管理后台
├── docs/                 # 文档
├── scripts/              # 脚本工具
└── README.md
```

## 🔧 技术栈

### 后端
- **框架**：Express.js + TypeScript
- **数据库**：PostgreSQL / SQLite
- **ORM**：Prisma
- **文件上传**：Multer
- **AI集成**：OpenAI API (可配置)

### 前端
- **纯HTML/CSS/JavaScript**：无框架依赖，轻量级
- **响应式设计**：适配多种设备

## 📊 数据模型

### 核心实体

- **User (用户)**：用户账号、个人信息、权限
- **Story (故事)**：故事基本信息、封面图片
- **Node (章节)**：树状结构的故事节点、内容、配图
- **Rating (评分)**：用户对章节的评分
- **Follow (关注)**：用户之间的关注关系
- **Notification (通知)**：系统通知消息
- **Report (举报)**：内容举报记录

## 🛠️ 开发指南

### 运行开发环境

```bash
# 后端开发模式（热重载）
cd api
npm run dev

# 查看数据库
npm run db:studio
```

### 代码规范

```bash
# 代码检查
npm run lint

# 格式化代码
npm run format
```

### 数据库操作

```bash
# 推送模型变更到数据库
npm run db:push

# 查看数据库GUI
npm run db:studio

# 生成Prisma Client
npm run db:generate
```

## 🔐 权限系统

### 用户角色

- **普通用户**：创作、阅读、评分、举报
- **管理员**：内容审核、用户管理、查看举报

### 设置管理员

在数据库中将用户的 `is_admin` 字段设置为 `true`：

```sql
UPDATE users SET is_admin = true WHERE username = 'admin';
```

## 📝 API文档

### 认证
- `POST /api/auth/dev-login` - 开发环境登录

### 故事管理
- `GET /api/stories` - 获取故事列表
- `POST /api/stories` - 创建新故事
- `GET /api/stories/:id` - 获取故事详情

### 章节管理
- `GET /api/nodes/:id` - 获取章节详情
- `POST /api/nodes/:id/branches` - 创建分支
- `POST /api/nodes/:id/rate` - 评分
- `POST /api/nodes/:id/report` - 举报

### 用户功能
- `GET /api/users/:id` - 获取用户信息
- `PUT /api/users/profile` - 更新个人资料
- `POST /api/users/:id/follow` - 关注用户
- `GET /api/users/feed/me` - 获取动态流

### 搜索
- `GET /api/search?q=关键词` - 搜索故事和章节

### 通知
- `GET /api/notifications` - 获取通知列表
- `PUT /api/notifications/:id/read` - 标记已读

### 管理员
- `GET /api/admin/review-queue` - 获取审核队列
- `POST /api/admin/review` - 审核操作

## 🎯 开发路线图

### M1 阶段 ✅ (已完成)
- 基础故事创作和阅读
- 分支式章节系统
- AI续写功能
- 评分和举报系统

### M2 阶段 ✅ (已完成)
- 图片上传功能
- 搜索功能
- 用户资料页
- 通知系统
- 动态流
- 管理员后台

### M3 阶段 (规划中)
- 用户注册和邮箱验证
- 故事收藏和书签
- 评论系统
- 标签和分类
- 数据统计和分析

### M4 阶段 (规划中)
- 移动端优化
- PWA支持
- 实时协作
- 导出功能（PDF/EPUB）

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交Pull Request

### Commit规范

使用语义化提交信息：

- `feat:` 新功能
- `fix:` 修复Bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建/工具相关

## 📄 许可证

MIT License

## 👥 作者

StoryTree Team

## 🙏 致谢

- OpenAI - AI生成能力
- Prisma - 优秀的ORM工具
- Express.js - 简洁的Web框架

---

**享受创作的乐趣！** 🌳✨

