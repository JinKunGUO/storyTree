<template>
  <view class="index-page">
    <!-- 顶部导航栏 -->
    <view class="navbar">
      <view class="navbar-left">
        <image class="logo" src="/static/images/logo.png" mode="aspectFit" />
        <text class="app-name">StoryTree</text>
      </view>
      <view class="navbar-right">
        <view class="search-btn" @tap="goSearch">
          <text class="icon">🔍</text>
        </view>
        <view class="checkin-btn" @tap="goCheckin">
          <text class="icon">📅</text>
          <text v-if="!checkedIn" class="badge-dot" />
        </view>
      </view>
    </view>

    <scroll-view
      class="content"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <!-- 用户欢迎横幅 -->
      <view v-if="userStore.isLoggedIn" class="welcome-banner">
        <view class="welcome-left">
          <image
            class="avatar"
            :src="userStore.avatarUrl"
            mode="aspectFill"
            @tap="goProfile"
          />
          <view class="welcome-info">
            <text class="welcome-text">你好，{{ userStore.userInfo?.username }}</text>
            <view class="level-badge">
              <text class="level-text">Lv.{{ userStore.userInfo?.level }}</text>
              <text class="points-text">{{ userStore.userInfo?.points }} 积分</text>
            </view>
          </view>
        </view>
        <view class="streak-info" @tap="goCheckin">
          <text class="streak-num">{{ userStore.userInfo?.consecutive_days }}</text>
          <text class="streak-label">连续签到</text>
        </view>
      </view>

      <!-- 未登录横幅 -->
      <view v-else class="guest-banner" @tap="goLogin">
        <view class="guest-content">
          <text class="guest-title">加入 StoryTree</text>
          <text class="guest-sub">开启协作创作之旅</text>
        </view>
        <view class="guest-btn">
          <text>立即登录</text>
        </view>
      </view>

      <!-- 快捷功能入口 -->
      <view class="quick-actions">
        <view class="action-item" @tap="goCreate">
          <view class="action-icon-wrap action-create">
            <text class="action-icon">✍️</text>
          </view>
          <text class="action-label">开始创作</text>
        </view>
        <view class="action-item" @tap="goDiscover">
          <view class="action-icon-wrap action-discover">
            <text class="action-icon">🌟</text>
          </view>
          <text class="action-label">发现故事</text>
        </view>
        <view class="action-item" @tap="goMembership">
          <view class="action-icon-wrap action-member">
            <text class="action-icon">👑</text>
          </view>
          <text class="action-label">会员中心</text>
        </view>
        <view class="action-item" @tap="goPoints">
          <view class="action-icon-wrap action-points">
            <text class="action-icon">💎</text>
          </view>
          <text class="action-label">积分中心</text>
        </view>
      </view>

      <!-- 精选故事 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">精选故事</text>
          <text class="section-more" @tap="goDiscover">查看更多 →</text>
        </view>

        <scroll-view class="featured-scroll" scroll-x>
          <view class="featured-list">
            <view
              v-for="story in featuredStories"
              :key="story.id"
              class="featured-card"
              @tap="goStory(story.id)"
            >
              <image
                class="featured-cover"
                :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
                mode="aspectFill"
              />
              <view class="featured-overlay">
                <text class="featured-title">{{ story.title }}</text>
                <view class="featured-meta">
                  <text class="featured-author">{{ story.author.username }}</text>
                  <text class="featured-count">{{ story._count?.nodes || 0 }} 章节</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 最新故事 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">最新故事</text>
          <view class="sort-tabs">
            <text
              v-for="tab in sortTabs"
              :key="tab.value"
              class="sort-tab"
              :class="{ active: currentSort === tab.value }"
              @tap="changeSort(tab.value)"
            >
              {{ tab.label }}
            </text>
          </view>
        </view>

        <!-- 故事列表骨架屏 -->
        <view v-if="loading && stories.length === 0" class="skeleton-list">
          <view v-for="i in 3" :key="i" class="skeleton-card">
            <view class="skeleton-cover" />
            <view class="skeleton-content">
              <view class="skeleton-title" />
              <view class="skeleton-meta" />
            </view>
          </view>
        </view>

        <!-- 故事列表 -->
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
              <view class="story-meta">
                <view class="author-info">
                  <image
                    class="author-avatar"
                    :src="getImageUrl(story.author.avatar) || '/static/images/default-avatar.png'"
                    mode="aspectFill"
                  />
                  <text class="author-name">{{ story.author.username }}</text>
                </view>
                <view class="story-stats">
                  <text class="stat-item">{{ story._count?.nodes || 0 }} 章</text>
                  <text class="stat-item">{{ story._count?.followers || 0 }} 追更</text>
                </view>
              </view>
              <view v-if="story.tags" class="tag-list">
                <text
                  v-for="tag in story.tags.split(',').slice(0, 3)"
                  :key="tag"
                  class="tag"
                >
                  {{ tag.trim() }}
                </text>
              </view>
            </view>
          </view>
        </view>

        <!-- 加载更多 -->
        <view v-if="loadingMore" class="loading-more">
          <text>加载中...</text>
        </view>
        <view v-if="noMore && stories.length > 0" class="no-more">
          <text>没有更多了</text>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getFeaturedStories, getStories } from '@/api/stories'
