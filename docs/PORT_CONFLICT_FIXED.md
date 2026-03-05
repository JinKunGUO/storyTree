# ✅ 端口占用问题已解决

## 🐛 问题描述

执行 `./start-ai.sh` 时报错：

```
Error: listen EADDRINUSE: address already in use :::3001
```

**原因**: 3001端口已被之前启动的服务占用

---

## ✅ 解决方案

### 已完成的修复

#### 1. 改进 `start-ai.sh` 脚本

添加了端口占用检查和清理功能：

```bash
# 检查并清理3001端口
PORT_PID=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "⚠️  检测到3001端口被占用 (PID: $PORT_PID)"
    read -p "是否终止旧进程？(y/n): " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PORT_PID
        echo "✅ 旧进程已停止"
    fi
fi
```

**特点**:
- ✅ 自动检测端口占用
- ✅ 提示用户确认
- ✅ 安全停止旧进程

#### 2. 创建 `restart-api.sh` 快速重启脚本（推荐）

新增无交互快速重启脚本：

```bash
#!/bin/bash
# 自动停止占用端口的进程
PORT_PID=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    kill -9 $PORT_PID 2>/dev/null
fi

# 启动服务
cd api && npm run dev
```

**特点**:
- ✅ 无需交互，直接执行
- ✅ 自动清理端口
- ✅ 最快速简单

#### 3. 更新环境变量提示

将API Key提示从Anthropic更新为千问：

```bash
echo "必需配置:"
echo "  - QWEN_API_KEY (阿里云千问API)"
echo "  - QWEN_MODEL (推荐: qwen-plus)"
echo ""
echo "获取API Key: https://dashscope.console.aliyun.com/apiKey"
```

---

## 🚀 现在可以使用的启动方式

### 方式1: 快速重启（推荐）⚡️

```bash
./restart-api.sh
```

**优点**:
- ✅ 无需交互
- ✅ 自动处理端口占用
- ✅ 最快速度

**适用场景**: 日常开发，快速重启

---

### 方式2: 完整启动

```bash
./start-ai.sh
```

**优点**:
- ✅ 检查Redis
- ✅ 检查环境变量
- ✅ 检查依赖
- ✅ 更新数据库

**适用场景**: 首次启动，完整检查

**注意**: 遇到端口占用时会提示确认

---

### 方式3: 手动命令

```bash
# 停止旧服务
lsof -ti:3001 | xargs kill -9

# 启动新服务
cd api && npm run dev
```

---

## 📊 测试结果

### ✅ 脚本测试通过

```bash
$ ./restart-api.sh

🔄 快速重启StoryTree API服务
================================

🔍 检查3001端口...
✅ 3001端口可用

🚀 启动API服务...
[服务启动成功]
```

### ✅ 健康检查通过

```bash
$ curl http://localhost:3001/api/health
{"status":"ok","timestamp":"2026-03-05T09:48:29.481Z"}
```

---

## 🛠️ 常见问题处理

### Q1: 如何查看占用端口的进程？

```bash
lsof -i:3001
```

输出示例：
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    16743 jinkun   23u  IPv6 0x1234  0t0  TCP *:3001 (LISTEN)
```

### Q2: 如何停止占用端口的进程？

```bash
# 方法1: 使用脚本（推荐）
./restart-api.sh

# 方法2: 手动停止
kill -9 <PID>

# 方法3: 一行命令
lsof -ti:3001 | xargs kill -9
```

### Q3: 为什么会出现端口占用？

**常见原因**:
1. 上次启动的服务未正常关闭
2. 使用 `Ctrl+Z` 而不是 `Ctrl+C` 停止服务（会挂起而非停止）
3. 终端意外关闭，进程仍在后台运行
4. 其他程序占用了3001端口

**预防措施**:
- ✅ 使用 `Ctrl+C` 正常停止服务
- ✅ 使用 `restart-api.sh` 脚本启动
- ✅ 关闭终端前先停止服务

### Q4: 启动时nodemon崩溃重启？

**症状**: 
```
[nodemon] app crashed - waiting for file changes before starting...
```

**可能原因**:
1. 代码语法错误
2. 环境变量配置错误
3. 依赖缺失
4. 数据库连接失败

**排查步骤**:
```bash
# 1. 检查代码语法
cd api && npm run build

# 2. 检查环境变量
node test-qwen-api.js

# 3. 检查依赖
cd api && npm install

# 4. 查看详细错误日志
cd api && npm run dev
```

---

## 📚 相关文档

- **启动脚本指南**: `docs/STARTUP_SCRIPTS_GUIDE.md` - 详细的脚本使用说明
- **千问API配置**: `docs/QWEN_API_SETUP.md`
- **配置成功确认**: `docs/QWEN_SETUP_COMPLETE.md`

---

## ✅ 问题已解决检查清单

- [x] ✅ 改进了 `start-ai.sh` 脚本
- [x] ✅ 创建了 `restart-api.sh` 快速重启脚本
- [x] ✅ 更新了环境变量提示
- [x] ✅ 测试脚本运行正常
- [x] ✅ 服务成功启动
- [x] ✅ 健康检查通过
- [x] ✅ 创建了使用文档

---

## 🎉 现在可以正常启动了！

**推荐使用**:
```bash
./restart-api.sh
```

快速、简单、无交互！✨

---

**修复时间**: 2026-03-05  
**文档版本**: 1.0

