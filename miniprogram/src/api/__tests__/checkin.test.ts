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

import { getCheckinStatus, getCheckinHistory, doCheckin, makeupCheckin } from '@/api/checkin'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkin API', () => {
  it('getCheckinStatus sends GET to /api/checkin/status', async () => {
    await getCheckinStatus()
    expect(mockHttp.get).toHaveBeenCalledWith('/api/checkin/status')
  })

  it('getCheckinHistory sends GET to /api/checkin/history with year and month params', async () => {
    await getCheckinHistory(2025, 5)
    expect(mockHttp.get).toHaveBeenCalledWith('/api/checkin/history', { year: 2025, month: 5 })
  })

  it('getCheckinHistory sends GET with empty params when no arguments', async () => {
    await getCheckinHistory()
    expect(mockHttp.get).toHaveBeenCalledWith('/api/checkin/history', {})
  })

  it('doCheckin posts to /api/checkin/daily', async () => {
    await doCheckin()
    expect(mockHttp.post).toHaveBeenCalledWith('/api/checkin/daily')
  })

  it('makeupCheckin posts to /api/checkin/makeup with date', async () => {
    await makeupCheckin('2025-05-10')
    expect(mockHttp.post).toHaveBeenCalledWith('/api/checkin/makeup', { date: '2025-05-10' })
  })
})