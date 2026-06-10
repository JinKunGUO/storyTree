#!/usr/bin/env node
/**
 * 移动端内联样式 Lint 检测脚本
 * 
 * 扫描 JS 文件中的内联 style 属性，检测可能导致移动端水平溢出的模式：
 * 1. 固定 width 值（width: Npx，不含 max-width 防护）
 * 2. display: flex 但缺少 flex-wrap
 * 3. min-width 使用固定像素值过大
 * 4. calc() 中可能产生负值的表达式
 * 
 * 用法：node scripts/lint-mobile-styles.js [目录路径]
 * 默认扫描 web/js/pages/
 */

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] || path.join(__dirname, '..', 'web', 'js', 'pages');

// 规则定义
const rules = [
  {
    id: 'fixed-width',
    description: '固定宽度内联样式（width: Npx）',
    severity: 'warning',
    test(styleContent, fullLine) {
      // 匹配 width: 数字px，但排除 max-width 和 min-width
      const match = styleContent.match(/(?<![a-z-])width\s*:\s*(\d+)px/i);
      if (!match) return null;
      const px = parseInt(match[1]);
      // 小于 50px 的一般是图标/按钮，不算风险
      if (px < 50) return null;
      // 如果同时有 max-width: 100% 则安全
      if (styleContent.includes('max-width') && styleContent.includes('100%')) return null;
      return `固定宽度 width: ${px}px，建议使用 max-width 或 flex 布局`;
    }
  },
  {
    id: 'flex-no-wrap',
    description: 'display: flex 缺少 flex-wrap',
    severity: 'warning',
    test(styleContent) {
      if (!styleContent.match(/display\s*:\s*flex/i)) return null;
      if (styleContent.includes('flex-wrap')) return null;
      // 如果是 flex-direction: column 则不需要 wrap
      if (styleContent.match(/flex-direction\s*:\s*column/i)) return null;
      return 'display: flex 缺少 flex-wrap: wrap';
    }
  },
  {
    id: 'large-min-width',
    description: 'min-width 过大（>= 150px）',
    severity: 'info',
    test(styleContent) {
      const match = styleContent.match(/min-width\s*:\s*(\d+)px/i);
      if (!match) return null;
      const px = parseInt(match[1]);
      if (px < 150) return null;
      return `min-width: ${px}px 可能在窄屏溢出`;
    }
  },
  {
    id: 'dangerous-calc',
    description: 'calc() 可能产生负值',
    severity: 'warning',
    test(styleContent) {
      const match = styleContent.match(/width\s*:\s*calc\(100%\s*-\s*(\d+)px\)/i);
      if (!match) return null;
      const subtract = parseInt(match[1]);
      // 如果同时有 min-width 防护则安全
      if (styleContent.includes('min-width')) return null;
      if (subtract > 100) {
        return `calc(100% - ${subtract}px) 在容器 < ${subtract}px 时产生负值，需加 min-width 防护`;
      }
      return null;
    }
  },
  {
    id: 'large-gap-no-wrap',
    description: '大 gap 值且无 flex-wrap',
    severity: 'info',
    test(styleContent) {
      if (!styleContent.match(/display\s*:\s*flex/i)) return null;
      if (styleContent.includes('flex-wrap')) return null;
      if (styleContent.match(/flex-direction\s*:\s*column/i)) return null;
      const match = styleContent.match(/gap\s*:\s*(\d+)px/i);
      if (!match) return null;
      const px = parseInt(match[1]);
      if (px >= 20) {
        return `gap: ${px}px 且无 flex-wrap，多子元素时可能溢出`;
      }
      return null;
    }
  }
];

// 扫描文件
function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  // 匹配 style="..." 或 style='...'
  const styleRegex = /style\s*=\s*["']([^"']+)["']/gi;

  lines.forEach((line, index) => {
    let match;
    styleRegex.lastIndex = 0;
    while ((match = styleRegex.exec(line)) !== null) {
      const styleContent = match[1];
      for (const rule of rules) {
        const result = rule.test(styleContent, line);
        if (result) {
          issues.push({
            file: filePath,
            line: index + 1,
            rule: rule.id,
            severity: rule.severity,
            message: result,
            snippet: styleContent.substring(0, 80) + (styleContent.length > 80 ? '...' : '')
          });
        }
      }
    }
  });

  return issues;
}

// 递归扫描目录
function scanDirectory(dir) {
  let allIssues = [];
  
  if (!fs.existsSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      allIssues = allIssues.concat(scanDirectory(fullPath));
    } else if (entry.name.endsWith('.js')) {
      allIssues = allIssues.concat(lintFile(fullPath));
    }
  }
  return allIssues;
}

// 主逻辑
console.log(`\n🔍 移动端内联样式 Lint 检测`);
console.log(`   扫描目录: ${targetDir}\n`);

const issues = scanDirectory(targetDir);

if (issues.length === 0) {
  console.log('✅ 未发现移动端溢出风险的内联样式\n');
  process.exit(0);
}

// 按严重度分组输出
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

if (warnings.length > 0) {
  console.log(`⚠️  警告 (${warnings.length} 个):\n`);
  warnings.forEach(issue => {
    const relPath = path.relative(process.cwd(), issue.file);
    console.log(`  ${relPath}:${issue.line}`);
    console.log(`    [${issue.rule}] ${issue.message}`);
    console.log(`    style="${issue.snippet}"`);
    console.log('');
  });
}

if (infos.length > 0) {
  console.log(`ℹ️  提示 (${infos.length} 个):\n`);
  infos.forEach(issue => {
    const relPath = path.relative(process.cwd(), issue.file);
    console.log(`  ${relPath}:${issue.line}`);
    console.log(`    [${issue.rule}] ${issue.message}`);
    console.log('');
  });
}

console.log(`\n总计: ${warnings.length} 警告, ${infos.length} 提示\n`);
process.exit(warnings.length > 0 ? 1 : 0);
