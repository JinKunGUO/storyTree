#!/bin/bash
# ===================================
# StoryTree 一键部署脚本
# ===================================
# 使用方法：
#   首次部署：bash scripts/deploy.sh --init
#   更新部署：bash scripts/deploy.sh
#
# 前提条件（在服务器上执行）：
#   1. 已安装 Node.js 18+、Nginx、Redis、PM2
#   2. 已配置 api/.env.production 文件
#   3. 已创建 MySQL 数据库

set -e  # 遇到错误立即退出

# ===================================
# 配置变量
# ===================================
APP_DIR="/var/www/storytree"
API_DIR="$APP_DIR/api"
LOG_DIR="/var/log/pm2"
REPO_URL="https://github.com/JinKunGUO/storyTree.git"
PM2_APP_NAME="storytree-api"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ===================================
# 环境检查
# ===================================
check_requirements() {
    log_info "检查运行环境..."

    command -v node >/dev/null 2>&1 || log_error "Node.js 未安装，请先运行：curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    command -v npm >/dev/null 2>&1 || log_error "npm 未安装"
    command -v pm2 >/dev/null 2>&1 || log_error "PM2 未安装，请先运行：sudo npm install -g pm2"
    command -v nginx >/dev/null 2>&1 || log_error "Nginx 未安装，请先运行：sudo apt install -y nginx"

    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本需要 >= 18，当前版本：$(node -v)"
    fi

    log_success "环境检查通过（Node.js $(node -v)）"
}

# ===================================
# 首次初始化
# ===================================
init_server() {
    log_info "===== 首次初始化服务器环境 ====="

    # 创建日志目录
    sudo mkdir -p "$LOG_DIR"
    sudo chown -R "$USER:$USER" "$LOG_DIR"

    # 克隆代码
    if [ -d "$APP_DIR" ]; then
        log_warn "$APP_DIR 已存在，跳过克隆"
    else
        log_info "克隆代码仓库..."
        sudo mkdir -p /var/www
        sudo git clone "$REPO_URL" "$APP_DIR"
        sudo chown -R "$USER:$USER" "$APP_DIR"
        log_success "代码克隆完成"
    fi

    # 检查生产环境配置文件
    if [ ! -f "$API_DIR/.env.production" ]; then
        log_warn "未找到 $API_DIR/.env.production"
        log_warn "请将 api/.env.production 上传到服务器并填写真实配置后重新运行"
        log_warn "参考模板：api/.env.production（在项目根目录）"
        exit 1
    fi

    # 配置 Nginx
    setup_nginx

    # 配置 PM2 开机自启
    log_info "配置 PM2 开机自启..."
    pm2 startup | tail -1 | bash || true
    log_success "PM2 开机自启配置完成"
}

# ===================================
# 配置 Nginx
# ===================================
setup_nginx() {
    log_info "配置 Nginx..."

    NGINX_CONF="$APP_DIR/scripts/nginx.conf"
    NGINX_SITE="/etc/nginx/sites-available/storytree"

    if [ ! -f "$NGINX_CONF" ]; then
        log_error "Nginx 配置文件不存在：$NGINX_CONF"
    fi

    sudo cp "$NGINX_CONF" "$NGINX_SITE"

    # 检查是否已启用
    if [ ! -L "/etc/nginx/sites-enabled/storytree" ]; then
        sudo ln -s "$NGINX_SITE" /etc/nginx/sites-enabled/
    fi

    # 禁用默认站点
    if [ -L "/etc/nginx/sites-enabled/default" ]; then
        sudo rm /etc/nginx/sites-enabled/default
    fi

    # 测试 Nginx 配置
    sudo nginx -t || log_error "Nginx 配置有误，请检查 $NGINX_SITE"
    sudo systemctl reload nginx
    log_success "Nginx 配置完成"
}

# ===================================
# 更新代码
# ===================================
update_code() {
    log_info "拉取最新代码..."
    cd "$APP_DIR"

    # 记录拉取前的 schema 哈希，用于后续判断是否需要重新生成 Prisma 客户端
    SCHEMA_HASH_BEFORE=""
    if [ -f "$API_DIR/prisma/schema.mysql.prisma" ]; then
        SCHEMA_HASH_BEFORE=$(md5sum "$API_DIR/prisma/schema.mysql.prisma" | cut -d' ' -f1)
    fi
    export SCHEMA_HASH_BEFORE

    # 强制同步远程代码
    # 使用 fetch + reset --hard 代替 git pull，避免以下问题：
    # 1. 部署时 schema.prisma/migration_lock.toml 会被切换为 MySQL 版本，导致 git pull 冲突
    # 2. 服务器上可能存在未跟踪文件（如 package-lock.json）与远程冲突
    git fetch origin main
    git reset --hard origin/main
    git clean -fd -e "*.env.production" -e "api/prisma/dev.db" 2>/dev/null || true
    log_success "代码更新完成（$(git log --oneline -1)）"
}

# ===================================
# 安装依赖
# ===================================
install_deps() {
    log_info "安装 Node.js 依赖..."
    cd "$API_DIR"
    npm ci
    log_success "依赖安装完成"
}

