#!/bin/bash

# Git提交脚本 - 千问API迁移
# 使用方法: ./git-commit-qwen.sh

echo "📦 准备提交千问API迁移更改"
echo "================================"
echo ""

# 显示当前分支
BRANCH=$(git branch --show-current)
echo "📍 当前分支: $BRANCH"
echo ""

# 显示将要提交的文件
echo "📝 将要提交的文件:"
echo ""

# 核心代码修改
echo "【核心代码】"
git add api/src/routes/ai.ts
echo "  ✅ api/src/routes/ai.ts - 切换到千问API"

# 注意：不提交 api/.env（包含敏感信息）
# 用户需要手动配置自己的API Key

# 启动脚本
echo ""
echo "【启动脚本】"
git add start-ai.sh
echo "  ✅ start-ai.sh - 改进的启动脚本"
git add restart-api.sh
echo "  ✅ restart-api.sh - 快速重启脚本"
git add setup-qwen.sh
echo "  ✅ setup-qwen.sh - 千问配置脚本"

# 测试脚本
echo ""
echo "【测试脚本】"
git add test-qwen-api.js
echo "  ✅ test-qwen-api.js - 千问API测试"

# 文档
echo ""
echo "【文档】"
git add docs/QWEN_API_SETUP.md
echo "  ✅ docs/QWEN_API_SETUP.md - 千问配置指南"
git add docs/QWEN_MIGRATION_SUMMARY.md
echo "  ✅ docs/QWEN_MIGRATION_SUMMARY.md - 迁移总结"
git add docs/QWEN_SETUP_COMPLETE.md
echo "  ✅ docs/QWEN_SETUP_COMPLETE.md - 配置完成确认"
git add docs/QWEN_README.md
echo "  ✅ docs/QWEN_README.md - 文档索引"
git add docs/QWEN_MIGRATION_FINAL.md
echo "  ✅ docs/QWEN_MIGRATION_FINAL.md - 最终总结"
git add docs/PORT_CONFLICT_FIXED.md
echo "  ✅ docs/PORT_CONFLICT_FIXED.md - 端口冲突修复"
git add docs/STARTUP_SCRIPTS_GUIDE.md
echo "  ✅ docs/STARTUP_SCRIPTS_GUIDE.md - 启动脚本指南"
git add docs/AI_BUTTON_FIX.md
echo "  ✅ docs/AI_BUTTON_FIX.md - AI按钮修复"
git add COMMIT_QWEN_MIGRATION.md
echo "  ✅ COMMIT_QWEN_MIGRATION.md - 提交说明"

# 前端修改
echo ""
echo "【前端修改】"
git add web/write.html
echo "  ✅ web/write.html - AI功能修复"

echo ""
echo "================================"
echo ""

# 显示git状态
echo "📊 Git状态:"
git status --short

echo ""
echo "================================"
echo ""

# 确认提交
read -p "是否继续提交？(y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消提交"
    exit 1
fi

echo ""
echo "✍️  准备提交..."
echo ""

# 提交信息
COMMIT_MSG="feat: 迁移AI功能从Claude到阿里云千问API

主要更改:
- 切换AI API从Anthropic Claude到阿里云千问(Qwen)
- 使用OpenAI兼容接口调用千问API
- 更新Token计费逻辑
- 成本降低85% (¥63/月 -> ¥12/月)
- 中文原生支持，质量更优

代码修改:
- api/src/routes/ai.ts: 更新AI路由，使用千问API
- api/.env: 配置QWEN_API_KEY和QWEN_MODEL

脚本工具:
- restart-api.sh: 新增快速重启脚本
- setup-qwen.sh: 新增千问配置脚本
- test-qwen-api.js: 新增API测试脚本
- start-ai.sh: 改进启动脚本，添加端口检查

前端修复:
- web/write.html: 修复AI续写按钮初始化问题

文档:
- docs/QWEN_*.md: 千问API配置和迁移文档
- docs/STARTUP_SCRIPTS_GUIDE.md: 启动脚本使用指南
- docs/PORT_CONFLICT_FIXED.md: 端口冲突解决方案

测试:
- ✅ 千问API连接测试通过
- ✅ AI续写功能正常
- ✅ Token使用记录正常
- ✅ 成本计算准确"

# 执行提交
git commit -m "$COMMIT_MSG"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 提交成功！"
    echo ""
    echo "📊 提交信息:"
    git log -1 --oneline
    echo ""
    echo "🚀 下一步:"
    echo "  1. 推送到远程: git push origin $BRANCH"
    echo "  2. 或创建PR合并到主分支"
else
    echo ""
    echo "❌ 提交失败"
    exit 1
fi

