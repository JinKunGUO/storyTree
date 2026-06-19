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

import {
  getStories,
  getStory,
  createStory,
  followStory,
  bookmarkStory,
  getMyStories,
  searchStories,
} from '@/api/stories'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stories API', () => {
  it('getStories sends GET to /api/stories with params', async () => {
    await getStories({ page: 1, pageSize: 10, sort: 'latest' })
    expect(mockHttp.get).toHaveBeenCalledWith('/api/stories', {
      page: 1,
      pageSize: 10,
      sort: 'latest',
    })
  })

  it('getStory sends GET to /api/stories/:id', async () => {
    await getStory(42)
    expect(mockHttp.get).toHaveBeenCalledWith('/api/stories/42')
  })

  it('createStory posts to /api/stories with data', async () => {
    const data = { title: 'My Story', description: 'A test story', allow_branch: true }
    await createStory(data)
    expect(mockHttp.post).toHaveBeenCalledWith('/api/stories', data)
  })

  it('followStory posts to /api/stories/:id/follow', async () => {
    await followStory(7)
    expect(mockHttp.post).toHaveBeenCalledWith('/api/stories/7/follow')
  })

  it('bookmarkStory posts to /api/bookmarks/story/:id', async () => {
    await bookmarkStory(9)
    expect(mockHttp.post).toHaveBeenCalledWith('/api/bookmarks/story/9')
  })

  it('getMyStories sends GET to /api/stories/my', async () => {
    await getMyStories()
    expect(mockHttp.get).toHaveBeenCalledWith('/api/stories/my')
  })
})

describe('searchStories API', () => {
  it('sends GET to /api/search with query and type', async () => {
    await searchStories('测试')
    expect(mockHttp.get).toHaveBeenCalledWith('/api/search', {
      q: '测试',
      type: 'stories',
    })
  })

  it('passes page param when provided', async () => {
    await searchStories('故事', { page: 2 })
    expect(mockHttp.get).toHaveBeenCalledWith('/api/search', {
      q: '故事',
      type: 'stories',
      page: 2,
    })
  })

  it('passes pageSize param when provided', async () => {
    await searchStories('故事', { pageSize: 15 })
    expect(mockHttp.get).toHaveBeenCalledWith('/api/search', {
      q: '故事',
      type: 'stories',
      pageSize: 15,
    })
  })

  it('passes both page and pageSize when provided', async () => {
    await searchStories('故事', { page: 3, pageSize: 10 })
    expect(mockHttp.get).toHaveBeenCalledWith('/api/search', {
      q: '故事',
      type: 'stories',
      page: 3,
      pageSize: 10,
    })
  })

  it('does not pass page/pageSize when they are 0 or undefined', async () => {
    await searchStories('故事', { page: 0, pageSize: 0 })
    // page=0 and pageSize=0 are falsy, should not be included
    expect(mockHttp.get).toHaveBeenCalledWith('/api/search', {
      q: '故事',
      type: 'stories',
    })
  })
})