# ===================================
# 数据库迁移
# ===================================
run_migrations() {
    log_info "执行数据库迁移..."
    cd "$API_DIR"

    # 使用生产环境配置（逐行读取，支持含特殊字符的值如 URL、密码）
    while IFS= read -r line; do
        # 跳过空行和注释行
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        # 提取 key=value，去掉首尾空格，支持带引号的值
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            val="${BASH_REMATCH[2]}"
            # 去掉值两端的双引号或单引号
            val="${val%\"}"
            val="${val#\"}"
            val="${val%\'}"
            val="${val#\'}"
            export "$key=$val"
        fi
    done < .env.production

    # 使用 MySQL 版本的 schema（生产环境）
    SCHEMA_FILE="$API_DIR/prisma/schema.prisma"
    cp "$API_DIR/prisma/schema.mysql.prisma" "$SCHEMA_FILE"
    log_info "已切换到 MySQL 版本的 schema"

    # 同步 migration_lock.toml 中的 provider（避免 P3019 错误）
    LOCK_FILE="$API_DIR/prisma/migrations/migration_lock.toml"
    if [ -f "$LOCK_FILE" ]; then
        sed -i 's/provider = "sqlite"/provider = "mysql"/' "$LOCK_FILE"
        log_info "已同步 migration_lock.toml provider 为 mysql"
    fi

    # 生成 Prisma Client
    npx prisma generate

    # 使用 db push 同步 schema 到数据库
    # （迁移文件为 SQLite 语法，无法在 MySQL 上执行，故使用 db push）
    npx prisma db push
    log_success "数据库 schema 同步完成"

    # 执行种子数据（确保模板等基础数据存在）
    log_info "检查并插入种子数据..."
    npx tsx prisma/seeds/templates.ts || npx ts-node prisma/seeds/templates.ts || log_warn "种子数据插入失败（非致命，继续部署）"
    log_success "种子数据检查完成"
}

# ===================================
# 检查 Prisma 客户端是否需要重新生成
# ===================================
check_prisma_client() {
    log_info "检查 Prisma 客户端一致性..."
    cd "$API_DIR"

    SCHEMA_FILE="$API_DIR/prisma/schema.prisma"
    MYSQL_SCHEMA_FILE="$API_DIR/prisma/schema.mysql.prisma"

    NEED_REGENERATE=false

    # 1. 检查 schema.mysql.prisma 是否比当前 schema.prisma 更新
    #    （部署时 schema.prisma 会被覆盖为 MySQL 版本，这里对比两者内容）
    if [ -f "$MYSQL_SCHEMA_FILE" ] && [ -f "$SCHEMA_FILE" ]; then
        SCHEMA_HASH=$(md5sum "$SCHEMA_FILE" | cut -d' ' -f1)
        MYSQL_HASH=$(md5sum "$MYSQL_SCHEMA_FILE" | cut -d' ' -f1)
        if [ "$SCHEMA_HASH" != "$MYSQL_HASH" ]; then
            log_warn "schema.prisma 与 schema.mysql.prisma 不一致，需要重新生成 Prisma 客户端"
            NEED_REGENERATE=true
        fi
    fi

    # 2. 检查 git pull 后 schema 是否有变更
    if [ -n "$SCHEMA_HASH_BEFORE" ] && [ -f "$MYSQL_SCHEMA_FILE" ]; then
        SCHEMA_HASH_AFTER=$(md5sum "$MYSQL_SCHEMA_FILE" | cut -d' ' -f1)
        if [ "$SCHEMA_HASH_BEFORE" != "$SCHEMA_HASH_AFTER" ]; then
            log_warn "schema.mysql.prisma 在本次更新中有变更，需要重新生成 Prisma 客户端"
            NEED_REGENERATE=true
        fi
    fi

    # 3. 检查 Prisma 客户端是否已生成（node_modules/.prisma/client 是否存在）
    PRISMA_CLIENT_DIR="$API_DIR/node_modules/.prisma/client"
    if [ ! -d "$PRISMA_CLIENT_DIR" ] || [ ! -f "$PRISMA_CLIENT_DIR/index.js" ]; then
        log_warn "Prisma 客户端未生成，需要执行 prisma generate"
        NEED_REGENERATE=true
    fi

    # 4. 验证 Prisma 客户端类型是否与 schema 一致
    #    通过检查 schema 中的 model 名称是否在生成的类型文件中存在
    if [ "$NEED_REGENERATE" = false ] && [ -f "$PRISMA_CLIENT_DIR/index.d.ts" ]; then
        # 提取 schema 中所有 model 名称
        SCHEMA_MODELS=$(grep "^model " "$SCHEMA_FILE" 2>/dev/null | awk '{print $2}')
        MISSING_MODELS=0
        for model in $SCHEMA_MODELS; do
            # 检查生成的类型文件中是否包含该 model 的类型定义
            # Prisma 生成的类型格式：export type ${model}ScalarFieldEnum 或 export type ${model} = ...
            if ! grep -q "export type $model " "$PRISMA_CLIENT_DIR/index.d.ts" 2>/dev/null; then
                log_warn "Prisma 客户端缺少 model 类型: $model"
                MISSING_MODELS=$((MISSING_MODELS + 1))
            fi
        done
        if [ "$MISSING_MODELS" -gt 0 ]; then
            log_warn "Prisma 客户端缺少 $MISSING_MODELS 个 model 类型，需要重新生成"
            NEED_REGENERATE=true
        fi
    fi

    # 5. 如果有 .prisma/client 生成时间早于 schema 文件修改时间
    if [ "$NEED_REGENERATE" = false ] && [ -f "$PRISMA_CLIENT_DIR/index.js" ] && [ -f "$SCHEMA_FILE" ]; then
        if [ "$SCHEMA_FILE" -nt "$PRISMA_CLIENT_DIR/index.js" ]; then
            log_warn "schema.prisma 比 Prisma 客户端更新，需要重新生成"
            NEED_REGENERATE=true
        fi
    fi

    if [ "$NEED_REGENERATE" = true ]; then
        log_info "重新生成 Prisma 客户端..."
        # 确保使用 MySQL 版本的 schema
        cp "$MYSQL_SCHEMA_FILE" "$SCHEMA_FILE"
        npx prisma generate
        log_success "Prisma 客户端已重新生成"
    else
        log_success "Prisma 客户端一致性检查通过"
    fi
}

