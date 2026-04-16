<template>
  <view class="chapter-tree">
    <!-- 标题栏 -->
    <view class="tree-header">
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
            <view class="node-main" :class="{ root: item.depth === 0 }" @tap="$emit('node-tap', item.node.id)">
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
              <view class="action-btn write-btn" @tap="$emit('write-branch', item.node.id)">
                <text>✍️ 续写</text>
              </view>
              <view class="action-btn ai-btn" @tap="$emit('ai-create', item.node.id)">
                <text>🤖 AI创作</text>
              </view>
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
}>()

defineEmits<{
  (e: 'node-tap', id: number): void
  (e: 'write-branch', id: number): void
  (e: 'ai-create', id: number): void
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
  return flattenTree(props.rootNode, 0)
})

const totalNodes = computed(() => flatNodes.value.length)

function nodeIcon(item: FlatNode): string {
  if (item.depth === 0) return '🌳'
  if (item.node.children && item.node.children.length > 0) return '🌿'
  return '🍃'
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

