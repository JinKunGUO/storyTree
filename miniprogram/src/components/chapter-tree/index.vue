<template>
  <view class="chapter-tree">
    <!-- 标题栏（可由外部隐藏） -->
    <view v-if="!hideHeader" class="tree-header">
      <text class="tree-title">故事分支树</text>
      <text class="tree-count">{{ totalNodes }} 个节点</text>
    </view>

    <view v-if="flatNodes.length > 0" class="tree-list">
      <view
        v-for="item in flatNodes"
        :key="item.node.id"
        class="tree-node-wrap"
      >
        <view class="node-row" :class="item.depth === 0 ? 'depth-0' : 'depth-n'">
          <!-- 缩进连接线 -->
          <view v-if="item.depth > 0" class="branch-line" :style="{ marginLeft: (item.depth - 1) * 32 + 'rpx' }" />

          <view
            class="node-body"
            :style="item.depth > 0 ? { marginLeft: item.depth * 32 + 'rpx' } : {}"
            :class="{ 'node-highlight': props.highlightNodeId === item.node.id }"
          >
            <view
              class="node-main"
              :class="{ root: item.depth === 0, 'node-draft': !item.node.is_published }"
              @tap="handleNodeTap(item.node)"
            >
              <view class="node-dot" :class="{ 'root-dot': item.depth === 0 }">
                <text class="dot-icon">{{ nodeIcon(item) }}</text>
              </view>
              <view class="node-info">
                <text class="node-title">{{ item.node.title }}</text>
                <view class="node-meta">
                  <text class="meta-author">{{ item.node.author?.username }}</text>
                  <text v-if="item.node.rating_avg > 0" class="meta-rating">★ {{ Number(item.node.rating_avg).toFixed(1) }}</text>
                  <text v-if="item.node.children && item.node.children.length > 0" class="meta-branch">{{ item.node.children.length }} 分支</text>
                  <text v-else class="meta-leaf">叶子节点</text>
                  <text v-if="!item.node.is_published" class="meta-draft">草稿</text>
                </view>
              </view>
              <text class="node-arrow">›</text>
            </view>
            <view v-if="isLoggedIn && isAuthorOrCollab" class="node-actions">
              <!-- 草稿节点：仅草稿创作者本人或故事主创可以发布 -->
              <template v-if="!item.node.is_published">
                <view
                  v-if="canPublishDraft(item.node)"
                  class="action-btn publish-btn"
                  @tap="$emit('publish-draft', item.node.id)"
                >
                  <text>📢 发布草稿</text>
                </view>
                <!-- 其他协作者：只能看到草稿标记，无发布权限 -->
                <view v-else class="action-btn draft-readonly-btn">
                  <text>📝 草稿（只读）</text>
                </view>
              </template>
              <!-- 已发布节点：正常显示续写/AI按钮 -->
              <template v-else>
                <view class="action-btn write-btn" @tap="$emit('write-branch', item.node.id)">
                  <text>✍️ 续写</text>
                </view>
                <view class="action-btn ai-btn" @tap="$emit('ai-create', item.node.id)">
                  <text>🤖 AI创作</text>
                </view>
              </template>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="tree-empty">
      <text class="empty-text">暂无章节</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '@/api/nodes'

const props = defineProps<{
  rootNode?: Node | null
  isAuthorOrCollab?: boolean
  isLoggedIn?: boolean
  highlightNodeId?: number | null   // 新节点 id，触发高亮浮动动画
  currentUserId?: number | null     // 当前登录用户 ID
  storyAuthorId?: number | null     // 故事主创 ID
  hideHeader?: boolean              // 隐藏内置标题栏（由外部提供标题时使用）
  skipRoot?: boolean                // 跳过根节点自身的渲染，只展示子分支
}>()

interface FlatNode {
  node: Node
  depth: number
}

/** 将树形结构深度优先展开为线性列表，支持任意层深 */
function flattenTree(node: Node, depth: number): FlatNode[] {
  const result: FlatNode[] = [{ node, depth }]
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1))
    }
  }
  return result
}

const flatNodes = computed<FlatNode[]>(() => {
  if (!props.rootNode) return []
  if (props.skipRoot) {
    // 跳过根节点，将每个直接子分支作为独立的根展开
    const result: FlatNode[] = []
    for (const child of props.rootNode.children || []) {
      result.push(...flattenTree(child, 0))
    }
    return result
  }
  return flattenTree(props.rootNode, 0)
})

const totalNodes = computed(() => flatNodes.value.length)

function nodeIcon(item: FlatNode): string {
  if (item.depth === 0) return '🌳'
  if (item.node.children && item.node.children.length > 0) return '🌿'
  return '🍃'
}

const emit = defineEmits<{
  (e: 'node-tap', id: number): void
  (e: 'write-branch', id: number): void
  (e: 'ai-create', id: number): void
  (e: 'publish-draft', id: number): void
}>()

