# 🚀 StoryTree 快速启动指南

## 一次性设置

### 1. 初始化Git仓库

```bash
cd /Users/jinkun/storytree
bash scripts/setup-git.sh
```

### 2. 首次提交

```bash
git add .
git commit -m "feat: initial StoryTree MVP

- Add story creation
- Add AI continuation
- Add branching system
- Add rating system

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 日常开发

### 启动后端

```bash
cd /Users/jinkun/storytree/api
npm run dev
```
服务运行于 http://localhost:3001

### 启动前端

```bash
cd /Users/jinkun/storytree/web
python3 -m http.server 3000
```
访问 http://localhost:3000

### 完整启动（使用两个终端）

```bash
# Terminal 1
cd /Users/jinkun/storytree/api && npm run dev

# Terminal 2
cd /Users/jinkun/storytree/web && python3 -m http.server 3000

# Browser
open http://localhost:3000
```

## 版本管理

```bash
# 查看版本
node scripts/version-manager.js

# 发布新版本
node scripts/version-manager.js patch    # 1.0.0 -> 1.0.1
node scripts/version-manager.js minor    # 1.0.0 -> 1.1.0
node scripts/version-manager.js stage M2 # 切换阶段
```

## 项目结构

```
storytree/
├── README.md              # 项目说明
├── VERSION.json           # 版本信息
├── scripts/               # 工具脚本
│   ├── setup-git.sh
│   └── version-manager.js
├── api/                   # 后端
│   ├── src/
│   ├── prisma/
│   └── package.json
├── web/                   # 前端
│   └── index.html
└── docs/                  # 文档
    └── VERSION-GUIDE.md
```

## 检查状态

```bash
# 查看API状态
curl http://localhost:3001/api/health

# 查看版本信息
curl http://localhost:3001/api/version

# 查看Git状态
git status
```
