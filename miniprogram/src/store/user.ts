/**
 * 用户状态管理
 * 管理用户信息、Token、登录状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 用户信息类型
export interface UserInfo {
  id: number
  username: string
  email: string
  avatar?: string
  bio?: string
  level: number
  points: number
  word_count: number
  badges?: string
  consecutive_days: number
  makeup_chances: number
  membership_tier: string
  membership_expires_at?: string
  emailVerified: boolean
  isAdmin: boolean
  createdAt: string
}

const TOKEN_KEY = 'st_token'
const USER_KEY = 'st_user'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(
    (() => {
      try {
        const stored = uni.getStorageSync(USER_KEY)
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    })()
  )

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  const isMember = computed(() => {
    if (!userInfo.value) return false
    return (
      userInfo.value.membership_tier !== 'free' &&
      (!userInfo.value.membership_expires_at ||
        new Date(userInfo.value.membership_expires_at) > new Date())
    )
  })
  const isAdmin = computed(() => userInfo.value?.isAdmin ?? false)
  const avatarUrl = computed(() => {
    if (!userInfo.value?.avatar) return '/static/images/default-avatar.png'
    // 如果是相对路径，拼接 API 基础地址
    if (userInfo.value.avatar.startsWith('/')) {
      return `${import.meta.env.VITE_API_BASE_URL || ''}${userInfo.value.avatar}`
    }
    return userInfo.value.avatar
  })

  // 操作
  function setToken(newToken: string) {
    token.value = newToken
    uni.setStorageSync(TOKEN_KEY, newToken)
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    uni.setStorageSync(USER_KEY, JSON.stringify(info))
  }

  function updateUserInfo(partial: Partial<UserInfo>) {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...partial }
      uni.setStorageSync(USER_KEY, JSON.stringify(userInfo.value))
    }
  }

  function login(newToken: string, info: UserInfo) {
    setToken(newToken)
    setUserInfo(info)
    // 触发登录事件，通知其他页面刷新
    uni.$emit('user:logged-in', info)
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync(TOKEN_KEY)
    uni.removeStorageSync(USER_KEY)
  }

  // 检查登录状态（用于页面 onShow 时刷新）
  function checkLoginStatus() {
    const storedToken = uni.getStorageSync(TOKEN_KEY)
    const storedUser = uni.getStorageSync(USER_KEY)
    console.log('[checkLoginStatus] storedToken:', !!storedToken, 'storedUser:', !!storedUser)
    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        console.log('[checkLoginStatus] parsed user:', parsed)
        if (parsed) {
          // 始终更新 token（确保一致性）
          if (token.value !== storedToken) {
            token.value = storedToken
          }
          // 始终更新 userInfo（如果存储中有数据）
          userInfo.value = parsed
        }
      } catch (e) {
        console.log('[checkLoginStatus] 解析失败', e)
        // 解析失败，忽略
      }
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    isMember,
    isAdmin,
    avatarUrl,
    setToken,
    setUserInfo,
    updateUserInfo,
    checkLoginStatus,
    login,
    logout,
  }
})

