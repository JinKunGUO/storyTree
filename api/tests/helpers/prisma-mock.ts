import { prisma } from '../../src/db'

export const mockPrisma = prisma as unknown as {
  users: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findFirst: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn>; count: ReturnType<typeof import('vitest').vi.fn> }
  stories: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn>; count: ReturnType<typeof import('vitest').vi.fn> }
  nodes: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn>; count: ReturnType<typeof import('vitest').vi.fn> }
  story_collaborators: { findFirst: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn> }
  story_followers: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn> }
  follows: { findUnique: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn> }
  invitation_codes: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn> }
  invitation_records: { create: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn> }
  notifications: { create: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn>; count: ReturnType<typeof import('vitest').vi.fn> }
  point_transactions: { create: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; aggregate: ReturnType<typeof import('vitest').vi.fn> }
  login_logs: { create: ReturnType<typeof import('vitest').vi.fn> }
  ai_tasks: { create: ReturnType<typeof import('vitest').vi.fn>; findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; update: ReturnType<typeof import('vitest').vi.fn>; groupBy: ReturnType<typeof import('vitest').vi.fn> }
  bookmarks: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; delete: ReturnType<typeof import('vitest').vi.fn> }
  checkins: { findUnique: ReturnType<typeof import('vitest').vi.fn>; findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn>; count: ReturnType<typeof import('vitest').vi.fn> }
  $transaction: ReturnType<typeof import('vitest').vi.fn>
}

export function resetPrismaMocks() {
  Object.values(mockPrisma).forEach((model: any) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn: any) => {
        if (typeof fn?.mockReset === 'function') {
          fn.mockReset()
        }
      })
    }
  })
}