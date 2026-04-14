<template>
  <view class="page">
    <!-- 骨架屏 -->
    <view v-if="loading" class="skeleton-list">
      <view v-for="i in 4" :key="i" class="skeleton-card">
        <view class="skeleton-cover" />
        <view class="skeleton-info">
          <view class="skeleton-title" />
          <view class="skeleton-meta" />
        </view>
      </view>
    </view>

    <!-- 故事列表 -->
    <scroll-view v-else class="story-scroll" scroll-y @scrolltolower="onLoadMore">
      <view v-if="stories.length === 0" class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有创作故事</text>
        <text class="empty-sub">去写作页面开始你的第一个故事吧</text>
        <button class="btn-create" @tap="goWrite">开始创作</button>
      </view>

      <view v-else class="story-list">
        <view
          v-for="story in stories"
          :key="story.id"
          class="story-card"
          @tap="goStory(story.id)"
        >
          <image
            class="story-cover"
            :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
            mode="aspectFill"
          />
          <view class="story-info">
            <text class="story-title">{{ story.title }}</text>
            <text class="story-desc">{{ story.description || '暂无简介' }}</text>
            <view class="story-stats">
              <text class="stat">{{ story._count?.nodes || 0 }} 章</text>
              <text class="stat-dot">·</text>
              <text class="stat">{{ story.views || 0 }} 阅读</text>
              <text class="stat-dot">·</text>
              <text class="stat">{{ story._count?.followers || 0 }} 追更</text>
            </view>
            <view class="story-meta">
              <view class="status-badge" :class="story.is_published ? 'published' : 'draft'">
                {{ story.is_published ? '已发布' : '草稿' }}
              </view>
              <text class="create-time">{{ formatDate(story.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loadingMore" class="loading-more">加载中...</view>
      <view v-if="noMore && stories.length > 0" class="no-more">没有更多了</view>
      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getImageUrl } from '@/utils/request'
import { http } from '@/utils/request'

const userStore = useUserStore()

const loading = ref(true)
const loadingMore = ref(false)
const noMore = ref(false)
const stories = ref<any[]>([])

onMounted(() => {
  loadStories()
})

async function loadStories() {
  loading.value = true
  try {
    const userId = userStore.userInfo?.id
    if (!userId) return
    const res = await http.get<{ stories: any[] }>(`/api/users/${userId}/stories`)
    stories.value = res.stories || []
  } catch (err) {
    console.error('加载我的故事失败', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  // 当前后端接口不支持分页，暂不处理
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
}

function goWrite() {
  uni.switchTab({ url: '/pages/write/index' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f0f2f5;
}

.story-scroll {
  height: 100vh;
}

.story-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.story-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;

  .story-cover {
    width: 160rpx;
    height: 200rpx;
    border-radius: 12rpx;
    flex-shrink: 0;
    background: #f0f2f5;
  }

  .story-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    overflow: hidden;

    .story-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .story-desc {
      font-size: 24rpx;
      color: #64748b;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }

    .story-stats {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-top: auto;

      .stat {
        font-size: 22rpx;
        color: #94a3b8;
      }

      .stat-dot {
        font-size: 22rpx;
        color: #cbd5e1;
      }
    }

    .story-meta {
      display: flex;
      align-items: center;
      gap: 16rpx;

      .status-badge {
        font-size: 20rpx;
        padding: 4rpx 14rpx;
        border-radius: 20rpx;
        font-weight: 600;

        &.published {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        &.draft {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }
      }

      .create-time {
        font-size: 20rpx;
        color: #cbd5e1;
      }
    }
  }
}

/* 骨架屏 */
.skeleton-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.skeleton-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;

  .skeleton-cover {
    width: 160rpx;
    height: 200rpx;
    border-radius: 12rpx;
    flex-shrink: 0;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-top: 8rpx;

    .skeleton-title {
      height: 32rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      height: 24rpx;
      border-radius: 6rpx;
      width: 60%;
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

/* 空状态 */
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

  .btn-create {
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    padding: 20rpx 80rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
    font-weight: 600;
    border: none;
  }
}

.loading-more,
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

