import { describe, it, expect, vi } from 'vitest';
import {
  LEVEL_CONFIG,
  POINT_RULES,
  AI_COST,
  getUserLevel,
} from '../points';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('Constants', () => {
  it('LEVEL_CONFIG has 4 keys', () => {
    expect(Object.keys(LEVEL_CONFIG)).toHaveLength(4);
  });

  it('LEVEL_CONFIG keys are 1, 2, 3, 4', () => {
    expect(Object.keys(LEVEL_CONFIG).map(Number).sort()).toEqual([1, 2, 3, 4]);
  });

  it('POINT_RULES.PUBLISH_STORY.points === 20', () => {
    expect(POINT_RULES.PUBLISH_STORY.points).toBe(20);
  });

  it('AI_COST.CONTINUATION === 10', () => {
    expect(AI_COST.CONTINUATION).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getUserLevel
// ---------------------------------------------------------------------------
describe('getUserLevel', () => {
  it('0 points -> level 1', () => {
    const result = getUserLevel(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe('新手作者');
  });

  it('0 points -> progress 0', () => {
    const result = getUserLevel(0);
    expect(result.progress).toBe(0);
  });

  it('99 points -> level 1 (upper boundary)', () => {
    const result = getUserLevel(99);
    expect(result.level).toBe(1);
  });

  it('100 points -> level 2', () => {
    const result = getUserLevel(100);
    expect(result.level).toBe(2);
    expect(result.name).toBe('活跃作者');
  });

  it('100 points -> progress 0', () => {
    const result = getUserLevel(100);
    expect(result.progress).toBe(0);
  });

  it('499 points -> level 2 (upper boundary)', () => {
    const result = getUserLevel(499);
    expect(result.level).toBe(2);
  });

  it('500 points -> level 3', () => {
    const result = getUserLevel(500);
    expect(result.level).toBe(3);
    expect(result.name).toBe('专业作者');
  });

  it('1999 points -> level 3 (upper boundary)', () => {
    const result = getUserLevel(1999);
    expect(result.level).toBe(3);
  });

  it('2000 points -> level 4, progress 100 (max level)', () => {
    const result = getUserLevel(2000);
    expect(result.level).toBe(4);
    expect(result.name).toBe('大师作者');
    expect(result.progress).toBe(100);
  });

  it('999999 points -> level 4', () => {
    const result = getUserLevel(999999);
    expect(result.level).toBe(4);
  });

  it('calculates nextLevelPoints correctly at level 1', () => {
    const result = getUserLevel(50);
    // next level (2) starts at 100, so 100 - 50 = 50
    expect(result.nextLevelPoints).toBe(50);
  });

  it('calculates progress correctly within level 1', () => {
    // range = 99 - 0 + 1 = 100, progress = (49 / 100) * 100 = 49
    const result = getUserLevel(49);
    expect(result.progress).toBe(49);
  });

  it('returns progress 100 at max level with no nextLevelPoints needed', () => {
    const result = getUserLevel(5000);
    expect(result.progress).toBe(100);
    expect(result.nextLevelPoints).toBe(0);
  });

  it('includes quotas for each level', () => {
    const result = getUserLevel(0);
    expect(result.quotas).toBeDefined();
    expect(result.quotas.continuation).toBe(5);
    expect(result.quotas.polish).toBe(10);
    expect(result.quotas.illustration).toBe(2);
  });
});