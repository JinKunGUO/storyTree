# StoryTree 双环境部署指南

## 📋 概述

本项目支持两种数据库环境：
- **本地开发环境**：SQLite（`prisma/dev.db`）
- **云端生产环境**：MySQL（阿里云 RDS）

## 🗂️ 文件结构

```
api/
├── prisma/
│   ├── schema.prisma          # 当前使用的 schema（自动切换）
│   ├── schema.sqlite.prisma   # SQLite 版本模板
│   ├── schema.mysql.prisma    # MySQL 版本模板
│   └── dev.db                 # 本地 SQLite 数据库
├── scripts/
│   ├── deploy.sh              # 云端部署脚本
│   ├── switch-local.sh        # 切换到本地环境
│   └── switch-production.sh   # 切换到生产环境
├── .env                       # 本地开发配置（SQLite）
└── .env.production            # 生产环境配置（MySQL）
```

## 🚀 本地开发流程

### 1. 初始化本地环境

```bash
cd api

# 确保使用 SQLite schema
./scripts/switch-local.sh

# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 启动开发服务器
npm run dev
```

### 2. 数据库操作

```bash
# 查看数据库
npx prisma studio

# 同步 schema 到数据库
npx prisma db push

# 创建迁移
npx prisma migrate dev --name your_migration_name
```

## ☁️ 云端部署流程

### 方式一：使用自动部署脚本（推荐）

```bash
# 1. SSH 登录到阿里云服务器
ssh root@120.26.182.140

# 2. 进入项目目录
cd /var/www/storytree/api

# 3. 拉取最新代码
git pull origin main

# 4. 执行部署脚本
./scripts/deploy.sh
```

部署脚本会自动完成：
- ✅ 切换到 MySQL schema
- ✅ 检查环境配置
- ✅ 安装依赖
- ✅ 生成 Prisma Client
- ✅ 同步数据库（可选）
- ✅ 重启 PM2 服务

### 方式二：手动部署

```bash
# 1. SSH 登录
ssh root@120.26.182.140

# 2. 进入项目目录
cd /var/www/storytree/api

# 3. 拉取代码
git pull origin main

# 4. 切换到生产环境
./scripts/switch-production.sh

# 5. 确保使用 .env.production
cp .env.production .env

# 6. 安装依赖
npm install --production=false

# 7. 生成 Prisma Client
npx prisma generate

# 8. 同步数据库（首次部署或 schema 变更时）
npx prisma db push

# 9. 重启服务
pm2 restart all
pm2 logs
```

## 🔄 环境切换

### 切换到本地开发环境

```bash
cd api
./scripts/switch-local.sh
```

### 切换到生产环境

```bash
cd api
./scripts/switch-production.sh
```

## 📝 数据库迁移

### 本地开发时创建迁移

```bash
# 1. 修改 schema.prisma（SQLite 版本）
# 2. 创建迁移
npx prisma migrate dev --name add_new_feature

# 3. 同步到 MySQL 版本
# 手动将相同的修改应用到 schema.mysql.prisma
```

### 生产环境应用迁移

```bash
# 在云端服务器上
cd /var/www/storytree/api

# 方式一：使用 db push（推荐，适合开发阶段）
npx prisma db push

# 方式二：使用 migrate deploy（适合正式生产）
npx prisma migrate deploy
```

## ⚠️ 注意事项

### 1. Schema 同步

修改数据库结构时，需要同时更新两个 schema 文件：
- `schema.sqlite.prisma`（本地开发）
- `schema.mysql.prisma`（生产环境）

主要差异：
- **Provider**: `sqlite` vs `mysql`
- **字段类型**: MySQL 需要指定 `@db.Text`, `@db.VarChar(n)` 等
- **DateTime**: MySQL 支持 `@updatedAt`

### 2. 环境变量

确保两个环境使用正确的配置文件：
- 本地：`.env`（DATABASE_URL 指向 SQLite）
- 云端：`.env`（从 `.env.production` 复制，DATABASE_URL 指向 MySQL）

### 3. Git 版本控制

**提交到 Git**：
- ✅ `schema.sqlite.prisma`
- ✅ `schema.mysql.prisma`
- ✅ `migrations/`
- ✅ 部署脚本

**不提交到 Git**（已在 .gitignore）：
- ❌ `.env`
- ❌ `.env.production`
- ❌ `dev.db`
- ❌ `schema.prisma`（自动生成）

### 4. 数据库连接信息

**本地 SQLite**：
```env
DATABASE_URL="file:prisma/dev.db"
```

**云端 MySQL**：
```env
DATABASE_URL="mysql://storytree:StoryTree0429@rm-cn-4l64purrx00022.rwlb.rds.aliyuncs.com:3306/storytree"
```

## 🐛 常见问题

### 问题 1：部署后注册失败

**原因**：Prisma Client 未重新生成

**解决**：
```bash
npx prisma generate
pm2 restart all
```

### 问题 2：数据库连接失败

**检查**：
```bash
# 查看当前 DATABASE_URL
cat .env | grep DATABASE_URL

# 测试 MySQL 连接
npx prisma db pull
```

### 问题 3：Schema 不匹配

**解决**：
```bash
# 查看当前 provider
head -n 10 prisma/schema.prisma

# 如果不对，重新切换
./scripts/switch-production.sh  # 或 switch-local.sh
```

### 问题 4：PM2 服务异常

**排查**：
```bash
pm2 status
pm2 logs --lines 100
pm2 restart all
```

## 📊 部署检查清单

部署前确认：
- [ ] 代码已提交到 Git
- [ ] `.env.production` 配置正确
- [ ] MySQL 数据库可访问
- [ ] Schema 文件已同步更新

部署后验证：
- [ ] PM2 服务运行正常
- [ ] API 健康检查通过：`curl http://localhost:3001/api/health`
- [ ] 数据库连接正常
- [ ] 日志无错误：`pm2 logs`

## 🔗 相关链接

- [Prisma 文档](https://www.prisma.io/docs)
- [PM2 文档](https://pm2.keymetrics.io/docs)
- [阿里云 RDS](https://www.aliyun.com/product/rds)

## 📞 技术支持

如有问题，请查看：
1. PM2 日志：`pm2 logs`
2. 系统日志：`/var/log/pm2/`
3. 数据库日志：阿里云 RDS 控制台

