# 免费试用阿里云部署方案

## 🆓 免费试用方案（0成本体验）

### 免费资源清单
| 产品 | 免费额度 | 有效期 | 用途 |
|------|----------|---------|------|
| 轻量应用服务器 | 1核2G, 40GB SSD | 1个月 | 应用服务器 |
| RDS数据库 | MySQL基础版 | 3个月 | 数据库 |
| OSS存储 | 40GB标准存储 | 12个月 | 文件存储 |
| CDN流量 | 10GB/月 | 12个月 | 内容加速 |
| 域名 | .cn域名首年 | 1年 | 网站域名 |

**总成本：0元（首年）**

### 免费试用申请步骤

#### 1. 注册阿里云账号
- 访问：https://www.aliyun.com
- 完成实名认证（个人用户）
- 开通免费试用中心

#### 2. 申请免费资源
```bash
# 按顺序申请：
1. 轻量应用服务器（香港节点）
2. RDS MySQL数据库
3. OSS对象存储
4. CDN流量包
```

#### 3. 轻量服务器配置
```bash
# 系统：Ubuntu 20.04
# 配置：1核2G，40GB SSD
# 地域：香港（免备案）
# 带宽：30Mbps峰值

# 连接服务器
ssh root@你的服务器IP

# 一次性环境配置
curl -sSL https://raw.githubusercontent.com/your-repo/setup.sh | bash
```

#### 4. 一键部署脚本
```bash
#!/bin/bash
# 保存为：quick-deploy.sh

# 1. 环境准备
sudo apt update && sudo apt install -y git nodejs npm nginx

# 2. 下载项目
git clone https://github.com/your-username/storytree.git
cd storytree

# 3. 后端配置
cd api
cp .env.example .env
# 编辑.env文件，填入免费数据库信息
npm install
npm run build

# 4. 启动服务
pm2 start dist/index.js --name storytree
pm2 startup

# 5. 配置Nginx
sudo ln -sf /var/www/storytree/nginx.conf /etc/nginx/sites-enabled/
sudo nginx -s reload

echo "🎉 部署完成！访问 http://你的服务器IP"
```

### 5分钟快速部署

#### 方法一：一键脚本
```bash
# 在轻量服务器上执行
curl -sSL https://raw.githubusercontent.com/storytree/deploy/main/quick-setup.sh | bash
```

#### 方法二：手动步骤
```bash
# 1. 克隆项目
git clone https://github.com/your-username/storytree.git
cd storytree

# 2. 安装依赖
cd api && npm install

# 3. 配置环境
echo "DATABASE_URL=mysql://user:pass@free-rds.mysql.rds.aliyuncs.com:3306/storytree" > .env
echo "ANTHROPIC_API_KEY=your-key" >> .env

# 4. 启动
npm start

# 5. 访问 http://服务器IP:3000
```

### 免费域名方案

#### 方案1：使用服务器IP直接访问
- 地址：http://服务器IP:3000
- 优点：无需域名，立即可用
- 缺点：不专业，无法HTTPS

#### 方案2：免费域名
- 申请：
  - 阿里云.cn域名首年免费
  - 或二级域名：yourname.storytree.cn

### 免费试用限制说明

#### 性能限制
- CPU：1核（适合10-50并发用户）
- 内存：2GB（支持基础AI功能）
- 存储：40GB（够用1年内容）
- 带宽：30Mbps峰值（国内访问流畅）

#### 功能完整度
- ✅ 所有核心功能
- ✅ AI写作增强
- ✅ 用户注册登录
- ✅ 故事创作
- ✅ 内容分享

#### 不适用场景
- ❌ 高并发（>100用户）
- ❌ 大文件存储（>40GB）
- ❌ 全球用户访问

### 升级路径

#### 免费到期后升级
```
免费试用 → 轻量服务器2核4G → 正式RDS → OSS扩容
   ↓           ↓              ↓         ↓
  0元/月    ¥89/月        ¥168/月    ¥12/月

总计升级成本：¥269/月（比直接购买便宜90元/月）
```

### 监控和维护

#### 免费资源监控
```bash
# 创建监控脚本
# 保存为：monitor.sh
#!/bin/bash
while true; do
    # 检查磁盘空间
    df -h / | tail -1 | awk '{print "磁盘使用：" $5}' >> /var/log/usage.log
    
    # 检查内存
    free -m | grep Mem | awk '{print "内存使用：" $3"M"}' >> /var/log/usage.log
    
    # 检查服务状态
    pm2 status >> /var/log/service.log
    
    sleep 3600  # 每小时检查一次
done
```

#### 数据备份
```bash
# 免费备份策略
# 保存为：backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)

# 数据库备份
mysqldump -h free-rds.mysql.rds.aliyuncs.com -u user -p database > backup_$DATE.sql

# 上传到OSS（免费额度内）
ossutil cp backup_$DATE.sql oss://your-bucket/backups/

# 本地保留3天
find . -name "backup_*.sql" -mtime +3 -delete
```

### 免费试用申请地址

#### 阿里云免费中心
1. **轻量服务器**：https://free.aliyun.com/
2. **RDS数据库**：搜索"RDS免费试用"
3. **OSS存储**：https://oss.console.aliyun.com/
4. **CDN流量**：https://cdn.console.aliyun.com/

#### 申请技巧
- 使用个人认证（比企业认证容易通过）
- 先申请轻量服务器，再申请数据库
- 所有免费资源可以叠加使用

### 技术支持

#### 遇到问题时的解决方案
1. **查看日志**：`pm2 logs`
2. **重启服务**：`pm2 restart all`
3. **检查网络**：`curl -I http://服务器IP:3000`
4. **数据库连接**：`mysql -h 地址 -u 用户 -p`

#### 免费技术支持
- 阿里云工单系统（免费用户也可使用）
- 官方QQ群：阿里云轻量服务器群
- 社区论坛：https://developer.aliyun.com/

## 🎯 本周行动计划

### 今天（3月3日）
1. ✅ 注册阿里云账号
2. ✅ 申请免费试用资源
3. ✅ 下载一键部署脚本

### 明天（3月4日）
1. ✅ 配置轻量服务器
2. ✅ 部署StoryTree项目
3. ✅ 测试AI功能

### 后天（3月5日）
1. ✅ 邀请朋友体验
2. ✅ 收集使用反馈
3. ✅ 准备升级方案

### 本周内完成
1. ✅ 域名申请和配置
2. ✅ HTTPS证书部署
3. ✅ 性能优化

**预计总时间：2小时完成部署，1小时测试**

## 📱 快速测试地址
部署完成后，你可以：
1. 手机扫码访问：http://服务器IP:3000
2. 微信分享给朋友体验
3. 测试AI多风格创作功能
