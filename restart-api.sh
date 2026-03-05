#!/bin/bash

# 快速重启API服务脚本（无交互）
# 使用方法: ./restart-api.sh

echo "🔄 快速重启StoryTree API服务"
echo "================================"

# 停止占用3001端口的进程
echo ""
echo "🔍 检查3001端口..."
PORT_PID=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "⚠️  停止旧进程 (PID: $PORT_PID)..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
    echo "✅ 旧进程已停止"
else
    echo "✅ 3001端口可用"
fi

# 启动服务
echo ""
echo "🚀 启动API服务..."
cd api && npm run dev