/** 处理节点点击：草稿节点不允许非作者/协作者点击进入 */
function handleNodeTap(node: Node) {
  if (!node.is_published && !props.isAuthorOrCollab) {
    // 非作者/协作者点击草稿节点，不做任何操作
    return
  }
  emit('node-tap', node.id)
}

/**
 * 判断当前用户是否有权发布某个草稿节点
 * 规则：草稿创作者本人 或 故事主创 可以发布
 */
function canPublishDraft(node: Node): boolean {
  if (!props.currentUserId) return false
  // 草稿节点的作者本人
  if (node.author_id === props.currentUserId) return true
  // 故事主创
  if (props.storyAuthorId && props.storyAuthorId === props.currentUserId) return true
  return false
}
</script>

<style lang="scss" scoped>
.chapter-tree {
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;

    .tree-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .tree-count {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .tree-empty {
    padding: 40rpx 0;
    text-align: center;

    .empty-text {
      font-size: 26rpx;
      color: #94a3b8;
    }
  }
}

.tree-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.tree-node-wrap {
  position: relative;
}

.node-row {
  position: relative;

  &.depth-n {
    display: flex;
    align-items: flex-start;
  }
}

.branch-line {
  flex-shrink: 0;
  width: 28rpx;
  height: 2rpx;
  background: #e2e8f0;
  margin-top: 44rpx; // 垂直居中对齐节点
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: calc(-44rpx);
    width: 2rpx;
    height: 44rpx;
    background: #e2e8f0;
  }
}

.node-body {
  flex: 1;
  background: #ffffff;
  border-radius: 16rpx;
  border: 1rpx solid #f0f2f5;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  // 新节点高亮：上下浮动 + 紫色边框淡出
  &.node-highlight {
    border-color: #7c6af7;
    box-shadow: 0 0 0 4rpx rgba(124, 106, 247, 0.2), 0 4rpx 16rpx rgba(124, 106, 247, 0.15);
    animation: nodeFloat 0.6s ease-in-out 3, nodeFadeHighlight 2s ease-out 1.8s forwards;
  }
}

.node-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;

  &.root {
    background: linear-gradient(135deg, rgba(124, 106, 247, 0.06) 0%, rgba(167, 139, 250, 0.04) 100%);
    border-bottom: 1rpx solid rgba(124, 106, 247, 0.1);
  }

  // 草稿节点：使用橙色调背景，视觉上与已发布区分
  &.node-draft {
    background: rgba(245, 158, 11, 0.04);
    opacity: 0.85;
  }
}

.node-dot {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(124, 106, 247, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.root-dot {
    width: 64rpx;
    height: 64rpx;
    background: rgba(124, 106, 247, 0.15);
  }

  .dot-icon {
    font-size: 28rpx;
  }
}

.node-info {
  flex: 1;
  min-width: 0;

  .node-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1e293b;
    display: block;
    margin-bottom: 6rpx;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-meta {
    display: flex;
    gap: 12rpx;
    flex-wrap: wrap;

    .meta-author {
      font-size: 22rpx;
      color: #94a3b8;
    }

    .meta-rating {
      font-size: 22rpx;
      color: #f59e0b;
    }

    .meta-branch {
      font-size: 22rpx;
      color: #7c6af7;
    }

    .meta-leaf {
      font-size: 22rpx;
      color: #10b981;
    }

    .meta-draft {
      font-size: 22rpx;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      padding: 2rpx 8rpx;
      border-radius: 6rpx;
    }
  }
}

.node-arrow {
  font-size: 32rpx;
  color: #cbd5e1;
  flex-shrink: 0;
}

.node-actions {
  display: flex;
  border-top: 1rpx solid #f8fafc;

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16rpx 0;

    text {
      font-size: 24rpx;
    }

    &:not(:last-child) {
      border-right: 1rpx solid #f8fafc;
    }
  }

  .write-btn {
    background: #fafaf8;

    text {
      color: #475569;
    }
  }

  .ai-btn {
    background: linear-gradient(135deg, rgba(124, 106, 247, 0.06), rgba(167, 139, 250, 0.06));

    text {
      color: #7c6af7;
    }
  }

  .publish-btn {
    flex: 1;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.06));

    text {
      color: #059669;
      font-weight: 600;
    }
  }

  .draft-readonly-btn {
    flex: 1;
    background: rgba(245, 158, 11, 0.04);

    text {
      color: #d97706;
      font-size: 22rpx;
    }
  }
}

@keyframes nodeFloat {
  0%   { transform: translateY(0); }
  30%  { transform: translateY(-8rpx); }
  70%  { transform: translateY(4rpx); }
  100% { transform: translateY(0); }
}

@keyframes nodeFadeHighlight {
  from {
    border-color: #7c6af7;
    box-shadow: 0 0 0 4rpx rgba(124, 106, 247, 0.2), 0 4rpx 16rpx rgba(124, 106, 247, 0.15);
  }
  to {
    border-color: #f0f2f5;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  }
}
</style>

