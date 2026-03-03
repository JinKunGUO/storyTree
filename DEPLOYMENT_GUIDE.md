# StoryTree 生产环境部署指南

## 🚀 快速部署步骤（预计2小时完成）

### 1. 腾讯云服务器准备
```bash
# 购买腾讯云服务器（推荐配置）
- 实例：标准型S5 2核4G
- 系统：Ubuntu 20.04 LTS
- 带宽：5Mbps
- 存储：50GB SSD
- 费用：约50元/月
```

### 2. 域名和SSL配置
```bash
# 购买域名（推荐）
domain="storytree.com"  # 你的域名

# 腾讯云免费SSL证书申请
# 路径：腾讯云控制台 > SSL证书 > 申请免费证书
```

### 3. 服务器环境搭建
```bash
# 连接服务器
ssh root@你的服务器IP

# 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2进程管理器
npm install -g pm2

# 安装Nginx
sudo apt update
sudo apt install nginx -y

# 安装MySQL
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

### 4. 数据库配置
```bash
# 登录MySQL
sudo mysql -u root -p

# 创建数据库
CREATE DATABASE storytree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'storytree'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON storytree.* TO 'storytree'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5. 项目部署
```bash
# 克隆项目
git clone https://github.com/your-username/storytree.git
cd storytree

# 后端部署
cd api
npm install
npm run build

# 配置环境变量
cp .env.example .env
# 编辑.env文件，填入数据库信息

# 数据库迁移
npx prisma migrate deploy
npx prisma generate

# 启动后端（使用PM2）
pm2 start dist/index.js --name storytree-api

# 前端部署
cd ../web
# 将web目录上传到CDN或使用Nginx托管
```

### 6. Nginx配置
```nginx
# /etc/nginx/sites-available/storytree
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 静态文件
    location / {
        root /var/www/storytree/web;
        try_files $uri $uri/ /index.html;
    }
    
    # 文件上传大小限制
    client_max_body_size 10M;
}
```

### 7. 启动服务
```bash
# 重启Nginx
sudo nginx -t
sudo systemctl restart nginx

# 设置开机启动
sudo systemctl enable nginx
pm2 startup
pm2 save
```

## 📊 部署验证清单

### 功能测试
- [ ] 用户注册/登录
- [ ] 创建故事
- [ ] 章节创作
- [ ] 分享功能
- [ ] HTTPS证书有效性

### 性能优化
- [ ] 启用Gzip压缩
- [ ] 配置CDN加速
- [ ] 数据库索引优化
- [ ] 图片压缩和懒加载

### 安全配置
- [ ] 防火墙配置（仅开放80/443端口）
- [ ] 定期备份数据库
- [ ] 监控告警设置

## 🎯 下一步：微信小程序开发准备

部署完成后，我们将开始微信小程序开发，包括：
1. 微信小程序账号注册
2. 开发者资质认证
3. 小程序UI设计
4. 微信登录集成
5. 微信支付集成

## 📞 技术支持

如遇到部署问题，请联系：
- 技术文档：查看docs/目录
- 社区支持：GitHub Issues
- 紧急联系：微信 jinhui-gjk
