# 🎉 StoryTree v1.0.0 发布说明

**发布日期**: 2026-02-11  
**版本代号**: M2-Basic Features  
**Git标签**: v1.0.0

---

## 📋 版本概述

StoryTree v1.0.0 是一个重要的里程碑版本，完成了M1（MVP）和M2（基础功能）两个阶段的开发。本版本提供了完整的分支式故事创作平台核心功能，包括AI协作、图片管理、搜索、社交和内容审核等功能。

## ✨ 新增功能

### 1. 图片功能支持
- ✅ **图片上传API**: 基于multer的文件上传处理
- ✅ **故事封面**: 为每个故事添加封面图片
- ✅ **章节配图**: 章节可以包含配图
- ✅ **用户头像**: 支持自定义头像上传
- ✅ **文件限制**: 5MB大小限制，支持jpg/png/gif/webp格式
- ✅ **静态服务**: 自动提供图片访问服务

**技术实现**:
```
api/src/utils/upload.ts - 上传工具
api/src/routes/upload.ts - 上传API
/uploads - 静态文件目录
```

### 2. 全文搜索功能
- ✅ **搜索API**: 支持故事和章节的全文搜索
- ✅ **智能排序**: 按相关度和时间排序
- ✅ **实时搜索**: 前端防抖优化
- ✅ **分类展示**: 故事和章节分类显示
- ✅ **快速跳转**: 搜索结果直接跳转

**技术实现**:
```
api/src/routes/search.ts - 搜索API
web/index.html - 搜索界面
```

### 3. 用户资料与社交
- ✅ **个人主页**: 完整的用户资料页面
- ✅ **资料编辑**: 修改个人简介和头像
- ✅ **创作统计**: 显示故事数和章节数
- ✅ **社交数据**: 关注数和粉丝数
- ✅ **创作历史**: 用户发布的所有故事
- ✅ **参与记录**: 用户创作的所有章节
- ✅ **关注系统**: 关注/取消关注用户

**API端点**:
```
GET  /api/users/:id - 获取用户信息
PUT  /api/users/profile - 更新个人资料
GET  /api/users/:id/stories - 用户的故事
GET  /api/users/:id/nodes - 用户的章节
POST /api/users/:id/follow - 关注用户
DELETE /api/users/:id/follow - 取消关注
```

### 4. 通知系统
- ✅ **通知模型**: 新增Notification数据表
- ✅ **多种类型**: 关注、审核、更新等通知
- ✅ **自动通知**: 关键操作自动发送通知
- ✅ **未读提示**: 导航栏未读数量显示
- ✅ **通知中心**: 完整的通知列表页面
- ✅ **已读管理**: 标记已读/全部已读
- ✅ **快速跳转**: 点击通知跳转到相关内容

**通知类型**:
- `follow`: 新增关注者
- `review`: 内容审核结果
- `story_update`: 关注的故事更新
- `system`: 系统通知

### 5. 动态流
- ✅ **动态API**: 获取关注用户的最新创作
- ✅ **时间排序**: 按发布时间倒序
- ✅ **内容预览**: 显示章节标题和摘要
- ✅ **作者信息**: 显示作者和创作时间
- ✅ **快速访问**: 一键跳转到内容

**使用方式**:
```
GET /api/users/feed/me - 获取个人动态流
```

### 6. 管理员系统
- ✅ **权限标识**: User表新增isAdmin字段
- ✅ **权限中间件**: requireAdmin保护管理接口
- ✅ **管理后台**: 独立的admin.html页面
- ✅ **审核统计**: 实时统计待审核数量
- ✅ **审核队列**: 列表展示待审核内容
- ✅ **快速操作**: 一键通过/驳回/下架
- ✅ **举报处理**: 查看和处理用户举报
- ✅ **审核通知**: 自动通知作者审核结果

**管理功能**:
```
GET  /api/admin/review-queue - 审核队列
POST /api/admin/review - 审核操作
GET  /api/admin/reports/:nodeId - 举报详情
```

## 🔧 技术改进

### 数据库变更
```sql
-- Story表新增字段
coverImage String? - 故事封面

-- Node表新增字段  
image String? - 章节配图

-- User表新增字段
isAdmin Boolean - 管理员标识

-- 新增Notification表
id, userId, type, title, content, link, isRead, createdAt
```

### 新增依赖
```json
{
  "multer": "^1.4.5-lts.1",
  "@types/multer": "^1.4.11"
}
```

