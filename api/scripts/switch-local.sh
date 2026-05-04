#!/bin/bash
# ===================================
# 切换本地开发环境（SQLite）
# ===================================
# 用法: ./switch-local.sh

set -e

echo "切换到本地开发环境 (SQLite)..."

cd "$(dirname "$0")/.."

# 备份当前 schema（如果是 MySQL 版本）
if grep -q 'provider = "mysql"' prisma/schema.prisma 2>/dev/null; then
    echo "检测到当前是 MySQL schema，备份中..."
    cp prisma/schema.prisma prisma/schema.mysql.prisma
fi

# 检查是否有 SQLite 版本的 schema
if [ -f "prisma/schema.sqlite.prisma" ]; then
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
    echo "✓ 已切换到 SQLite schema"
else
    # 如果没有备份，手动修改 provider
    sed -i '' 's/provider = "mysql"/provider = "sqlite"/' prisma/schema.prisma 2>/dev/null || \
    sed -i 's/provider = "mysql"/provider = "sqlite"/' prisma/schema.prisma
    echo "✓ 已将 provider 修改为 sqlite"
fi

# 重新生成 Prisma Client
echo "重新生成 Prisma Client..."
npx prisma generate

echo ""
echo "✓ 本地开发环境切换完成"
echo "  数据库: SQLite (prisma/dev.db)"
echo "  配置文件: .env"

