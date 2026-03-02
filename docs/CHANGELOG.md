# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-11

### Added - M2阶段基础功能

#### 图片功能支持
- 图片上传API和文件存储处理
- 支持故事封面图片上传
- 支持章节配图上传
- 支持用户头像上传
- 文件大小限制5MB，支持jpg/png/gif/webp格式
- 静态文件服务提供图片访问

#### 搜索功能
- 全文搜索API支持故事和章节
- 搜索结果按相关度排序
- 前端搜索界面，支持实时搜索（防抖）
- 分类展示搜索结果
- 导航栏新增搜索入口

#### 用户资料与社交
- 用户个人主页展示
- 个人资料编辑功能（简介）
- 显示用户创作统计（故事数、章节数）
- 显示关注和粉丝数量
- 用户创作历史列表
- 用户参与章节列表
- 关注/取消关注功能

#### 通知系统
- 新增Notification数据模型
- 通知创建和管理API
- 支持多种通知类型（关注、审核、更新等）
- 关注用户时自动发送通知
- 审核结果自动通知作者
- 导航栏通知图标和未读数量提示
- 通知中心页面
- 标记已读/全部已读功能
- 点击通知跳转到相关内容

#### 动态流
- 获取关注用户最新创作的API
- 动态流页面展示关注用户的新作品
- 按时间倒序排列
- 显示作者信息和创作时间
- 内容预览和快速跳转

#### 管理员系统
- User模型新增isAdmin字段
- 管理员权限验证中间件
- requireAdmin中间件保护管理接口
- 独立的管理员后台页面（admin.html）
- 审核统计面板
- 待审核内容队列
- 一键通过/驳回/下架操作
- 查看举报详情功能

### Changed

- 更新Story模型，新增coverImage字段
- 更新Node模型，新增image字段
- 更新User模型，新增isAdmin字段和notifications关系
- stories路由支持封面图片参数
- nodes路由支持章节配图参数
- admin路由添加权限验证和通知功能
- users路由扩展，支持资料编辑和动态流

### Technical

- 新增multer依赖用于文件上传
- 新增upload.ts工具处理图片上传
- 新增auth.ts中间件处理权限验证
- 数据库schema新增Notification表
- API新增upload、search、notifications路由
- 前端新增搜索、通知、用户资料、动态流页面

## [0.1.0] - 2026-02-10

### Added - M1阶段MVP

#### 核心功能
- 用户认证系统（开发环境快速登录）
- 故事创建和管理
- 分支式章节系统
- 树状结构的故事导航
- 章节阅读和评分
- AI续写功能（生成多个选项）

#### 内容管理
- 自动内容审核机制
- 敏感词过滤
- 举报系统
- 管理员审核队列
- 审核状态管理（待审核/通过/驳回/下架）

#### 社交功能
- 用户关注系统
- 关注者和粉丝列表
- 用户基本信息展示

#### 技术实现
- Express.js + TypeScript后端
- Prisma ORM数据库访问
- PostgreSQL/SQLite数据库支持
- RESTful API设计
- 纯HTML/CSS/JavaScript前端
- 响应式界面设计

### Database Schema

- User（用户）
- Story（故事）
- Node（章节）
- Rating（评分）
- Report（举报）
- Follow（关注）

---

## 版本说明

- **Major version (x.0.0)**: 重大功能更新或架构变更
- **Minor version (0.x.0)**: 新功能添加
- **Patch version (0.0.x)**: Bug修复和小改进

[Unreleased]: https://github.com/yourusername/storytree/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/storytree/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/yourusername/storytree/releases/tag/v0.1.0