### 代码结构
```
api/src/
├── routes/
│   ├── upload.ts        ✨ 新增
│   ├── search.ts        ✨ 新增
│   ├── notifications.ts ✨ 新增
│   ├── users.ts         ✨ 扩展
│   └── admin.ts         ✨ 增强
├── utils/
│   ├── upload.ts        ✨ 新增
│   └── auth.ts          ✨ 新增
```

### 文档完善
- ✅ `README.md` - 完整的项目说明
- ✅ `CHANGELOG.md` - 版本变更记录
- ✅ `CONTRIBUTING.md` - 贡献指南
- ✅ `docs/GIT_WORKFLOW.md` - Git工作流程
- ✅ `.gitignore` - Git忽略配置
- ✅ `.gitattributes` - Git属性配置

## 📊 统计数据

### 代码变更
- **新增文件**: 13个
- **修改文件**: 10个
- **新增代码**: 3390行
- **删除代码**: 146行
- **净增加**: 3244行

### 提交记录
```
* 25c4359 Merge branch 'feature/m2-basic-features'
* 8a25749 chore: 同步版本号
* 0b919e7 chore: 同步版本号
* 19a8f34 chore: 更新版本号到1.0.2
* fcd1e34 docs: 添加Git工作流程文档
* 3e060c9 fix: 修复version-manager.js语法错误并添加Git配置
* 3765244 docs: 添加项目文档和Git配置
* 1921c63 feat(M2): 实现M2阶段基础功能
* 34ecc78 feat: initial StoryTree MVP
```

### 功能模块
- **后端API**: 8个路由文件
- **工具函数**: 3个工具模块
- **前端页面**: 2个HTML页面
- **数据模型**: 7个Prisma模型

## 🚀 快速开始

### 安装
```bash
# 克隆项目
git clone <repository-url>
cd storytree

# 检出v1.0.0版本
git checkout v1.0.0

# 安装依赖
cd api && npm install

# 配置环境
cp .env.example .env

# 初始化数据库
npm run db:push

# 启动服务
npm run dev
```

### 访问
- **用户前台**: http://localhost:3001
- **管理后台**: http://localhost:3001/admin.html
- **API文档**: http://localhost:3001/api/health

## 🔄 升级指南

### 从M1升级到v1.0.0

1. **备份数据库**
```bash
# SQLite
cp api/prisma/dev.db api/prisma/dev.db.backup
```

2. **拉取代码**
```bash
git pull origin main
git checkout v1.0.0
```

3. **更新依赖**
```bash
cd api
npm install
```

4. **更新数据库**
```bash
npm run db:push
```

5. **重启服务**
```bash
npm run dev
```

## ⚠️ 重要变更

### 破坏性变更
- 无破坏性变更

### 数据库迁移
- 新增字段都是可选的，不影响现有数据
- 建议为现有用户设置管理员权限：
```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

### API变更
- 所有管理员API需要管理员权限
- 图片上传需要用户认证

## 🐛 已知问题

1. **图片上传**: 暂不支持图片压缩和缩略图
2. **搜索性能**: 大量数据时搜索可能较慢
3. **通知推送**: 暂无实时推送，需刷新页面

## 🔮 下一步计划（M3）

### 计划功能
- [ ] 用户注册和邮箱验证
- [ ] 故事收藏和书签
- [ ] 评论系统
- [ ] 标签和分类
- [ ] 图片压缩和CDN
- [ ] WebSocket实时通知
- [ ] 高级搜索过滤
- [ ] 数据导出功能

### 性能优化
- [ ] 数据库索引优化
- [ ] API响应缓存
- [ ] 图片懒加载
- [ ] 分页加载优化

## 📞 支持与反馈

### 报告问题
- GitHub Issues: https://github.com/yourusername/storytree/issues
- Email: storytree@example.com

### 获取帮助
- 文档: 查看 README.md
- 贡献指南: 查看 CONTRIBUTING.md
- Git工作流程: 查看 docs/GIT_WORKFLOW.md

## 🙏 致谢

感谢所有为StoryTree v1.0.0做出贡献的开发者和测试者！

特别感谢：
- M1阶段的核心功能开发
- M2阶段的功能完善和文档编写
- 所有提供反馈和建议的用户

## 📜 许可证

[待定]

---

**StoryTree Team**  
2026年2月11日

🌳 让故事拥有无限可能！

