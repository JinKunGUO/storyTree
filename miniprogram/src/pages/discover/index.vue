<template>
  <view class="discover-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap" @tap="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索故事、作者、标签...</text>
      </view>
    </view>

    <!-- 标签筛选 -->
    <scroll-view class="tags-scroll" scroll-x>
      <view class="tags-list">
        <view
          class="tag-item"
          :class="{ active: currentTag === '' }"
          @tap="selectTag('')"
        >
          全部
        </view>
        <view
          v-for="tag in popularTags"
          :key="tag"
          class="tag-item"
          :class="{ active: currentTag === tag }"
          @tap="selectTag(tag)"
        >
          {{ tag }}
        </view>
      </view>
    </scroll-view>

    <!-- 排序栏 -->
    <view class="sort-bar">
      <view
        v-for="tab in sortTabs"
        :key="tab.value"
        class="sort-tab"
        :class="{ active: currentSort === tab.value }"
        @tap="changeSort(tab.value)"
      >
        {{ tab.label }}
      </view>
    </view>

    <!-- 故事列表 -->
    <scroll-view
      class="story-scroll"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <!-- 骨架屏 -->
      <view v-if="loading && stories.length === 0" class="skeleton-grid">
        <view v-for="i in 6" :key="i" class="skeleton-card">
          <view class="skeleton-cover" />
          <view class="skeleton-info">
            <view class="skeleton-title" />
            <view class="skeleton-meta" />
          </view>
        </view>
      </view>

      <!-- 故事网格 -->
      <view v-else class="story-grid">
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
            <view class="story-author">
              <image
                class="author-avatar"
                :src="getImageUrl(story.author.avatar) || '/static/images/default-avatar.png'"
                mode="aspectFill"
              />
              <text class="author-name">{{ story.author.username }}</text>
            </view>
            <view class="story-stats">
              <text class="stat">{{ story._count?.nodes || 0 }} 章</text>
              <text class="stat">{{ story._count?.followers || 0 }} 追更</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!loading && stories.length === 0" class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-text">暂无故事</text>
        <text class="empty-sub">换个标签试试？</text>
      </view>

      <!-- 加载更多 -->
      <view v-if="loadingMore" class="loading-more">加载中...</view>
      <view v-if="noMore && stories.length > 0" class="no-more">没有更多了</view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getStories } from '@/api/stories'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'

const loading = ref(false)
const refreshing = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)

const stories = ref<Story[]>([])
const currentTag = ref('')
const currentSort = ref<'latest' | 'popular' | 'trending'>('latest')
const page = ref(1)
const pageSize = 12

const popularTags = ['奇幻', '科幻', '悬疑', '言情', '武侠', '历史', '都市', '恐怖', '喜剧', '冒险']

const sortTabs = [
  { label: '最新', value: 'latest' as const },
  { label: '热门', value: 'popular' as const },
  { label: '趋势', value: 'trending' as const },
]

onMounted(() => {
  loadStories()
})

async function loadStories(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    noMore.value = false
  }
  try {
    const params: any = {
      page: reset ? 1 : page.value,
      pageSize,
      sort: currentSort.value,
    }
    if (currentTag.value) params.tag = currentTag.value

    const res = await getStories(params)
    if (reset) {
      stories.value = res.stories
    } else {
      stories.value.push(...res.stories)
    }
    noMore.value = res.stories.length < pageSize
  } catch (err) {
    console.error('加载故事失败', err)
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadStories(true)
  refreshing.value = false
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value++
  await loadStories(false)
  loadingMore.value = false
}

function selectTag(tag: string) {
  currentTag.value = tag
  loadStories(true)
}

function changeSort(sort: typeof currentSort.value) {
  if (currentSort.value === sort) return
  currentSort.value = sort
  loadStories(true)
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
}
</script>

<style lang="scss" scoped>
.discover-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 20rpx 24rpx;
  background: #1a1a2e;

  .search-input-wrap {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 40rpx;
    padding: 16rpx 24rpx;
    gap: 12rpx;

    .search-icon {
      font-size: 28rpx;
    }

    .search-placeholder {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.4);
    }
  }
}

.tags-scroll {
  background: #1a1a2e;
  padding-bottom: 20rpx;
}

.tags-list {
  display: flex;
  gap: 16rpx;
  padding: 0 24rpx;
  white-space: nowrap;
}

.tag-item {
  display: inline-block;
  padding: 12rpx 28rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  flex-shrink: 0;

  &.active {
    background: #7c6af7;
    color: #ffffff;
    font-weight: 600;
  }
}

.sort-bar {
  display: flex;
  background: #ffffff;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #f0f2f5;

  .sort-tab {
    padding: 24rpx 20rpx;
    font-size: 28rpx;
    color: #94a3b8;
    position: relative;

    &.active {
      color: #7c6af7;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20rpx;
        right: 20rpx;
        height: 4rpx;
        background: #7c6af7;
        border-radius: 2rpx;
      }
    }
  }
}

.story-scroll {
  flex: 1;
  height: calc(100vh - 280rpx);
}

.skeleton-grid,
.story-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  padding: 24rpx;
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

    .skeleton-title {
      height: 28rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      margin-bottom: 12rpx;
    }

    .skeleton-meta {
      height: 22rpx;
      border-radius: 6rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      width: 60%;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
    }

    .story-author {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-top: 10rpx;

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
      gap: 16rpx;
      margin-top: 8rpx;

      .stat {
        font-size: 20rpx;
        color: #cbd5e1;
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 30rpx;
    color: #475569;
    font-weight: 600;
  }

  .empty-sub {
    font-size: 24rpx;
    color: #94a3b8;
    margin-top: 12rpx;
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

