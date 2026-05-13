import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must declare mockPost before vi.mock because the factory is hoisted
// but refers to this variable. Using `var` or re-assigning after works,
// but the cleanest pattern is to let vi.hoisted create the fn.
const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/utils/request', () => {
  return { default: { post: mockPost } }
})

import { voteComment } from '../comments'

describe('voteComment', () => {
  beforeEach(() => {
    mockPost.mockClear()
  })

  it('calls http.post with voteType "like" when voteType is "up"', async () => {
    await voteComment(1, 'up')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/comments/comments/1/vote', {
      voteType: 'like',
    })
  })

  it('calls http.post with voteType "dislike" when voteType is "down"', async () => {
    await voteComment(2, 'down')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/comments/comments/2/vote', {
      voteType: 'dislike',
    })
  })

  it('includes the correct comment id in the URL', async () => {
    await voteComment(42, 'up')
    expect(mockPost).toHaveBeenCalledWith(
      '/api/comments/comments/42/vote',
      expect.objectContaining({ voteType: 'like' }),
    )
  })
})