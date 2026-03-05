#!/bin/bash

# 千问API快速配置脚本

echo "🚀 StoryTree - 千问API快速配置"
echo "================================"
echo ""

# 检查.env文件是否存在
if [ ! -f "api/.env" ]; then
    echo "❌ 错误: api/.env 文件不存在"
    exit 1
fi

echo "📝 请输入您的千问API Key:"
echo "   (从 https://dashscope.console.aliyun.com/apiKey 获取)"
read -p "API Key: " api_key

if [ -z "$api_key" ]; then
    echo "❌ API Key不能为空"
    exit 1
fi

echo ""
echo "🎯 请选择模型:"
echo "   1) qwen-turbo  (快速，¥0.0008/千tokens)"
echo "   2) qwen-plus   (推荐，¥0.002/千tokens)"
echo "   3) qwen-max    (最强，¥0.02/千tokens)"
read -p "选择 (1-3, 默认2): " model_choice

case $model_choice in
    1)
        model="qwen-turbo"
        ;;
    3)
        model="qwen-max"
        ;;
    *)
        model="qwen-plus"
        ;;
esac

echo ""
echo "⚙️  正在更新配置..."

# 更新.env文件
if grep -q "QWEN_API_KEY" api/.env; then
    # 替换现有配置
    sed -i.bak "s|QWEN_API_KEY=.*|QWEN_API_KEY=\"$api_key\"|" api/.env
    sed -i.bak "s|QWEN_MODEL=.*|QWEN_MODEL=\"$model\"|" api/.env
else
    # 添加新配置
    echo "" >> api/.env
    echo "# 阿里云千问 API" >> api/.env
    echo "QWEN_API_KEY=\"$api_key\"" >> api/.env
    echo "QWEN_MODEL=\"$model\"" >> api/.env
fi

echo "✅ 配置已更新"
echo "   API Key: ${api_key:0:10}..."
echo "   模型: $model"
echo ""

# 测试API
echo "🧪 测试API连接..."
node test-qwen-api.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 配置成功！"
    echo ""
    echo "下一步:"
    echo "  1. 重启服务: ./start-ai.sh"
    echo "  2. 访问: http://localhost:3001/write?storyId=1"
    echo "  3. 测试AI续写功能"
else
    echo ""
    echo "❌ API测试失败，请检查配置"
    echo "   查看详细文档: docs/QWEN_API_SETUP.md"
fi