# ===================================
# 构建项目
# ===================================
build_project() {
    log_info "构建 TypeScript 项目..."
    cd "$API_DIR"
    npm run build
    log_success "项目构建完成"
}

# ===================================
# 启动/重启服务
# ===================================
restart_service() {
    log_info "启动/重启服务..."
    cd "$APP_DIR"

    # 检查是否已有运行中的实例
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        log_info "重启现有服务..."
        pm2 restart "$PM2_APP_NAME" --update-env
    else
        log_info "首次启动服务..."
        pm2 start ecosystem.config.js --env production
    fi

    # 保存 PM2 进程列表
    pm2 save
    log_success "服务启动完成"
}

# ===================================
# 健康检查
# ===================================
health_check() {
    log_info "执行健康检查..."
    sleep 5  # 等待服务完全启动（含数据库连接、Worker初始化）

    MAX_RETRIES=6
    RETRY=0
    while [ $RETRY -lt $MAX_RETRIES ]; do
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/health 2>/dev/null || echo "000")
        if [ "$HTTP_STATUS" = "200" ]; then
            log_success "健康检查通过（HTTP $HTTP_STATUS）"
            return 0
        fi
        RETRY=$((RETRY + 1))
        log_warn "健康检查失败（HTTP $HTTP_STATUS），重试 $RETRY/$MAX_RETRIES..."
        sleep 4
    done

    # 最终失败时打印更多诊断信息
    log_error "健康检查失败！诊断信息："
    log_error "  curl 响应: $(curl -s --max-time 5 http://localhost:3001/health 2>&1)"
    log_error "  PM2 状态: $(pm2 show $PM2_APP_NAME 2>&1 | grep -E 'status|uptime|restarts')"
    log_error "  请查看完整日志：pm2 logs $PM2_APP_NAME"
}

# ===================================
# 生产环境冒烟测试
# ===================================
smoke_test() {
    log_info "运行生产环境冒烟测试..."

    SMOKE_SCRIPT="$APP_DIR/scripts/smoke-test-production.sh"
    if [ ! -f "$SMOKE_SCRIPT" ]; then
        log_warn "冒烟测试脚本不存在：$SMOKE_SCRIPT，跳过"
        return 0
    fi

    if bash "$SMOKE_SCRIPT" "https://storytree.online"; then
        log_success "生产环境冒烟测试全部通过"
    else
        log_warn "冒烟测试有失败项，请检查上方输出（部署本身已完成，服务正在运行）"
    fi
}

# ===================================
# 主流程
# ===================================
main() {
    echo ""
    echo "====================================="
    echo "  StoryTree 部署脚本"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "====================================="
    echo ""

    check_requirements

    if [ "$1" = "--init" ]; then
        init_server
    fi

    # 检查应用目录
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在：$APP_DIR，请先运行：bash scripts/deploy.sh --init"
    fi

    # 检查生产环境配置
    if [ ! -f "$API_DIR/.env.production" ]; then
        log_error "生产环境配置文件不存在：$API_DIR/.env.production"
    fi

    update_code
    install_deps
    run_migrations
    check_prisma_client
    build_project
    restart_service
    health_check
    smoke_test

    echo ""
    echo "====================================="
    log_success "部署完成！"
    echo "  前端地址：https://storytree.online"
    echo "  API 地址：https://api.storytree.online"
    echo "  备用地址：https://www.storytree.online / https://www.api.storytree.online"
    echo "  查看日志：pm2 logs $PM2_APP_NAME"
    echo "  服务状态：pm2 status"
    echo "====================================="
    echo ""
}

main "$@"

