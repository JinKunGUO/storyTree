# StoryTree 启动脚本使用指南

## 📋 可用脚本

项目根目录下有多个启动脚本，用于不同场景：

---

## 🚀 推荐脚本

### 1. `restart-api.sh` - 快速重启（推荐）

**适用场景**: 日常开发，快速重启服务

**特点**:
- ✅ 无交互，直接执行
- ✅ 自动停止旧进程
- ✅ 立即启动服务
- ✅ 最快速简单

**使用方法**:
```bash
./restart-api.sh
```

**执行流程**:
1. 检查3001端口
2. 自动停止占用端口的进程
3. 启动API服务

---

### 2. `start-ai.sh` - 完整启动（首次使用）

**适用场景**: 首次启动、完整检查

**特点**:
- ✅ 检查Redis状态
- ✅ 检查环境变量
- ✅ 检查依赖安装
- ✅ 更新数据库Schema
- ⚠️ 需要交互确认

**使用方法**:
```bash
./start-ai.sh
```

**执行流程**:
1. 检查3001端口（需要手动确认是否停止）
2. 检查Redis是否运行
3. 检查.env文件配置
4. 检查node_modules依赖
5. 更新数据库Schema
6. 启动API服务

---

### 3. `setup-qwen.sh` - 千问API配置

**适用场景**: 配置千问API Key

**特点**:
- ✅ 交互式配置API Key
- ✅ 选择模型
- ✅ 自动测试连接

**使用方法**:
```bash
./setup-qwen.sh
```

---

## 🐛 常见问题

### 问题1: 端口被占用（EADDRINUSE）

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**原因**: 3001端口已被其他进程占用（通常是上次启动的服务未关闭）

**解决方案A - 使用快速重启脚本（推荐）**:
```bash
./restart-api.sh
```

**解决方案B - 手动停止进程**:
```bash
# 查找占用端口的进程
lsof -ti:3001

# 停止进程（替换PID为实际进程ID）
kill -9 <PID>

# 重新启动
cd api && npm run dev
```

**解决方案C - 一行命令**:
```bash
lsof -ti:3001 | xargs kill -9 && cd api && npm run dev
```

---

### 问题2: Redis未运行

**错误信息**: Redis connection failed

**解决方案**:
```bash
# macOS (使用Homebrew)
brew services start redis

# 或直接启动
redis-server

# 检查状态
redis-cli ping
```

---

### 问题3: 依赖缺失

**错误信息**: Cannot find module 'xxx'

**解决方案**:
```bash
cd api
npm install
```

---

## 📊 脚本对比

| 脚本 | 速度 | 交互 | 检查项 | 推荐场景 |
|------|------|------|--------|----------|
| **restart-api.sh** | ⚡️ 最快 | ❌ 无 | 端口 | 日常开发 ✅ |
| **start-ai.sh** | 🐢 较慢 | ✅ 有 | 全面 | 首次启动 |
| **setup-qwen.sh** | 🐢 较慢 | ✅ 有 | API配置 | 配置API |

---

## 🎯 推荐使用流程

### 首次启动项目
```bash
# 1. 配置千问API
./setup-qwen.sh

# 2. 完整启动（检查所有依赖）
./start-ai.sh
```

### 日常开发
```bash
# 快速重启
./restart-api.sh
```

### 修改配置后
```bash
# 重新配置API
./setup-qwen.sh

# 快速重启
./restart-api.sh
```

---

## 🛠️ 手动操作命令

如果不使用脚本，也可以手动执行：

### 启动服务
```bash
cd api
npm run dev
```

### 停止服务
```bash
# 按 Ctrl+C 停止
# 或
lsof -ti:3001 | xargs kill -9
```

### 检查服务状态
```bash
# 检查端口
lsof -i:3001

# 检查健康状态
curl http://localhost:3001/api/health
```

### 查看日志
```bash
cd api
npm run dev
# 日志会实时显示在终端
```

---

## 📝 脚本源码位置

所有脚本都在项目根目录：

```
storytree/
├── restart-api.sh      # 快速重启（推荐）
├── start-ai.sh         # 完整启动
├── setup-qwen.sh       # 千问配置
├── test-qwen-api.js    # API测试
└── api/
    └── ...
```

---

## 💡 最佳实践

### 1. 日常开发推荐流程

```bash
# 早上开始工作
./restart-api.sh

# 修改代码后自动重启（nodemon）
# 无需手动重启

# 结束工作
# 按 Ctrl+C 停止服务
```

### 2. 遇到问题时

```bash
# 1. 先尝试快速重启
./restart-api.sh

# 2. 如果还有问题，测试API配置
node test-qwen-api.js

# 3. 如果API配置有问题，重新配置
./setup-qwen.sh

# 4. 最后尝试完整启动
./start-ai.sh
```

### 3. 部署到服务器

```bash
# 使用PM2等进程管理器
pm2 start api/src/index.ts --name storytree-api

# 或使用nohup后台运行
nohup npm run dev > api.log 2>&1 &
```

---

## 🔗 相关文档

- **千问API配置**: `docs/QWEN_API_SETUP.md`
- **配置成功确认**: `docs/QWEN_SETUP_COMPLETE.md`
- **迁移总结**: `docs/QWEN_MIGRATION_SUMMARY.md`

---

**更新时间**: 2026-03-05  
**文档版本**: 1.0

