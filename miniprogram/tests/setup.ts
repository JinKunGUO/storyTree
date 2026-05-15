import { vi, beforeEach } from 'vitest'

// Mock uni global — must be present before any module that calls uni.getStorageSync etc.
const storage = new Map<string, any>()
const eventListeners = new Map<string, Set<Function>>()

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
  // Event system - will be properly initialized in beforeEach
  $on: vi.fn(),
  $off: vi.fn(),
  $emit: vi.fn(),
}

vi.stubGlobal('uni', uniMock)

// Mock getCurrentPages (used in helpers.ts navigateToLogin)
vi.stubGlobal('getCurrentPages', vi.fn(() => [{ route: 'pages/index/index' }]))

// Mock localStorage using the same storage map
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value) },
  removeItem: (key: string) => { storage.delete(key) },
  clear: () => { storage.clear() },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size },
}

vi.stubGlobal('localStorage', localStorageMock)

// Initialize uni.$on/$off/$emit properly
beforeEach(() => {
  // Clear storage
  storage.clear()
  eventListeners.clear()

  // Setup event system properly
  uniMock.$on = vi.fn((event: string, handler: Function) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set())
    }
    eventListeners.get(event)!.add(handler)
  })

  uniMock.$off = vi.fn((event: string, handler: Function) => {
    if (eventListeners.has(event)) {
      eventListeners.get(event)!.delete(handler)
    }
  })

  uniMock.$emit = vi.fn((event: string, ...args: any[]) => {
    if (eventListeners.has(event)) {
      eventListeners.get(event)!.forEach(handler => handler(...args))
    }
  })

  // Reset mocks
  vi.clearAllMocks()
})