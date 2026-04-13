/**
 * 应用全局状态管理
 * 管理全局配置、主题、加载状态等
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 系统信息
  const systemInfo = ref<UniApp.GetSystemInfoResult | null>(null)
  // 全局加载状态
  const loading = ref(false)
  // 网络状态
  const isOnline = ref(true)
  // 未读通知数
  const unreadCount = ref(0)
  // 阅读设置
  const readerSettings = ref({
    fontSize: 16,
    lineHeight: 1.8,
    theme: 'light' as 'light' | 'dark' | 'sepia',
    fontFamily: 'default',
  })

  function initSystemInfo() {
    try {
      const info = uni.getSystemInfoSync()
      systemInfo.value = info
    } catch (e) {
      console.error('获取系统信息失败', e)
    }
  }

  function setLoading(val: boolean) {
    loading.value = val
  }

  function setUnreadCount(count: number) {
    unreadCount.value = count
  }

  function updateReaderSettings(settings: Partial<typeof readerSettings.value>) {
    readerSettings.value = { ...readerSettings.value, ...settings }
    uni.setStorageSync('st_reader_settings', JSON.stringify(readerSettings.value))
  }

  function loadReaderSettings() {
    try {
      const stored = uni.getStorageSync('st_reader_settings')
      if (stored) {
        readerSettings.value = { ...readerSettings.value, ...JSON.parse(stored) }
      }
    } catch {
      // 忽略
    }
  }

  return {
    systemInfo,
    loading,
    isOnline,
    unreadCount,
    readerSettings,
    initSystemInfo,
    setLoading,
    setUnreadCount,
    updateReaderSettings,
    loadReaderSettings,
  }
})

