/**
 * 故事相关 API
 */

import http from '@/utils/request'

export interface Story {
  id: number
  title: string
  description?: string
  cover_image?: string
  author_id: number
  root_node_id?: number
  visibility: string
  allow_branch: boolean
  allow_comment: boolean
  tags?: string
  created_at: string
  updated_at: string
  pinned: boolean
  author: {
    id: number
    username: string
    avatar?: string
    level: number
  }
  _count?: {
    nodes: number
    followers: number
    bookmarks: number
  }
  isFollowed?: boolean
  isBookmarked?: boolean
}

export interface StoryListResponse {
  stories: Story[]
  total: number
  page: number
  pageSize: number
}

// 获取故事列表（发现页）
export function getStories(params?: {
  page?: number
  pageSize?: number
  sort?: 'latest' | 'popular' | 'trending'
  tag?: string
  search?: string
}) {
  return http.get<StoryListResponse>('/api/stories', params as Record<string, unknown>)
}

// 获取故事详情（后端同时返回 nodes 数组）
export function getStory(id: number) {
  return http.get<{ story: Story; nodes: import('./nodes').Node[] }>(`/api/stories/${id}`)
}

// 获取首页推荐故事
export function getFeaturedStories() {
  return http.get<{ stories: Story[] }>('/api/stories/featured')
}

// 获取热门故事
export function getPopularStories(params?: { page?: number; pageSize?: number }) {
  return http.get<StoryListResponse>('/api/stories/popular', params as Record<string, unknown>)
}

// 创建故事
export function createStory(data: {
  title: string
  description?: string
  cover_image?: string
  visibility?: string
  tags?: string
  allow_branch?: boolean
  allow_comment?: boolean
}) {
  return http.post<{ story: Story }>('/api/stories', data)
}

// 更新故事
export function updateStory(id: number, data: Partial<Story>) {
  return http.put<{ story: Story }>(`/api/stories/${id}`, data as Record<string, unknown>)
}

// 删除故事
export function deleteStory(id: number) {
  return http.delete<{ message: string }>(`/api/stories/${id}`)
}

// 追更故事（关注）
export function followStory(id: number) {
  return http.post<{ message: string; isFollowed: boolean }>(`/api/stories/${id}/follow`)
}

// 取消追更
export function unfollowStory(id: number) {
  return http.delete<{ message: string }>(`/api/stories/${id}/follow`)
}

// 收藏故事
export function bookmarkStory(id: number) {
  return http.post<{ message: string }>(`/api/bookmarks`, { story_id: id })
}

// 取消收藏
export function unbookmarkStory(id: number) {
  return http.delete<{ message: string }>(`/api/bookmarks/${id}`)
}

// 获取用户的故事列表
export function getUserStories(userId: number, params?: { page?: number; pageSize?: number }) {
  return http.get<StoryListResponse>(`/api/users/${userId}/stories`, params as Record<string, unknown>)
}

// 搜索故事
export function searchStories(query: string, params?: { page?: number; pageSize?: number }) {
  return http.get<{ stories: Story[]; nodes: any[]; total: number }>('/api/search', {
    q: query,
    type: 'stories',
  } as Record<string, unknown>)
}

