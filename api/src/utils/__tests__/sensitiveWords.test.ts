import { describe, it, expect, vi } from 'vitest';
import {
  sensitiveWordCategories,
  scanSensitiveWords,
  maskSensitiveWords,
  needsReview,
} from '../sensitiveWords';

// ---------------------------------------------------------------------------
// scanSensitiveWords
// ---------------------------------------------------------------------------
describe('scanSensitiveWords', () => {
  it('returns not found for empty string', () => {
    const result = scanSensitiveWords('');
    expect(result.found).toBe(false);
    expect(result.words).toEqual([]);
    expect(result.category).toBeUndefined();
  });

  it('returns not found for clean text', () => {
    const result = scanSensitiveWords('今天天气真好，适合写作。');
    expect(result.found).toBe(false);
    expect(result.words).toEqual([]);
  });

  it('detects illegal category word "毒品"', () => {
    const result = scanSensitiveWords('不要碰毒品');
    expect(result.found).toBe(true);
    expect(result.words).toContain('毒品');
    expect(result.category).toBe('illegal');
  });

  it('detects porn category word "色情"', () => {
    const result = scanSensitiveWords('禁止色情内容');
    expect(result.found).toBe(true);
    expect(result.words).toContain('色情');
    expect(result.category).toBe('porn');
  });

  it('detects violence category word "杀人"', () => {
    const result = scanSensitiveWords('故事中的杀人情节');
    expect(result.found).toBe(true);
    expect(result.words).toContain('杀人');
    expect(result.category).toBe('violence');
  });

  it('detects spam category word "加微信"', () => {
    const result = scanSensitiveWords('快来加微信领奖');
    expect(result.found).toBe(true);
    expect(result.words).toContain('加微信');
    expect(result.category).toBe('spam');
  });

  it('returns first category when multiple categories match', () => {
    const result = scanSensitiveWords('毒品和色情都有');
    expect(result.found).toBe(true);
    expect(result.words.length).toBeGreaterThanOrEqual(2);
    // illegal is the first category in iteration order
    expect(result.category).toBe('illegal');
  });

  it('finds all matching words from a single category', () => {
    const result = scanSensitiveWords('赌博和毒品都是违法的');
    expect(result.found).toBe(true);
    expect(result.words).toContain('赌博');
    expect(result.words).toContain('毒品');
  });
});

// ---------------------------------------------------------------------------
// maskSensitiveWords
// ---------------------------------------------------------------------------
describe('maskSensitiveWords', () => {
  it('returns clean text unchanged', () => {
    const text = '这是一段正常文字';
    expect(maskSensitiveWords(text)).toBe(text);
  });

  it('replaces "毒品" with "**"', () => {
    expect(maskSensitiveWords('毒品')).toBe('**');
  });

  it('replaces multiple occurrences of the same word', () => {
    const result = maskSensitiveWords('毒品和毒品');
    expect(result).toBe('**和**');
  });

  it('replaces word correctly when embedded in context', () => {
    const result = maskSensitiveWords('不要接触毒品，毒品有害');
    expect(result).toBe('不要接触**，**有害');
  });

  it('replaces words of different lengths with matching asterisks', () => {
    const result = maskSensitiveWords('加微信');
    expect(result).toBe('***');
  });
});

// ---------------------------------------------------------------------------
// needsReview
// ---------------------------------------------------------------------------
describe('needsReview', () => {
  it('always requires review when nodeCount < 3', () => {
    const result = needsReview('正常内容', 0);
    expect(result.needReview).toBe(true);
    expect(result.reason).toContain('新用户');
  });

  it('requires review when nodeCount is 2', () => {
    const result = needsReview('正常内容', 2);
    expect(result.needReview).toBe(true);
  });

  it('does not require review when nodeCount >= 3 and text is clean', () => {
    const result = needsReview('正常内容', 3);
    expect(result.needReview).toBe(false);
    expect(result.reason).toBe('');
  });

  it('requires review when nodeCount >= 3 but text contains sensitive word', () => {
    const result = needsReview('这是毒品内容', 5);
    expect(result.needReview).toBe(true);
    expect(result.reason).toContain('敏感词');
  });

  it('large nodeCount with clean text does not need review', () => {
    const result = needsReview('美好的一天', 100);
    expect(result.needReview).toBe(false);
  });
});