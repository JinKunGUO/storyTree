<template>
  <view class="search-page">
    <!-- 搜索输入框 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索故事、作者..."
          placeholder-class="search-placeholder"
          :focus="true"
          @input="onInput"
          @confirm="doSearch"
        />
        <text v-if="keyword" class="clear-btn" @tap="clearSearch">×</text>
      </view>
      <text class="cancel-btn" @tap="goBack">取消</text>
    </view>

    <!-- 搜索历史 -->
    <view v-if="!keyword && searchHistory.length > 0" class="history-section">
      <view class="section-header">
        <text class="section-title">搜索历史</text>
        <text class="clear-history" @tap="clearHistory">清除</text>
      </view>
      <view class="history-tags">
        <view
          v-for="item in searchHistory"
          :key="item"
          class="history-tag"
          @tap="searchByHistory(item)"
        >
          {{ item }}
        </view>
      </view>
    </view>

    <!-- 热门搜索 -->
    <view v-if="!keyword" class="hot-section">
      <text class="section-title">热门搜索</text>
      <view class="hot-tags">
        <view
          v-for="(tag, index) in hotTags"
          :key="tag"
          class="hot-tag"
          :class="{ top3: index < 3 }"
          @tap="searchByHistory(tag)"
        >
          <text class="hot-rank">{{ index + 1 }}</text>
          <text class="hot-text">{{ tag }}</text>
        </view>
      </view>
    </view>

    <!-- 搜索结果 -->
    <scroll-view
      v-if="keyword && searched"
      class="results-scroll"
      scroll-y
      @scrolltolower="loadMore"
    >
      <!-- 无结果 -->
      <view v-if="results.length === 0 && !loading" class="empty-result">
        <text class="empty-icon">🔍</text>
        <text class="empty-text">没有找到"{{ keyword }}"相关内容</text>
      </view>

      <!-- 结果列表 -->
      <view class="results-list">
        <view
          v-for="story in results"
          :key="story.id"
          class="result-item"
          @tap="goStory(story.id)"
        >
          <image
            class="result-cover"
            :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
            mode="aspectFill"
          />
          <view class="result-info">
            <text class="result-title">{{ story.title }}</text>
            <text class="result-desc">{{ story.description || '暂无简介' }}</text>
            <view class="result-meta">
              <text class="result-author">{{ story.author.username }}</text>
              <text class="result-count">{{ story._count?.nodes || 0 }} 章</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loading" class="loading-more">搜索中...</view>
      <view v-if="noMore && results.length > 0" class="no-more">没有更多结果</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { searchStories } from '@/api/stories'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'

const keyword = ref('')
const searched = ref(false)
const loading = ref(false)
const noMore = ref(false)
const results = ref<Story[]>([])
const page = ref(1)
const searchHistory = ref<string[]>([])
const hotTags = ['奇幻冒险', '科幻未来', '都市爱情', '悬疑推理', '武侠江湖', '历史穿越', '恐怖惊悚', '喜剧轻松']

let searchTimer: ReturnType<typeof setTimeout>

onMounted(() => {
  loadHistory()
})

function loadHistory() {
  try {
    const stored = uni.getStorageSync('st_search_history')
    if (stored) searchHistory.value = JSON.parse(stored)
  } catch {
    // 忽略
  }
}

function saveHistory(kw: string) {
  const list = [kw, ...searchHistory.value.filter(h => h !== kw)].slice(0, 10)
  searchHistory.value = list
  uni.setStorageSync('st_search_history', JSON.stringify(list))
}

function clearHistory() {
  searchHistory.value = []
  uni.removeStorageSync('st_search_history')
}

function onInput() {
  clearTimeout(searchTimer)
  if (!keyword.value.trim()) {
    searched.value = false
    return
  }
  searchTimer = setTimeout(() => {
    doSearch()
  }, 500)
}

async function doSearch() {
  if (!keyword.value.trim()) return
  saveHistory(keyword.value.trim())
  loading.value = true
  searched.value = true
  page.value = 1
  noMore.value = false
  try {
    const res = await searchStories(keyword.value.trim(), { page: 1, pageSize: 15 })
    results.value = res.stories
    noMore.value = res.stories.length < 15
  } catch (err) {
    console.error('搜索失败', err)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || noMore.value) return
  loading.value = true
  page.value++
  try {
    const res = await searchStories(keyword.value.trim(), { page: page.value, pageSize: 15 })
    results.value.push(...res.stories)
    noMore.value = res.stories.length < 15
  } catch {
    // 忽略
  } finally {
    loading.value = false
  }
}

function searchByHistory(kw: string) {
  keyword.value = kw
  doSearch()
}

function clearSearch() {
  keyword.value = ''
  searched.value = false
  results.value = []
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 88rpx 24rpx 16rpx;
  background: #ffffff;

  .search-input-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    background: #f0f2f5;
    border-radius: 40rpx;
    padding: 16rpx 24rpx;
    gap: 12rpx;

    .search-icon {
      font-size: 28rpx;
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      font-size: 28rpx;
      color: #1e293b;
      height: 44rpx;
    }

    .clear-btn {
      font-size: 36rpx;
      color: #94a3b8;
      padding: 0 4rpx;
    }
  }

  .cancel-btn {
    font-size: 28rpx;
    color: #7c6af7;
    white-space: nowrap;
    padding: 10rpx 8rpx;
  }
}

.search-placeholder {
  color: #94a3b8;
}

.history-section,
.hot-section {
  padding: 24rpx 24rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .clear-history {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .section-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1e293b;
    display: block;
    margin-bottom: 16rpx;
  }
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;

  .history-tag {
    padding: 12rpx 24rpx;
    background: #ffffff;
    border-radius: 40rpx;
    font-size: 26rpx;
    color: #475569;
  }
}

.hot-tags {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;

  .hot-tag {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx 28rpx;
    border-bottom: 1rpx solid #f8fafc;

    &:last-child {
      border-bottom: none;
    }

    .hot-rank {
      width: 40rpx;
      font-size: 28rpx;
      font-weight: 700;
      color: #cbd5e1;
      text-align: center;
    }

    &.top3 .hot-rank {
      color: #ef4444;
    }

    .hot-text {
      font-size: 28rpx;
      color: #1e293b;
    }
  }
}

.results-scroll {
  height: calc(100vh - 160rpx);
  padding: 16rpx 0;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #94a3b8;
  }
}

.results-list {
  padding: 0 24rpx;

  .result-item {
    display: flex;
    gap: 20rpx;
    padding: 24rpx;
    background: #ffffff;
    border-radius: 20rpx;
    margin-bottom: 16rpx;

    .result-cover {
      width: 160rpx;
      height: 120rpx;
      border-radius: 12rpx;
      flex-shrink: 0;
      background: #f0f2f5;
    }

    .result-info {
      flex: 1;
      overflow: hidden;

      .result-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
        margin-bottom: 8rpx;
      }

      .result-desc {
        font-size: 24rpx;
        color: #64748b;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-bottom: 12rpx;
      }

      .result-meta {
        display: flex;
        gap: 16rpx;

        .result-author,
        .result-count {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }
  }
}

.loading-more,
.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #94a3b8;
}
</style>

