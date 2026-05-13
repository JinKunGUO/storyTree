import { vi } from 'vitest'

const mockHttp = {
  get: vi.fn(() => Promise.resolve({} as any)),
  post: vi.fn(() => Promise.resolve({} as any)),
  put: vi.fn(() => Promise.resolve({} as any)),
  delete: vi.fn(() => Promise.resolve({} as any)),
  patch: vi.fn(() => Promise.resolve({} as any)),
  upload: vi.fn(() => Promise.resolve({} as any)),
}

export { mockHttp }

// This mock must be imported in test files that test API modules
// Usage: import { mockHttp } from '../../tests/mocks/request'
// Then: vi.mock('@/utils/request', () => ({ default: mockHttp }))