#!/bin/bash
# =============================================================================
# 暗黑模式兼容性检测脚本
# 扫描 web/ 目录下所有 JS/HTML/CSS 文件中的硬编码颜色值
# 用法: bash scripts/check-dark-mode.sh [--verbose] [--fix-suggestions]
# =============================================================================

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
WEB_DIR="$REPO_ROOT/web"
VERBOSE=false
SUGGESTIONS=false

for arg in "$@"; do
  case $arg in
    --verbose) VERBOSE=true ;;
    --fix-suggestions) SUGGESTIONS=true ;;
  esac
done

# 颜色输出
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "=============================================="
echo "  暗黑模式兼容性检查"
echo "=============================================="
echo ""

# --- P0: JS 内联样式中的白色背景 ---
echo -e "${RED}[P0-严重] JS 内联样式中的硬编码白色背景:${NC}"
P0_BG=$(grep -rn -E "(style\.cssText|style=|innerHTML).*background:\s*(white|#fff|#ffffff)" "$WEB_DIR" --include="*.js" | grep -v "node_modules" | grep -v "\.min\." || true)
P0_BG_COUNT=$(echo "$P0_BG" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P0_BG" ]; then
  echo "$P0_BG" | head -30
fi
echo -e "  发现: ${RED}${P0_BG_COUNT} 处${NC}"
echo ""

# --- P0: JS 内联样式中的硬编码深色文字 ---
echo -e "${RED}[P0-严重] JS 内联样式中的硬编码深色文字:${NC}"
P0_TXT=$(grep -rn -E "(style\.cssText|style=|innerHTML).*color:\s*#(111|222|333|444|555|666|111827|1f2937|4[bB]5563)" "$WEB_DIR" --include="*.js" | grep -v "node_modules" | grep -v "\.min\." || true)
P0_TXT_COUNT=$(echo "$P0_TXT" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P0_TXT" ]; then
  echo "$P0_TXT" | head -30
fi
echo -e "  发现: ${RED}${P0_TXT_COUNT} 处${NC}"
echo ""

# --- P1: HTML <style> 块中的硬编码颜色 ---
echo -e "${YELLOW}[P1-中等] HTML/CSS 中的硬编码白色背景:${NC}"
P1_BG=$(grep -rn -E "background(-color)?:\s*(white|#fff|#ffffff)" "$WEB_DIR" --include="*.html" --include="*.css" | grep -v "node_modules" | grep -v "\.min\." | grep -v "design-system" || true)
P1_BG_COUNT=$(echo "$P1_BG" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P1_BG" ]; then
  echo "$P1_BG" | head -30
fi
echo -e "  发现: ${YELLOW}${P1_BG_COUNT} 处${NC}"
echo ""

echo -e "${YELLOW}[P1-中等] HTML/CSS 中的硬编码深色文字:${NC}"
P1_TXT=$(grep -rn -E "color:\s*#(111|222|333|444|555|666|111827|1f2937|4[bB]5563)" "$WEB_DIR" --include="*.html" --include="*.css" | grep -v "node_modules" | grep -v "\.min\." | grep -v "design-system" || true)
P1_TXT_COUNT=$(echo "$P1_TXT" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P1_TXT" ]; then
  echo "$P1_TXT" | head -30
fi
echo -e "  发现: ${YELLOW}${P1_TXT_COUNT} 处${NC}"
echo ""

# --- P1: 硬编码的浅色背景 (亮模式下的灰色背景，暗模式下可能太亮) ---
echo -e "${YELLOW}[P1-中等] 硬编码浅灰色背景 (#f0-#f9):${NC}"
P1_GRAY=$(grep -rn -E "background(-color)?:\s*#f[0-9a-fA-F]{5}" "$WEB_DIR" --include="*.js" --include="*.html" --include="*.css" | grep -v "node_modules" | grep -v "\.min\." | grep -v "design-system" || true)
P1_GRAY_COUNT=$(echo "$P1_GRAY" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P1_GRAY" ]; then
  echo "$P1_GRAY" | head -20
fi
echo -e "  发现: ${YELLOW}${P1_GRAY_COUNT} 处${NC}"
echo ""

# --- P2: 硬编码边框颜色 ---
echo -e "${CYAN}[P2-低] 硬编码边框颜色 (#ccc/#ddd/#eee):${NC}"
P2_BORDER=$(grep -rn -E "border.*:\s*.*#(ccc|ddd|eee|e[0-9a-f]{4})" "$WEB_DIR" --include="*.js" --include="*.html" --include="*.css" | grep -v "node_modules" | grep -v "\.min\." | grep -v "design-system" || true)
P2_BORDER_COUNT=$(echo "$P2_BORDER" | grep -c "." 2>/dev/null || echo "0")
if [ "$VERBOSE" = true ] && [ -n "$P2_BORDER" ]; then
  echo "$P2_BORDER" | head -20
fi
echo -e "  发现: ${CYAN}${P2_BORDER_COUNT} 处${NC}"
echo ""

# --- 汇总 ---
TOTAL=$((P0_BG_COUNT + P0_TXT_COUNT + P1_BG_COUNT + P1_TXT_COUNT + P1_GRAY_COUNT + P2_BORDER_COUNT))

echo "=============================================="
echo -e "  总计: ${RED}${TOTAL} 处${NC} 潜在暗黑模式不兼容代码"
echo "=============================================="
echo ""

# --- 按文件统计 ---
echo "按文件统计 (Top 15):"
echo "----------------------------------------------"
{
  grep -rn -E "background(-color)?:\s*(white|#fff|#ffffff)|color:\s*#(111|222|333|444|555|666|111827)" "$WEB_DIR" --include="*.js" --include="*.html" --include="*.css" 2>/dev/null || true
} | grep -v "node_modules" | grep -v "\.min\." | grep -v "design-system" | cut -d: -f1 | sort | uniq -c | sort -rn | head -15
echo ""

# --- 修复建议 ---
if [ "$SUGGESTIONS" = true ]; then
  echo "=============================================="
  echo "  修复建议"
  echo "=============================================="
  echo ""
  echo "CSS 变量替换对照表:"
  echo "  background: white       → var(--st-bg-primary)"
  echo "  background: #f8f9fa     → var(--st-gray-50)"
  echo "  background: #f1f3f5     → var(--st-gray-100)"
  echo "  color: #333 / #111827   → var(--st-text-primary)"
  echo "  color: #666 / #4B5563   → var(--st-text-secondary)"
  echo "  color: #999 / #9ca3af   → var(--st-text-disabled)"
  echo "  border-color: #eee      → var(--st-gray-200)"
  echo "  border-color: #ddd      → var(--st-gray-300)"
  echo ""
  echo "JS 内联样式修复策略:"
  echo "  1. 优先: 将 style=\"...\" 改为 class=\"st-surface\" 等预定义类"
  echo "  2. 次选: 使用 window.matchMedia('(prefers-color-scheme: dark)').matches 检测"
  echo "  3. 兜底: 在同文件的 injectStyles() 中添加 @media 覆盖"
  echo ""
fi

# 退出码: 有 P0 问题时返回 1（可用于 CI）
if [ "$P0_BG_COUNT" -gt 0 ] || [ "$P0_TXT_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
