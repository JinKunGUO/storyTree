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

import { login, register, wxLogin, getMe, sendVerification, forgotPassword, resetPassword } from '@/api/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('auth API', () => {
  it('login posts to /api/auth/login with account and password', async () => {
    await login({ account: 'user1', password: 'pass123' })
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/login', {
      account: 'user1',
      password: 'pass123',
    })
  })

  it('register posts to /api/auth/register with user data', async () => {
    await register({ username: 'newuser', email: 'new@test.com', password: 'pw', invitationCode: 'ABC' })
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/register', {
      username: 'newuser',
      email: 'new@test.com',
      password: 'pw',
      invitationCode: 'ABC',
    })
  })

  it('wxLogin posts to /api/auth/wx-login with code', async () => {
    await wxLogin({ code: 'wx-code-123' })
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/wx-login', {
      code: 'wx-code-123',
    })
  })

  it('getMe sends GET to /api/auth/me', async () => {
    await getMe()
    expect(mockHttp.get).toHaveBeenCalledWith('/api/auth/me')
  })

  it('sendVerification posts to /api/auth/resend-verification with email', async () => {
    await sendVerification('test@example.com')
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/resend-verification', {
      email: 'test@example.com',
    })
  })

  it('forgotPassword posts to /api/auth/forgot-password with email', async () => {
    await forgotPassword('test@example.com')
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/forgot-password', {
      email: 'test@example.com',
    })
  })

  it('resetPassword posts to /api/auth/reset-password with token and newPassword', async () => {
    await resetPassword('reset-token-abc', 'newPass123')
    expect(mockHttp.post).toHaveBeenCalledWith('/api/auth/reset-password', {
      token: 'reset-token-abc',
      newPassword: 'newPass123',
    })
  })
})