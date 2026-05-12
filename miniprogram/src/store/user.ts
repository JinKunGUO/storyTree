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
    if (!userInfo.value?.avatar) return '/static/images/default-avatar.svg'
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
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync(TOKEN_KEY)
    uni.removeStorageSync(USER_KEY)
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
    login,
    logout,
  }
})

