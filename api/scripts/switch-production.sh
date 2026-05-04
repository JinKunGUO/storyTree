#!/bin/bash
# ===================================
# 切换到生产环境（MySQL）
# ===================================
# 用法: ./switch-production.sh

set -e

echo "切换到生产环境 (MySQL)..."

cd "$(dirname "$0")/.."

# 备份当前 schema（如果是 SQLite 版本）
if grep -q 'provider = "sqlite"' prisma/schema.prisma 2>/dev/null; then
    echo "检测到当前是 SQLite schema，备份中..."
    cp prisma/schema.prisma prisma/schema.sqlite.prisma
fi

# 切换到 MySQL schema
if [ -f "prisma/schema.mysql.prisma" ]; then
    cp prisma/schema.mysql.prisma prisma/schema.prisma
    echo "✓ 已切换到 MySQL schema"
else
    echo "错误: 找不到 prisma/schema.mysql.prisma"
    exit 1
fi

# 重新生成 Prisma Client
echo "重新生成 Prisma Client..."
npx prisma generate

echo ""
echo "✓ 生产环境切换完成"
echo "  数据库: MySQL (阿里云 RDS)"
echo "  配置文件: .env.production"

