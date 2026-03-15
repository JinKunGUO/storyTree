#!/bin/bash

# 添加所有修改和新增的文件
echo "📦 添加修改的文件..."

# 后端修改
git add api/src/routes/collaboration-requests.ts
git add api/src/routes/nodes.ts
git add api/src/routes/stories.ts

# 前端修改
git add web/index.html
git add web/story.html
git add web/notifications.html

# 文档
git add docs/notification-feature.md
git add docs/collaborator-auto-follow.md

# 版本文件
git add VERSION.json

# 删除的文件
git add -u

echo "✅ 文件添加完成！"
echo ""
echo "📝 可用的commit message文件："
echo "  1. COMMIT_MESSAGE_CN.txt (详细版)"
echo "  2. COMMIT_MESSAGE_SIMPLE.txt (简洁版)"
echo ""
echo "🚀 提交命令："
echo "  git commit -F COMMIT_MESSAGE_SIMPLE.txt"
echo "  或"
echo "  git commit -F COMMIT_MESSAGE_CN.txt"
echo ""
echo "📊 查看暂存的文件："
echo "  git status"

