/**
 * AI 相关 API
 */

import http from '@/utils/request'

export interface AiTask {
  id: number
  user_id: number
  story_id?: number
  node_id?: number
  task_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input_data: string
  result_data?: string
  error_message?: string
  created_at: string
  completed_at?: string
}

// 创建 AI 续写任务
export function createContinueTask(data: {
  story_id: number
  node_id: number
  style?: string
  length?: 'short' | 'medium' | 'long'
}) {
  return http.post<{ task: AiTask; message: string }>('/api/ai/continue', data)
}

// 创建 AI 润色任务
export function createPolishTask(data: {
  node_id: number
  content: string
  style?: string
}) {
  return http.post<{ task: AiTask; message: string }>('/api/ai/polish', data)
}

// 创建 AI 插图任务
export function createIllustrationTask(data: {
  node_id: number
  prompt?: string
}) {
  return http.post<{ task: AiTask; message: string }>('/api/ai/illustration', data)
}

// 获取 AI 任务状态
export function getAiTask(taskId: number) {
  return http.get<{ task: AiTask }>(`/api/ai/tasks/${taskId}`)
}

// 获取用户的 AI 任务列表
export function getMyAiTasks(params?: { page?: number; pageSize?: number; status?: string }) {
  return http.get<{ tasks: AiTask[]; total: number }>('/api/ai/tasks', params as Record<string, unknown>)
}

// 创建 AI 摘要任务
export function createSummaryTask(data: {
  node_id: number
}) {
  return http.post<{ task: AiTask; message: string }>('/api/ai/summary', data)
}

// 获取任务状态（别名，与 getAiTask 相同）
export const getTaskStatus = getAiTask

// 获取 AI 使用配额
export function getAiQuota() {
  return http.get<{ used: number; limit: number; resetAt: string }>('/api/ai/quota')
}

