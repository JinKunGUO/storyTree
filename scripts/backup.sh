#!/bin/bash
# ===================================
# StoryTree 自动备份脚本
# ===================================
# 使用方法：
#   手动备份：bash scripts/backup.sh
#   设置定时任务（每天凌晨 3 点）：
#     crontab -e
#     添加：0 3 * * * /bin/bash /var/www/storytree/scripts/backup.sh >> /var/log/storytree-backup.log 2>&1
#
# 备份内容：
#   1. MySQL 数据库完整备份
#   2. 用户上传文件（uploads 目录）

set -e

# ===================================
# 配置变量
# ===================================
APP_DIR="/var/www/storytree"
API_DIR="$APP_DIR/api"
BACKUP_DIR="/var/backups/storytree"
DATE=$(date '+%Y%m%d_%H%M%S')
KEEP_DAYS=7  # 保留最近 7 天的备份

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"; }
log_success() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1"; exit 1; }

# ===================================
# 初始化备份目录
# ===================================
init_backup_dir() {
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/uploads"
    log_info "备份目录：$BACKUP_DIR"
}

# ===================================
# 读取数据库配置
# ===================================
load_db_config() {
    ENV_FILE="$API_DIR/.env.production"
    if [ ! -f "$ENV_FILE" ]; then
        log_error "生产环境配置文件不存在：$ENV_FILE"
    fi

    # 从 .env.production 读取 DATABASE_URL
    DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')

    # 解析 MySQL 连接字符串：mysql://user:password@host:port/dbname
    DB_USER=$(echo "$DATABASE_URL" | sed 's|mysql://||' | cut -d: -f1)
    DB_PASS=$(echo "$DATABASE_URL" | sed 's|mysql://[^:]*:||' | cut -d@ -f1)
    DB_HOST=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f1)
    DB_PORT=$(echo "$DATABASE_URL" | cut -d@ -f2 | cut -d: -f2 | cut -d/ -f1)
    DB_NAME=$(echo "$DATABASE_URL" | cut -d/ -f4)
}

# ===================================
# 备份 MySQL 数据库
# ===================================
backup_database() {
    log_info "备份 MySQL 数据库..."

    BACKUP_FILE="$BACKUP_DIR/database/storytree_${DATE}.sql.gz"

    # 使用 mysqldump 备份并压缩
    MYSQL_PWD="$DB_PASS" mysqldump \
        -h "$DB_HOST" \
        -P "$DB_PORT" \
        -u "$DB_USER" \
        --single-transaction \
        --routines \
        --triggers \
        --add-drop-table \
        "$DB_NAME" | gzip > "$BACKUP_FILE"

    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    log_success "数据库备份完成：$BACKUP_FILE（$BACKUP_SIZE）"
}

# ===================================
# 备份上传文件
# ===================================
backup_uploads() {
    UPLOADS_DIR="$API_DIR/uploads"

    if [ ! -d "$UPLOADS_DIR" ]; then
        log_warn "uploads 目录不存在，跳过"
        return
    fi

    log_info "备份用户上传文件..."

    BACKUP_FILE="$BACKUP_DIR/uploads/uploads_${DATE}.tar.gz"
    tar -czf "$BACKUP_FILE" -C "$API_DIR" uploads/

    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    log_success "文件备份完成：$BACKUP_FILE（$BACKUP_SIZE）"
}

# ===================================
# 清理旧备份（保留最近 N 天）
# ===================================
cleanup_old_backups() {
    log_info "清理 $KEEP_DAYS 天前的旧备份..."

    DELETED_COUNT=0

    # 清理数据库备份
    while IFS= read -r -d '' file; do
        rm -f "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    done < <(find "$BACKUP_DIR/database" -name "*.sql.gz" -mtime +"$KEEP_DAYS" -print0 2>/dev/null)

    # 清理文件备份
    while IFS= read -r -d '' file; do
        rm -f "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    done < <(find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +"$KEEP_DAYS" -print0 2>/dev/null)

    if [ $DELETED_COUNT -gt 0 ]; then
        log_info "已删除 $DELETED_COUNT 个旧备份文件"
    else
        log_info "无需清理旧备份"
    fi
}

# ===================================
# 显示备份统计
# ===================================
show_stats() {
    DB_COUNT=$(find "$BACKUP_DIR/database" -name "*.sql.gz" 2>/dev/null | wc -l)
    UPLOAD_COUNT=$(find "$BACKUP_DIR/uploads" -name "*.tar.gz" 2>/dev/null | wc -l)
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

    echo ""
    echo "===== 备份统计 ====="
    echo "  数据库备份：$DB_COUNT 个"
    echo "  文件备份：$UPLOAD_COUNT 个"
    echo "  总占用空间：$TOTAL_SIZE"
    echo "  备份保留天数：$KEEP_DAYS 天"
    echo "===================="
}

# ===================================
# 主流程
# ===================================
main() {
    echo ""
    log_info "===== 开始备份 StoryTree ====="

    init_backup_dir
    load_db_config
    backup_database
    backup_uploads
    cleanup_old_backups
    show_stats

    log_success "===== 备份完成 ====="
    echo ""
}

main "$@"

