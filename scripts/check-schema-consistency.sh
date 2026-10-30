#!/bin/bash
# ===================================
# Prisma 双 schema 一致性检查
# ===================================
# 检查 api/prisma/schema.prisma（SQLite 开发版）与 api/prisma/schema.mysql.prisma（MySQL 生产版）
# 的模型列表与各模型字段是否一致。
# 背景：双 schema 靠手工同步，漏同步在生产会直接运行时报错（Unknown model / Unknown field），
# 本地 tsc 与测试均无法发现。历史已发生三次漂移（pending 三字段、Cascade 外键、整个 team_memberships 模型）。
# 用法：bash scripts/check-schema-consistency.sh
# 退出码：0 = 一致；1 = 存在差异（附差异明细）

set -o pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$(dirname "$0")/.." && pwd)")
SQLITE_SCHEMA="$REPO_ROOT/api/prisma/schema.prisma"
MYSQL_SCHEMA="$REPO_ROOT/api/prisma/schema.mysql.prisma"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

fail() { echo -e "${RED}[SCHEMA-DIFF]${NC} $1"; exit 1; }

[ -f "$SQLITE_SCHEMA" ] || fail "找不到 $SQLITE_SCHEMA"
[ -f "$MYSQL_SCHEMA" ] || fail "找不到 $MYSQL_SCHEMA"

# 提取模型名列表
model_list() {
  grep -E '^model ' "$1" | awk '{print $2}' | sort
}

# 提取指定模型体内的字段名（两空格缩进的字段行，含关系字段；排除 @@ 属性与注释）
model_fields() {
  sed -n "/^model $2 {/,/^}/p" "$1" | grep -E '^  [a-zA-Z_][a-zA-Z0-9_]*[[:space:]]' | awk '{print $1}' | sort
}

SQLITE_MODELS=$(model_list "$SQLITE_SCHEMA")
MYSQL_MODELS=$(model_list "$MYSQL_SCHEMA")

# 1. 模型列表一致性
ONLY_SQLITE=$(comm -23 <(echo "$SQLITE_MODELS") <(echo "$MYSQL_MODELS"))
ONLY_MYSQL=$(comm -13 <(echo "$SQLITE_MODELS") <(echo "$MYSQL_MODELS"))
if [ -n "$ONLY_SQLITE" ]; then
  fail "以下模型仅在 SQLite schema 中存在（MySQL 生产 schema 缺失，部署后会运行时报错）: $(echo "$ONLY_SQLITE" | tr '\n' ' ')"
fi
if [ -n "$ONLY_MYSQL" ]; then
  fail "以下模型仅在 MySQL schema 中存在（SQLite 开发 schema 缺失）: $(echo "$ONLY_MYSQL" | tr '\n' ' ')"
fi

# 2. 各模型字段一致性
for m in $SQLITE_MODELS; do
  S_FIELDS=$(model_fields "$SQLITE_SCHEMA" "$m")
  M_FIELDS=$(model_fields "$MYSQL_SCHEMA" "$m")
  if [ "$S_FIELDS" != "$M_FIELDS" ]; then
    echo -e "${RED}[SCHEMA-DIFF]${NC} 模型 $m 字段不一致（< SQLite / > MySQL）："
    diff <(echo "$S_FIELDS") <(echo "$M_FIELDS") | sed 's/^/    /'
    exit 1
  fi
done

MODEL_COUNT=$(echo "$SQLITE_MODELS" | wc -l | tr -d ' ')
echo -e "${GREEN}[SCHEMA-OK]${NC} 双 schema 一致（$MODEL_COUNT 个模型全部匹配）"
exit 0
