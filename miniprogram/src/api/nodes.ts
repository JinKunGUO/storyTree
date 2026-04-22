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

/**
 * 从扁平节点数组中构建以 rootId 为根的完整子树（递归）
 * 用于在章节阅读页展示多层分支图
 */
export function buildSubTree(nodes: Node[], rootId: number): Node | null {
  const map = new Map<number, Node>()
  // 克隆节点，避免污染原始数据
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] })
  }
  // 构建完整树
  const root = map.get(rootId)
  if (!root) return null
  for (const n of map.values()) {
    if (n.parent_id && map.has(n.parent_id)) {
      const parent = map.get(n.parent_id)!
      if (!parent.children) parent.children = []
      parent.children.push(n)
    }
  }
  return root
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
// 后端 POST /api/nodes 期望驼峰字段名：storyId / parentId
export function createNode(data: {
  story_id: number
  parent_id?: number
  title: string
  content: string
  image?: string
}) {
  return http.post<{ node: Node }>('/api/nodes', {
    storyId: data.story_id,
    parentId: data.parent_id,
    title: data.title,
    content: data.content,
    image: data.image,
  })
}

// 更新节点
export function updateNode(id: number, data: { title?: string; content?: string; image?: string }) {
  return http.put<{ node: Node }>(`/api/nodes/${id}`, data)
}

// 删除节点（showError: false，由业务层统一处理错误提示，避免 toast 重复弹出）
export function deleteNode(id: number) {
  return http.delete<{ message: string }>(`/api/nodes/${id}`, undefined, { showError: false })
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

// 发布草稿章节（将 is_published=false 的章节正式发布）
// 后端路由：POST /api/nodes/:id/publish
export function publishNode(id: number) {
  return http.post<{ node: Node; message: string }>(`/api/nodes/${id}/publish`)
}

// ─── 草稿相关 API ─────────────────────────────────────────────────────────────

export interface DraftNode extends Node {
  story: { id: number; title: string }
  parent_title: string | null
}

// 获取当前用户的草稿列表（is_published=false 的节点）
export function getMyDrafts() {
  return http.get<{ drafts: DraftNode[] }>('/api/nodes/my-drafts')
}

// 创建草稿节点（is_published=false）
export function createDraftNode(data: {
  story_id: number
  parent_id?: number
  title: string
  content: string
  image?: string
}) {
  return http.post<{ node: Node }>('/api/nodes', {
    storyId: data.story_id,
    parentId: data.parent_id,
    title: data.title,
    content: data.content,
    image: data.image,
    isPublished: false,
  })
}

// 更新草稿内容（不触发审核，仅限未发布节点）
export function updateDraftNode(id: number, data: { title?: string; content?: string; image?: string }) {
  return http.patch<{ node: Node; message: string }>(`/api/nodes/${id}/draft`, data)
}

// 删除草稿节点（直接复用 deleteNode 接口）
export function deleteDraftNode(id: number) {
  return deleteNode(id)
}

