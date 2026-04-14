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

// 获取故事的节点树（从 GET /api/stories/:id 的响应中提取）
// 后端不存在独立的 /api/stories/:id/nodes 接口，节点数据包含在故事详情中
export function getStoryNodes(storyId: number) {
  return http.get<{ story: any; nodes: Node[] }>(`/api/stories/${storyId}`).then(res => {
    const nodes = res.nodes || []
    const rootNode = nodes.find((n: Node) => !n.parent_id) || null
    return { nodes, rootNode }
  })
}

// 获取单个节点
export function getNode(id: number) {
  return http.get<{ node: Node }>(`/api/nodes/${id}`)
}

// 获取节点的子节点（分支）
// 后端不存在 /children 接口，子节点数据在 GET /api/nodes/:id 的 branches 字段中
export function getNodeChildren(id: number) {
  return http.get<{ node: Node; branches: Node[] }>(`/api/nodes/${id}`).then(res => ({
    children: res.branches || [],
  }))
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

// 收藏/取消收藏节点（切换型，后端路由：POST /api/bookmarks/node/:nodeId）
export function bookmarkNode(nodeId: number) {
  return http.post<{ message: string; bookmarked: boolean }>(`/api/bookmarks/node/${nodeId}`)
}

// 取消收藏节点（与 bookmarkNode 相同，调用切换接口）
export function unbookmarkNode(nodeId: number) {
  return http.post<{ message: string; bookmarked: boolean }>(`/api/bookmarks/node/${nodeId}`)
}

// 增加阅读次数
// 注意：后端 GET /api/nodes/:id 已自动增加 read_count，此函数为空操作，无需额外请求
export function incrementReadCount(_id: number) {
  return Promise.resolve({ message: 'read count auto-incremented by GET /api/nodes/:id' })
}

