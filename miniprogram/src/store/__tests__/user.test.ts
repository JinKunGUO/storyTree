import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/store/user'

// Import the mocked uni so we can control return values in tests
const uniMock = uni as unknown as {
  getStorageSync: ReturnType<typeof vi.fn>
  setStorageSync: ReturnType<typeof vi.fn>
  removeStorageSync: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  setActivePinia(createPinia())
})

const sampleUserInfo = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  avatar: '/uploads/avatar.png',
  bio: '',
  level: 1,
  points: 100,
  word_count: 500,
  badges: '',
  consecutive_days: 3,
  makeup_chances: 1,
  membership_tier: 'free',
  emailVerified: true,
  isAdmin: false,
  createdAt: '2025-01-01T00:00:00.000Z',
}

describe('useUserStore', () => {
  // ---- isLoggedIn ----
  describe('isLoggedIn', () => {
    it('returns true when both token and userInfo are set', () => {
      const store = useUserStore()
      store.login('my-token', { ...sampleUserInfo })
      expect(store.isLoggedIn).toBe(true)
    })

    it('returns false when only token is set', () => {
      const store = useUserStore()
      store.token = 'my-token'
      expect(store.isLoggedIn).toBe(false)
    })

    it('returns false when only userInfo is set', () => {
      const store = useUserStore()
      // Bypass login so only userInfo is set without token
      store.userInfo = { ...sampleUserInfo }
      store.token = ''
      expect(store.isLoggedIn).toBe(false)
    })

    it('returns false when neither is set', () => {
      const store = useUserStore()
      expect(store.isLoggedIn).toBe(false)
    })
  })

  // ---- isMember ----
  describe('isMember', () => {
    it('returns true for monthly tier with future expiry', () => {
      const store = useUserStore()
      store.login('t', {
        ...sampleUserInfo,
        membership_tier: 'monthly',
        membership_expires_at: '2099-12-31T00:00:00.000Z',
      })
      expect(store.isMember).toBe(true)
    })

    it('returns false for free tier', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo, membership_tier: 'free' })
      expect(store.isMember).toBe(false)
    })

    it('returns false for monthly tier with past expiry', () => {
      const store = useUserStore()
      store.login('t', {
        ...sampleUserInfo,
        membership_tier: 'monthly',
        membership_expires_at: '2020-01-01T00:00:00.000Z',
      })
      expect(store.isMember).toBe(false)
    })

    it('returns true for monthly tier with no expiry', () => {
      const store = useUserStore()
      store.login('t', {
        ...sampleUserInfo,
        membership_tier: 'monthly',
        membership_expires_at: undefined,
      })
      expect(store.isMember).toBe(true)
    })
  })

  // ---- avatarUrl ----
  describe('avatarUrl', () => {
    it('prepends API_BASE_URL for relative path', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo, avatar: '/uploads/avatar.png' })
      expect(store.avatarUrl).toBe('http://localhost:3001/uploads/avatar.png')
    })

    it('returns absolute URL as-is', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo, avatar: 'https://cdn.example.com/pic.png' })
      expect(store.avatarUrl).toBe('https://cdn.example.com/pic.png')
    })

    it('returns default avatar path when avatar is null', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo, avatar: undefined })
      expect(store.avatarUrl).toBe('/static/images/default-avatar.png')
    })
  })

  // ---- login ----
  describe('login', () => {
    it('sets token and userInfo', () => {
      const store = useUserStore()
      store.login('abc123', { ...sampleUserInfo })
      expect(store.token).toBe('abc123')
      expect(store.userInfo).toBeTruthy()
      expect(store.userInfo!.username).toBe('testuser')
    })

    it('persists token and userInfo to storage', () => {
      const store = useUserStore()
      store.login('abc123', { ...sampleUserInfo })
      expect(uniMock.setStorageSync).toHaveBeenCalledWith('st_token', 'abc123')
      expect(uniMock.setStorageSync).toHaveBeenCalledWith('st_user', JSON.stringify({ ...sampleUserInfo }))
    })
  })

  // ---- logout ----
  describe('logout', () => {
    it('clears token and userInfo', () => {
      const store = useUserStore()
      store.login('abc123', { ...sampleUserInfo })
      store.logout()
      expect(store.token).toBe('')
      expect(store.userInfo).toBeNull()
    })

    it('removes token and userInfo from storage', () => {
      const store = useUserStore()
      store.login('abc123', { ...sampleUserInfo })
      store.logout()
      expect(uniMock.removeStorageSync).toHaveBeenCalledWith('st_token')
      expect(uniMock.removeStorageSync).toHaveBeenCalledWith('st_user')
    })
  })

  // ---- updateUserInfo ----
  describe('updateUserInfo', () => {
    it('merges partial data into userInfo', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo })
      store.updateUserInfo({ bio: 'new bio', level: 5 })
      expect(store.userInfo!.bio).toBe('new bio')
      expect(store.userInfo!.level).toBe(5)
      // unchanged fields remain
      expect(store.userInfo!.username).toBe('testuser')
    })

    it('persists updated userInfo to storage', () => {
      const store = useUserStore()
      store.login('t', { ...sampleUserInfo })
      store.updateUserInfo({ bio: 'new bio' })
      expect(uniMock.setStorageSync).toHaveBeenCalledWith(
        'st_user',
        JSON.stringify({ ...sampleUserInfo, bio: 'new bio' }),
      )
    })
  })
})