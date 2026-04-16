<template>
  <view class="chapter-tree">
    <!-- 标题栏 -->
    <view class="tree-header">
      <text class="tree-title">故事分支树</text>
      <text class="tree-count">{{ totalNodes }} 个节点</text>
    </view>

    <view v-if="rootNode" class="tree-root">
      <!-- 根节点 -->
      <view class="tree-node-wrap">
        <view class="node-row depth-0">
          <view class="node-body" :class="{ 'node-highlight': props.highlightNodeId === rootNode.id }">
            <view class="node-main root" @tap="$emit('node-tap', rootNode.id)">
              <view class="node-dot root-dot">
                <text class="dot-icon">🌳</text>
              </view>
              <view class="node-info">
                <text class="node-title">{{ rootNode.title }}</text>
                <view class="node-meta">
                  <text class="meta-author">{{ rootNode.author?.username }}</text>
                  <text v-if="rootNode.rating_avg > 0" class="meta-rating">★ {{ Number(rootNode.rating_avg).toFixed(1) }}</text>
                  <text v-if="rootNode.children && rootNode.children.length > 0" class="meta-branch">{{ rootNode.children.length }} 分支</text>
                  <text v-else class="meta-leaf">叶子节点</text>
                </view>
              </view>
              <text class="node-arrow">›</text>
            </view>
            <view v-if="isLoggedIn && isAuthorOrCollab" class="node-actions">
              <view class="action-btn write-btn" @tap="$emit('write-branch', rootNode.id)">
                <text>✍️ 续写</text>
              </view>
              <view class="action-btn ai-btn" @tap="$emit('ai-create', rootNode.id)">
                <text>🤖 AI创作</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 第1层子节点 -->
        <view v-if="rootNode.children && rootNode.children.length" class="children-wrap">
          <view
            v-for="child1 in rootNode.children"
            :key="child1.id"
            class="tree-node-wrap"
          >
            <view class="node-row depth-1">
              <view class="branch-line" />
              <view class="node-body" :class="{ 'node-highlight': props.highlightNodeId === child1.id }">
                <view class="node-main" @tap="$emit('node-tap', child1.id)">
                  <view class="node-dot">
                    <text class="dot-icon">{{ child1.children && child1.children.length ? '🌿' : '🍃' }}</text>
                  </view>
                  <view class="node-info">
                    <text class="node-title">{{ child1.title }}</text>
                    <view class="node-meta">
                      <text class="meta-author">{{ child1.author?.username }}</text>
                      <text v-if="child1.rating_avg > 0" class="meta-rating">★ {{ Number(child1.rating_avg).toFixed(1) }}</text>
                      <text v-if="child1.children && child1.children.length > 0" class="meta-branch">{{ child1.children.length }} 分支</text>
                      <text v-else class="meta-leaf">叶子节点</text>
                    </view>
                  </view>
                  <text class="node-arrow">›</text>
                </view>
                <view v-if="isLoggedIn && isAuthorOrCollab" class="node-actions">
                  <view class="action-btn write-btn" @tap="$emit('write-branch', child1.id)">
                    <text>✍️ 续写</text>
                  </view>
                  <view class="action-btn ai-btn" @tap="$emit('ai-create', child1.id)">
                    <text>🤖 AI创作</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 第2层子节点 -->
            <view v-if="child1.children && child1.children.length" class="children-wrap">
              <view
                v-for="child2 in child1.children"
                :key="child2.id"
                class="tree-node-wrap"
              >
                <view class="node-row depth-2">
                  <view class="branch-line" />
                  <view class="node-body" :class="{ 'node-highlight': props.highlightNodeId === child2.id }">
                    <view class="node-main" @tap="$emit('node-tap', child2.id)">
                      <view class="node-dot">
                        <text class="dot-icon">{{ child2.children && child2.children.length ? '🌿' : '🍃' }}</text>
                      </view>
                      <view class="node-info">
                        <text class="node-title">{{ child2.title }}</text>
                        <view class="node-meta">
                          <text class="meta-author">{{ child2.author?.username }}</text>
                          <text v-if="child2.rating_avg > 0" class="meta-rating">★ {{ Number(child2.rating_avg).toFixed(1) }}</text>
                          <text v-if="child2.children && child2.children.length > 0" class="meta-branch">{{ child2.children.length }} 分支</text>
                          <text v-else class="meta-leaf">叶子节点</text>
                        </view>
                      </view>
                      <text class="node-arrow">›</text>
                    </view>
                    <view v-if="isLoggedIn && isAuthorOrCollab" class="node-actions">
                      <view class="action-btn write-btn" @tap="$emit('write-branch', child2.id)">
                        <text>✍️ 续写</text>
                      </view>
                      <view class="action-btn ai-btn" @tap="$emit('ai-create', child2.id)">
                        <text>🤖 AI创作</text>
                      </view>
                    </view>
                  </view>
                </view>

                <!-- 第3层子节点 -->
                <view v-if="child2.children && child2.children.length" class="children-wrap">
                  <view
                    v-for="child3 in child2.children"
                    :key="child3.id"
                    class="tree-node-wrap"
                  >
                    <view class="node-row depth-3">
                      <view class="branch-line" />
                      <view class="node-body" :class="{ 'node-highlight': props.highlightNodeId === child3.id }">
                        <view class="node-main" @tap="$emit('node-tap', child3.id)">
                          <view class="node-dot">
                            <text class="dot-icon">🍃</text>
                          </view>
                          <view class="node-info">
                            <text class="node-title">{{ child3.title }}</text>
                            <view class="node-meta">
                              <text class="meta-author">{{ child3.author?.username }}</text>
                              <text v-if="child3.rating_avg > 0" class="meta-rating">★ {{ Number(child3.rating_avg).toFixed(1) }}</text>
                              <text v-if="child3.children && child3.children.length > 0" class="meta-branch">+{{ child3.children.length }}</text>
                              <text v-else class="meta-leaf">叶子节点</text>
                            </view>
                          </view>
                          <text class="node-arrow">›</text>
                        </view>
                        <view v-if="isLoggedIn && isAuthorOrCollab" class="node-actions">
                          <view class="action-btn write-btn" @tap="$emit('write-branch', child3.id)">
                            <text>✍️ 续写</text>
                          </view>
                          <view class="action-btn ai-btn" @tap="$emit('ai-create', child3.id)">
                            <text>🤖 AI创作</text>
                          </view>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
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

const totalNodes = computed(() => {
  if (!props.rootNode) return 0
  function count(node: Node): number {
    let n = 1
    if (node.children) {
      for (const c of node.children) n += count(c)
    }
    return n
  }
  return count(props.rootNode)
})
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

.tree-node-wrap {
  position: relative;
}

.node-row {
  position: relative;
  margin-bottom: 12rpx;

  &.depth-0 { margin-bottom: 16rpx; }
}

.branch-line {
  position: absolute;
  left: -20rpx;
  top: 28rpx;
  width: 16rpx;
  height: 2rpx;
  background: #e2e8f0;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: calc(-100% - 2rpx);
    bottom: 0;
    width: 2rpx;
    background: #e2e8f0;
  }
}

.node-body {
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

.children-wrap {
  padding-left: 32rpx;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 16rpx;
    top: 0;
    bottom: 20rpx;
    width: 2rpx;
    background: #e2e8f0;
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

