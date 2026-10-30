#!/bin/bash
# ===================================
# StoryTree 数据恢复脚本
# ===================================
# 使用方法（在服务器上执行）：
#   列出所有备份：      bash scripts/restore.sh --list
#   恢复数据库：        bash scripts/restore.sh --db storytree_20261030_030000.sql.gz
#   恢复上传文件：      bash scripts/restore.sh --uploads uploads_20261030_030000.tar.gz
#   同时恢复两者：      bash scripts/restore.sh --all 20261030_030000
#
# 安全机制：
#   1. 恢复前必须输入 YES 确认
#   2. 恢复前自动备份当前数据库/文件，恢复错了可以再回退
#   3. 恢复后提示重启服务

set -e

# ===================================
# 配置变量
# ===================================
APP_DIR="/var/www/storytree"
API_DIR="$APP_DIR/api"
BACKUP_DIR="/var/backups/storytree"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ===================================
# 读取数据库配置
# ===================================
load_db_config() {
    ENV_FILE="$API_DIR/.env.production"
    if [ ! -f "$ENV_FILE" ]; then
        log_error "生产环境配置文件不存在：$ENV_FILE"
    fi

    DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')

    DB_USER=$(echo "$DATABASE_URL" | sed 's|mysql://||' | cut -d: -f1)
    DB_PASS=$(echo "$DATABASE_URL" | sed 's|mysql://[^:]*:||' | cut -d@ -f1)
    DB_HOST=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f1)
    DB_PORT=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f2 | cut -d/ -f1)
    DB_NAME=$(echo "$DATABASE_URL" | cut -d/ -f4)
}

# ===================================
# 列出备份
# ===================================
list_backups() {
    echo ""
    echo "===== 数据库备份（$BACKUP_DIR/database）====="
    ls -lht "$BACKUP_DIR/database"/*.sql.gz 2>/dev/null || echo "（无备份）"
    echo ""
    echo "===== 上传文件备份（$BACKUP_DIR/uploads）====="
    ls -lht "$BACKUP_DIR/uploads"/*.tar.gz 2>/dev/null || echo "（无备份）"
    echo ""
    echo "恢复命令示例："
    echo "  bash scripts/restore.sh --db <数据库备份文件名>"
    echo "  bash scripts/restore.sh --uploads <文件备份文件名>"
    echo "  bash scripts/restore.sh --all <时间戳，如 20261030_030000>"
    echo ""
}

# ===================================
# 恢复数据库
# ===================================
restore_db() {
    local file="$1"
    if [ -z "$file" ]; then
        log_error "请指定备份文件名（可用 --list 查看）"
    fi
    # 支持传文件名或绝对路径
    [[ "$file" != /* ]] && file="$BACKUP_DIR/database/$file"
    [ -f "$file" ] || log_error "备份文件不存在：$file"

    load_db_config

    echo ""
    log_warn "即将用以下备份覆盖当前数据库："
    log_warn "  备份文件：$file"
    log_warn "  目标数据库：$DB_NAME @ $DB_HOST:$DB_PORT"
    log_warn "  当前数据将被覆盖！"
    echo ""
    read -r -p "确认恢复请输入 YES：" confirm
    [ "$confirm" = "YES" ] || log_error "已取消恢复"

    # 恢复前自动备份当前状态（恢复错了可再回退）
    log_info "恢复前备份当前数据库状态..."
    local pre_backup="$BACKUP_DIR/database/before_restore_$(date '+%Y%m%d_%H%M%S').sql.gz"
    MYSQL_PWD="$DB_PASS" mysqldump \
        -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
        --single-transaction --routines --triggers --add-drop-table \
        "$DB_NAME" | gzip > "$pre_backup"
    log_success "当前状态已备份：$pre_backup"

    log_info "开始恢复数据库（可能需要几十秒）..."
    gunzip -c "$file" | MYSQL_PWD="$DB_PASS" mysql \
        -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
    log_success "数据库恢复完成"
}

# ===================================
# 恢复上传文件
# ===================================
restore_uploads() {
    local file="$1"
    if [ -z "$file" ]; then
        log_error "请指定备份文件名（可用 --list 查看）"
    fi
    [[ "$file" != /* ]] && file="$BACKUP_DIR/uploads/$file"
    [ -f "$file" ] || log_error "备份文件不存在：$file"

    echo ""
    log_warn "即将用以下备份覆盖当前 uploads 目录：$file"
    read -r -p "确认恢复请输入 YES：" confirm
    [ "$confirm" = "YES" ] || log_error "已取消恢复"

    # 恢复前备份当前 uploads
    if [ -d "$API_DIR/uploads" ]; then
        local bak="$API_DIR/uploads.bak.$(date '+%Y%m%d_%H%M%S')"
        mv "$API_DIR/uploads" "$bak"
        log_info "当前 uploads 已移到：$bak"
    fi

    tar -xzf "$file" -C "$API_DIR"
    log_success "上传文件恢复完成"
}

# ===================================
# 参数解析
# ===================================
case "$1" in
    --list)
        list_backups
        ;;
    --db)
        restore_db "$2"
        log_warn "建议重启服务使连接池刷新：pm2 restart storytree-api"
        ;;
    --uploads)
        restore_uploads "$2"
        ;;
    --all)
        [ -z "$2" ] && log_error "请指定时间戳，如：--all 20261030_030000"
        restore_db "storytree_$2.sql.gz"
        restore_uploads "uploads_$2.tar.gz"
        log_warn "建议重启服务：pm2 restart storytree-api"
        ;;
    *)
        echo "用法："
        echo "  bash scripts/restore.sh --list                          # 列出所有备份"
        echo "  bash scripts/restore.sh --db <备份文件名>                # 恢复数据库"
        echo "  bash scripts/restore.sh --uploads <备份文件名>           # 恢复上传文件"
        echo "  bash scripts/restore.sh --all <时间戳>                   # 同时恢复两者"
        exit 1
        ;;
esac