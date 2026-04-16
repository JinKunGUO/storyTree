/**
 * AI 相关 API
 * 后端实际路由（/api/ai）：
 *   POST /generate   — 生成续写选项（支持 nodeId 或 storyId + context）
 *   POST /accept     — 采纳 AI 续写分支（创建节点）
 *   GET  /usage-stats — 获取 AI 使用统计
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

export interface AiOption {
  title: string
  content: string
  style: string
}

// 生成 AI 续写选项
// 后端路由：POST /api/ai/generate
// 支持两种模式：
//   - 基于已保存节点：{ nodeId, style?, count? }
//   - 基于故事+上下文：{ storyId, context?, style?, count? }
export function createContinueTask(data: {
  story_id?: number
  node_id?: number
  context?: string
  style?: string
  length?: 'short' | 'medium' | 'long'
}) {
  return http.post<{
    options: AiOption[]
    raw: string
    metadata: { tokensUsed: number; costUsd: string; responseTimeMs: number; success: boolean }
  }>('/api/ai/generate', {
    nodeId: data.node_id,
    storyId: data.story_id,
    context: data.context,
    style: data.style,
    count: data.length === 'short' ? 1 : data.length === 'long' ? 5 : 3,
  })
}

// 采纳 AI 续写分支（创建节点）
// 后端路由：POST /api/ai/accept
export function acceptAiOption(data: {
  parentNodeId: number
  title: string
  content: string
}) {
  return http.post<{ node: any }>('/api/ai/accept', data)
}

// 创建 AI 润色任务（复用 generate 接口，style='润色'）
// 后端没有独立的 /polish 接口，使用 generate 替代
export function createPolishTask(data: {
  node_id: number
  content: string
  style?: string
}) {
  return http.post<{
    options: AiOption[]
    raw: string
  }>('/api/ai/generate', {
    nodeId: data.node_id,
    style: '润色',
    count: 1,
  })
}

// 创建 AI 插图任务（后端暂无此接口，预留）
export function createIllustrationTask(data: {
  node_id: number
  prompt?: string
}) {
  return Promise.reject(new Error('AI 插图功能暂未开放'))
}

// 获取 AI 使用统计（后端路由：GET /api/ai/usage-stats）
export function getAiTask(taskId: number) {
  // 后端没有 /tasks/:id 接口，此函数仅作兼容保留
  return Promise.reject(new Error('暂不支持查询单个任务'))
}

// 获取用户的 AI 任务列表（后端无此接口，兼容保留）
export function getMyAiTasks(params?: { page?: number; pageSize?: number; status?: string }) {
  return Promise.reject(new Error('暂不支持任务列表查询'))
}

// 创建 AI 摘要任务（后端无独立接口，使用 generate 替代）
export function createSummaryTask(data: {
  node_id: number
}) {
  return http.post<{
    options: AiOption[]
    raw: string
  }>('/api/ai/generate', {
    nodeId: data.node_id,
    style: '摘要',
    count: 1,
  })
}

// 获取任务状态（别名，兼容保留）
export const getTaskStatus = getAiTask

// 获取 AI 使用统计
// 后端路由：GET /api/ai/usage-stats
export function getAiQuota() {
  return http.get<{
    total: { requests: number; tokens: number; cost: string; successRate: string }
    recent7Days: { requests: number; tokens: number; cost: string }
  }>('/api/ai/usage-stats')
}

// ——— AI 创作章节（独立创作者模式，ai-v2 接口）———

export type AiSurpriseTime = 'immediate' | '1hour' | 'tonight' | 'tomorrow' | 'custom'
export type AiWritingStyle = '悬疑' | '温情' | '脑洞' | '科幻' | '武侠' | '现实' | '浪漫' | '奇幻'

export interface AiCreateChapterParams {
  storyId: number
  nodeId: number          // 父节点 id
  surpriseTime: AiSurpriseTime
  customScheduledAt?: string  // 自定义时间（ISO 字符串），surpriseTime='custom' 时有效
  style?: AiWritingStyle
  wordCount?: number      // 期望字数
  publishImmediately?: boolean  // true=自动发布，false=保存为草稿
}

// 提交 AI 创作章节任务
// 后端路由：POST /api/ai/v2/continuation/submit（挂载于 /api/ai/v2）
// 自定义时间：surpriseTime='custom' 时，将 customScheduledAt（ISO 字符串）作为 surpriseTime 传给后端
// 后端 switch default 分支会将其解析为 Date 对象
export function submitAiCreateChapter(params: AiCreateChapterParams) {
  const surpriseTimeValue = params.surpriseTime === 'custom'
    ? (params.customScheduledAt ?? 'immediate')
    : params.surpriseTime

  return http.post<{
    taskId: number
    scheduledAt?: string
    message: string
  }>('/api/ai/v2/continuation/submit', {
    storyId: params.storyId,
    nodeId: params.nodeId,
    surpriseTime: surpriseTimeValue,
    style: params.style,
    wordCount: params.wordCount || 1500,
    publishImmediately: params.publishImmediately ?? true,
    count: 1,
    mode: 'full',
  })
}

// 查询 AI 任务状态
// 后端路由：GET /api/ai/v2/tasks/:taskId
export function getAiTaskStatus(taskId: number) {
  return http.get<{
    taskId: number
    taskType: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: string
    scheduledAt?: string
    startedAt?: string
    completedAt?: string
    result?: {
      options?: Array<{ title: string; content: string; style: string }>
      savedAsDraft?: boolean
      autoAccepted?: boolean
      acceptedNodeId?: number
      publishStatus?: 'published' | 'draft'
    }
    errorMessage?: string
  }>(`/api/ai/v2/tasks/${taskId}`)
}


