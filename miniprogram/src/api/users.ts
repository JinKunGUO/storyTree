/**
 * 用户相关 API
 */

import http from '@/utils/request'
import type { UserInfo } from '@/store/user'

// 获取用户信息
export function getUserProfile(userId: number) {
  return http.get<{ user: UserInfo & { followersCount: number; followingCount: number; storiesCount: number } }>(
    `/api/users/${userId}`
  )
}

// 更新用户信息
export function updateProfile(data: { username?: string; bio?: string; avatar?: string }) {
  return http.put<{ user: UserInfo; message: string }>('/api/users/me', data)
}

// 关注用户
export function followUser(userId: number) {
  return http.post<{ message: string; isFollowing: boolean }>(`/api/users/${userId}/follow`)
}

// 取消关注
export function unfollowUser(userId: number) {
  return http.delete<{ message: string }>(`/api/users/${userId}/follow`)
}

// 获取通知列表
export function getNotifications(params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
  return http.get<{ notifications: Notification[]; total: number; unreadCount: number }>(
    '/api/notifications',
    params as Record<string, unknown>
  )
}

// 标记通知已读
export function markNotificationRead(id: number) {
  return http.put<{ message: string }>(`/api/notifications/${id}/read`)
}

// 标记所有通知已读
export function markAllNotificationsRead() {
  return http.put<{ message: string }>('/api/notifications/read-all')
}

// 获取积分记录
export function getPointTransactions(params?: { page?: number; pageSize?: number }) {
  return http.get<{ transactions: PointTransaction[]; total: number; balance: number }>(
    '/api/points/transactions',
    params as Record<string, unknown>
  )
}

export interface PointTransaction {
  id: number
  user_id: number
  amount: number
  type: string
  description: string
  reference_id?: number
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  content: string
  link?: string
  is_read: boolean
  created_at: string
}

// ==================== 邀请系统 ====================

// 获取我的邀请码列表
export function getMyInvitationCodes() {
  return http.get<{ codes: InvitationCode[] }>('/api/invitations/my-codes')
}

// 获取邀请记录
export function getInvitationRecords(params?: { page?: number; pageSize?: number }) {
  return http.get<{ records: InvitationRecord[]; total: number }>(
    '/api/invitations/records',
    params as Record<string, unknown>
  )
}

export interface InvitationCode {
  id: number
  code: string
  bonus_points: number
  max_uses: number
  used_count: number
  is_active: boolean
  expires_at?: string
  created_at: string
}

export interface InvitationRecord {
  id: number
  inviter_id: number
  invitee_id: number
  invitation_code: string
  bonus_points: number
  created_at: string
  invitee?: {
    id: number
    username: string
    avatar?: string
  }
}


