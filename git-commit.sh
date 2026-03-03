#!/bin/bash

# Git提交脚本
# 用于提交AI功能修复和保存草稿功能改进

echo "======================================"
echo "📦 准备提交代码到Git"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}当前分支:${NC} $CURRENT_BRANCH"
echo ""

# 显示修改的文件
echo "======================================"
echo "📝 修改的文件列表"
echo "======================================"
git status --short
echo ""

# 显示统计信息
echo "======================================"
echo "📊 修改统计"
echo "======================================"
MODIFIED_COUNT=$(git status --short | grep "^ M" | wc -l | xargs)
DELETED_COUNT=$(git status --short | grep "^ D" | wc -l | xargs)
UNTRACKED_COUNT=$(git status --short | grep "^??" | wc -l | xargs)

echo -e "${GREEN}修改文件:${NC} $MODIFIED_COUNT"
echo -e "${YELLOW}删除文件:${NC} $DELETED_COUNT"
echo -e "${BLUE}新增文件:${NC} $UNTRACKED_COUNT"
echo ""

# 提交信息
COMMIT_MESSAGE="feat: AI功能修复和保存草稿功能改进

主要更新:

1. 🔧 修复AI API认证问题
   - 修改AI路由使用标准JWT认证
   - 支持Authorization Bearer Token
   - 修复401未授权错误

2. ✨ 区分保存草稿和发布章节功能
   - 保存草稿: 保存后留在当前页面，可继续编辑
   - 发布章节: 保存后自动跳转到章节详情页
   - 添加内容变更追踪，防止意外丢失

3. 📝 优化AI续写功能
   - 支持两种模式: 基于nodeId和基于storyId+context
   - 扩展AI风格系统: 8种写作风格
   - 添加AI使用日志和成本统计
   - 优化Prompt质量和输出格式

4. 🗄️ 修复数据库配置
   - 修正数据库路径配置
   - 重建数据库表结构

5. 🧹 清理冗余文件
   - 删除临时测试脚本
   - 删除重复的修复报告文档
   - 整理项目结构

技术细节:
- 修改文件: api/src/routes/ai.ts, web/write.html, api/.env
- 保留文档: AI使用指南、功能实现总结、保存草稿说明
- 删除文件: 8个临时测试脚本和报告文档

测试状态: ✅ 已通过完整功能测试
"

echo "======================================"
echo "📋 提交信息预览"
echo "======================================"
echo "$COMMIT_MESSAGE"
echo ""

# 询问用户确认
echo "======================================"
echo "⚠️  请确认以下操作"
echo "======================================"
echo "1. 添加所有修改到暂存区 (git add -A)"
echo "2. 提交到本地仓库"
echo "3. 推送到远程仓库 (可选)"
echo ""

read -p "是否继续? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消提交"
    exit 1
fi

# 添加所有修改
echo ""
echo -e "${BLUE}步骤1:${NC} 添加修改到暂存区..."
git add -A

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ 添加文件失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 文件已添加到暂存区${NC}"
echo ""

# 显示暂存的文件
echo "======================================"
echo "📦 暂存的文件"
echo "======================================"
git status --short
echo ""

# 提交
echo -e "${BLUE}步骤2:${NC} 提交到本地仓库..."
git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ 提交失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 已提交到本地仓库${NC}"
echo ""

# 询问是否推送
echo "======================================"
echo "🚀 推送到远程仓库"
echo "======================================"
read -p "是否推送到远程仓库? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}正在推送...${NC}"
    git push origin $CURRENT_BRANCH
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 已推送到远程仓库${NC}"
    else
        echo -e "${YELLOW}⚠️  推送失败，请手动执行: git push origin $CURRENT_BRANCH${NC}"
    fi
else
    echo -e "${YELLOW}⏸️  跳过推送，稍后可手动执行: git push origin $CURRENT_BRANCH${NC}"
fi

echo ""
echo "======================================"
echo "🎉 完成！"
echo "======================================"
echo ""
echo "提交信息已保存，可以使用以下命令查看:"
echo "  git log -1"
echo "  git show HEAD"
echo ""

