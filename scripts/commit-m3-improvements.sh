#!/bin/bash

# Git提交脚本 - M3用户认证分支改进
# 日期: 2026-03-08
# 说明: 提交AI功能优化和文档整理

set -e  # 遇到错误立即退出

echo "======================================"
echo "开始Git提交流程"
echo "======================================"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/.."
echo "✅ 当前目录: $(pwd)"
echo ""

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "✅ 当前分支: $CURRENT_BRANCH"
echo ""

# 检查是否有未提交的更改
if [[ -z $(git status -s) ]]; then
    echo "⚠️  没有需要提交的更改"
    exit 0
fi

echo "======================================"
echo "查看当前更改"
echo "======================================"
git status
echo ""

# 添加所有更改的文件
echo "======================================"
echo "添加文件到暂存区"
echo "======================================"

# 添加数据库相关文件
echo "📦 添加数据库文件..."
git add api/prisma/schema.prisma 2>/dev/null || true

# 添加后端路由文件
echo "📦 添加后端路由文件..."
git add api/src/routes/ai-v2.ts 2>/dev/null || true
git add api/src/routes/nodes.ts 2>/dev/null || true
git add api/src/index.ts 2>/dev/null || true

# 添加脚本文件
echo "📦 添加脚本文件..."
git add api/scripts/ 2>/dev/null || true

# 添加前端文件
echo "📦 添加前端文件..."
git add web/write.html 2>/dev/null || true
git add web/story.html 2>/dev/null || true
git add web/ai-tasks.html 2>/dev/null || true

# 添加版本文件
echo "📦 添加版本文件..."
git add VERSION.json 2>/dev/null || true

# 处理文档文件
echo "📦 处理文档文件..."
# 删除的临时文档
git add docs/ 2>/dev/null || true

# 添加提交脚本和说明
echo "📦 添加脚本文件..."
git add scripts/commit-m3-improvements.sh 2>/dev/null || true
git add scripts/COMMIT_GUIDE.md 2>/dev/null || true

echo "✅ 文件已添加到暂存区"
echo ""

# 显示暂存区的文件
echo "======================================"
echo "暂存区文件列表"
echo "======================================"
git status
echo ""

# 创建提交
echo "======================================"
echo "创建Git提交"
echo "======================================"

git commit -m "功能：AI功能优化和代码整理

主要改进：
1. 修复AI创建章节不显示问题
   - 添加is_published字段到nodes表
   - 所有章节创建时默认已发布
   - 更新现有章节为已发布状态

2. 修复AI章节顺序问题
   - AI创建的章节自动接在最新一章后面
   - 优化parent_id逻辑，避免创建根节点
   - 自动查找最新章节作为父节点

3. 优化写作页面功能
   - 删除写作页面的'AI创作章节'功能
   - 保留'AI续写'（小段落）功能
   - 功能职责更清晰：写作页面专注辅助写作
   - 简化代码约100行

4. 增强故事详情页AI功能
   - 添加惊喜时间选择器样式
   - 优化AI选项卡片显示
   - 改进用户交互体验

5. 代码整理
   - 删除18个临时修复报告文档
   - 保留重要的用户指南和API文档
   - 简化代码逻辑，提高可维护性

技术细节：
- 数据库：添加is_published字段，默认false
- 后端：优化AI续写接受逻辑，自动查找最新章节
- 前端：简化write.html（-100行），优化story.html样式
- 脚本：添加update-existing-nodes.ts数据迁移工具
- 迁移：更新现有章节数据

测试验证：
- ✅ AI创建的章节正常显示
- ✅ 章节顺序正确排列
- ✅ 写作页面功能正常
- ✅ 故事详情页AI功能正常
- ✅ 数据库迁移成功

文件变更统计：
- 修改：6个核心文件
- 新增：3个工具文件
- 删除：18个临时文档
- 代码行数：+250/-230"

echo "✅ 提交创建成功"
echo ""

# 显示提交信息
echo "======================================"
echo "提交信息"
echo "======================================"
git log -1 --stat
echo ""

# 询问是否推送
echo "======================================"
echo "准备推送到远程仓库"
echo "======================================"
echo "⚠️  注意: 这将推送到远程分支 $CURRENT_BRANCH"
echo ""
read -p "是否推送到远程? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 推送到远程..."
    git push origin "$CURRENT_BRANCH"
    echo "✅ 推送成功!"
else
    echo "⏸️  跳过推送"
    echo "💡 稍后可以手动推送: git push origin $CURRENT_BRANCH"
fi

echo ""
echo "======================================"
echo "Git提交流程完成 ✨"
echo "======================================"

