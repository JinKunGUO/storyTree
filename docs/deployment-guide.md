# StoryTree 服务器部署全流程指南

> **记录时间**：2026-04-01  
> **服务器 IP**：120.26.182.140（阿里云 ECS，Ubuntu）  
> **项目仓库**：https://github.com/JinKunGUO/storyTree.git  
> **本次部署结果**：成功 ✅

---

## 目录

1. [名词解释](#名词解释)
2. [架构概览](#架构概览)
3. [部署流程（分步骤）](#部署流程)
   - [第一步：服务器基础环境准备](#第一步服务器基础环境准备)
   - [第二步：安装 Node.js 与 npm](#第二步安装-nodejs-与-npm)
   - [第三步：安装并配置 MySQL 数据库](#第三步安装并配置-mysql-数据库)
   - [第四步：克隆代码并安装依赖](#第四步克隆代码并安装依赖)
   - [第五步：配置环境变量](#第五步配置环境变量)
   - [第六步：数据库迁移](#第六步数据库迁移)
   - [第七步：使用 PM2 启动后端服务](#第七步使用-pm2-启动后端服务)
   - [第八步：配置 Nginx 反向代理](#第八步配置-nginx-反向代理)
   - [第九步：配置防火墙（ufw）](#第九步配置防火墙ufw)
   - [第十步：配置阿里云安全组](#第十步配置阿里云安全组)
4. [验证部署结果](#验证部署结果)
5. [常见问题排查](#常见问题排查)
6. [日常运维命令](#日常运维命令)
7. [后续优化建议](#后续优化建议)

---

## 名词解释

| 名词 | 解释 |
|------|------|
| **ECS** | 阿里云弹性计算服务（Elastic Compute Service），即云服务器 |
| **Ubuntu** | 一种 Linux 操作系统发行版，本次使用 Ubuntu 22.04 |
| **Node.js** | JavaScript 运行时环境，用于在服务器端运行 JS 代码 |
| **npm** | Node.js 的包管理工具（Node Package Manager） |
| **PM2** | Node.js 进程管理工具，可以让 Node 应用在后台持续运行、崩溃自动重启 |
| **Nginx** | 高性能 Web 服务器，本项目中用作反向代理和静态文件服务器 |
| **反向代理** | Nginx 接收外部请求后，转发给内部的 Node.js 服务，外部用户感知不到内部端口 |
| **MySQL** | 开源关系型数据库，本项目生产环境使用的数据库（开发环境使用 SQLite） |
| **Prisma** | Node.js 的 ORM 框架，用于操作数据库，`prisma migrate` 负责执行数据库结构变更 |
| **ufw** | Ubuntu 内置防火墙工具（Uncomplicated Firewall），控制操作系统级别的网络访问 |
| **安全组** | 阿里云网络层的访问控制规则，在流量到达服务器前进行过滤，比 ufw 更外层 |
| **端口** | 网络通信的逻辑通道。80=HTTP，443=HTTPS，22=SSH，3001=本项目 API 服务 |
| **SSH** | 安全远程登录协议（Secure Shell），用于从本地连接并操作远程服务器 |
| **环境变量** | 存储在系统中的配置信息（如数据库密码、API 密钥），通过 `.env` 文件管理 |
| **git pull** | 从远程仓库拉取最新代码到服务器 |
| **scp** | 通过 SSH 在本地与服务器之间传输文件的命令 |
| **localhost / 127.0.0.1** | 指服务器自身，只能从服务器内部访问，外网无法直接访问 |

---

## 架构概览

```
用户浏览器
    │
    │ HTTP/HTTPS 请求 (80/443 端口)
    ▼
阿里云安全组（第一道防线）
    │
    ▼
服务器 ufw 防火墙（第二道防线）
    │
    ▼
Nginx（80/443 端口监听）
    ├── /api/* 请求  ──→  转发到 localhost:3001（Node.js API 服务，PM2 管理）
    │                          │
    │                          ▼
    │                    MySQL 数据库
    │
    └── 其他请求  ──→  /var/www/storytree/web/（静态前端文件）
```

**关键点**：
- Nginx 是唯一对外暴露的入口（80/443）
- Node.js API 只监听 `127.0.0.1:3001`，外网无法直接访问
- 前端是纯静态 HTML/CSS/JS，由 Nginx 直接提供服务
- Nginx职责一：静态文件服务器。直接把 /var/www/storytree/web/ 目录下的 HTML/CSS/JS 文件返回给浏览器。职责二：反向代理。用户访问 http://120.26.182.140/api/开头时，Nginx 不自己处理，而是转交给后端 Node.js 服务

---

## 部署流程

### 第一步：服务器基础环境准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装常用工具
sudo apt install -y curl git build-essential
```

### 第二步：安装 Node.js 与 npm

```bash
# 使用 NodeSource 安装 Node.js 18.x（LTS 版本）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version

# 全局安装 PM2
npm install -g pm2
```

### 第三步：安装并配置 MySQL 数据库

```bash
# 安装 MySQL
sudo apt install -y mysql-server

# 启动并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql

# 运行安全初始化（设置 root 密码、移除匿名用户等）
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -u root -p << EOF
CREATE DATABASE storytree_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'storytree'@'localhost' IDENTIFIED BY '你的数据库密码';
GRANT ALL PRIVILEGES ON storytree_db.* TO 'storytree'@'localhost';
FLUSH PRIVILEGES;
EOF
```

> **注意**：密码要足够复杂，并与后续 `.env` 文件中的 `DATABASE_URL` 保持一致。

### 第四步：克隆代码并安装依赖

```bash
# 创建项目目录
sudo mkdir -p /var/www/storytree
sudo chown -R $USER:$USER /var/www/storytree

# 克隆仓库
cd /var/www
git clone https://github.com/JinKunGUO/storyTree.git storytree
cd storytree

# 安装 API 依赖
cd api
npm install

# 构建（如果有 TypeScript 编译）
npm run build
```

### 第五步：配置环境变量

```bash
# 在 api 目录下创建 .env 文件
cd /var/www/storytree/api
nano .env
```

`.env` 文件内容示例：

```env
# 数据库连接（MySQL 格式）
DATABASE_URL="mysql://storytree:你的数据库密码@localhost:3306/storytree_db"

# JWT 密钥（随机字符串，越长越安全）
JWT_SECRET="your-super-secret-jwt-key-here"

# 服务端口
PORT=3001

# 运行环境
NODE_ENV=production

# 其他 API 密钥（如 AI 服务等）
# OPENAI_API_KEY=...
```

> **安全提示**：`.env` 文件包含敏感信息，确保已在 `.gitignore` 中排除，不要提交到 Git 仓库。

### 第六步：数据库迁移

```bash
cd /var/www/storytree/api

# 【重要】确认 prisma/schema.prisma 中 provider 已设置为 mysql
# datasource db {
#   provider = "mysql"
#   url      = env("DATABASE_URL")
# }

# 执行所有数据库迁移
npx prisma migrate deploy

# 验证数据库结构
npx prisma db pull
```

> **说明**：`migrate deploy` 会按顺序执行 `prisma/migrations/` 目录下所有未执行的迁移文件，建立数据库表结构。

### 第七步：使用 PM2 启动后端服务

```bash
cd /var/www/storytree/api

# 启动服务（指定名称便于管理）
pm2 start dist/index.js --name storytree-api
# 或者如果直接运行 ts-node：
# pm2 start src/index.ts --name storytree-api --interpreter ts-node

# 设置开机自启
pm2 startup
pm2 save

# 查看运行状态
pm2 status
pm2 logs storytree-api
```

**PM2 常用命令**：

```bash
pm2 status              # 查看所有进程状态
pm2 logs storytree-api  # 查看实时日志
pm2 restart storytree-api  # 重启服务
pm2 stop storytree-api     # 停止服务
pm2 delete storytree-api   # 删除进程
```

### 第八步：配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建项目配置文件
sudo nano /etc/nginx/sites-available/storytree
```

Nginx 配置文件内容（`/etc/nginx/sites-available/storytree`）：

```nginx
server {
    listen 80;
    server_name 120.26.182.140;  # 替换为你的 IP 或域名

    # 安全头
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # 静态前端文件根目录
    root /var/www/storytree/web;
    index index.html;

    # ① API 反向代理（优先级最高，必须放在最前）
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # ② 上传文件反向代理
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ③ 前端页面路由：将已知路径转发给 Node.js 处理
    #    与 api/src/index.ts 中的 possiblePages 列表保持一致
    location ~ ^/(login|register|create|discover|profile|admin|story|story-tree|chapter|write|payment|reset-password|verify-email|forgot-password|ai-tasks|debug|level)$ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ④ 静态资源（CSS/JS/图片等有扩展名的文件）直接由 Nginx 提供
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ⑤ 其他所有请求：先找静态文件，找不到则返回首页
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> **说明**：规则 ③ 是修复"访问 `/login` 显示首页"问题的关键。Nginx 将这些路径转发给 Node.js，由 `api/src/index.ts` 中的 SPA 路由逻辑返回对应的 `.html` 文件。每次在 `index.ts` 的 `possiblePages` 中新增页面时，也需要同步更新此处的正则表达式。

```bash
# 启用配置（创建软链接）
sudo ln -s /etc/nginx/sites-available/storytree /etc/nginx/sites-enabled/

# 删除默认配置（避免冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 第九步：配置防火墙（ufw）

```bash
# 放行必要端口
sudo ufw allow 22/tcp    # SSH（必须先放行，否则会断开连接！）
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 启用防火墙
sudo ufw enable

# 验证状态
sudo ufw status
```

预期输出：

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> **警告**：一定要先放行 22 端口再启用防火墙，否则 SSH 连接会被切断，导致无法远程操作服务器！

### 第十步：配置阿里云安全组

这是**第二道防线**，必须在阿里云控制台手动配置。

**操作路径**：阿里云控制台 → ECS → 实例 → 点击实例名 → 安全组 → 管理规则 → 入方向 → 手动添加

需要添加的规则：

| 授权策略 | 优先级 | 协议 | 端口范围 | 授权对象 | 描述 |
|----------|--------|------|----------|----------|------|
| 允许 | 100 | TCP | 80/80 | 0.0.0.0/0 | HTTP |
| 允许 | 100 | TCP | 443/443 | 0.0.0.0/0 | HTTPS |
| 允许 | 100 | TCP | 22/22 | 0.0.0.0/0 | SSH |

> **提示**：也可以使用右侧"快捷配置"中的"Web HTTP 流量访问"和"Web HTTPS 流量访问"按钮，一键添加 80 和 443 规则。

---

## 验证部署结果

### 服务器内部验证

```bash
# 1. 检查 PM2 进程状态
pm2 status

# 2. 检查 API 是否正常响应（本地测试）
curl http://localhost:3001/api/health

# 3. 检查 Nginx 是否正常提供前端页面
curl -v http://localhost/

# 4. 检查 Nginx 状态
sudo systemctl status nginx

# 5. 检查端口监听情况
sudo ss -tlnp | grep -E '80|443|3001'
```

### 外网验证

在浏览器中访问：`http://120.26.182.140`

能看到 StoryTree 首页即为部署成功。

---

## 常见问题排查

### 问题一：外网访问 IP 无法打开页面（超时或拒绝连接）

**排查步骤**：

```bash
# 在本地 Mac 终端测试端口连通性
curl -v --connect-timeout 10 http://120.26.182.140/
telnet 120.26.182.140 80
```

**原因与解决**：

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| 连接超时 | 阿里云安全组未放行 80 端口 | 去阿里云控制台添加安全组入方向规则 |
| Connection refused | Nginx 未运行或端口未监听 | `sudo systemctl start nginx` |
| 返回 502 Bad Gateway | Node.js 服务未运行 | `pm2 restart storytree-api` |
| 返回 404 | Nginx root 路径配置错误 | 检查 `/etc/nginx/sites-available/storytree` 中的 root 路径 |

### 问题二：API 请求失败（/api/* 返回错误）

```bash
# 查看 API 日志
pm2 logs storytree-api --lines 50

# 查看错误日志
cat /var/log/pm2/storytree-api-error.log

# 测试 API 直连
curl http://localhost:3001/api/health
```

### 问题三：数据库连接失败

```bash
# 检查 MySQL 是否运行
sudo systemctl status mysql

# 测试数据库连接
mysql -u storytree -p storytree_db

# 检查 .env 中的 DATABASE_URL 格式是否正确
cat /var/www/storytree/api/.env | grep DATABASE_URL
```

### 问题四：Nginx 配置修改后不生效

```bash
# 测试配置语法
sudo nginx -t

# 重载配置（不中断服务）
sudo systemctl reload nginx

# 查看 Nginx 错误日志
sudo tail -50 /var/log/nginx/error.log
sudo tail -50 /var/log/nginx/storytree-error.log
```

### 问题五：代码更新后如何重新部署

```bash
cd /var/www/storytree

# 拉取最新代码
git pull origin main

# 重新安装依赖（如有新依赖）
cd api && npm install

# 重新编译（如有 TypeScript）
npm run build

# 执行新的数据库迁移（如有）
npx prisma migrate deploy

# 重启 API 服务
pm2 restart storytree-api

# 如果 Nginx 配置有变更
sudo nginx -t && sudo systemctl reload nginx
```

---

## 日常运维命令

### 查看服务状态

```bash
pm2 status                          # 查看所有 PM2 进程
pm2 logs storytree-api              # 实时查看 API 日志
pm2 logs storytree-api --lines 100  # 查看最近 100 行日志
sudo systemctl status nginx         # 查看 Nginx 状态
sudo systemctl status mysql         # 查看数据库状态
```

### 服务管理

```bash
pm2 restart storytree-api           # 重启 API（代码更新后用）
pm2 reload storytree-api            # 零停机重载
sudo systemctl reload nginx         # 重载 Nginx 配置
sudo systemctl restart nginx        # 重启 Nginx
sudo systemctl restart mysql        # 重启数据库
```

### 日志查看

```bash
# PM2 日志（应用输出）
/var/log/pm2/storytree-api-out.log   # 标准输出
/var/log/pm2/storytree-api-error.log # 错误输出

# Nginx 日志
/var/log/nginx/access.log            # 访问日志
/var/log/nginx/error.log             # 错误日志

# 系统日志
sudo journalctl -u nginx -n 50       # 最近 50 条 Nginx 系统日志
sudo journalctl -u mysql -n 50       # 最近 50 条数据库系统日志
```

### 磁盘与内存监控

```bash
df -h          # 查看磁盘使用情况
free -h        # 查看内存使用情况
top            # 实时查看系统资源
pm2 monit      # PM2 资源监控界面
```

---

## 后续优化建议

### 1. 配置 HTTPS（强烈推荐）

```bash
# 安装 Certbot（Let's Encrypt 免费证书）
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（需要先绑定域名）
sudo certbot --nginx -d your-domain.com

# 证书自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

> **前提**：需要先购买域名并将 DNS 解析指向服务器 IP。

### 2. 配置日志轮转

防止日志文件无限增长占满磁盘：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. 数据库定期备份

```bash
# 创建备份脚本
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/db-backups"
mkdir -p $BACKUP_DIR
mysqldump -u storytree -p'你的数据库密码' storytree_db > $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql
# 只保留最近 7 天的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /root/backup-db.sh

# 每天凌晨 3 点自动备份
crontab -e
# 添加：0 3 * * * /root/backup-db.sh
```

### 4. 配置服务器监控告警

建议在阿里云控制台开启 **云监控**，对 CPU、内存、磁盘设置告警阈值，及时发现异常。

---

## 关键文件路径速查

| 文件/目录 | 说明 |
|-----------|------|
| `/var/www/storytree/` | 项目根目录 |
| `/var/www/storytree/web/` | 前端静态文件目录 |
| `/var/www/storytree/api/` | 后端 API 目录 |
| `/var/www/storytree/api/.env` | 环境变量配置（含敏感信息） |
| `/etc/nginx/sites-available/storytree` | Nginx 项目配置文件 |
| `/etc/nginx/sites-enabled/storytree` | Nginx 启用配置（软链接） |
| `/var/log/nginx/access.log` | Nginx 访问日志 |
| `/var/log/nginx/error.log` | Nginx 错误日志 |
| `/var/log/pm2/` | PM2 日志目录 |

---

*本文档记录于 2026-04-01，基于实际部署过程整理，可作为后续运维和问题排查的参考依据。*