import { getCheckinStatus } from '@/api/checkin'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'

const userStore = useUserStore()

const refreshing = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const checkedIn = ref(false)

const featuredStories = ref<Story[]>([])
const stories = ref<Story[]>([])
const currentSort = ref<'latest' | 'popular' | 'trending'>('latest')
const page = ref(1)
const pageSize = 10

const sortTabs = [
  { label: '最新', value: 'latest' as const },
  { label: '热门', value: 'popular' as const },
  { label: '趋势', value: 'trending' as const },
]

onMounted(async () => {
  await loadData()
  if (userStore.isLoggedIn) {
    checkCheckinStatus()
  }
})

async function loadData() {
  loading.value = true
  try {
    const [featuredRes, storiesRes] = await Promise.all([
      getFeaturedStories(),
      getStories({ page: 1, pageSize, sort: currentSort.value }),
    ])
    featuredStories.value = featuredRes.stories
    stories.value = storiesRes.stories
    page.value = 1
    noMore.value = storiesRes.stories.length < pageSize
  } catch (err) {
    console.error('加载数据失败', err)
  } finally {
    loading.value = false
  }
}

async function checkCheckinStatus() {
  try {
    const res = await getCheckinStatus()
    checkedIn.value = res.hasCheckedIn
  } catch {
    // 忽略
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadData()
  refreshing.value = false
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    const res = await getStories({
      page: page.value + 1,
      pageSize,
      sort: currentSort.value,
    })
    stories.value.push(...res.stories)
    page.value++
    noMore.value = res.stories.length < pageSize
  } catch (err) {
    console.error('加载更多失败', err)
  } finally {
    loadingMore.value = false
  }
}

async function changeSort(sort: typeof currentSort.value) {
  if (currentSort.value === sort) return
  currentSort.value = sort
  await loadData()
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

function goCheckin() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  uni.navigateTo({ url: '/pages/checkin/index' })
}

function goProfile() {
  uni.switchTab({ url: '/pages/profile/index' })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function goCreate() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  uni.switchTab({ url: '/pages/write/index' })
}

function goDiscover() {
  uni.switchTab({ url: '/pages/discover/index' })
}

function goMembership() {
  uni.navigateTo({ url: '/pages/membership/index' })
}

function goPoints() {
  uni.navigateTo({ url: '/pages/points/index' })
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
}
</script>

<style lang="scss" scoped>
.index-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 88rpx 32rpx 24rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .logo {
      width: 56rpx;
      height: 56rpx;
      border-radius: 12rpx;
    }

    .app-name {
      font-size: 36rpx;
      font-weight: 700;
      color: #ffffff;
    }
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 24rpx;

    .search-btn,
    .checkin-btn {
      position: relative;
      width: 64rpx;
      height: 64rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .icon {
        font-size: 40rpx;
      }

      .badge-dot {
        position: absolute;
        top: 8rpx;
        right: 8rpx;
        width: 16rpx;
        height: 16rpx;
        background: #ef4444;
        border-radius: 50%;
      }
    }
  }
}

.content {
  height: calc(100vh - 160rpx);
}

