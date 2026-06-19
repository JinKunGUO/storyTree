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

// ---------------------------------------------------------------------------
// DFA 变体检测（噪声字符跳过）
// ---------------------------------------------------------------------------
describe('DFA variant detection', () => {
  it('detects words with spaces in between', () => {
    const result = scanSensitiveWords('毒 品');
    expect(result.found).toBe(true);
    expect(result.words).toContain('毒品');
  });

  it('detects words with special chars in between', () => {
    const result = scanSensitiveWords('毒·品');
    expect(result.found).toBe(true);
    expect(result.words).toContain('毒品');
  });

  it('detects words with multiple noise chars', () => {
    const result = scanSensitiveWords('赌---博');
    expect(result.found).toBe(true);
    expect(result.words).toContain('赌博');
  });

  it('does not false-positive on unrelated chars', () => {
    const result = scanSensitiveWords('独立的品味');
    expect(result.found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------
describe('severity classification', () => {
  it('returns "high" for illegal category', () => {
    const result = scanSensitiveWords('贩毒走私');
    expect(result.severity).toBe('high');
  });

  it('returns "high" for porn category', () => {
    const result = scanSensitiveWords('色情内容');
    expect(result.severity).toBe('high');
  });

  it('returns "high" for political category', () => {
    const result = scanSensitiveWords('颠覆政权');
    expect(result.severity).toBe('high');
  });

  it('returns "medium" for violence category', () => {
    const result = scanSensitiveWords('血腥暴力');
    expect(result.severity).toBe('medium');
  });

  it('returns "low" for spam category', () => {
    const result = scanSensitiveWords('加微信领奖');
    expect(result.severity).toBe('low');
  });

  it('returns "none" for clean text', () => {
    const result = scanSensitiveWords('美好的一天');
    expect(result.severity).toBe('none');
  });

  it('returns highest severity when multiple categories match', () => {
    // illegal (high) + spam (low) → high
    const result = scanSensitiveWords('毒品加微信');
    expect(result.severity).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// autoReject logic
// ---------------------------------------------------------------------------
describe('autoReject', () => {
  it('returns autoReject=true when severity=high and words >= 3', () => {
    const result = needsReview('毒品冰毒海洛因', 10);
    expect(result.autoReject).toBe(true);
    expect(result.severity).toBe('high');
  });

  it('returns autoReject=false when severity=high but words < 3', () => {
    const result = needsReview('毒品内容', 10);
    expect(result.autoReject).toBe(false);
  });

  it('returns autoReject=false for medium severity', () => {
    const result = needsReview('杀人分尸碎尸', 10);
    expect(result.autoReject).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('returns autoReject=false for clean text', () => {
    const result = needsReview('正常内容', 10);
    expect(result.autoReject).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Member bypass (P3)
// ---------------------------------------------------------------------------
describe('member bypass', () => {
  it('annual member with nodeCount >= 1 skips new user check', () => {
    const result = needsReview('正常内容', 1, { isMember: true, memberTier: 'annual' });
    expect(result.needReview).toBe(false);
  });

  it('enterprise member with nodeCount >= 1 skips new user check', () => {
    const result = needsReview('正常内容', 1, { isMember: true, memberTier: 'enterprise' });
    expect(result.needReview).toBe(false);
  });

  it('monthly member does NOT skip new user check', () => {
    const result = needsReview('正常内容', 1, { isMember: true, memberTier: 'monthly' });
    expect(result.needReview).toBe(true);
    expect(result.reason).toContain('新用户');
  });

  it('non-member with nodeCount=0 still requires review', () => {
    const result = needsReview('正常内容', 0);
    expect(result.needReview).toBe(true);
  });

  it('annual member still flagged for sensitive content', () => {
    const result = needsReview('毒品交易', 10, { isMember: true, memberTier: 'annual' });
    expect(result.needReview).toBe(true);
    expect(result.reason).toContain('敏感词');
  });

  it('member bypass does not apply when nodeCount=0', () => {
    const result = needsReview('正常内容', 0, { isMember: true, memberTier: 'annual' });
    expect(result.needReview).toBe(true);
    expect(result.reason).toContain('新用户');
  });
});