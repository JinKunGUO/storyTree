<template>
  <view class="chapter-tree">
    <view class="tree-title">
      <text class="title-text">故事树</text>
      <text class="node-count">{{ totalNodes }} 个节点</text>
    </view>

    <!-- 根节点 -->
    <view v-if="rootNode" class="node-item root-node" @tap="$emit('node-tap', rootNode.id)">
      <view class="node-connector root-connector" />
      <view class="node-dot root-dot">
        <text class="dot-icon">🌳</text>
      </view>
      <view class="node-content">
        <text class="node-title">{{ rootNode.title }}</text>
        <view class="node-meta">
          <text class="node-author">{{ rootNode.author.username }}</text>
          <text class="node-rating">★ {{ rootNode.rating_avg.toFixed(1) }}</text>
          <text class="node-children">{{ rootNode._count?.other_nodes || 0 }} 分支</text>
        </view>
      </view>
    </view>

    <!-- 子节点 -->
    <view
      v-for="(node, index) in childNodes"
      :key="node.id"
      class="node-item"
      :class="{ 'last-child': index === childNodes.length - 1 }"
      @tap="$emit('node-tap', node.id)"
    >
      <view class="node-connector" />
      <view class="node-dot">
        <text class="dot-icon">🌿</text>
      </view>
      <view class="node-content">
        <text class="node-title">{{ node.title }}</text>
        <view class="node-meta">
          <text class="node-author">{{ node.author.username }}</text>
          <text class="node-rating">★ {{ node.rating_avg.toFixed(1) }}</text>
          <text class="node-children">{{ node._count?.other_nodes || 0 }} 分支</text>
        </view>
      </view>
    </view>

    <!-- 展开更多 -->
    <view v-if="hasMore" class="load-more" @tap="$emit('load-more')">
      <text class="load-more-text">查看更多分支 →</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '@/api/nodes'

const props = defineProps<{
  rootNode?: Node | null
  childNodes?: Node[]
  hasMore?: boolean
}>()

defineEmits<{
  (e: 'node-tap', id: number): void
  (e: 'load-more'): void
}>()

const totalNodes = computed(() => {
  let count = props.rootNode ? 1 : 0
  count += props.childNodes?.length || 0
  return count
})
</script>

<style lang="scss" scoped>
.chapter-tree {
  .tree-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .title-text {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .node-count {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .node-item {
    display: flex;
    align-items: flex-start;
    gap: 16rpx;
    position: relative;
    padding-bottom: 24rpx;

    &:not(.last-child)::before {
      content: '';
      position: absolute;
      left: 27rpx;
      top: 48rpx;
      bottom: 0;
      width: 2rpx;
      background: #e2e8f0;
    }

    .node-connector {
      display: none;
    }

    .node-dot {
      width: 56rpx;
      height: 56rpx;
      border-radius: 50%;
      background: rgba(124, 106, 247, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .dot-icon {
        font-size: 28rpx;
      }
    }

    &.root-node .node-dot {
      background: rgba(124, 106, 247, 0.2);
      width: 64rpx;
      height: 64rpx;
    }

    .node-content {
      flex: 1;
      padding-top: 8rpx;

      .node-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
        margin-bottom: 8rpx;
      }

      .node-meta {
        display: flex;
        gap: 16rpx;

        .node-author,
        .node-rating,
        .node-children {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }
  }

  .load-more {
    text-align: center;
    padding: 16rpx 0;

    .load-more-text {
      font-size: 26rpx;
      color: #7c6af7;
    }
  }
}
</style>

