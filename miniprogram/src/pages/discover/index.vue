<template>
  <view class="discover-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 搜索栏 -->
    <view class="search-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="search-input-wrap" @tap="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索故事、作者、标签...</text>
      </view>
    </view>

    <!-- 榜单 Tab（热门/趋势/最新）-->
    <view class="rank-tabs">
      <view
        v-for="tab in sortTabs"
        :key="tab.value"
        class="rank-tab"
        :class="{ active: currentSort === tab.value }"
        @tap="changeSort(tab.value)"
      >
        <text class="rank-tab-icon">{{ tab.icon }}</text>
        <text class="rank-tab-label">{{ tab.label }}</text>
      </view>
      <view
        class="rank-tab-indicator"
        :style="{ left: sortTabs.findIndex(t => t.value === currentSort) * 33.33 + '%' }"
      />
    </view>

    <!-- 分类标签（横向滚动）-->
    <scroll-view class="tags-scroll" scroll-x>
      <view class="tags-list">
        <view
          class="tag-item"
          :class="{ active: currentTag === '' }"
          @tap="selectTag('')"
        >全部</view>
        <view
          v-for="tag in popularTags"
          :key="tag"
          class="tag-item"
          :class="{ active: currentTag === tag }"
          @tap="selectTag(tag)"
        >{{ tag }}</view>
      </view>
    </scroll-view>

    <!-- 榜单列表 -->
    <scroll-view
      class="story-scroll"
      scroll-y
      :style="{ height: scrollViewHeight + 'px' }"
      :lower-threshold="100"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
      @scroll="onScroll"
    >
      <!-- 骨架屏 -->
      <view v-if="loading && stories.length === 0" class="skeleton-rank-list">
        <view v-for="i in 6" :key="i" class="skeleton-rank-item">
          <view class="sk-rank" />
          <view class="sk-cover" />
          <view class="sk-lines">
            <view class="sk-line" />
            <view class="sk-line short" />
          </view>
        </view>
      </view>

      <!-- 榜单列表 -->
      <view v-else class="rank-list">
        <view
          v-for="(story, idx) in stories"
          :key="story.id"
          class="rank-item"
          @tap="goStory(story.id)"
        >
          <!-- 排名徽章 -->
          <view class="rank-badge" :class="['rank-' + (idx + 1)]">
            <text v-if="idx < 3" class="rank-medal">{{ ['🥇','🥈','🥉'][idx] }}</text>
            <text v-else class="rank-num">{{ idx + 1 }}</text>
          </view>

          <!-- 封面 -->
          <image
            class="rank-cover"
            :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
            mode="aspectFill"
          />

          <!-- 信息 -->
          <view class="rank-info">
            <text class="rank-title">{{ story.title }}</text>
            <view class="rank-author-row">
              <image
                class="rank-avatar"
                :src="getImageUrl(story.author.avatar) || '/static/images/default-avatar.png'"
                mode="aspectFill"
              />
              <text class="rank-author">{{ story.author.username }}</text>
              <text v-if="story.tags" class="rank-tag">{{ story.tags.split(',')[0] }}</text>
            </view>
            <view class="rank-stats">
              <text class="rank-stat">📖 {{ story._count?.nodes || 0 }} 章</text>
              <text class="rank-stat">❤️ {{ story._count?.followers || 0 }} 追更</text>
            </view>
          </view>

          <!-- 右侧箭头 -->
          <text class="rank-arrow">›</text>
        </view>

      </view>

      <!-- 空状态 -->
      <view v-if="!loading && stories.length === 0" class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-text">暂无故事</text>
        <text class="empty-sub">换个标签试试？</text>
      </view>

      <!-- 加载状态提示 -->
      <view v-if="stories.length > 0" class="load-status">
        <view v-if="loadingMore" class="loading-more">
          <text class="loading-icon">⏳</text>
          <text>加载中...</text>
        </view>
        <view v-else-if="noMore" class="no-more">
          <text class="no-more-line" />
          <text class="no-more-text">已加载全部 {{ totalStories }} 本故事</text>
          <text class="no-more-line" />
        </view>
        <view v-else class="load-more-hint">
          <text class="hint-arrow">↑</text>
          <text class="hint-text">上拉加载更多（{{ stories.length }}/{{ totalStories }}）</text>
        </view>
      </view>

      <!-- 榜单排行依据说明 -->
      <view v-if="stories.length > 0" class="rank-basis-tip">
        <text class="rank-basis-text">
          {{ currentSort === 'popular' ? '热门榜：综合追更数、章节数及阅读量排序' : currentSort === 'trending' ? '趋势榜：近期活跃度与增长速度排序' : '最新榜：按最新发布时间排序' }}
        </text>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStories } from '@/api/stories'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'

const loading = ref(false)
const refreshing = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const statusBarHeight = ref(20)
const scrollViewHeight = ref(500) // 滚动区域高度

const stories = ref<Story[]>([])
const currentTag = ref('')
const currentSort = ref<'latest' | 'popular' | 'trending'>('popular')
const page = ref(1)
const pageSize = 20
const totalStories = ref(0)

