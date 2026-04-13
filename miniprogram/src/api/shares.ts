/**
 * 分享相关 API
 */

import http from '@/utils/request'

// 记录分享行为
export function recordShare(data: {
  story_id: number
  node_id?: number
  platform: string
}) {
  return http.post<{ success: boolean }>('/api/shares', data)
}

// 生成小程序码（返回 base64 图片）
export function getMiniprogramCode(data: {
  story_id?: number
  node_id?: number
  page?: string
  scene?: string
}) {
  return http.post<{ success: boolean; base64: string; scene: string }>(
    '/api/shares/miniprogram-code',
    data
  )
}

// 获取故事分享统计
export function getShareStats(storyId: number) {
  return http.get<{
    total_shares: number
    by_platform: Record<string, number>
  }>(`/api/shares/stats/${storyId}`)
}