.welcome-banner {
  margin: 24rpx 24rpx 0;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .welcome-left {
    display: flex;
    align-items: center;
    gap: 20rpx;

    .avatar {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      border: 3rpx solid rgba(255, 255, 255, 0.4);
    }

    .welcome-info {
      .welcome-text {
        font-size: 28rpx;
        color: #ffffff;
        font-weight: 600;
      }

      .level-badge {
        display: flex;
        align-items: center;
        gap: 12rpx;
        margin-top: 6rpx;

        .level-text {
          font-size: 22rpx;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.2);
          padding: 4rpx 12rpx;
          border-radius: 20rpx;
        }

        .points-text {
          font-size: 22rpx;
          color: rgba(255, 255, 255, 0.8);
        }
      }
    }
  }

  .streak-info {
    display: flex;
    flex-direction: column;
    align-items: center;

    .streak-num {
      font-size: 48rpx;
      font-weight: 700;
      color: #ffffff;
      line-height: 1;
    }

    .streak-label {
      font-size: 20rpx;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 4rpx;
    }
  }
}

.guest-banner {
  margin: 24rpx 24rpx 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1rpx solid rgba(124, 106, 247, 0.3);

  .guest-content {
    .guest-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #ffffff;
    }

    .guest-sub {
      font-size: 24rpx;
      color: #94a3b8;
      margin-top: 6rpx;
      display: block;
    }
  }

  .guest-btn {
    background: #7c6af7;
    padding: 16rpx 28rpx;
    border-radius: 40rpx;

    text {
      font-size: 26rpx;
      color: #ffffff;
      font-weight: 600;
    }
  }
}

.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 32rpx 24rpx;
  background: #ffffff;
  margin: 24rpx 24rpx 0;
  border-radius: 24rpx;

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;

    .action-icon-wrap {
      width: 96rpx;
      height: 96rpx;
      border-radius: 24rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .action-icon {
        font-size: 44rpx;
      }

      &.action-create { background: rgba(124, 106, 247, 0.12); }
      &.action-discover { background: rgba(245, 158, 11, 0.12); }
      &.action-member { background: rgba(16, 185, 129, 0.12); }
      &.action-points { background: rgba(59, 130, 246, 0.12); }
    }

    .action-label {
      font-size: 24rpx;
      color: #475569;
    }
  }
}

.section {
  margin: 24rpx 24rpx 0;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .section-more {
      font-size: 24rpx;
      color: #7c6af7;
    }
  }
}

.featured-scroll {
  white-space: nowrap;
}

.featured-list {
  display: flex;
  gap: 20rpx;
  padding-bottom: 10rpx;
}

.featured-card {
  display: inline-block;
  width: 280rpx;
  height: 360rpx;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;

  .featured-cover {
    width: 100%;
    height: 100%;
  }

  .featured-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 24rpx 20rpx 20rpx;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);

    .featured-title {
      font-size: 26rpx;
      font-weight: 600;
      color: #ffffff;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .featured-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 8rpx;

      .featured-author,
      .featured-count {
        font-size: 20rpx;
        color: rgba(255, 255, 255, 0.7);
      }
    }
  }
}

.sort-tabs {
  display: flex;
  gap: 8rpx;

  .sort-tab {
    font-size: 24rpx;
    color: #94a3b8;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;

    &.active {
      background: rgba(124, 106, 247, 0.12);
      color: #7c6af7;
      font-weight: 600;
    }
  }
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.skeleton-card {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;

  .skeleton-cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 12rpx;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-top: 8rpx;

    .skeleton-title {
      height: 32rpx;
      border-radius: 8rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      width: 70%;
    }

    .skeleton-meta {
      height: 24rpx;
      border-radius: 8rpx;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      width: 50%;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.story-card {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;

  .story-cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 12rpx;
    flex-shrink: 0;
    background: #f0f2f5;
  }

  .story-info {
    flex: 1;
    overflow: hidden;

    .story-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
    }

    .story-desc {
      font-size: 24rpx;
      color: #64748b;
      margin-top: 8rpx;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .story-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12rpx;

      .author-info {
        display: flex;
        align-items: center;
        gap: 8rpx;

        .author-avatar {
          width: 36rpx;
          height: 36rpx;
          border-radius: 50%;
        }

        .author-name {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }

      .story-stats {
        display: flex;
        gap: 12rpx;

        .stat-item {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }

    .tag-list {
      display: flex;
      gap: 8rpx;
      margin-top: 10rpx;
      flex-wrap: wrap;

      .tag {
        font-size: 20rpx;
        color: #7c6af7;
        background: rgba(124, 106, 247, 0.08);
        padding: 4rpx 12rpx;
        border-radius: 20rpx;
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

.bottom-placeholder {
  height: 60rpx;
}
</style>