const popularTags = [
  '奇幻', '科幻', '悬疑', '言情', '武侠', '历史',
  '都市', '恐怖', '喜剧', '冒险', '推理', '古风',
  '末世', '穿越', '校园', '职场',
]

const sortTabs = [
  { label: '热门榜', icon: '🔥', value: 'popular' as const },
  { label: '趋势榜', icon: '📈', value: 'trending' as const },
  { label: '最新榜', icon: '🆕', value: 'latest' as const },
]

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight || 20
    // 计算滚动区域高度：使用屏幕高度减去固定元素
    // windowHeight 是可用窗口高度（已减去 TabBar）
    const headerHeight = statusBarHeight.value + 50 // 搜索栏
    const rankTabsHeight = 70 // Tab 栏
    const tagsScrollHeight = 60 // 标签栏
    scrollViewHeight.value = info.windowHeight - headerHeight - rankTabsHeight - tagsScrollHeight
    console.log('[发现页] 系统信息:', {
      screenHeight: info.screenHeight,
      windowHeight: info.windowHeight,
      statusBarHeight: statusBarHeight.value,
      scrollViewHeight: scrollViewHeight.value
    })
  } catch { /* ignore */ }
  loadStories()
  
  // 延迟检查实际渲染的高度
  setTimeout(() => {
    const query = uni.createSelectorQuery()
    query.select('.story-scroll').boundingClientRect((rect: any) => {
      console.log('[发现页] scroll-view 实际尺寸:', rect)
    })
    query.select('.rank-list').boundingClientRect((rect: any) => {
      console.log('[发现页] rank-list 实际尺寸:', rect)
    })
    query.exec()
  }, 1000)
})

onShow(() => {
  // 读取首页"更多"按钮传入的 sort 参数
  const initSort = uni.getStorageSync('discoverInitSort') as string
  if (initSort) {
    uni.removeStorageSync('discoverInitSort')
    // collab（开放协作）在发现页没有独立榜单，映射到热门榜
    const sortMap: Record<string, typeof currentSort.value> = {
      popular: 'popular',
      collab: 'popular',
      latest: 'latest',
    }
    const target = sortMap[initSort] || 'popular'
    if (currentSort.value !== target) {
      currentSort.value = target
      loadStories()
    }
  }
})

