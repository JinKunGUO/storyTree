# StoryTree 部署与运维指南

本文档包含：**首次部署**、**日常更新**、**HTTPS 配置**、**故障排查**全流程。

> 适用分支：`main`
> 服务器：阿里云 ECS
> 域名：storytree.online / api.storytree.online

---

## 目录

- [项目架构](#项目架构)
- [快速命令参考](#快速命令参考)
- [首次部署（初始化）](#首次部署初始化)
- [日常更新部署](#日常更新部署)
- [HTTPS/SSL 配置](#httpsssl-配置)
- [监控与运维](#监控与运维)
- [故障排查](#故障排查)

---

## 项目架构

```
用户浏览器
    │
    ▼
Nginx（443 HTTPS）
    │
    ├─── 静态资源（/、*.html、*.css） → /var/www/storytree/web/
    ├─── 上传文件（/uploads/） → /var/www/storytree/api/uploads/
    └─── API 请求（/api/*） → http://127.0.0.1:3001 → PM2/Node.js → MySQL/Redis
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JS |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL（阿里云 RDS） |
| 缓存 | Redis（阿里云或本地） |
| 存储 | 阿里云 OSS |
| 进程管理 | PM2 |
| 反向代理 | Nginx + HTTPS |

---

## 快速命令参考

| 场景 | 命令 |
|------|------|
| **一键更新部署** | `cd /var/www/storytree && bash scripts/deploy.sh` |
| **仅重启服务** | `pm2 restart storytree-api` |
| **查看日志** | `pm2 logs storytree-api --lines 100` |
| **测试 Nginx** | `sudo nginx -t && sudo systemctl reload nginx` |
| **健康检查** | `curl https://api.storytree.online/api/health` |

---

## 首次部署（初始化）

### 1. 服务器准备

```bash
# SSH 登录
ssh root@your-ecs-ip

# 安装基础软件
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs nginx git
npm install -g pm2

# 创建目录
mkdir -p /var/www/storytree
chown -R $USER:$USER /var/www/storytree
```

### 2. 上传配置文件

**必须手动上传以下文件到服务器**（不在 Git 中）：

| 文件 | 路径 | 说明 |
|------|------|------|
| SSL 证书（前端） | `/etc/nginx/ssl/storytree/storytree.online.pem` | 阿里云下载的 Nginx 证书 |
| SSL 私钥（前端） | `/etc/nginx/ssl/storytree/storytree.online.key` | 对应私钥 |
| SSL 证书（API） | `/etc/nginx/ssl/api.storytree.online/api.storytree.online.pem` | API 子域名证书 |
| SSL 私钥（API） | `/etc/nginx/ssl/api.storytree.online/api.storytree.online.key` | 对应私钥 |
| 环境变量 | `/var/www/storytree/api/.env.production` | 生产环境配置 |

**上传证书示例**：
```bash
# 本地执行
scp storytree.online.pem root@120.26.182.140:/etc/nginx/ssl/storytree/
scp storytree.online.key root@120.26.182.140:/etc/nginx/ssl/storytree/
scp api.storytree.online.pem root@120.26.182.140:/etc/nginx/ssl/api.storytree.online/
scp api.storytree.online.key root@120.26.182.140:/etc/nginx/ssl/api.storytree.online/
```

### 3. 运行初始化脚本

```bash
cd /var/www/storytree
bash scripts/deploy.sh --init
```

初始化会完成：
- 克隆代码仓库
- 配置 Nginx
- 设置 PM2 开机自启

### 4. 配置环境变量

创建 `/var/www/storytree/api/.env.production`：

```bash
# ===================================
# 核心配置
# ===================================
NODE_ENV=production
PORT=3001

# 数据库（阿里云 RDS）
DATABASE_URL="mysql://用户名:密码@主机:端口/数据库"

# Redis（可选，本地或阿里云）
REDIS_URL=redis://localhost:6379

# JWT 密钥（已移除引号，纯字符串）
JWT_SECRET=your-production-secret-key

# 开发模式（生产环境必须关闭）
ENABLE_DEV_AUTH=false

# ===================================
# 域名配置（HTTPS）
# ===================================
FRONTEND_URL=https://storytree.online
API_URL=https://api.storytree.online
API_BASE_URL=https://api.storytree.online

# CORS 配置（安全必需）
ALLOWED_ORIGINS=https://storytree.online,https://www.storytree.online,https://api.storytree.online

# ===================================
# 阿里云 OSS
# ===================================
STORAGE_MODE=oss
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret

# ===================================
# 其他服务（按需填写）
# ===================================
# QWEN_API_KEY=xxx
# WX_APPID=xxx
# SMTP_HOST=xxx
```

### 5. 启动服务

```bash
cd /var/www/storytree/api

# 安装依赖
npm ci

# 数据库同步
npx prisma generate
npx prisma db push

# 编译
npm run build

# 启动
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 6. 验证部署

```bash
# 测试 HTTPS 访问
curl -I https://storytree.online
curl -I https://api.storytree.online/api/health

# 检查 PM2 状态
pm2 status
pm2 logs storytree-api --lines 20
```

---

## 日常更新部署

### 一键部署（推荐）

```bash
ssh root@120.26.182.140
cd /var/www/storytree
bash scripts/deploy.sh
```

脚本自动执行：
1. `git pull origin main` - 拉取最新代码（第 131 行）
2. `npm ci` - 安装依赖
3. `npx prisma db push` - 同步数据库（生产环境使用 MySQL schema）
4. `npm run build` - 编译 TypeScript
5. `pm2 restart` - 重启服务
6. `curl /api/health` - 健康检查

### 手动分步部署

根据变更类型选择步骤：

#### A. 仅前端变更（web/ 目录）

```bash
cd /var/www/storytree
git pull origin main
# 无需操作，Nginx 直接提供静态文件
```

#### B. 后端代码变更（api/src/）

```bash
cd /var/www/storytree
git pull origin main
cd api
npm run build
pm2 restart storytree-api --update-env
```

#### C. 数据库 Schema 变更（prisma/schema.prisma）

```bash
cd /var/www/storytree
git pull origin main
cd api
npx prisma generate
npx prisma db push
npm run build
pm2 restart storytree-api --update-env
```

#### D. 新增依赖（package.json）

```bash
cd /var/www/storytree
git pull origin main
cd api
npm ci
npx prisma generate
npm run build
pm2 restart storytree-api --update-env
```

---

## HTTPS/SSL 配置

### 证书路径

| 域名 | 证书 | 私钥 |
|------|------|------|
| storytree.online | `/etc/nginx/ssl/storytree/storytree.online.pem` | `/etc/nginx/ssl/storytree/storytree.online.key` |
| api.storytree.online | `/etc/nginx/ssl/api.storytree.online/api.storytree.online.pem` | `/etc/nginx/ssl/api.storytree.online/api.storytree.online.key` |

### Nginx 配置说明

配置文件：`/etc/nginx/sites-available/storytree`

**HTTP → HTTPS 强制跳转**：
```nginx
server {
    listen 80;
    server_name storytree.online;
    return 301 https://$server_name$request_uri;
}
```

**HTTPS 配置关键行**：
```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/storytree/storytree.online.pem;
ssl_certificate_key /etc/nginx/ssl/storytree/storytree.online.key;
```

### 更新证书后

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 监控与运维

### PM2 进程管理

```bash
pm2 status                          # 查看进程状态
pm2 restart storytree-api           # 重启服务
pm2 stop storytree-api              # 停止服务
pm2 logs storytree-api              # 实时日志
pm2 logs storytree-api --lines 100  # 最近 100 行
pm2 monit                           # 监控面板
```

### Nginx 管理

```bash
sudo nginx -t                       # 测试配置语法
sudo systemctl reload nginx         # 重载配置（平滑）
sudo systemctl restart nginx        # 重启 Nginx
sudo tail -f /var/log/nginx/storytree-error.log
```

### 日志文件位置

| 日志 | 路径 |
|------|------|
| PM2 输出 | `/var/log/pm2/storytree-api-out.log` |
| PM2 错误 | `/var/log/pm2/storytree-api-error.log` |
| Nginx 访问 | `/var/log/nginx/storytree-access.log` |
| Nginx 错误 | `/var/log/nginx/storytree-error.log` |
| API 访问 | `/var/log/nginx/storytree-api-access.log` |

### 健康检查

```bash
# API 健康检查
curl https://api.storytree.online/api/health
# 期望返回：{"status":"ok","timestamp":"..."}

# 本地直接检查
curl http://localhost:3001/api/health
```

---

## 故障排查

### 常见问题速查

| 问题 | 排查命令/解决 |
|------|---------------|
| 服务无法启动 | `pm2 logs storytree-api --lines 50` |
| 数据库连接失败 | 检查 `.env.production` 中的 `DATABASE_URL` |
| Nginx 502 错误 | `pm2 status` 确认服务运行；`pm2 logs` 查看错误 |
| SSL 证书错误 | 检查证书路径是否正确，文件权限是否为 644 |
| CORS 错误 | 检查 `ALLOWED_ORIGINS` 是否包含当前访问域名 |
| 端口被占用 | `lsof -ti:3001` 查看占用进程 |

### 数据库连接失败

```bash
# 检查网络连通性
telnet rm-xxx.mysql.rds.aliyuncs.com 3306

# 检查 RDS 白名单设置
# 阿里云控制台 → RDS → 数据安全性 → 白名单设置
```

### OSS 上传失败

```bash
# 检查 AccessKey 权限
# RAM 控制台 → 用户 → 权限管理

# 检查 Bucket 权限和 CORS 设置
# OSS 控制台 → Bucket → 权限管理
```

### 部署脚本失败

```bash
# 手动检查每步
cd /var/www/storytree
git pull origin main        # 1. 拉取代码
cd api
npm ci                      # 2. 安装依赖
npx prisma db push          # 3. 数据库同步
npm run build               # 4. 编译
pm2 restart storytree-api   # 5. 重启服务
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/deploy.sh` | 一键部署脚本 |
| `scripts/nginx.conf` | Nginx 配置模板（HTTPS 双域名） |
| `api/.env.example` | 环境变量配置模板 |
| `ecosystem.config.js` | PM2 进程配置 |

---

## 注意事项

1. **分支统一**：当前使用 `main` 分支，deploy.sh 已配置为 `git pull origin main`

2. **Schema 切换**：部署脚本会自动复制 `schema.mysql.prisma` 到 `schema.prisma`，**请勿将此修改提交到 Git**

3. **服务器独立文件**（不在 Git 中）：
   - `api/.env.production` - 生产环境配置
   - `api/uploads/` - 用户上传图片
   - `/etc/nginx/ssl/` - SSL 证书

4. **HTTPS 强制**：Nginx 已配置 HTTP(80) 自动跳转到 HTTPS(443)，确保所有流量加密
