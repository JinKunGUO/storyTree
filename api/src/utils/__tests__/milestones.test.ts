import { describe, it, expect, vi } from 'vitest';
import {
  WORD_MILESTONES,
  WORD_REWARD_RATE,
  MAKEUP_CHANCE_RATE,
  getAllBadges,
  getBadgeById,
  getNextMilestone,
} from '../milestones';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('Constants', () => {
  it('WORD_REWARD_RATE === 10', () => {
    expect(WORD_REWARD_RATE).toBe(10);
  });

  it('MAKEUP_CHANCE_RATE === 1', () => {
    expect(MAKEUP_CHANCE_RATE).toBe(1);
  });

  it('WORD_MILESTONES has 7 entries', () => {
    expect(WORD_MILESTONES).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// getAllBadges
// ---------------------------------------------------------------------------
describe('getAllBadges', () => {
  it('returns 7 badges', () => {
    const badges = getAllBadges();
    expect(badges).toHaveLength(7);
  });

  it('each badge has id, name, emoji, and description', () => {
    const badges = getAllBadges();
    for (const badge of badges) {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('emoji');
      expect(badge).toHaveProperty('description');
    }
  });
});

// ---------------------------------------------------------------------------
// getBadgeById
// ---------------------------------------------------------------------------
describe('getBadgeById', () => {
  it('returns the "rookie" badge', () => {
    const badge = getBadgeById('rookie');
    expect(badge).toBeDefined();
    expect(badge!.name).toBe('初出茅庐');
  });

  it('returns the "legend" badge', () => {
    const badge = getBadgeById('legend');
    expect(badge).toBeDefined();
    expect(badge!.name).toBe('殿堂作者');
  });

  it('returns undefined for nonexistent id', () => {
    const badge = getBadgeById('nonexistent');
    expect(badge).toBeUndefined();
  });

  it('returns correct badge for "master"', () => {
    const badge = getBadgeById('master');
    expect(badge).toBeDefined();
    expect(badge!.name).toBe('大神作者');
  });
});

// ---------------------------------------------------------------------------
// getNextMilestone
// ---------------------------------------------------------------------------
describe('getNextMilestone', () => {
  it('0 words -> 10000 milestone', () => {
    const milestone = getNextMilestone(0);
    expect(milestone).not.toBeNull();
    expect(milestone!.words).toBe(10000);
  });

  it('9999 words -> 10000 milestone', () => {
    const milestone = getNextMilestone(9999);
    expect(milestone).not.toBeNull();
    expect(milestone!.words).toBe(10000);
  });

  it('10000 words -> 50000 milestone', () => {
    const milestone = getNextMilestone(10000);
    expect(milestone).not.toBeNull();
    expect(milestone!.words).toBe(50000);
  });

  it('2000000 words -> null (all milestones reached)', () => {
    const milestone = getNextMilestone(2000000);
    expect(milestone).toBeNull();
  });

  it('5000000 words -> null', () => {
    const milestone = getNextMilestone(5000000);
    expect(milestone).toBeNull();
  });

  it('49999 words -> 50000 milestone', () => {
    const milestone = getNextMilestone(49999);
    expect(milestone).not.toBeNull();
    expect(milestone!.words).toBe(50000);
  });

  it('returns milestone with reward and badge', () => {
    const milestone = getNextMilestone(0);
    expect(milestone!.reward).toBe(50);
    expect(milestone!.badge.id).toBe('rookie');
  });
});