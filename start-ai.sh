#!/bin/bash

# StoryTree AI功能快速启动脚本
# 使用方法: chmod +x start-ai.sh && ./start-ai.sh

echo "🚀 StoryTree AI功能启动脚本"
echo "================================"

# 检查并清理3001端口
echo ""
echo "🔍 检查3001端口状态..."
PORT_PID=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "⚠️  检测到3001端口被占用 (PID: $PORT_PID)"
    read -p "是否终止旧进程？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 正在停止旧进程..."
        kill -9 $PORT_PID 2>/dev/null
        sleep 1
        echo "✅ 旧进程已停止"
    else
        echo "❌ 无法启动服务，端口被占用"
        exit 1
    fi
else
    echo "✅ 3001端口可用"
fi

# 检查Redis是否运行
echo ""
echo "📡 检查Redis状态..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis运行正常"
else
    echo "❌ Redis未运行，正在启动..."
    
    # 尝试启动Redis (macOS)
    if command -v brew &> /dev/null; then
        brew services start redis
        sleep 2
    # 尝试启动Redis (Linux)
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start redis
        sleep 2
    else
        echo "⚠️  请手动启动Redis: redis-server"
        exit 1
    fi
    
    # 再次检查
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis启动成功"
    else
        echo "❌ Redis启动失败，请手动启动"
        exit 1
    fi
fi

# 检查环境变量
echo ""
echo "🔧 检查环境变量..."
cd api

if [ ! -f .env ]; then
    echo "⚠️  未找到.env文件，从.env.example复制..."
    cp .env.example .env
    echo "⚠️  请编辑 api/.env 文件，配置API Keys"
    echo ""
    echo "必需配置:"
    echo "  - QWEN_API_KEY (阿里云千问API)"
    echo "  - QWEN_MODEL (推荐: qwen-plus)"
    echo ""
    echo "获取API Key: https://dashscope.console.aliyun.com/apiKey"
    echo ""
    read -p "按回车键继续（确保已配置API Keys）..."
fi

# 检查依赖
echo ""
echo "📦 检查Node.js依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  未找到node_modules，正在安装依赖..."
    npm install
else
    echo "✅ 依赖已安装"
fi

# 更新数据库
echo ""
echo "🗄️  更新数据库Schema..."
npm run db:push

# 启动服务
echo ""
echo "🎉 启动StoryTree API服务..."
echo "================================"
echo ""
echo "✅ 服务启动成功！"
echo ""
echo "📍 访问地址:"
echo "  - API: http://localhost:3001"
echo "  - 用户等级页面: http://localhost:3001/level"
echo "  - API文档: docs/AI_IMPLEMENTATION_REPORT.md"
echo ""
echo "🧪 测试指南: docs/AI_TESTING_GUIDE.md"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

npm run dev

