#!/bin/bash
# ===================================
# StoryTree 云端部署脚本
# ===================================
# 用法: ./deploy.sh
# 在阿里云服务器上执行此脚本完成部署

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  StoryTree 云端部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在 api 目录下执行此脚本${NC}"
    exit 1
fi

# 步骤 1: 切换到 MySQL schema
echo ""
echo -e "${YELLOW}[1/6] 切换到 MySQL Schema...${NC}"
if [ -f "prisma/schema.mysql.prisma" ]; then
    cp prisma/schema.mysql.prisma prisma/schema.prisma
    echo -e "${GREEN}✓ 已切换到 MySQL 版本的 schema${NC}"
else
    echo -e "${RED}错误: 找不到 prisma/schema.mysql.prisma${NC}"
    exit 1
fi

# 步骤 2: 检查 .env 文件
echo ""
echo -e "${YELLOW}[2/6] 检查环境配置...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo -e "${GREEN}✓ 已从 .env.production 复制配置${NC}"
    else
        echo -e "${RED}错误: 找不到 .env 或 .env.production 文件${NC}"
        exit 1
    fi
fi

# 验证 DATABASE_URL 是 MySQL
if grep -q "mysql://" .env; then
    echo -e "${GREEN}✓ DATABASE_URL 配置为 MySQL${NC}"
else
    echo -e "${RED}错误: DATABASE_URL 不是 MySQL 连接字符串${NC}"
    echo "请检查 .env 文件中的 DATABASE_URL 配置"
    exit 1
fi

# 步骤 3: 安装依赖
echo ""
echo -e "${YELLOW}[3/6] 安装依赖...${NC}"
npm install --production=false
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 步骤 4: 生成 Prisma Client
echo ""
echo -e "${YELLOW}[4/6] 生成 Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma Client 生成完成${NC}"

# 步骤 5: 同步数据库结构（可选）
echo ""
echo -e "${YELLOW}[5/6] 检查数据库同步...${NC}"
echo "提示: 如果是首次部署或 schema 有变化，需要同步数据库"
read -p "是否执行数据库同步 (prisma db push)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db push
    echo -e "${GREEN}✓ 数据库同步完成${NC}"
else
    echo -e "${YELLOW}跳过数据库同步${NC}"
fi

# 步骤 6: 重启服务
echo ""
echo -e "${YELLOW}[6/6] 重启 PM2 服务...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart all || pm2 start src/index.js --name storytree-api
    echo -e "${GREEN}✓ PM2 服务已重启${NC}"
    echo ""
    pm2 status
else
    echo -e "${YELLOW}PM2 未安装，请手动启动服务${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  部署完成！${NC}"
echo "=========================================="
echo ""
echo "后续操作建议："
echo "  1. 查看日志: pm2 logs"
echo "  2. 查看状态: pm2 status"
echo "  3. 测试 API: curl http://localhost:3001/api/health"
echo ""

