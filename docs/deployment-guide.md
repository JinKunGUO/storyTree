# StoryTree 生产环境部署指南

本文档详细说明如何将 StoryTree 部署到阿里云生产环境。

---

## 目录

- [架构概览](#架构概览)
- [准备工作](#准备工作)
- [阿里云资源配置](#阿里云资源配置)
- [部署步骤](#部署步骤)
- [数据迁移](#数据迁移)
- [监控与运维](#监控与运维)
- [故障排查](#故障排查)

---

## 架构概览

```
                        ┌─────────────────────────────────────┐
                        │              CDN 层                  │
                        │          阿里云 CDN                  │
                        └─────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│   ECS 云主机  │              │     OSS      │              │    Redis     │
│  Node.js     │              │   图片文件    │              │   缓存/队列   │
│   应用       │              │   封面/头像   │              │   热点数据    │
└──────────────┘              └──────────────┘              └──────────────┘
        │
        ▼
┌──────────────┐
│   RDS MySQL  │
│  (主从架构)   │
│ 章节文本存储  │
└──────────────┘
```

### 组件说明

| 组件 | 服务 | 用途 |
|------|------|------|
| 计算 | ECS | 运行 Node.js 应用 |
| 数据库 | RDS MySQL | 存储结构化数据（用户、故事、章节等） |
| 对象存储 | OSS | 存储图片文件（头像、封面） |
| 缓存 | Redis | 热点数据缓存、会话管理、频率限制 |
| CDN | 阿里云 CDN | 静态资源加速 |

---

## 准备工作

### 1. 阿里云账号

- 注册阿里云账号并完成实名认证
- 创建 RAM 子账号（推荐），仅授予必要权限
- 开通以下服务：ECS、RDS、OSS、Redis、CDN

### 2. 域名与备案

- 准备已备案的域名（中国大陆服务器必须备案）
- 配置 DNS 解析

### 3. 本地环境

确保本地已安装：
- Node.js 18+
- npm 或 yarn
- Git

---

## 阿里云资源配置

### 1. ECS 云主机

**推荐配置**（大规模）：

| 配置项 | 推荐值 |
|--------|--------|
| 规格 | ecs.c6.xlarge (4核8G) |
| 系统 | Ubuntu 22.04 LTS |
| 磁盘 | 100GB SSD |
| 带宽 | 5Mbps（按流量计费） |
| 数量 | 2 台（负载均衡） |

**安全组配置**：

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 你的 IP | SSH 登录 |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 3001 | TCP | 内网 | Node.js 应用（仅内网） |

### 2. RDS MySQL

**推荐配置**：

| 配置项 | 推荐值 |
|--------|--------|
| 版本 | MySQL 8.0 |
| 规格 | mysql.n2.medium.1 (2核4G) |
| 存储 | 100GB SSD |
| 架构 | 高可用版（主从） |

**创建数据库**：

```sql
CREATE DATABASE storytree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'storytree'@'%' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON storytree.* TO 'storytree'@'%';
FLUSH PRIVILEGES;
```

### 3. OSS 对象存储

**创建 Bucket**：

| 配置项 | 推荐值 |
|--------|--------|
| Bucket 名称 | storytree-assets |
| 区域 | 与 ECS 同区域 |
| 存储类型 | 标准存储 |
| 读写权限 | 公共读 |

**跨域配置（CORS）**：

```json
{
  "CORSRule": [
    {
      "AllowedOrigin": ["https://your-domain.com"],
      "AllowedMethod": ["GET", "POST", "PUT"],
      "AllowedHeader": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### 4. Redis

**推荐配置**：

| 配置项 | 推荐值 |
|--------|--------|
| 版本 | Redis 6.0 |
| 规格 | 2GB 内存 |
| 架构 | 标准版 |

### 5. CDN

**配置步骤**：

1. 添加域名：`cdn.your-domain.com`
2. 源站设置：OSS Bucket 域名
3. 开启 HTTPS
4. 配置缓存规则

---

## 部署步骤

### 1. 准备服务器

```bash
# SSH 登录 ECS
ssh root@your-ecs-ip

# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装 PM2（进程管理）
npm install -g pm2

# 安装 Nginx
apt install -y nginx

# 创建应用目录
mkdir -p /var/www/storytree
chown -R $USER:$USER /var/www/storytree
```

### 2. 部署代码

```bash
# 克隆代码
cd /var/www/storytree
git clone https://github.com/your-repo/storytree.git .

# 安装依赖
cd api
npm install

# 复制生产环境配置
cp .env.example .env
nano .env  # 编辑配置
```

### 3. 配置环境变量

编辑 `/var/www/storytree/api/.env`：

```env
NODE_ENV=production

# 数据库（RDS MySQL）
DATABASE_URL="mysql://storytree:password@rm-xxx.mysql.rds.aliyuncs.com:3306/storytree"

# 存储模式
STORAGE_MODE=oss

# OSS 配置
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=storytree-assets
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_CDN_DOMAIN=https://cdn.your-domain.com

# Redis
REDIS_URL="redis://:password@r-xxx.redis.rds.aliyuncs.com:6379"

# JWT（使用强密钥）
JWT_SECRET=your-production-jwt-secret-32-chars

# URL
API_BASE_URL=https://api.your-domain.com
FRONTEND_URL=https://your-domain.com
```

### 4. 初始化数据库

```bash
# 使用 MySQL schema
cp prisma/schema.mysql.prisma prisma/schema.prisma

# 生成 Prisma Client
npx prisma generate

# 推送数据库结构
npx prisma db push
```

### 5. 构建与启动

```bash
# 构建项目
npm run build

# 使用 PM2 启动
pm2 start dist/index.js --name storytree-api -i max

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 6. 配置 Nginx

创建 `/etc/nginx/sites-available/storytree`：

```nginx
# API 服务
server {
    listen 80;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# 前端静态文件
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/storytree/web;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/storytree /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 7. 配置 HTTPS

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com -d www.your-domain.com -d api.your-domain.com

# 自动续期
certbot renew --dry-run
```

---

## 数据迁移

### 从 SQLite 迁移到 MySQL

1. **备份 SQLite 数据库**：

```bash
cp api/prisma/dev.db api/prisma/dev.db.backup
```

2. **运行迁移脚本**：

```bash
cd api
npx ts-node scripts/migrate-to-mysql.ts
```

3. **验证数据**：

```bash
# 登录 MySQL 检查数据
mysql -h rm-xxx.mysql.rds.aliyuncs.com -u storytree -p storytree
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM stories;
SELECT COUNT(*) FROM nodes;
```

---

## 监控与运维

### PM2 监控

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs storytree-api

# 监控面板
pm2 monit

# 重启应用
pm2 restart storytree-api
```

### 日志管理

```bash
# 配置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 健康检查

创建健康检查端点 `/api/health`：

```typescript
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### 阿里云监控

- 开启 ECS 云监控
- 配置 RDS 告警规则
- 设置 OSS 流量告警

---

## 故障排查

### 常见问题

**1. 数据库连接失败**

```bash
# 检查网络连通性
telnet rm-xxx.mysql.rds.aliyuncs.com 3306

# 检查白名单配置
# RDS 控制台 → 数据安全性 → 白名单设置
```

**2. OSS 上传失败**

```bash
# 检查 AccessKey 权限
# RAM 控制台 → 用户 → 权限管理

# 检查 Bucket 权限
# OSS 控制台 → Bucket → 权限管理
```

**3. Redis 连接超时**

```bash
# 检查 Redis 白名单
# Redis 控制台 → 白名单设置

# 检查连接字符串
redis-cli -h r-xxx.redis.rds.aliyuncs.com -a password ping
```

**4. 应用启动失败**

```bash
# 查看错误日志
pm2 logs storytree-api --err --lines 100

# 检查环境变量
pm2 env storytree-api
```

---

## 成本估算

| 服务 | 规格 | 月费用（约） |
|------|------|-------------|
| ECS | 4核8G × 2 | ¥400-600 |
| RDS MySQL | 2核4G 高可用 | ¥200-400 |
| OSS | 100GB | ¥10-20 |
| Redis | 2GB | ¥100-200 |
| CDN | 500GB/月 | ¥100-200 |
| SLB | 按流量 | ¥50-100 |
| **总计** | | **¥860-1520/月** |

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `api/.env.example` | 生产环境配置模板 |
| `api/prisma/schema.mysql.prisma` | MySQL 数据库模型 |
| `api/src/utils/storage.ts` | 统一存储模块 |
| `api/src/utils/oss.ts` | OSS 上传模块 |
| `api/src/utils/cache.ts` | Redis 缓存模块 |
| `api/scripts/migrate-to-mysql.ts` | 数据迁移脚本 |

