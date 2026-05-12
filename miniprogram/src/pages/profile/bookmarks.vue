<template>
  <view class="page">
    <view v-if="loading" class="skeleton-list">
      <view v-for="i in 4" :key="i" class="skeleton-card">
        <view class="skeleton-cover" />
        <view class="skeleton-info">
          <view class="skeleton-title" />
          <view class="skeleton-meta" />
        </view>
      </view>
    </view>

    <scroll-view v-else class="scroll" scroll-y @scrolltolower="onLoadMore">
      <view v-if="stories.length === 0" class="empty-state">
        <text class="empty-icon">🔖</text>
        <text class="empty-text">还没有收藏故事</text>
        <text class="empty-sub">该功能暂时不可用，去发现更多故事吧</text>
        <button class="btn-discover" @tap="goDiscover">去发现</button>
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
            :src="getImageUrl(story.cover_image) || '/static/images/default-cover.svg'"
            mode="aspectFill"
          />
          <view class="story-info">
            <text class="story-title">{{ story.title }}</text>
            <view class="story-author">
              <image
                class="author-avatar"
                :src="getImageUrl(story.author?.avatar) || '/static/images/default-avatar.svg'"
                mode="aspectFill"
              />
              <text class="author-name">{{ story.author?.username }}</text>
            </view>
            <view class="story-stats">
              <text class="stat">{{ story._count?.nodes || 0 }} 章</text>
              <text class="stat-dot">·</text>
              <text class="stat">{{ story._count?.followers || 0 }} 追更</text>
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
import { getImageUrl, http } from '@/utils/request'

const loading = ref(true)
const loadingMore = ref(false)
const noMore = ref(false)
const stories = ref<any[]>([])
const page = ref(1)
const pageSize = 20

onMounted(() => {
  loadBookmarks()
})

async function loadBookmarks(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    noMore.value = false
  }
  try {
    const res = await http.get<{ bookmarks: any[]; pagination: any }>('/api/bookmarks', {
      page: reset ? 1 : page.value,
      pageSize,
    })
    const items = (res.bookmarks || []).map((b: any) => b.story || b)
    if (reset) {
      stories.value = items
    } else {
      stories.value.push(...items)
    }
    noMore.value = items.length < pageSize
  } catch (err) {
    console.error('加载收藏失败', err)
    stories.value = []
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value++
  await loadBookmarks(false)
  loadingMore.value = false
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
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

.story-list {
  padding: 24rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.story-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;

  .story-cover {
    width: 100%;
    height: 240rpx;
    background: #f0f2f5;
  }

  .story-info {
    padding: 16rpx;

    .story-title {
      font-size: 26rpx;
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      margin-bottom: 10rpx;
    }

    .story-author {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-bottom: 8rpx;

      .author-avatar {
        width: 32rpx;
        height: 32rpx;
        border-radius: 50%;
      }

      .author-name {
        font-size: 22rpx;
        color: #94a3b8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .story-stats {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .stat {
        font-size: 20rpx;
        color: #cbd5e1;
      }

      .stat-dot {
        font-size: 20rpx;
        color: #e2e8f0;
      }
    }
  }
}

/* 骨架屏 */
.skeleton-list {
  padding: 24rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.skeleton-card {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;

  .skeleton-cover {
    width: 100%;
    height: 240rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-info {
    padding: 16rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;

    .skeleton-title {
      height: 28rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      height: 22rpx;
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

