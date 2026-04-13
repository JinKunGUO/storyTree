# StoryTree 项目架构与部署更新指南

> 生成时间：2026-04-10  
> 适用分支：`mini-program`  
> 服务器：阿里云轻量应用服务器

---

## 一、项目整体架构

### 1.1 目录结构

```
/var/www/storytree/              ← 服务器部署根目录
│
├── web/                         ← 前端（纯静态 HTML/CSS/JS，无框架）
│   ├── index.html               ← 首页
│   ├── story.html               ← 故事详情页
│   ├── write.html               ← 写作页面
│   ├── chapter.html             ← 章节页面
│   ├── profile.html             ← 用户主页
│   ├── story-tree.html          ← 故事树可视化
│   ├── discover.html            ← 发现页
│   ├── admin.html               ← 管理后台
│   ├── styles/                  ← 全局样式（设计系统）
│   └── js/                      ← 公共 JS 组件（navbar/modal/toast等）
│
├── api/                         ← 后端服务（Node.js + Express + TypeScript）
│   ├── src/
│   │   ├── index.ts             ← 服务入口，监听端口 3001
│   │   ├── routes/              ← 24 个路由模块
│   │   ├── utils/               ← 工具类（auth/permissions/points/membership等）
│   │   └── workers/             ← 异步 Worker
│   │       ├── aiWorker.ts      ← AI 任务队列处理
│   │       ├── membershipWorker.ts  ← 会员到期处理
│   │       └── pinCleanupWorker.ts  ← 置顶过期清理
│   ├── prisma/
│   │   └── schema.prisma        ← 数据库 Schema（本地 SQLite / 生产 MySQL）
│   ├── dist/                    ← TypeScript 编译产物（由 npm run build 生成）
│   ├── uploads/                 ← 用户上传图片（不在 Git 中）
│   ├── .env                     ← 本地开发环境配置
│   └── .env.production          ← 生产环境配置（不在 Git 中，服务器单独维护）
│
├── scripts/
│   ├── deploy.sh                ← 一键部署脚本
│   └── nginx.conf               ← Nginx 反向代理配置模板
│
└── ecosystem.config.js          ← PM2 进程管理配置
```

### 1.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JS | 多页应用（MPA），无前端框架 |
| 后端 | Node.js + Express + TypeScript | RESTful API，端口 3001 |
| 数据库 | SQLite（本地） / MySQL（生产） | 通过 Prisma ORM 操作 |
| 进程管理 | PM2 | 单实例 fork 模式，支持开机自启 |
| 反向代理 | Nginx | 80 端口统一入口，分发静态文件和 API |
| 消息队列 | Bull + Redis | AI 任务异步处理 |
| AI 服务 | Anthropic Claude + OpenAI | 故事创作辅助 |
| 支付 | 支付宝 SDK | 会员购买、积分充值 |

### 1.3 请求流向

```
用户浏览器
    │
    ▼
Nginx（端口 80）
    │
    ├─── 静态资源请求（/、*.html、*.css、*.js）
    │         └─→ 直接读取 /var/www/storytree/web/ 目录
    │
    ├─── 上传文件请求（/uploads/）
    │         └─→ 读取 /var/www/storytree/api/uploads/ 目录
    │
    └─── API 请求（/api/...）
              └─→ 反向代理到 http://127.0.0.1:3001/api/
                        └─→ PM2 托管的 Node.js 进程
                                  └─→ MySQL（阿里云 RDS）
                                  └─→ Redis（消息队列）
```

### 1.4 数据库 Schema 说明

数据库包含以下核心数据模型：

| 模型 | 说明 |
|------|------|
| `users` | 用户（含会员等级、积分、签到等） |
| `stories` | 故事（支持可见性、协作者、密码保护） |
| `nodes` | 故事节点/章节（树状结构，支持分支） |
| `comments` | 评论（支持嵌套、置顶、软删除） |
| `ai_tasks` | AI 异步任务队列 |
| `orders` | 支付订单 |
| `point_transactions` | 积分流水 |
| `membership_benefits_log` | 会员权益记录 |
| `invitation_codes` | 邀请码系统 |
| `checkin_records` | 签到记录 |

---

## 二、本地开发环境

### 2.1 启动开发服务

```bash
# 启动 API（热重载模式）
cd api
npm run dev       # 使用 nodemon + ts-node，监听文件变化自动重启

# 前端无需构建，直接在浏览器打开 web/index.html
# 或通过 API 服务的静态文件托管访问：http://localhost:3001
```

### 2.2 本地数据库

本地使用 SQLite，数据库文件位于 `api/prisma/dev.db`，无需安装 MySQL。

```bash
cd api
npx prisma studio   # 可视化查看数据库
npx prisma db push  # 同步 Schema 变更到本地数据库
```

---

## 三、代码推送到远程仓库

```bash
# 1. 查看变更
git status
git diff

# 2. 暂存变更
git add .

# 3. 提交
git commit -m "feat: 描述本次变更内容"

# 4. 推送到远程（当前分支：mini-program）
git push origin mini-program
```

> **注意**：`api/.env.production`、`api/uploads/`、`api/prisma/dev.db` 均在 `.gitignore` 中，不会被提交。

---

## 四、阿里云服务器部署更新

### 4.1 方法一：使用一键部署脚本（推荐）

SSH 登录服务器后执行：

```bash
cd /var/www/storytree
bash scripts/deploy.sh
```

脚本会自动完成以下步骤：
1. 拉取最新代码（`git pull`）
2. 安装 Node.js 依赖（`npm ci`）
3. 同步数据库 Schema（`prisma db push`）
4. 编译 TypeScript（`npm run build`）
5. 重启 PM2 服务（`pm2 restart`）
6. 健康检查（`curl /api/health`）

