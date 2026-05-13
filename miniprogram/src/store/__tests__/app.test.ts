import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/store/app'

const uniMock = uni as unknown as {
  getStorageSync: ReturnType<typeof vi.fn>
  setStorageSync: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useAppStore', () => {
  describe('updateReaderSettings', () => {
    it('merges partial settings into readerSettings', () => {
      const store = useAppStore()
      expect(store.readerSettings.fontSize).toBe(16)
      expect(store.readerSettings.theme).toBe('light')

      store.updateReaderSettings({ fontSize: 20, theme: 'dark' })

      expect(store.readerSettings.fontSize).toBe(20)
      expect(store.readerSettings.theme).toBe('dark')
      // unchanged fields remain
      expect(store.readerSettings.lineHeight).toBe(1.8)
      expect(store.readerSettings.fontFamily).toBe('default')
    })

    it('persists settings to storage as JSON', () => {
      const store = useAppStore()
      store.updateReaderSettings({ fontSize: 22 })
      expect(uniMock.setStorageSync).toHaveBeenCalledWith(
        'st_reader_settings',
        JSON.stringify({ fontSize: 22, lineHeight: 1.8, theme: 'light', fontFamily: 'default' }),
      )
    })
  })

  describe('loadReaderSettings', () => {
    it('reads settings from storage and merges into state', () => {
      const stored = JSON.stringify({ fontSize: 24, theme: 'sepia' })
      uniMock.getStorageSync.mockReturnValue(stored)

      const store = useAppStore()
      store.loadReaderSettings()

      expect(store.readerSettings.fontSize).toBe(24)
      expect(store.readerSettings.theme).toBe('sepia')
      expect(store.readerSettings.lineHeight).toBe(1.8)
    })

    it('keeps defaults when storage is empty', () => {
      uniMock.getStorageSync.mockReturnValue('')

      const store = useAppStore()
      store.loadReaderSettings()

      expect(store.readerSettings.fontSize).toBe(16)
      expect(store.readerSettings.theme).toBe('light')
      expect(store.readerSettings.lineHeight).toBe(1.8)
      expect(store.readerSettings.fontFamily).toBe('default')
    })
  })
})