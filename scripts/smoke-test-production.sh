#!/bin/bash
# ============================================================
# 生产环境路由冒烟测试
# 用途：部署后验证 Nginx 路由配置是否正确
# 用法：
#   bash scripts/smoke-test-production.sh [BASE_URL]
#   默认 BASE_URL: https://storytree.online
# ============================================================

set -e

BASE_URL="${1:-https://storytree.online}"
ERRORS=0
PASSED=0

echo "🔍 生产环境路由冒烟测试"
echo "   目标: $BASE_URL"
echo "   时间: $(date)"
echo ""

# 辅助函数：检查 HTTP 响应
check_route() {
  local path="$1"
  local expected_content="$2"
  local not_expected_content="$3"
  local description="$4"

  local url="${BASE_URL}${path}"
  local response
  local http_code

  # 获取 HTTP 状态码和响应体
  response=$(curl -s -w "\n%{http_code}" --max-time 10 "$url" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')

  # 检查状态码
  if [ "$http_code" != "200" ]; then
    echo "  ❌ $description"
    echo "     路径: $path"
    echo "     期望状态码: 200, 实际: $http_code"
    ERRORS=$((ERRORS + 1))
    return
  fi

  # 检查期望内容
  if [ -n "$expected_content" ]; then
    if echo "$body" | grep -q "$expected_content"; then
      : # 通过
    else
      echo "  ❌ $description"
      echo "     路径: $path"
      echo "     期望包含: $expected_content"
      ERRORS=$((ERRORS + 1))
      return
    fi
  fi

  # 检查不应包含的内容
  if [ -n "$not_expected_content" ]; then
    if echo "$body" | grep -q "$not_expected_content"; then
      echo "  ❌ $description"
      echo "     路径: $path"
      echo "     不应包含: $not_expected_content (但找到了)"
      ERRORS=$((ERRORS + 1))
      return
    fi
  fi

  echo "  ✅ $description"
  PASSED=$((PASSED + 1))
}

# 辅助函数：检查 API 端点
check_api() {
  local path="$1"
  local expected_status="$2"
  local description="$3"

  local url="${BASE_URL}${path}"
  local http_code

  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)

  if [ "$http_code" = "$expected_status" ]; then
    echo "  ✅ $description (HTTP $http_code)"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ $description"
    echo "     期望状态码: $expected_status, 实际: $http_code"
    ERRORS=$((ERRORS + 1))
  fi
}

# ============================================================
# 1. 页面路由测试（Nginx try_files $uri $uri.html）
# ============================================================
echo "📋 1. 页面路由测试"
echo ""

check_route "/verify-email?token=test" "邮箱验证" "发现故事" \
  "/verify-email 返回 verify-email.html（非 index.html）"

check_route "/register" "注册" "发现故事" \
  "/register 返回 register.html"

check_route "/login" "登录" "" \
  "/login 返回 login.html"

check_route "/reset-password?token=test" "重置密码" "发现故事" \
  "/reset-password 返回 reset-password.html"

check_route "/forgot-password" "忘记密码" "发现故事" \
  "/forgot-password 返回 forgot-password.html"

echo ""

# ============================================================
# 2. 注册页面密码提示验证
# ============================================================
echo "📋 2. 注册页面密码提示验证"
echo ""

check_route "/register" "password-requirements" "" \
  "注册页面包含密码要求提示区域"

check_route "/register" "至少8个字符" "" \
  "注册页面包含长度要求提示"

check_route "/register" "包含字母" "" \
  "注册页面包含字母要求提示"

check_route "/register" "包含数字" "" \
  "注册页面包含数字要求提示"

echo ""

# ============================================================
# 3. Fallback 路由测试
# ============================================================
echo "📋 3. Fallback 路由测试"
echo ""

check_route "/" "StoryTree" "" \
  "根路径返回首页"

check_route "/non-existent-random-page" "StoryTree" "" \
  "未知路径 fallback 到 index.html"

echo ""

# ============================================================
# 4. API 端点可用性
# ============================================================
echo "📋 4. API 端点可用性"
echo ""

check_api "/api/health" "200" "健康检查端点正常"
check_api "/api/version" "200" "版本信息端点正常"
check_api "/api/non-existent" "404" "不存在的 API 返回 404"

echo ""

# ============================================================
# 5. 静态资源可访问性
# ============================================================
echo "📋 5. 静态资源可访问性"
echo ""

check_route "/auth.js" "validatePassword" "" \
  "auth.js 静态文件可访问"

check_route "/styles.css" "" "" \
  "styles.css 静态文件可访问"

echo ""

# ============================================================
# 结果汇总
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果: 通过 $PASSED, 失败 $ERRORS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "⚠️  有 $ERRORS 个测试失败！请检查 Nginx 配置和部署状态。"
  exit 1
else
  echo ""
  echo "✅ 所有生产环境路由测试通过！"
  exit 0
fi
