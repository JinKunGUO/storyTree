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

import { getUserProfile, updateProfile, followUser, getMyFeed } from '@/api/users'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('users API', () => {
  it('getUserProfile sends GET to /api/users/:id', async () => {
    await getUserProfile(5)
    expect(mockHttp.get).toHaveBeenCalledWith('/api/users/5')
  })

  it('updateProfile sends PUT to /api/users/profile with data', async () => {
    const data = { username: 'newname', bio: 'hello' }
    await updateProfile(data)
    expect(mockHttp.put).toHaveBeenCalledWith('/api/users/profile', data)
  })

  it('followUser posts to /api/users/:id/follow', async () => {
    await followUser(10)
    expect(mockHttp.post).toHaveBeenCalledWith('/api/users/10/follow')
  })

  it('getMyFeed sends GET to /api/users/feed/me', async () => {
    await getMyFeed()
    expect(mockHttp.get).toHaveBeenCalledWith('/api/users/feed/me', undefined, { showError: false })
  })
})