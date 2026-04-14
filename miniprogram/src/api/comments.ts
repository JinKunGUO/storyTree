/**
 * 评论相关 API
 */

import http from '@/utils/request'

export interface Comment {
  id: number
  content: string
  node_id: number
  user_id: number
  parent_id?: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  pinned: boolean
  user: {
    id: number
    username: string
    avatar?: string
    level: number
  }
  _count?: {
    votes: number
    other_comments: number
  }
  replies?: Comment[]
  userVote?: 'up' | 'down' | null
}

export interface CommentsResponse {
  comments: Comment[]
  total: number
  page: number
}

// 获取节点评论
// 后端路由：GET /api/comments/nodes/:node_id/comments
export function getNodeComments(
  nodeId: number,
  params?: { page?: number; pageSize?: number; sort?: 'latest' | 'popular' }
) {
  // 后端使用 limit 参数而非 pageSize
  const queryParams: Record<string, unknown> = {
    page: params?.page ?? 1,
    limit: params?.pageSize ?? 10,
  }
  return http
    .get<{
      comments: Comment[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/api/comments/nodes/${nodeId}/comments`, queryParams)
    .then(res => ({
      comments: res.comments || [],
      total: res.pagination?.total ?? 0,
      page: res.pagination?.page ?? 1,
    }))
}

// 发表评论
// 后端路由：POST /api/comments/nodes/:node_id/comments
export function createComment(data: { node_id: number; content: string; parent_id?: number }) {
  return http.post<{ comment: Comment; message: string }>(
    `/api/comments/nodes/${data.node_id}/comments`,
    { content: data.content, parent_id: data.parent_id }
  )
}

// 删除评论
// 后端路由：DELETE /api/comments/comments/:commentId
export function deleteComment(id: number) {
  return http.delete<{ message: string }>(`/api/comments/comments/${id}`)
}

// 给评论点赞/踩
// 后端路由：POST /api/comments/comments/:commentId/vote，参数 voteType: 'like'|'dislike'
export function voteComment(id: number, voteType: 'up' | 'down') {
  // 后端接受 'like'/'dislike'，前端传来 'up'/'down'，需要转换
  const backendType = voteType === 'up' ? 'like' : 'dislike'
  return http.post<{ message: string; action: string }>(
    `/api/comments/comments/${id}/vote`,
    { voteType: backendType }
  )
}

// 取消投票（通过再次发送相同 voteType 来切换）
export function unvoteComment(id: number) {
  return http.delete<{ message: string }>(`/api/comments/comments/${id}/vote`)
}