async function loadStories(reset = true) {
  if (reset) {
    loading.value = true
    page.value = 1
    noMore.value = false
    totalStories.value = 0
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
    // 使用后端返回的 total 字段来判断是否还有更多数据
    totalStories.value = res.total || 0
    noMore.value = stories.value.length >= totalStories.value
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

// 滚动事件监听（调试用）
let lastLogTime = 0
function onScroll(e: any) {
  const now = Date.now()
  // 每 500ms 打印一次，避免日志过多
  if (now - lastLogTime > 500) {
    lastLogTime = now
    console.log('[发现页] 滚动中', {
      scrollTop: e.detail.scrollTop,
      scrollHeight: e.detail.scrollHeight,
      containerHeight: scrollViewHeight.value,
      distanceToBottom: e.detail.scrollHeight - e.detail.scrollTop - scrollViewHeight.value
    })
  }
}

async function onLoadMore() {
  console.log('[发现页] onLoadMore 触发', {
    loadingMore: loadingMore.value,
    noMore: noMore.value,
    currentPage: page.value,
    storiesCount: stories.value.length,
    totalStories: totalStories.value
  })
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

// ===== 搜索栏 =====
.search-header {
  padding: 16rpx 24rpx 20rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

  .search-input-wrap {
    display: flex; align-items: center; gap: 12rpx;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 40rpx; padding: 16rpx 24rpx;

    .search-icon { font-size: 28rpx; }
    .search-placeholder { font-size: 26rpx; color: rgba(255, 255, 255, 0.4); }
  }
}

// ===== 榜单 Tab =====
.rank-tabs {
  position: relative;
  display: flex;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 0 0 0;

  .rank-tab {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 16rpx 0 24rpx; gap: 4rpx;

    .rank-tab-icon { font-size: 28rpx; opacity: 0.5; }
    .rank-tab-label { font-size: 24rpx; color: rgba(255, 255, 255, 0.5); font-weight: 500; }

    &.active {
      .rank-tab-icon { opacity: 1; }
      .rank-tab-label { color: #fff; font-weight: 700; }
    }
  }

  .rank-tab-indicator {
    position: absolute; bottom: 0; width: 33.33%; height: 4rpx;
    background: #7c6af7; border-radius: 4rpx 4rpx 0 0;
    transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// ===== 分类标签 =====
.tags-scroll {
  background: #fff;
  border-bottom: 1rpx solid #f1f5f9;
  padding-bottom: 16rpx;
}

.tags-list {
  display: flex; gap: 16rpx; padding: 16rpx 24rpx 0; white-space: nowrap;
}

.tag-item {
  display: inline-block; padding: 10rpx 24rpx;
  border-radius: 40rpx; font-size: 24rpx;
  color: #64748b; background: #f1f5f9;
  white-space: nowrap; flex-shrink: 0;

  &.active {
    background: #7c6af7; color: #fff; font-weight: 600;
  }
}

// ===== 故事滚动区 =====
.story-scroll {
  // 不使用 flex: 1，高度完全由 JS 内联样式控制
  // 这样才能让 scroll-view 产生滚动，触发 scrolltolower 事件
  overflow: hidden;
}

// ===== 榜单列表 =====
.rank-list {
  padding: 16rpx 24rpx;
  display: flex; flex-direction: column; gap: 0;
}

.rank-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
  background: #fff;

  &:first-child { border-radius: 20rpx 20rpx 0 0; padding-top: 24rpx; }
  &:last-child { border-bottom: none; border-radius: 0 0 20rpx 20rpx; padding-bottom: 24rpx; }

  // 排名徽章
  .rank-badge {
    width: 56rpx; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;

    .rank-medal { font-size: 36rpx; }
    .rank-num { font-size: 28rpx; font-weight: 700; color: #94a3b8; }
  }

  // 封面
  .rank-cover {
    width: 100rpx; height: 130rpx; border-radius: 12rpx; flex-shrink: 0;
    background: #e2e8f0;
  }

  // 信息
  .rank-info {
    flex: 1; overflow: hidden;

    .rank-title {
      font-size: 30rpx; font-weight: 600; color: #1e293b;
      display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      margin-bottom: 10rpx;
    }

    .rank-author-row {
      display: flex; align-items: center; gap: 8rpx; margin-bottom: 10rpx;

      .rank-avatar { width: 32rpx; height: 32rpx; border-radius: 50%; background: #e2e8f0; }
      .rank-author { font-size: 22rpx; color: #7c6af7; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rank-tag {
        font-size: 20rpx; color: #7c6af7;
        background: rgba(124, 106, 247, 0.1);
        padding: 2rpx 12rpx; border-radius: 20rpx; flex-shrink: 0;
      }
    }

    .rank-stats {
      display: flex; gap: 16rpx;
      .rank-stat { font-size: 20rpx; color: #94a3b8; }
    }
  }

  .rank-arrow { font-size: 40rpx; color: #cbd5e1; flex-shrink: 0; padding-right: 8rpx; }
}

// ===== 骨架屏 =====
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

%sk {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-rank-list {
  padding: 16rpx 24rpx; display: flex; flex-direction: column; gap: 0;

  .skeleton-rank-item {
    display: flex; align-items: center; gap: 16rpx;
    padding: 20rpx 0; border-bottom: 1rpx solid #f1f5f9; background: #fff;
    &:last-child { border-bottom: none; }

    .sk-rank { width: 56rpx; height: 40rpx; border-radius: 8rpx; @extend %sk; flex-shrink: 0; }
    .sk-cover { width: 100rpx; height: 130rpx; border-radius: 12rpx; flex-shrink: 0; @extend %sk; }
    .sk-lines { flex: 1; display: flex; flex-direction: column; gap: 12rpx;
      .sk-line { height: 24rpx; border-radius: 6rpx; @extend %sk;
        &.short { width: 60%; }
      }
    }
  }
}

// ===== 空状态 =====
.empty-state {
  display: flex; flex-direction: column; align-items: center; padding: 120rpx 0;
  .empty-icon { font-size: 100rpx; margin-bottom: 24rpx; }
  .empty-text { font-size: 30rpx; color: #475569; font-weight: 600; }
  .empty-sub { font-size: 24rpx; color: #94a3b8; margin-top: 12rpx; }
}

// ===== 加载状态提示 =====
.load-status {
  padding: 24rpx 32rpx;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
  font-size: 26rpx;
  color: #7c6af7;
  background: rgba(124, 106, 247, 0.08);
  border-radius: 16rpx;

  .loading-icon {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 16rpx 0;

  .no-more-line {
    flex: 1;
    height: 1rpx;
    background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
  }

  .no-more-text {
    font-size: 24rpx;
    color: #94a3b8;
    white-space: nowrap;
  }
}

.load-more-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx;
  background: linear-gradient(180deg, rgba(124, 106, 247, 0.05), rgba(124, 106, 247, 0.12));
  border-radius: 16rpx;
  border: 1rpx dashed rgba(124, 106, 247, 0.3);

  .hint-arrow {
    font-size: 32rpx;
    color: #7c6af7;
    animation: bounce 1.5s ease-in-out infinite;
  }

  .hint-text {
    font-size: 24rpx;
    color: #7c6af7;
    font-weight: 500;
  }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8rpx); }
}

// ===== 榜单排行依据说明 =====
.rank-basis-tip {
  padding: 20rpx 24rpx 8rpx;
  text-align: center;

  .rank-basis-text {
    font-size: 20rpx;
    color: #94a3b8;
    line-height: 1.6;
  }
}

.bottom-placeholder { height: 60rpx; }
</style>
