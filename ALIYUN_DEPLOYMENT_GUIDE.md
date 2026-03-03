# 基于阿里云的完整部署方案

## 🚀 阿里云部署架构设计

### 架构概览
```
用户 → CDN → SLB负载均衡 → ECS应用服务器 → RDS数据库
       ↓
      OSS对象存储 ← Redis缓存 ← 日志服务
```

### 1. 阿里云产品配置清单

| 产品 | 配置 | 费用 | 用途 |
|------|------|------|------|
| ECS服务器 | 2核4G, 80GB SSD | ¥89/月 | 应用服务器 |
| RDS数据库 | MySQL 8.0, 2核4G | ¥168/月 | 主数据库 |
| OSS存储 | 标准存储, 100GB | ¥12/月 | 图片/文件存储 |
| CDN加速 | 按量付费 | ¥30/月 | 静态资源加速 |
| 域名注册 | .com域名 | ¥60/年 | 网站域名 |
| SSL证书 | 免费DV证书 | ¥0 | HTTPS加密 |

**总计：约 ¥359/月**

### 2. 详细部署步骤

#### 步骤1：阿里云账号准备
```bash
# 1. 注册阿里云账号
# 2. 完成实名认证
# 3. 开通相关服务：ECS、RDS、OSS、CDN
```

#### 步骤2：ECS服务器配置
```bash
# 创建ECS实例
# 地域：华东1（杭州）
# 可用区：随机
# 实例规格：ecs.c6.large（2核4G）
# 操作系统：Ubuntu 20.04 64位
# 网络类型：专有网络
# 公网IP：分配公网IPv4地址
```

#### 步骤3：安全组配置
```
入方向规则：
- 端口 22：SSH (0.0.0.0/0)
- 端口 80：HTTP (0.0.0.0/0)
- 端口 443：HTTPS (0.0.0.0/0)
- 端口 3000：Node.js (仅内网)

出方向规则：
- 全部允许
```

#### 步骤4：RDS数据库配置
```sql
-- 创建数据库实例
-- 数据库类型：MySQL 8.0
-- 实例规格：rds.mysql.s2.large
-- 存储空间：100GB SSD云盘
-- 网络类型：专有网络（与ECS同VPC）

-- 创建数据库和用户
CREATE DATABASE storytree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'storytree'@'%' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON storytree.* TO 'storytree'@'%';
FLUSH PRIVILEGES;
```

#### 步骤5：OSS存储配置
```bash
# 创建Bucket
# Bucket名称：storytree-files
# 地域：华东1（杭州）
# 存储类型：标准存储
# 读写权限：私有

# 创建文件夹结构
- images/    # 图片存储
- uploads/   # 文件上传
- backups/   # 备份文件
```

### 3. 服务器环境搭建脚本

#### 初始化脚本（setup.sh）
```bash
#!/bin/bash

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装必要软件
sudo apt install -y nginx mysql-client redis-server git pm2

# 安装Docker（可选）
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker ubuntu

# 配置防火墙
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# 创建应用目录
sudo mkdir -p /var/www/storytree
sudo chown ubuntu:ubuntu /var/www/storytree
```

#### Nginx配置优化
```nginx
# /etc/nginx/sites-available/storytree
upstream storytree_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name storytree.com www.storytree.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name storytree.com www.storytree.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/storytree.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/storytree.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # 文件上传限制
    client_max_body_size 10M;

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API代理
    location /api/ {
        proxy_pass http://storytree_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 前端静态文件
    location / {
        root /var/www/storytree/web;
        try_files $uri $uri/ /index.html;
        
        # SPA路由支持
        error_page 404 = /index.html;
    }
}
```

### 4. 自动化部署脚本

#### 部署脚本（deploy.sh）
```bash
#!/bin/bash

set -e

# 配置变量
APP_DIR="/var/www/storytree"
BACKUP_DIR="/var/backups/storytree"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份
echo "创建备份..."
sudo mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $APP_DIR . || true

# 拉取最新代码
echo "拉取最新代码..."
cd $APP_DIR
git pull origin main

# 后端部署
echo "部署后端..."
cd api
npm install --production
npm run build

# 数据库迁移
echo "执行数据库迁移..."
npx prisma migrate deploy

# 重启应用
pm2 restart storytree-api || pm2 start dist/index.js --name storytree-api

# 清理旧备份（保留最近7天）
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "部署完成！"
```

### 5. 监控和日志

#### 监控配置
```bash
# 安装监控工具
sudo apt install htop iotop nethogs

# 配置日志轮转
sudo tee /etc/logrotate.d/storytree << EOF
/var/log/storytree/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# 设置定时备份
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/storytree/scripts/backup.sh") | crontab -
```

### 6. 环境变量配置

#### 生产环境变量（.env.production）
```bash
# 数据库配置
DATABASE_URL="mysql://storytree:StrongPassword123!@rm-bp1.mysql.rds.aliyuncs.com:3306/storytree"

# Redis配置
REDIS_URL="redis://localhost:6379"

# AI配置
ANTHROPIC_API_KEY="your-anthropic-api-key"

# 邮件配置
SMTP_HOST="smtp.aliyun.com"
SMTP_PORT=465
SMTP_USER="noreply@storytree.com"
SMTP_PASS="your-email-password"

# OSS配置
OSS_ACCESS_KEY="your-oss-access-key"
OSS_SECRET_KEY="your-oss-secret-key"
OSS_BUCKET="storytree-files"
OSS_REGION="oss-cn-hangzhou"

# 应用配置
NODE_ENV="production"
PORT=3000
JWT_SECRET="your-jwt-secret-key"
FRONTEND_URL="https://storytree.com"
```

### 7. 域名和SSL证书

#### 申请免费SSL证书
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d storytree.com -d www.storytree.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

### 8. 性能优化

#### CDN配置
```bash
# 阿里云CDN配置
# 加速域名：storytree.com
# 源站：ECS公网IP
# 缓存规则：
#   - 静态文件：1年
#   - API接口：不缓存
#   - HTML页面：1小时
```

### 9. 备份策略

#### 自动备份脚本（scripts/backup.sh）
```bash
#!/bin/bash

# 数据库备份
mysqldump -h rm-bp1.mysql.rds.aliyuncs.com -u storytree -pStrongPassword123! storytree > /var/backups/storytree/db_backup_$(date +%Y%m%d).sql

# 文件备份
ossutil cp -r /var/www/storytree/web/uploads oss://storytree-files/backups/web/$(date +%Y%m%d)/

# 清理旧备份（保留30天）
find /var/backups/storytree -name "db_backup_*.sql" -mtime +30 -delete
```

### 10. 部署验证清单

#### 部署完成后检查项
- [ ] 域名解析正常
- [ ] HTTPS证书有效
- [ ] 数据库连接正常
- [ ] 文件上传功能正常
- [ ] AI功能正常
- [ ] 邮件发送正常
- [ ] 监控告警正常
- [ ] 备份功能正常

## 📞 技术支持

如遇到部署问题：
1. 查看日志：`pm2 logs`
2. 检查服务状态：`pm2 status`
3. 查看Nginx状态：`sudo systemctl status nginx`
4. 联系阿里云技术支持：400-80-13260