### 4.2 方法二：手动分步执行

根据本次变更的范围，选择对应的步骤执行：

#### 情况 A：仅前端文件变更（web/ 目录）

```bash
cd /var/www/storytree
git pull origin mini-program

# Nginx 直接提供静态文件，无需任何额外操作
# 用户刷新浏览器即可看到最新内容
```

#### 情况 B：后端代码变更（api/src/ 目录）

```bash
cd /var/www/storytree
git pull origin mini-program

cd api
npm run build                          # 重新编译 TypeScript

pm2 restart storytree-api --update-env  # 重启服务
pm2 status                             # 确认服务正常运行
```

#### 情况 C：数据库 Schema 变更（api/prisma/schema.prisma）

```bash
cd /var/www/storytree
git pull origin mini-program

cd api
npx prisma generate                    # 生成 Prisma Client
npx prisma db push                     # 同步 Schema 到 MySQL

npm run build
pm2 restart storytree-api --update-env
```

#### 情况 D：新增 npm 依赖（package.json 变更）

```bash
cd /var/www/storytree
git pull origin mini-program

cd api
npm ci                                 # 严格按 package-lock.json 安装

npx prisma generate
npm run build
pm2 restart storytree-api --update-env
```

### 4.3 完整更新流程图

```
本地开发完成
    │
    ├─ git add . && git commit -m "..."
    ├─ git push origin mini-program
    │
    ▼
SSH 登录阿里云服务器
    │
    ├─ cd /var/www/storytree
    ├─ git pull origin mini-program
    │
    ├─── [仅前端变更] ─────────────────→ 无需操作，直接生效 ✓
    │
    ├─── [后端代码变更] ───────────────→ npm run build
    │                                    pm2 restart storytree-api
    │
    ├─── [Schema 变更] ────────────────→ npx prisma generate
    │                                    npx prisma db push
    │                                    npm run build
    │                                    pm2 restart storytree-api
    │
    └─── [依赖变更] ───────────────────→ npm ci
                                         npx prisma generate
                                         npm run build
                                         pm2 restart storytree-api
    │
    ▼
验证部署
    ├─ pm2 status                        # 确认进程状态
    ├─ pm2 logs storytree-api            # 查看运行日志
    └─ curl http://localhost:3001/api/health  # 健康检查
```

---

## 五、常用运维命令

### PM2 进程管理

```bash
pm2 status                          # 查看所有进程状态
pm2 restart storytree-api           # 重启服务
pm2 stop storytree-api              # 停止服务
pm2 logs storytree-api              # 查看实时日志
pm2 logs storytree-api --lines 100  # 查看最近 100 行日志
pm2 monit                           # 实时监控面板
```

### Nginx 管理

```bash
sudo nginx -t                       # 测试配置文件语法
sudo systemctl reload nginx         # 重载配置（不中断连接）
sudo systemctl restart nginx        # 重启 Nginx
sudo tail -f /var/log/nginx/storytree-error.log  # 查看错误日志
```

### 日志文件位置

| 日志 | 路径 |
|------|------|
| PM2 标准输出 | `/var/log/pm2/storytree-api-out.log` |
| PM2 错误输出 | `/var/log/pm2/storytree-api-error.log` |
| Nginx 访问日志 | `/var/log/nginx/storytree-access.log` |
| Nginx 错误日志 | `/var/log/nginx/storytree-error.log` |

---

## 六、重要注意事项

### 6.1 分支注意

当前开发分支为 `mini-program`，而 `scripts/deploy.sh` 中硬编码的是 `git pull origin main`。

**服务器上需要手动指定正确的分支**：

```bash
git pull origin mini-program
```

或修改 `deploy.sh` 第 113 行将 `main` 改为 `mini-program`。

### 6.2 数据库 Provider 差异

| 环境 | Provider | 配置文件 |
|------|----------|----------|
| 本地开发 | SQLite | `api/.env`（`DATABASE_URL=file:./dev.db`） |
| 生产服务器 | MySQL | `api/.env.production`（`DATABASE_URL=mysql://...`） |

部署脚本会自动将 `schema.prisma` 中的 `provider = "sqlite"` 替换为 `provider = "mysql"`。**注意不要将这个修改提交到 Git**，否则会破坏本地开发环境。

### 6.3 服务器独立维护的文件

以下文件不在 Git 仓库中，代码更新不会影响它们：

| 文件/目录 | 说明 |
|-----------|------|
| `api/.env.production` | 生产环境配置（数据库连接、API Key 等） |
| `api/uploads/` | 用户上传的图片文件 |
| `api/prisma/dev.db` | 本地 SQLite 数据库（服务器用 MySQL） |

### 6.4 首次部署（初始化）

如果是全新服务器，需要先运行初始化：

```bash
bash scripts/deploy.sh --init
```

初始化会完成：克隆代码仓库、配置 Nginx、设置 PM2 开机自启。

---

## 七、健康检查与故障排查

### 验证服务正常

```bash
# API 健康检查
curl http://localhost:3001/api/health
# 期望返回：{"status":"ok","timestamp":"..."}

# 通过 Nginx 访问
curl http://YOUR_SERVER_IP/api/health

# 查看版本信息
curl http://localhost:3001/api/version
```

### 常见问题

| 问题 | 排查命令 |
|------|----------|
| 服务无法启动 | `pm2 logs storytree-api --lines 50` |
| 数据库连接失败 | 检查 `api/.env.production` 中的 `DATABASE_URL` |
| 端口被占用 | `lsof -ti:3001` |
| Nginx 502 错误 | 确认 PM2 服务正在运行：`pm2 status` |
| 静态文件 404 | 检查 Nginx 配置中的 `root` 路径是否正确 |

