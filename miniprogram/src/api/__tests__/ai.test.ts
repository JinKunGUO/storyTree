import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockHttp } = vi.hoisted(() => {
  const mockHttp = {
    get: vi.fn(() => Promise.resolve({} as any)),
    post: vi.fn(() => Promise.resolve({} as any)),
    put: vi.fn(() => Promise.resolve({} as any)),
    delete: vi.fn(() => Promise.resolve({} as any)),
    patch: vi.fn(() => Promise.resolve({} as any)),
  }
  return { mockHttp }
})

vi.mock('@/utils/request', () => ({ default: mockHttp }))

import { createV2PolishTask, getAiV2Quota, submitAiCreateChapter, getAiTaskStatus } from '@/api/ai'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AI API', () => {
  describe('createV2PolishTask', () => {
    it('posts to /api/ai/v2/polish with content and default style', async () => {
      await createV2PolishTask({ content: 'Hello world' })
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/api/ai/v2/polish',
        { content: 'Hello world', style: 'elegant' },
        { showError: false },
      )
    })

    it('passes custom style when provided', async () => {
      await createV2PolishTask({ content: 'Hello world', style: 'concise' })
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/api/ai/v2/polish',
        { content: 'Hello world', style: 'concise' },
        { showError: false },
      )
    })
  })

  describe('getAiV2Quota', () => {
    it('sends GET to /api/ai/v2/quota', async () => {
      await getAiV2Quota()
      expect(mockHttp.get).toHaveBeenCalledWith('/api/ai/v2/quota', undefined, { showError: false })
    })
  })

  describe('submitAiCreateChapter', () => {
    it('posts to /api/ai/v2/continuation/submit with correct body for auto-publish', async () => {
      await submitAiCreateChapter({
        storyId: 1,
        nodeId: 10,
        surpriseTime: 'immediate',
        style: '悬疑',
        publishImmediately: true,
      })

      expect(mockHttp.post).toHaveBeenCalledWith('/api/ai/v2/continuation/submit', {
        storyId: 1,
        nodeId: 10,
        surpriseTime: 'immediate',
        style: '悬疑',
        wordCount: 1500,
        publishImmediately: true,
        count: 1,
        mode: 'full',
      })
    })

    it('sets count to 3 when publishImmediately is false (draft mode)', async () => {
      await submitAiCreateChapter({
        storyId: 2,
        nodeId: 20,
        surpriseTime: 'tonight',
        publishImmediately: false,
      })

      expect(mockHttp.post).toHaveBeenCalledWith('/api/ai/v2/continuation/submit', {
        storyId: 2,
        nodeId: 20,
        surpriseTime: 'tonight',
        style: undefined,
        wordCount: 1500,
        publishImmediately: false,
        count: 3,
        mode: 'full',
      })
    })

    it('maps surpriseTime=custom to customScheduledAt value', async () => {
      await submitAiCreateChapter({
        storyId: 3,
        nodeId: 30,
        surpriseTime: 'custom',
        customScheduledAt: '2025-06-01T08:00:00.000Z',
      })

      const call = mockHttp.post.mock.calls[0]
      expect(call[1].surpriseTime).toBe('2025-06-01T08:00:00.000Z')
    })

    it('falls back to "immediate" when custom with no customScheduledAt', async () => {
      await submitAiCreateChapter({
        storyId: 4,
        nodeId: 40,
        surpriseTime: 'custom',
      })

      const call = mockHttp.post.mock.calls[0]
      expect(call[1].surpriseTime).toBe('immediate')
    })

    it('defaults publishImmediately to true and count to 1 when omitted', async () => {
      await submitAiCreateChapter({
        storyId: 5,
        nodeId: 50,
        surpriseTime: '1hour',
      })

      const call = mockHttp.post.mock.calls[0]
      expect(call[1].publishImmediately).toBe(true)
      expect(call[1].count).toBe(1)
    })
  })

  describe('getAiTaskStatus', () => {
    it('sends GET to /api/ai/v2/tasks/:taskId', async () => {
      await getAiTaskStatus(99)
      expect(mockHttp.get).toHaveBeenCalledWith('/api/ai/v2/tasks/99')
    })
  })
})