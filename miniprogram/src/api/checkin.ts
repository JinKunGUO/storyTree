/**
 * 签到相关 API
 */

import http from '@/utils/request'

export interface CheckinRecord {
  id: number
  user_id: number
  checkin_date: string
  consecutive_days: number
  points_earned: number
  is_makeup: boolean
}

// 对应后端 GET /api/checkin/status 实际返回
export interface CheckinStatus {
  canCheckin: boolean        // 今天是否可签到
  isMissed: boolean          // 昨天是否漏签（连续中断）
  consecutiveDays: number    // 当前连续签到天数
  makeupChances: number      // 剩余补签次数
  nextReward: number         // 下次签到奖励积分
  lastCheckinDate: string | null
  reason?: string            // 不可签到时的原因
}

// 对应后端 GET /api/checkin/history 实际返回
export interface CheckinHistory {
  year: number
  month: number
  records: CheckinRecord[]
  stats: {
    totalCheckins: number
    totalPoints: number
    makeupCount: number
  }
}

// 对应后端 POST /api/checkin/daily 实际返回
export interface CheckinResult {
  success: boolean
  message: string
  data: {
    pointsEarned: number
    bonusPoints: number
    consecutiveDays: number
    totalPoints: number
    milestoneMessage: string
    bonusMakeupChances: number
    checkinRecord: CheckinRecord
  }
}

// 获取签到状态
export function getCheckinStatus() {
  return http.get<CheckinStatus>('/api/checkin/status')
}

// 获取本月签到历史
export function getCheckinHistory(year?: number, month?: number) {
  const params: Record<string, unknown> = {}
  if (year) params.year = year
  if (month) params.month = month
  return http.get<CheckinHistory>('/api/checkin/history', params)
}

// 执行签到
export function doCheckin() {
  return http.post<CheckinResult>('/api/checkin/daily')
}

// 补签
export function makeupCheckin(date: string) {
  return http.post<{ success: boolean; message: string; data: { pointsEarned: number; remainingMakeupChances: number; newConsecutiveDays: number } }>(
    '/api/checkin/makeup',
    { date }
  )
}

