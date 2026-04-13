/**
 * 节点（章节）相关 API
 */

import http from '@/utils/request'

export interface Node {
  id: number
  story_id: number
  parent_id?: number
  author_id: number
  title: string
  content: string
  image?: string
  path: string
  ai_generated: boolean
  is_published: boolean
  rating_avg: number
  rating_count: number
  read_count: number
  created_at: string
  updated_at: string
  author: {
    id: number
    username: string
    avatar?: string
    level: number
  }
  _count?: {
    comments: number
    other_nodes: number
  }
  children?: Node[]
  isBookmarked?: boolean
  userRating?: number
}

// 获取故事的节点树
export function getStoryNodes(storyId: number) {
  return http.get<{ nodes: Node[]; rootNode: Node }>(`/api/stories/${storyId}/nodes`)
}

// 获取单个节点
export function getNode(id: number) {
  return http.get<{ node: Node }>(`/api/nodes/${id}`)
}

// 获取节点的子节点
export function getNodeChildren(id: number) {
  return http.get<{ children: Node[] }>(`/api/nodes/${id}/children`)
}

// 创建节点（续写）
export function createNode(data: {
  story_id: number
  parent_id?: number
  title: string
  content: string
  image?: string
}) {
  return http.post<{ node: Node }>('/api/nodes', data)
}

// 更新节点
export function updateNode(id: number, data: { title?: string; content?: string; image?: string }) {
  return http.put<{ node: Node }>(`/api/nodes/${id}`, data)
}

// 删除节点
export function deleteNode(id: number) {
  return http.delete<{ message: string }>(`/api/nodes/${id}`)
}

// 给节点评分
export function rateNode(id: number, score: number) {
  return http.post<{ message: string; rating_avg: number }>(`/api/nodes/${id}/rate`, { score })
}

// 收藏节点
export function bookmarkNode(nodeId: number) {
  return http.post<{ message: string }>('/api/bookmarks/node', { node_id: nodeId })
}

// 取消收藏节点
export function unbookmarkNode(nodeId: number) {
  return http.delete<{ message: string }>(`/api/bookmarks/node/${nodeId}`)
}

// 增加阅读次数
export function incrementReadCount(id: number) {
  return http.post<{ message: string }>(`/api/nodes/${id}/read`)
}

