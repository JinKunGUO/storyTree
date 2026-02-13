#!/bin/bash

# StoryTree v1.0.9 Git Commit Script
# 执行方式: chmod +x commit.sh && ./commit.sh

cd /Users/jinkun/storytree

# 添加所有更改
git add .

# 提交更改
git commit -m "feat: M3 frontend development v1.0.9

Complete frontend pages and authentication system

- Add 7 complete frontend pages
- Implement user auth system  
- Optimize routing configuration
- Enhance UI/UX design
- Add comprehensive documentation

See: docs/CHANGELOG_2026-02-13.md"

# 显示提交结果
echo ""
echo "✅ Git commit completed!"
echo ""
echo "Next steps:"
echo "1. Review commit: git log -1"
echo "2. Push to remote: git push origin feature/m3-user-auth"
echo ""

