# 🌳 StoryTree - 分支式AI协作小说平台

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./VERSION.json)
[![Stage](https://img.shields.io/badge/stage-MVP-green.svg)](./VERSION.json)

> 让AI和人类共同创作分支式叙事作品

## ✨ 核心功能

- 📝 **故事创作** - 创建故事并撰写章节
- 🤖 **AI续写** - 3种风格智能续写选项
- 🌿 **分支创作** - 平等的分支树状结构
- ⭐ **评分系统** - 读者评分决定内容排序
- 👥 **多人协作** - 邀请好友或AI共同创作

## 🏗️ 项目结构

```
storytree/
├── README.md                 # 本文件
├── VERSION.json              # 版本信息
├── .gitignore               # Git忽略规则
├── .githooks/               # Git自动化钩子
│   ├── pre-commit
│   └── post-commit
├── scripts/
│   ├── version-manager.js   # 版本管理工具
│   └── setup-git.sh         # Git初始化脚本
├── api/                     # 后端服务
│   ├── src/                 # 源代码
│   ├── prisma/              # 数据库
│   ├── scripts/             # 后端脚本
│   └── package.json
├── web/                     # 前端应用
│   └── index.html           # 单页应用
└── docs/
    ├── API.md               # API文档
    ├── VERSION-GUIDE.md     # 版本管理指南
    └── ARCHITECTURE.md      # 架构设计
```

## 🚀 快速启动

### 1. 启动后端

```bash
cd api
npm install
npm run dev
# API运行于 http://localhost:3001
```

### 2. 启动前端

```bash
# 方式1: 直接打开浏览器
open web/index.html

# 方式2: 使用简易服务器
cd web
python3 -m http.server 3000
# 访问 http://localhost:3000
```

### 3. 配置AI功能（可选）

在 `api/.env` 中添加：
```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## 📦 版本管理

```bash
# 查看版本
node scripts/version-manager.js

# 更新版本
node scripts/version-manager.js patch  # 修订号+1
node scripts/version-manager.js minor  # 次版本号+1
node scripts/version-manager.js stage M2  # 切换阶段
```

每次Git提交会自动更新版本号。详见 [docs/VERSION-GUIDE.md](./docs/VERSION-GUIDE.md)

## 📝 开发路线

| 阶段 | 版本 | 状态 | 主要功能 |
|------|------|------|----------|
| M1 | 1.0.x | 🟢 完成 | MVP核心功能 |
| M2 | 1.1.x | 🟡 计划 | 审核系统、图片支持 |
| M3 | 1.2.x | ⚪ 计划 | 微信小程序 |
| M4 | 2.0.x | ⚪ 计划 | 正式发布 |

## 📄 许可证

MIT License
