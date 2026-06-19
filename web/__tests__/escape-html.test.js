/**
 * XSS 防护 - escapeHtml 函数测试
 *
 * 测试覆盖：
 * 1. 基本 HTML 实体转义
 * 2. 空值/边界处理
 * 3. 常见 XSS 攻击向量防御
 * 4. 性能 - 大文本不崩溃
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// 加载 escapeHtml 函数 - 通过 vm 在沙箱中执行
const code = fs.readFileSync(path.join(__dirname, '../js/utils/escape.js'), 'utf-8');
const sandbox = {};
vm.runInNewContext(code, sandbox);
const escapeHtml = sandbox.escapeHtml;

// ===========================================================================
// 基本 HTML 实体转义
// ===========================================================================
describe('基本 HTML 实体转义', () => {
  it('转义 & 符号', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('转义 < 符号', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('转义 > 符号', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('转义双引号', () => {
    expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('转义单引号', () => {
    expect(escapeHtml("a 'b' c")).toBe('a &#039;b&#039; c');
  });

  it('同时转义多种字符', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });
});

// ===========================================================================
// 空值/边界处理
// ===========================================================================
describe('空值/边界处理', () => {
  it('null 返回空字符串', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('undefined 返回空字符串', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('空字符串返回空字符串', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('数字被转为字符串', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('不含特殊字符的文本原样返回', () => {
    expect(escapeHtml('Hello World 你好')).toBe('Hello World 你好');
  });
});

// ===========================================================================
// 常见 XSS 攻击向量防御
// ===========================================================================
describe('XSS 攻击向量防御', () => {
  it('防御 script 标签注入', () => {
    const input = '<script>document.cookie</script>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('防御 img onerror 注入', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('防御事件处理器注入', () => {
    const input = '" onmouseover="alert(1)"';
    const result = escapeHtml(input);
    expect(result).not.toContain('" onmouseover');
    expect(result).toContain('&quot;');
  });

  it('防御 javascript: 协议（在属性上下文中）', () => {
    const input = 'javascript:alert(1)';
    // escapeHtml 不处理 javascript: 协议本身，但在 href 属性中使用时
    // 应该通过其他方式（如 URL 白名单）防御
    // 这里验证基本字符转义不会破坏
    const result = escapeHtml(input);
    expect(result).toBe('javascript:alert(1)'); // 无需转义
  });

  it('防御 SVG/MathML 注入', () => {
    const input = '<svg onload=alert(1)>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<svg');
  });

  it('防御 HTML 实体编码绕过', () => {
    const input = '&lt;script&gt;';
    const result = escapeHtml(input);
    // 已经编码的 & 应该被再次转义
    expect(result).toBe('&amp;lt;script&amp;gt;');
  });
});

// ===========================================================================
// 大文本处理
// ===========================================================================
describe('大文本处理', () => {
  it('处理大文本不崩溃（10KB）', () => {
    const largeText = '<div class="test">' + 'a'.repeat(10000) + '</div>';
    const result = escapeHtml(largeText);
    expect(result).toContain('&lt;div');
    expect(result.length).toBeGreaterThan(10000);
  });
});
