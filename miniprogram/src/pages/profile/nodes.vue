<template>
  <view class="page">
    <view v-if="loading" class="skeleton-list">
      <view v-for="i in 4" :key="i" class="skeleton-item">
        <view class="skeleton-left" />
        <view class="skeleton-right">
          <view class="skeleton-title" />
          <view class="skeleton-meta" />
        </view>
      </view>
    </view>

    <scroll-view v-else class="scroll" scroll-y>
      <view v-if="nodes.length === 0" class="empty-state">
        <text class="empty-icon">✍️</text>
        <text class="empty-text">还没有参与创作</text>
        <text class="empty-sub">去发现页面找到感兴趣的故事，续写你的章节</text>
        <button class="btn-discover" @tap="goDiscover">去发现</button>
      </view>

      <view v-else class="node-list">
        <view
          v-for="node in nodes"
          :key="node.id"
          class="node-card"
          @tap="goChapter(node.id)"
        >
          <view class="node-info">
            <text class="node-title">{{ node.title }}</text>
            <text class="node-story">来自《{{ node.story?.title }}》</text>
            <view class="node-stats">
              <text class="stat">{{ node.read_count || 0 }} 阅读</text>
              <text class="stat-dot">·</text>
              <text class="stat">{{ node.word_count || 0 }} 字</text>
              <text class="stat-dot">·</text>
              <text class="stat-time">{{ formatDate(node.created_at) }}</text>
            </view>
          </view>
          <view class="node-arrow">›</view>
        </view>
      </view>

      <view v-if="nodes.length > 0" class="no-more">共 {{ nodes.length }} 条</view>
      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { http } from '@/utils/request'

const userStore = useUserStore()
const loading = ref(true)
const nodes = ref<any[]>([])

onMounted(() => {
  loadNodes()
})

async function loadNodes() {
  loading.value = true
  try {
    const userId = userStore.userInfo?.id
    if (!userId) return
    const res = await http.get<{ nodes: any[] }>(`/api/users/${userId}/nodes`)
    nodes.value = res.nodes || []
  } catch (err) {
    console.error('加载章节失败', err)
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goChapter(id: number) {
  uni.navigateTo({ url: `/pages/chapter/index?id=${id}` })
}

function goDiscover() {
  uni.switchTab({ url: '/pages/discover/index' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f0f2f5;
}

.scroll {
  height: 100vh;
}

.node-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.node-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;

  .node-info {
    flex: 1;
    overflow: hidden;

    .node-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      margin-bottom: 8rpx;
    }

    .node-story {
      font-size: 24rpx;
      color: #7c6af7;
      display: block;
      margin-bottom: 12rpx;
    }

    .node-stats {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .stat {
        font-size: 22rpx;
        color: #94a3b8;
      }

      .stat-dot {
        font-size: 22rpx;
        color: #cbd5e1;
      }

      .stat-time {
        font-size: 22rpx;
        color: #cbd5e1;
      }
    }
  }

  .node-arrow {
    font-size: 36rpx;
    color: #cbd5e1;
    flex-shrink: 0;
  }
}

/* 骨架屏 */
.skeleton-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.skeleton-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;

  .skeleton-left {
    width: 80rpx;
    height: 80rpx;
    border-radius: 12rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .skeleton-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14rpx;

    .skeleton-title {
      height: 30rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      height: 22rpx;
      border-radius: 6rpx;
      width: 50%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 12rpx;
  }

  .empty-sub {
    font-size: 26rpx;
    color: #94a3b8;
    text-align: center;
    margin-bottom: 48rpx;
  }

  .btn-discover {
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    padding: 20rpx 80rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
    font-weight: 600;
    border: none;
  }
}

.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #94a3b8;
}

.bottom-placeholder {
  height: 60rpx;
}
</style>

