import { vi } from 'vitest'

// Mock uni global — must be present before any module that calls uni.getStorageSync etc.
const storage = new Map<string, any>()

const uniMock = {
  getStorageSync: vi.fn((key: string) => storage.get(key) ?? ''),
  setStorageSync: vi.fn((key: string, value: any) => { storage.set(key, value) }),
  removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
  getSystemInfoSync: vi.fn(() => ({
    platform: 'devtools',
    screenWidth: 375,
    screenHeight: 812,
  })),
  showToast: vi.fn(),
  showModal: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  setClipboardData: vi.fn(),
  request: vi.fn(),
  uploadFile: vi.fn(),
  reLaunch: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  navigateBack: vi.fn(),
}

vi.stubGlobal('uni', uniMock)

// Mock getCurrentPages (used in helpers.ts navigateToLogin)
vi.stubGlobal('getCurrentPages', vi.fn(() => [{ route: 'pages/index/index' }]))

// Clear storage between tests
beforeEach(() => {
  storage.clear()
})