import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canViewStory } from '../permissions';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

// The global setup.ts mocks ../src/index with { prisma: vi.fn() } — just a placeholder
// function with no .stories/.users etc. Source modules (like permissions.ts) import
// { prisma } from '../index', so we override that mock here to re-export the real
// prisma mock from ../db which has the full set of model methods.
vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

// ---------------------------------------------------------------------------
// canViewStory
// ---------------------------------------------------------------------------
describe('canViewStory', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  /** Shorthand: make prisma.stories.findUnique return a story with given visibility & author */
  function mockStory(visibility: string, author_id: number) {
    mockPrisma.stories.findUnique.mockResolvedValue({ visibility, author_id });
  }

  // -------------------------------------------------------------------------
  // Story not found
  // -------------------------------------------------------------------------
  it('returns false when story is not found', async () => {
    mockPrisma.stories.findUnique.mockResolvedValue(null);
    expect(await canViewStory(1, 999)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // visibility: author_only
  // -------------------------------------------------------------------------
  describe('visibility: author_only', () => {
    it('returns false for null userId (unauthenticated)', async () => {
      mockStory('author_only', 1);
      expect(await canViewStory(null, 1)).toBe(false);
    });

    it('returns true for the author (author always sees own story)', async () => {
      mockStory('author_only', 1);
      expect(await canViewStory(1, 1)).toBe(true);
    });

    it('returns false for a collaborator', async () => {
      mockStory('author_only', 1);
      // Even if collaborator row exists, author_only blocks them
      mockPrisma.story_collaborators.findFirst.mockResolvedValue({ id: 10 });
      expect(await canViewStory(2, 1)).toBe(false);
    });

    it('returns false for any other user', async () => {
      mockStory('author_only', 1);
      expect(await canViewStory(2, 1)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // visibility: collaborators
  // -------------------------------------------------------------------------
  describe('visibility: collaborators', () => {
    it('returns false for null userId (unauthenticated)', async () => {
      mockStory('collaborators', 1);
      expect(await canViewStory(null, 1)).toBe(false);
    });

    it('returns true for the author', async () => {
      mockStory('collaborators', 1);
      expect(await canViewStory(1, 1)).toBe(true);
    });

    it('returns true for a collaborator', async () => {
      mockStory('collaborators', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue({ id: 10 });
      expect(await canViewStory(2, 1)).toBe(true);
    });

    it('returns false for a story follower (not a collaborator)', async () => {
      mockStory('collaborators', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue(null);
      // Story follower is irrelevant for collaborators-only visibility
      expect(await canViewStory(2, 1)).toBe(false);
    });

    it('returns false for an unrelated user', async () => {
      mockStory('collaborators', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue(null);
      expect(await canViewStory(2, 1)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // visibility: followers
  // -------------------------------------------------------------------------
  describe('visibility: followers', () => {
    it('returns false for null userId (unauthenticated)', async () => {
      mockStory('followers', 1);
      expect(await canViewStory(null, 1)).toBe(false);
    });

    it('returns true for the author', async () => {
      mockStory('followers', 1);
      expect(await canViewStory(1, 1)).toBe(true);
    });

    it('returns true for a collaborator', async () => {
      mockStory('followers', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue({ id: 10 });
      expect(await canViewStory(2, 1)).toBe(true);
    });

    it('returns true for a story follower', async () => {
      mockStory('followers', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue(null);
      mockPrisma.story_followers.findUnique.mockResolvedValue({ story_id: 1, user_id: 2 });
      expect(await canViewStory(2, 1)).toBe(true);
    });

    it('returns true for an author follower', async () => {
      mockStory('followers', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue(null);
      mockPrisma.story_followers.findUnique.mockResolvedValue(null);
      // isFollowingAuthor calls stories.findUnique again (returns same mock)
      // then calls follows.findUnique
      mockPrisma.follows.findUnique.mockResolvedValue({ follower_id: 2, following_id: 1 });
      expect(await canViewStory(2, 1)).toBe(true);
    });

    it('returns false for an unrelated user', async () => {
      mockStory('followers', 1);
      mockPrisma.story_collaborators.findFirst.mockResolvedValue(null);
      mockPrisma.story_followers.findUnique.mockResolvedValue(null);
      mockPrisma.follows.findUnique.mockResolvedValue(null);
      expect(await canViewStory(2, 1)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // visibility: public
  // -------------------------------------------------------------------------
  describe('visibility: public', () => {
    it('returns true for null userId (unauthenticated)', async () => {
      mockStory('public', 1);
      expect(await canViewStory(null, 1)).toBe(true);
    });

    it('returns true for the author', async () => {
      mockStory('public', 1);
      expect(await canViewStory(1, 1)).toBe(true);
    });

    it('returns true for any other user', async () => {
      mockStory('public', 1);
      expect(await canViewStory(99, 1)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown visibility value — treated as public (backward-compatible default)
  // -------------------------------------------------------------------------
  describe('unknown visibility value', () => {
    it('returns true (treated as public)', async () => {
      mockStory('some_future_value', 1);
      expect(await canViewStory(null, 1)).toBe(true);
    });

    it('returns true for any user', async () => {
      mockStory('random_visibility', 1);
      expect(await canViewStory(5, 1)).toBe(true);
    });
  });
});