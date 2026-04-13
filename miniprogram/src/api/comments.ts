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
export function getNodeComments(
  nodeId: number,
  params?: { page?: number; pageSize?: number; sort?: 'latest' | 'popular' }
) {
  return http.get<CommentsResponse>(`/api/comments/node/${nodeId}`, params as Record<string, unknown>)
}

// 发表评论
export function createComment(data: { node_id: number; content: string; parent_id?: number }) {
  return http.post<{ comment: Comment }>('/api/comments', data)
}

// 删除评论
export function deleteComment(id: number) {
  return http.delete<{ message: string }>(`/api/comments/${id}`)
}

// 给评论点赞/踩
export function voteComment(id: number, voteType: 'up' | 'down') {
  return http.post<{ message: string; voteCount: number }>(`/api/comments/${id}/vote`, { voteType })
}

// 取消投票
export function unvoteComment(id: number) {
  return http.delete<{ message: string }>(`/api/comments/${id}/vote`)
}

