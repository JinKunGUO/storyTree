#!/bin/bash
# 环境一致性检查脚本
# 验证开发环境和生产环境的关键配置保持一致

set -e

ERRORS=0
WARNINGS=0

echo "============================================"
echo "  StoryTree 环境一致性检查"
echo "============================================"

# --- 1. Nginx 配置 ---
echo ""
echo "[1/5] 检查 Nginx 配置..."
if [ -f "scripts/nginx.conf" ]; then
    if grep -q 'try_files.*\$uri\.html' scripts/nginx.conf; then
        echo "  OK  Nginx try_files 包含 \$uri.html"
    else
        echo "  FAIL  Nginx 配置缺少 \$uri.html，/verify-email 等路径将无法正确路由"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  WARN  scripts/nginx.conf 不存在"
    WARNINGS=$((WARNINGS + 1))
fi

# --- 2. Express SPA fallback ---
echo ""
echo "[2/5] 检查 Express SPA fallback..."
# SPA fallback 逻辑在 app.ts 中（Phase 2 重构后从 index.ts 移出）
EXPRESS_SPA_FILE="api/src/app.ts"
if [ ! -f "$EXPRESS_SPA_FILE" ]; then
    EXPRESS_SPA_FILE="api/src/index.ts"
fi
if [ -f "$EXPRESS_SPA_FILE" ]; then
    if grep -q "verify-email" "$EXPRESS_SPA_FILE"; then
        echo "  OK  Express possiblePages 包含 verify-email"
    else
        echo "  FAIL  Express 缺少 verify-email 页面路由"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  FAIL  api/src/app.ts 和 api/src/index.ts 均不存在"
    ERRORS=$((ERRORS + 1))
fi

# --- 3. 密码验证逻辑一致性 ---
echo ""
echo "[3/5] 检查密码验证逻辑..."

# 后端：检查 isValidPassword 函数是否使用 [a-zA-Z] + [0-9] 模式
if [ -f "api/src/utils/auth.ts" ]; then
    if grep -q '\[a-zA-Z\]' api/src/utils/auth.ts && grep -q '\[0-9\]' api/src/utils/auth.ts; then
        echo "  OK  后端密码验证：字母+数字"
    else
        echo "  FAIL  后端密码验证逻辑不正确（应为字母+数字）"
        ERRORS=$((ERRORS + 1))
    fi

    # 检查不应存在单独的大小写检查
    if grep -q "\/\[A-Z\]\/" api/src/utils/auth.ts && grep -q "\/\[a-z\]\/" api/src/utils/auth.ts; then
        echo "  FAIL  后端仍要求大小写分别检查（应只需字母+数字）"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  FAIL  api/src/utils/auth.ts 不存在"
    ERRORS=$((ERRORS + 1))
fi

# 前端：检查 validatePassword 函数
if [ -f "web/auth.js" ]; then
    if grep -q '\[a-zA-Z\]' web/auth.js && grep -q '\[0-9\]' web/auth.js; then
        echo "  OK  前端密码验证：字母+数字"
    else
        echo "  FAIL  前端密码验证逻辑不正确（应为字母+数字）"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  FAIL  web/auth.js 不存在"
    ERRORS=$((ERRORS + 1))
fi

# --- 4. 邮箱验证流程 ---
echo ""
echo "[4/5] 检查邮箱验证流程..."

# 验证成功后应引导用户去登录页，而非自动登录
if [ -f "web/verify-email.html" ]; then
    if grep -q 'login\.html' web/verify-email.html; then
        echo "  OK  验证成功后引导用户前往登录页"
    else
        echo "  FAIL  验证成功后未引导用户前往登录页"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  FAIL  web/verify-email.html 不存在"
    ERRORS=$((ERRORS + 1))
fi

# 验证 API 不应返回 JWT token
if [ -f "api/src/routes/auth.ts" ]; then
    # 在 verify-email 端点区域内检查是否有 generateJWT 调用
    # 使用 sed 提取 verify-email 路由块，检查是否包含 generateJWT
    VERIFY_BLOCK=$(sed -n "/router.post.*verify-email/,/^router\./p" api/src/routes/auth.ts)
    if echo "$VERIFY_BLOCK" | grep -q "generateJWT"; then
        echo "  FAIL  verify-email 端点仍在生成 JWT token（应只做验证）"
        ERRORS=$((ERRORS + 1))
    else
        echo "  OK  verify-email 端点不返回 JWT token"
    fi
else
    echo "  FAIL  api/src/routes/auth.ts 不存在"
    ERRORS=$((ERRORS + 1))
fi

# --- 5. 环境变量 ---
echo ""
echo "[5/5] 检查环境变量配置..."
if [ -f "api/.env.example" ]; then
    if grep -q "FRONTEND_URL" api/.env.example; then
        echo "  OK  .env.example 包含 FRONTEND_URL"
    else
        echo "  WARN  .env.example 缺少 FRONTEND_URL"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  WARN  api/.env.example 不存在"
    WARNINGS=$((WARNINGS + 1))
fi

# --- 结果汇总 ---
echo ""
echo "============================================"
if [ $ERRORS -eq 0 ]; then
    echo "  结果: 通过 (警告: $WARNINGS)"
    echo "============================================"
    exit 0
else
    echo "  结果: 失败 (错误: $ERRORS, 警告: $WARNINGS)"
    echo "============================================"
    exit 1
fi
