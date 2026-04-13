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

export interface CheckinStatus {
  hasCheckedIn: boolean
  consecutiveDays: number
  makeupChances: number
  todayPoints: number
  monthRecords: CheckinRecord[]
}

// 获取签到状态
export function getCheckinStatus() {
  return http.get<CheckinStatus>('/api/checkin/status')
}

// 执行签到
export function doCheckin() {
  return http.post<{ message: string; points_earned: number; consecutive_days: number; record: CheckinRecord }>(
    '/api/checkin'
  )
}

// 补签
export function makeupCheckin(date: string) {
  return http.post<{ message: string; points_earned: number }>('/api/checkin/makeup', { date })
}

