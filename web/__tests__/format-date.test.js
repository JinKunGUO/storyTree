/**
 * 日期格式化 (formatDate) 工具函数测试
 *
 * 测试覆盖：
 * 1. 相对时间计算 - 刚刚/分钟/小时/天/周/月
 * 2. 边界值处理 - null/undefined/无效日期
 * 3. 未来时间处理
 * 4. 长时间间隔 - 超过一年
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// 加载 formatDate 函数
const code = fs.readFileSync(path.join(__dirname, '../js/utils/format-date.js'), 'utf-8');
const sandbox = { Date: Date, Math, isNaN, NaN };
vm.runInNewContext(code, sandbox);
const formatDate = sandbox.formatDate;

// ===========================================================================
// 空值/无效输入处理
// ===========================================================================
describe('空值/无效输入处理', () => {
  it('null 返回 "未知时间"', () => {
    expect(formatDate(null)).toBe('未知时间');
  });

  it('undefined 返回 "未知时间"', () => {
    expect(formatDate(undefined)).toBe('未知时间');
  });

  it('空字符串返回 "未知时间"', () => {
    expect(formatDate('')).toBe('未知时间');
  });

  it('无效日期字符串返回 "未知时间"', () => {
    expect(formatDate('not-a-date')).toBe('未知时间');
    expect(formatDate('abc123')).toBe('未知时间');
  });
});

// ===========================================================================
// 相对时间计算
// ===========================================================================
describe('相对时间计算', () => {
  // 使用固定时间进行测试
  let realDate;

  beforeEach(() => {
    realDate = global.Date;
    // 固定当前时间为 2024-06-15 12:00:00 UTC
    const fixedNow = new Date('2024-06-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    // 更新 sandbox 中的 Date
    sandbox.Date = global.Date;
  });

  afterEach(() => {
    vi.useRealTimers();
    sandbox.Date = realDate;
  });

  it('30秒前返回 "刚刚"', () => {
    const date = new Date('2024-06-15T11:59:30Z').toISOString();
    expect(formatDate(date)).toBe('刚刚');
  });

  it('5分钟前返回 "5分钟前"', () => {
    const date = new Date('2024-06-15T11:55:00Z').toISOString();
    expect(formatDate(date)).toBe('5分钟前');
  });

  it('59分钟前返回 "59分钟前"', () => {
    const date = new Date('2024-06-15T11:01:00Z').toISOString();
    expect(formatDate(date)).toBe('59分钟前');
  });

  it('2小时前返回 "2小时前"', () => {
    const date = new Date('2024-06-15T10:00:00Z').toISOString();
    expect(formatDate(date)).toBe('2小时前');
  });

  it('23小时前返回 "23小时前"', () => {
    const date = new Date('2024-06-14T13:00:00Z').toISOString();
    expect(formatDate(date)).toBe('23小时前');
  });

  it('1天前返回 "昨天"', () => {
    const date = new Date('2024-06-14T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('昨天');
  });

  it('3天前返回 "3天前"', () => {
    const date = new Date('2024-06-12T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('3天前');
  });

  it('6天前返回 "6天前"', () => {
    const date = new Date('2024-06-09T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('6天前');
  });

  it('10天前返回 "1周前"', () => {
    const date = new Date('2024-06-05T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('1周前');
  });

  it('25天前返回 "3周前"', () => {
    const date = new Date('2024-05-21T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('3周前');
  });

  it('60天前返回 "2个月前"', () => {
    const date = new Date('2024-04-16T12:00:00Z').toISOString();
    expect(formatDate(date)).toBe('2个月前');
  });

  it('超过365天返回完整日期', () => {
    const date = new Date('2023-01-01T12:00:00Z').toISOString();
    const result = formatDate(date);
    // 应该返回本地化日期格式
    expect(result).toContain('2023');
  });
});

// ===========================================================================
// 未来时间处理
// ===========================================================================
describe('未来时间处理', () => {
  beforeEach(() => {
    const fixedNow = new Date('2024-06-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    sandbox.Date = global.Date;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('未来时间返回完整日期', () => {
    const futureDate = new Date('2025-01-01T00:00:00Z').toISOString();
    const result = formatDate(futureDate);
    expect(result).toContain('2025');
  });
});
