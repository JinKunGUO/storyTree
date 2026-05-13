import { vi } from 'vitest'

// Set required env vars before any module loads
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'file:./test.db'
process.env.DISABLE_EMAIL = 'true'

// Mock src/index — prevent server startup side effects when modules import { prisma } from '../index'
vi.mock('../src/index', () => {
  // Re-export the mocked prisma from the db mock without loading the real index.ts
  // which starts Express, workers, WebSocket, etc.
  return {
    prisma: vi.fn(), // placeholder; the real mock comes from ../src/db below
  }
})

// Mock Prisma Client — prevent real DB connections
vi.mock('../src/db', () => {
  const prisma = {
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    stories: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    nodes: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comments: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    story_collaborators: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    story_followers: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    follows: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    invitation_codes: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invitation_records: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    notifications: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    point_transactions: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    login_logs: {
      create: vi.fn(),
    },
    ai_tasks: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    bookmarks: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    checkins: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    shares: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    memberships: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(prisma)
      }
      return Promise.resolve(fn)
    }),
  }
  return { prisma }
})