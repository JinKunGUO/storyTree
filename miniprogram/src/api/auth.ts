/**
 * 认证相关 API
 */

import http from '@/utils/request'

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  username: string
  email?: string
  password?: string
  invitationCode?: string
}

export interface WxLoginParams {
  code: string
  userInfo?: {
    nickName?: string
    avatarUrl?: string
  }
}

export interface AuthResponse {
  message: string
  token?: string  // 邮箱注册时不返回 token
  requireVerification?: boolean  // 是否需要邮箱验证
  isNewUser?: boolean
  email?: string | null  // 注册时返回的邮箱
  user: {
    id: number
    username: string
    email: string | null
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
}

// 登录
export function login(params: LoginParams) {
  return http.post<AuthResponse>('/api/auth/login', params)
}

// 注册
export function register(params: RegisterParams) {
  return http.post<AuthResponse>('/api/auth/register', params)
}

// 微信登录
export function wxLogin(params: WxLoginParams) {
  return http.post<AuthResponse>('/api/auth/wx-login', params)
}

// 获取当前用户信息
export function getMe() {
  return http.get<{ user: AuthResponse['user'] }>('/api/auth/me')
}

// 发送验证邮件
export function sendVerification(email: string) {
  return http.post<{ message: string }>('/api/auth/resend-verification', { email })
}

// 忘记密码
export function forgotPassword(email: string) {
  return http.post<{ message: string }>('/api/auth/forgot-password', { email })
}

// 重置密码
export function resetPassword(token: string, newPassword: string) {
  return http.post<{ message: string }>('/api/auth/reset-password', { token, newPassword })
}

