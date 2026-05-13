<template>
  <view class="index-page">
    <!-- 顶部导航栏 -->
    <view class="navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
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

    <!-- 顶部主 Tab：推荐 / 关注 -->
    <view class="main-tabs">
      <view
        class="main-tab"
        :class="{ active: mainTab === 'recommend' }"
        @tap="switchMainTab('recommend')"
      >推荐</view>
      <view
        class="main-tab"
        :class="{ active: mainTab === 'follow' }"
        @tap="switchMainTab('follow')"
      >关注</view>
      <view class="main-tab-indicator" :style="{ left: mainTab === 'recommend' ? '0' : '50%' }" />
    </view>

    <!-- ===== 推荐 Tab ===== -->
    <scroll-view
      v-if="mainTab === 'recommend'"
      class="content"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefreshRecommend"
    >
      <!-- 轮播 Banner -->
      <swiper
        class="banner-swiper"
        circular
        autoplay
        :interval="4000"
        indicator-dots
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#ffffff"
      >
        <swiper-item
          v-for="story in bannerStories"
          :key="story.id"
          @tap="goStory(story.id)"
        >
          <view class="banner-item">
            <image
              class="banner-img"
              :src="getImageUrl(story.cover_image) || '/static/images/default-cover.jpg'"
              mode="aspectFill"
            />
            <view class="banner-overlay">
              <view class="banner-tags">
                <text v-if="story.tags" class="banner-tag">{{ story.tags.split(',')[0] }}</text>
                <text class="banner-tag hot">🔥 精选</text>
              </view>
              <text class="banner-title">{{ story.title }}</text>
              <view class="banner-meta">
                <text class="banner-author">{{ story.author?.username }}</text>
                <text class="banner-dot">·</text>
                <text class="banner-count">{{ story._count?.nodes || 0 }} 章节</text>
                <text class="banner-dot">·</text>
                <text class="banner-follow">{{ story._count?.followers || 0 }} 追更</text>
              </view>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- StoryTree 特色品牌区 -->
      <view class="feature-section">
        <view class="feature-list">
          <view class="feature-card tree">
            <text class="feature-icon">🌳</text>
            <text class="feature-name">树状叙事</text>
            <text class="feature-desc">故事像树一样生长，每个节点都是新的可能</text>
          </view>
          <view class="feature-card collab">
            <text class="feature-icon">👥</text>
            <text class="feature-name">协作创作</text>
            <text class="feature-desc">多位作者共同编织，让故事更加丰富多彩</text>
          </view>
          <view class="feature-card community">
            <text class="feature-icon">📖</text>
            <text class="feature-name">故事社区</text>
            <text class="feature-desc">追更你喜爱的故事，关注优秀的创作者</text>
          </view>
        </view>
      </view>

      <!-- 热门故事 -->
      <view class="rec-section">
        <view class="rec-header">
          <view class="rec-title-wrap">
            <text class="rec-dot" />
            <text class="rec-title">🔥 热门故事</text>
          </view>
          <text class="rec-more" @tap="goDiscover('popular')">更多</text>
        </view>
        <view v-if="loadingRecommend" class="skeleton-grid-2">
          <view v-for="i in 4" :key="i" class="skeleton-card-v">
            <view class="sk-cover" />
            <view class="sk-line" />
            <view class="sk-line short" />
          </view>
        </view>
        <scroll-view v-else scroll-x class="h-story-scroll">
          <view class="h-story-list">
            <view
              v-for="story in hotStories"
              :key="story.id"
              class="h-story-card"
              @tap="goStory(story.id)"
            >
              <image
                class="h-cover"
                :src="getImageUrl(story.cover_image) || '/static/images/default-cover.jpg'"
                mode="aspectFill"
              />
              <view class="h-info">
                <text class="h-title">{{ story.title }}</text>
                <text class="h-author">{{ story.author?.username }}</text>
                <view class="h-stats">
                  <text class="h-stat">{{ story._count?.nodes || 0 }}章</text>
                  <text class="h-stat">{{ story._count?.followers || 0 }}追更</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 开放协作故事 -->
      <view class="rec-section">
        <view class="rec-header">
          <view class="rec-title-wrap">
            <text class="rec-dot collab" />
            <text class="rec-title">🤝 开放协作</text>
          </view>
          <text class="rec-sub rec-more" @tap="goDiscover('collab')">更多</text>
        </view>
        <view v-if="loadingRecommend" class="skeleton-list-h">
          <view v-for="i in 3" :key="i" class="skeleton-row">
            <view class="sk-cover-sm" />
            <view class="sk-lines">
              <view class="sk-line" />
              <view class="sk-line short" />
            </view>
          </view>
        </view>
        <view v-else-if="collabStories.length === 0" class="rec-empty">
          <text class="rec-empty-text">暂无开放协作的故事</text>
        </view>
        <view v-else class="collab-list">
          <view
            v-for="story in collabStories"
            :key="story.id"
            class="collab-card"
            @tap="goStory(story.id)"
          >
            <image
              class="collab-cover"
              :src="getImageUrl(story.cover_image) || '/static/images/default-cover.jpg'"
              mode="aspectFill"
            />
            <view class="collab-info">
              <text class="collab-title">{{ story.title }}</text>
              <text class="collab-desc">{{ story.description || '暂无简介' }}</text>
              <view class="collab-meta">
                <view class="collab-open-badge">
                  <text class="collab-open-text">✍️ 开放续写</text>
                </view>
                <text class="collab-count">{{ story._count?.followers || 0 }} 人追更</text>
              </view>
            </view>
            <view class="collab-arrow">›</view>
          </view>
        </view>
      </view>

      <!-- 最新发布 -->
      <view class="rec-section">
        <view class="rec-header">
          <view class="rec-title-wrap">
            <text class="rec-dot new" />
            <text class="rec-title">🆕 最新发布</text>
          </view>
          <text class="rec-more" @tap="goDiscover('latest')">更多</text>
        </view>
        <view v-if="loadingRecommend" class="skeleton-list-h">
          <view v-for="i in 4" :key="i" class="skeleton-row">
            <view class="sk-cover-sm" />
            <view class="sk-lines">
              <view class="sk-line" />
              <view class="sk-line short" />
            </view>
          </view>
        </view>
        <view v-else class="latest-list">
          <view
            v-for="story in latestStories"
            :key="story.id"
            class="latest-card"
            @tap="goStory(story.id)"
          >
            <image
              class="latest-cover"
              :src="getImageUrl(story.cover_image) || '/static/images/default-cover.jpg'"
              mode="aspectFill"
            />
            <view class="latest-info">
              <text class="latest-title">{{ story.title }}</text>
              <text class="latest-author">{{ story.author?.username }}</text>
              <text class="latest-stats">{{ story._count?.nodes || 0 }} 章 · {{ story._count?.followers || 0 }} 追更</text>
            </view>
            <view class="latest-right">
              <text v-if="story.tags" class="latest-tag">{{ story.tags.split(',')[0] }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 未登录引导 -->
      <view v-if="!userStore.isLoggedIn" class="login-guide" @tap="goLogin">
        <view class="login-guide-inner">
          <text class="login-guide-icon">✨</text>
          <view class="login-guide-text">
            <text class="login-guide-title">登录后体验更多功能</text>
            <text class="login-guide-sub">追更故事 · 关注作者 · 参与协作</text>
          </view>
          <view class="login-guide-btn">立即登录</view>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- ===== 关注 Tab ===== -->
    <template v-if="mainTab === 'follow'">
      <!-- 未登录提示 -->
      <view v-if="!userStore.isLoggedIn" class="login-wall">
        <text class="login-wall-icon">🔐</text>
        <text class="login-wall-title">登录后查看关注动态</text>
        <text class="login-wall-sub">追更你喜爱的故事，关注优秀的创作者</text>
        <view class="login-wall-btn" @tap="goLogin">立即登录</view>
      </view>

      <!-- 已登录：动态子Tab -->
      <template v-else>
        <view class="feed-tabs">
          <view
            class="feed-tab"
            :class="{ active: feedTab === 'stories' }"
            @tap="switchFeedTab('stories')"
          >追更故事</view>
          <view
            class="feed-tab"
            :class="{ active: feedTab === 'authors' }"
            @tap="switchFeedTab('authors')"
          >关注作者</view>
          <view class="tab-indicator" :style="{ left: feedTab === 'stories' ? '0' : '50%' }" />
        </view>

        <scroll-view
          class="content"
          scroll-y
          :refresher-enabled="true"
          :refresher-triggered="refreshingFeed"
          @refresherrefresh="onRefreshFeed"
          @scrolltolower="onLoadMore"
        >
          <!-- 追更故事 Tab -->
          <template v-if="feedTab === 'stories'">
            <view v-if="loadingFeed && followedStories.length === 0" class="skeleton-list">
              <view v-for="i in 4" :key="i" class="skeleton-card">
                <view class="skeleton-cover" />
                <view class="skeleton-content">
                  <view class="skeleton-title" />
                  <view class="skeleton-meta" />
                  <view class="skeleton-meta short" />
                </view>
              </view>
            </view>
            <view v-else-if="!loadingFeed && followedStories.length === 0" class="empty-state">
              <text class="empty-icon">📖</text>
              <text class="empty-title">还没有追更的故事</text>
              <text class="empty-sub">去发现页找找感兴趣的故事吧</text>
              <view class="empty-btn" @tap="goDiscover">去发现</view>
            </view>
            <view v-else class="story-feed-list">
              <view
                v-for="item in followedStories"
                :key="item.story.id"
                class="story-feed-card"
                @tap="goStory(item.story.id)"
              >
                <image
                  class="story-cover"
                  :src="getImageUrl(item.story.cover_image) || '/static/images/default-cover.jpg'"
                  mode="aspectFill"
                />
                <view class="story-info">
                  <text class="story-title">{{ item.story.title }}</text>
                  <text class="story-desc">{{ item.story.description || '暂无简介' }}</text>
                  <view class="story-meta">
                    <text class="author-name">{{ item.story.author?.username }}</text>
                    <text class="chapter-count">{{ item.story._count?.nodes || 0 }} 章节</text>
                  </view>
                </view>
                <view class="story-arrow">›</view>
              </view>
            </view>
          </template>

          <!-- 关注作者 Tab -->
          <template v-else>
            <view v-if="loadingFeed && authorFeed.length === 0" class="skeleton-list">
              <view v-for="i in 4" :key="i" class="skeleton-feed">
                <view class="skeleton-avatar" />
                <view class="skeleton-content">
                  <view class="skeleton-title" />
                  <view class="skeleton-meta" />
                </view>
              </view>
            </view>
            <view v-else-if="!loadingFeed && authorFeed.length === 0" class="empty-state">
              <text class="empty-icon">👥</text>
              <text class="empty-title">还没有关注的作者</text>
              <text class="empty-sub">去发现优秀的创作者，关注他们的最新动态</text>
              <view class="empty-btn" @tap="goDiscover">去发现</view>
            </view>
            <view v-else class="author-feed-list">
              <view
                v-for="item in authorFeed"
                :key="item.id"
                class="author-feed-item"
                @tap="goChapter(item.id)"
              >
                <view class="feed-header">
                  <text class="feed-author">{{ item.author.username }}</text>
                  <text class="feed-story">在《{{ item.story.title }}》</text>
                  <text class="feed-action">发布了新章节</text>
                </view>
                <view class="feed-chapter">
                  <text class="chapter-title">{{ item.title }}</text>
                  <text class="chapter-time">{{ formatTime(item.created_at) }}</text>
                </view>
              </view>
            </view>
          </template>

          <view v-if="loadingMore" class="loading-more">加载中...</view>
          <view v-if="noMore && (followedStories.length > 0 || authorFeed.length > 0)" class="no-more">没有更多了</view>
          <view class="bottom-placeholder" />
        </scroll-view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { getFeaturedStories, getStories, getFollowedStories } from '@/api/stories'
import { getMyFeed } from '@/api/users'
import { getCheckinStatus } from '@/api/checkin'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'

const userStore = useUserStore()

const statusBarHeight = ref(20)
const checkedIn = ref(false)

// ===== 主 Tab =====
const mainTab = ref<'recommend' | 'follow'>('recommend')

// ===== 推荐 Tab 数据 =====
const loadingRecommend = ref(false)
const refreshing = ref(false)
const bannerStories = ref<Story[]>([])   // 轮播 Banner（精选故事，取前3个）
const hotStories = ref<Story[]>([])       // 热门故事（横向滚动）
const collabStories = ref<Story[]>([])    // 协作中故事
const latestStories = ref<Story[]>([])    // 最新发布

// ===== 关注 Tab 数据 =====
const loadingFeed = ref(false)
const refreshingFeed = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const feedTab = ref<'stories' | 'authors'>('stories')
const followedStories = ref<Array<{ story: Story; created_at: string }>>([])
const authorFeed = ref<Array<{
  id: number
  title: string
  created_at: string
  author: { id: number; username: string }
  story: { id: number; title: string }
}>>([])
const feedPage = ref(1)

// 检测分享落地携带的邀请码，存入 storage 供注册页读取
onLoad((query: any) => {
  if (query?.invite) {
    uni.setStorageSync('pendingInviteCode', query.invite)
  }
})

onMounted(async () => {
  try {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight || 20
  } catch { /* ignore */ }

  await loadRecommend()
  checkCheckinStatus()
})

onShow(() => {
  checkCheckinStatus()
  // 从登录页返回后，若当前在"关注" tab 且已登录但数据为空，自动加载
  if (mainTab.value === 'follow' && userStore.isLoggedIn && followedStories.value.length === 0 && authorFeed.value.length === 0) {
    loadFeed()
  }
})

// ===== 推荐 Tab 加载 =====

async function loadRecommend() {
  loadingRecommend.value = true
  try {
    const [featuredRes, hotRes, latestRes] = await Promise.all([
      getFeaturedStories(),
      getStories({ page: 1, pageSize: 8, sort: 'popular' }),
      getStories({ page: 1, pageSize: 6, sort: 'latest' }),
    ])

    // Banner 用精选故事（最多3个）
    bannerStories.value = featuredRes.stories.slice(0, 3)
    // 如果精选不足3个，用热门补充
    if (bannerStories.value.length < 2) {
      bannerStories.value = hotRes.stories.slice(0, 3)
    }

    hotStories.value = hotRes.stories

    // 开放协作：allow_branch=true 的故事（不依赖 collaborators 字段，后端列表接口不返回该字段）
    // 优先从精选 + 热门里取，不够则从最新里补
    const candidatePool = [...featuredRes.stories, ...hotRes.stories, ...latestRes.stories]
    const seen = new Set<number>()
    const collabCandidates: typeof candidatePool = []
    for (const s of candidatePool) {
      if (s.allow_branch && !seen.has(s.id)) {
        seen.add(s.id)
        collabCandidates.push(s)
        if (collabCandidates.length >= 5) break
      }
    }
    collabStories.value = collabCandidates

    latestStories.value = latestRes.stories
  } catch (err) {
    console.error('加载推荐失败', err)
  } finally {
    loadingRecommend.value = false
  }
}

async function onRefreshRecommend() {
  refreshing.value = true
  await loadRecommend()
  refreshing.value = false
}

// ===== 主 Tab 切换 =====

async function switchMainTab(tab: 'recommend' | 'follow') {
  mainTab.value = tab
  if (tab === 'follow' && userStore.isLoggedIn && followedStories.value.length === 0 && authorFeed.value.length === 0) {
    await loadFeed()
  }
}

// ===== 关注 Tab 加载 =====

async function switchFeedTab(tab: 'stories' | 'authors') {
  feedTab.value = tab
  await loadFeed(true)
}

async function loadFeed(reset = true) {
  if (reset) {
    loadingFeed.value = true
    feedPage.value = 1
    noMore.value = false
  }
  try {
    if (feedTab.value === 'stories') {
      const res = await getFollowedStories(userStore.userInfo!.id, { page: feedPage.value, pageSize: 15 })
      if (reset) {
        followedStories.value = res.follows
      } else {
        followedStories.value.push(...res.follows)
        noMore.value = res.follows.length < 15
      }
    } else {
      const res = await getMyFeed()
      authorFeed.value = res.feed
      noMore.value = true
    }
  } catch (err) {
    console.error('加载动态失败', err)
  } finally {
    loadingFeed.value = false
  }
}

async function onRefreshFeed() {
  refreshingFeed.value = true
  await loadFeed(true)
  refreshingFeed.value = false
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value || feedTab.value === 'authors') return
  loadingMore.value = true
  feedPage.value++
  await loadFeed(false)
  loadingMore.value = false
}

// ===== 公共 =====

async function checkCheckinStatus() {
  try {
    const res = await getCheckinStatus()
    checkedIn.value = !res.canCheckin
  } catch { /* ignore */ }
}

function formatTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

function goCheckin() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pkgAuth/pages/auth/login/index' })
    return
  }
  uni.navigateTo({ url: '/pkgMisc/pages/checkin/index' })
}

function goLogin() {
  uni.navigateTo({ url: '/pkgAuth/pages/auth/login/index' })
}

function goDiscover(sort: 'popular' | 'collab' | 'latest' = 'popular') {
  // switchTab 不支持传参，通过 storage 中转
  uni.setStorageSync('discoverInitSort', sort)
  uni.switchTab({ url: '/pages/discover/index' })
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pkgStory/pages/story/index?id=${id}` })
}

function goChapter(id: number) {
  uni.navigateTo({ url: `/pkgStory/pages/chapter/index?id=${id}` })
}
</script>

<style lang="scss" scoped>
// ===== 基础布局 =====
.index-page {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

// ===== 导航栏 =====
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .logo { width: 56rpx; height: 56rpx; border-radius: 12rpx; }
    .app-name { font-size: 36rpx; font-weight: 700; color: #fff; }
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 24rpx;

    .search-btn, .checkin-btn {
      position: relative;
      width: 64rpx; height: 64rpx;
      display: flex; align-items: center; justify-content: center;
      .icon { font-size: 40rpx; }
      .badge-dot {
        position: absolute; top: 8rpx; right: 8rpx;
        width: 16rpx; height: 16rpx;
        background: #ef4444; border-radius: 50%;
      }
    }
  }
}

// ===== 主 Tab（推荐/关注）=====
.main-tabs {
  position: relative;
  display: flex;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 0 32rpx;

  .main-tab {
    flex: 1;
    text-align: center;
    font-size: 30rpx;
    color: rgba(255, 255, 255, 0.5);
    padding: 18rpx 0 26rpx;
    font-weight: 500;

    &.active { color: #fff; font-weight: 700; }
  }

  .main-tab-indicator {
    position: absolute;
    bottom: 0; width: 50%; height: 4rpx;
    background: #7c6af7;
    border-radius: 4rpx 4rpx 0 0;
    transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// ===== 内容滚动区 =====
.content {
  flex: 1;
  height: 0;
  min-height: 0;
}

// ===== 轮播 Banner =====
.banner-swiper {
  width: 100%;
  height: 420rpx;

  .banner-item {
    width: 100%; height: 100%;
    position: relative;

    .banner-img { width: 100%; height: 100%; }

    .banner-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 60rpx 32rpx 32rpx;
      background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);

      .banner-tags {
        display: flex; gap: 12rpx; margin-bottom: 12rpx;

        .banner-tag {
          font-size: 20rpx; color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.15);
          padding: 4rpx 16rpx; border-radius: 20rpx;
          border: 1rpx solid rgba(255,255,255,0.2);

          &.hot { background: rgba(124,106,247,0.7); border-color: transparent; }
        }
      }

      .banner-title {
        font-size: 40rpx; font-weight: 700; color: #fff;
        display: block; margin-bottom: 12rpx;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .banner-meta {
        display: flex; align-items: center; gap: 8rpx;

        .banner-author, .banner-count, .banner-follow {
          font-size: 22rpx; color: rgba(255,255,255,0.7);
        }
        .banner-dot { font-size: 22rpx; color: rgba(255,255,255,0.4); }
      }
    }
  }
}

// ===== 特色品牌区 =====
.feature-section {
  padding: 24rpx 24rpx 8rpx;
  background: #fff;
  margin-bottom: 16rpx;

  .feature-list {
    display: flex; gap: 16rpx;

    .feature-card {
      flex: 1;
      padding: 24rpx 16rpx;
      border-radius: 20rpx;
      display: flex; flex-direction: column; gap: 8rpx;

      &.tree { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
      &.collab { background: linear-gradient(135deg, #faf5ff, #ede9fe); }
      &.community { background: linear-gradient(135deg, #fff7ed, #fed7aa); }

      .feature-icon { font-size: 48rpx; }
      .feature-name { font-size: 26rpx; font-weight: 700; color: #1e293b; }
      .feature-desc { font-size: 20rpx; color: #64748b; line-height: 1.5; }
    }
  }
}

// ===== 推荐区块通用 =====
.rec-section {
  margin: 0 0 16rpx;
  background: #fff;
  padding: 24rpx 24rpx 20rpx;

  .rec-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20rpx;

    .rec-title-wrap {
      display: flex; align-items: center; gap: 10rpx;

      .rec-dot {
        width: 8rpx; height: 28rpx; border-radius: 4rpx;
        background: #ef4444;
        &.collab { background: #7c6af7; }
        &.new { background: #22c55e; }
      }

      .rec-title { font-size: 32rpx; font-weight: 700; color: #1e293b; }
    }

    .rec-more { font-size: 24rpx; color: #7c6af7; }
    .rec-sub { font-size: 22rpx; color: #94a3b8; }
  }

  .rec-empty { padding: 24rpx 0; text-align: center;
    .rec-empty-text { font-size: 26rpx; color: #94a3b8; }
  }
}

// ===== 热门故事（横向卡片）=====
.h-story-scroll { white-space: nowrap; overflow: hidden; }

.h-story-list {
  display: flex; gap: 16rpx; padding-bottom: 8rpx;

  .h-story-card {
    flex-shrink: 0; width: 200rpx;

    .h-cover {
      width: 200rpx; height: 260rpx; border-radius: 16rpx;
      display: block; background: #f0f2f5;
    }

    .h-info {
      padding: 10rpx 4rpx 0;

      .h-title {
        font-size: 26rpx; font-weight: 600; color: #1e293b;
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 6rpx;
      }
      .h-author { font-size: 22rpx; color: #7c6af7; display: block; margin-bottom: 6rpx; }
      .h-stats { display: flex; gap: 12rpx;
        .h-stat { font-size: 20rpx; color: #94a3b8; }
      }
    }
  }
}

// ===== 协作中故事（竖向列表）=====
.collab-list {
  display: flex; flex-direction: column; gap: 16rpx;

  .collab-card {
    display: flex; align-items: center; gap: 20rpx;
    background: #f8fafc; border-radius: 16rpx; padding: 16rpx;

    .collab-cover {
      width: 100rpx; height: 130rpx; border-radius: 12rpx; flex-shrink: 0;
      background: #e2e8f0;
    }

    .collab-info {
      flex: 1; overflow: hidden;

      .collab-title {
        font-size: 28rpx; font-weight: 600; color: #1e293b;
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 8rpx;
      }
      .collab-desc {
        font-size: 22rpx; color: #64748b; display: block; margin-bottom: 12rpx;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .collab-meta {
        display: flex; align-items: center; gap: 12rpx;

        .collab-open-badge {
          background: rgba(124, 106, 247, 0.1);
          border-radius: 20rpx;
          padding: 4rpx 14rpx;

          .collab-open-text {
            font-size: 20rpx; color: #7c6af7; font-weight: 500;
          }
        }
        .collab-count { font-size: 20rpx; color: #94a3b8; }
      }
    }
    .collab-arrow { font-size: 40rpx; color: #cbd5e1; flex-shrink: 0; }
  }
}

// ===== 最新发布（竖向列表）=====
.latest-list {
  display: flex; flex-direction: column; gap: 0;

  .latest-card {
    display: flex; align-items: center; gap: 20rpx;
    padding: 16rpx 0;
    border-bottom: 1rpx solid #f1f5f9;

    &:last-child { border-bottom: none; }

    .latest-cover {
      width: 90rpx; height: 120rpx; border-radius: 10rpx; flex-shrink: 0;
      background: #e2e8f0;
    }

    .latest-info {
      flex: 1; overflow: hidden;

      .latest-title {
        font-size: 28rpx; font-weight: 600; color: #1e293b;
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 8rpx;
      }
      .latest-author { font-size: 22rpx; color: #7c6af7; display: block; margin-bottom: 6rpx; }
      .latest-stats { font-size: 20rpx; color: #94a3b8; }
    }

    .latest-right {
      flex-shrink: 0; margin-left: 8rpx;

      .latest-tag {
        font-size: 20rpx; color: #7c6af7;
        background: rgba(124,106,247,0.1);
        padding: 4rpx 14rpx; border-radius: 20rpx;
      }
    }
  }
}

// ===== 未登录引导条 =====
.login-guide {
  margin: 0 0 16rpx;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 24rpx 32rpx;

  .login-guide-inner {
    display: flex; align-items: center; gap: 16rpx;

    .login-guide-icon { font-size: 40rpx; flex-shrink: 0; }

    .login-guide-text {
      flex: 1;
      .login-guide-title { font-size: 28rpx; font-weight: 600; color: #fff; display: block; margin-bottom: 4rpx; }
      .login-guide-sub { font-size: 22rpx; color: rgba(255,255,255,0.5); }
    }

    .login-guide-btn {
      background: #7c6af7; color: #fff;
      font-size: 24rpx; font-weight: 600;
      padding: 14rpx 28rpx; border-radius: 40rpx; flex-shrink: 0;
    }
  }
}

// ===== 关注Tab：未登录墙 =====
.login-wall {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 80rpx 48rpx;

  .login-wall-icon { font-size: 100rpx; margin-bottom: 24rpx; }
  .login-wall-title { font-size: 32rpx; font-weight: 600; color: #1e293b; margin-bottom: 12rpx; }
  .login-wall-sub { font-size: 26rpx; color: #94a3b8; text-align: center; margin-bottom: 48rpx; line-height: 1.6; }
  .login-wall-btn {
    background: linear-gradient(135deg, #7c6af7, #a78bfa);
    color: #fff; font-size: 28rpx; font-weight: 600;
    padding: 20rpx 64rpx; border-radius: 40rpx;
  }
}

// ===== 关注Tab：子Tab（追更故事/关注作者）=====
.feed-tabs {
  position: relative; display: flex;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 0 32rpx;

  .feed-tab {
    flex: 1; text-align: center;
    font-size: 28rpx; color: rgba(255,255,255,0.5);
    padding: 16rpx 0 24rpx; font-weight: 500;
    &.active { color: #fff; font-weight: 600; }
  }

  .tab-indicator {
    position: absolute; bottom: 0; width: 50%; height: 4rpx;
    background: #7c6af7; border-radius: 4rpx 4rpx 0 0;
    transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// ===== 追更故事列表 =====
.story-feed-list {
  padding: 16rpx 24rpx;
  display: flex; flex-direction: column; gap: 20rpx;
}

.story-feed-card {
  display: flex; align-items: center; gap: 20rpx;
  background: #fff; border-radius: 20rpx; padding: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

  .story-cover { width: 120rpx; height: 160rpx; border-radius: 12rpx; flex-shrink: 0; }

  .story-info {
    flex: 1; overflow: hidden;

    .story-title {
      font-size: 30rpx; font-weight: 600; color: #1e293b; display: block;
      margin-bottom: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .story-desc {
      font-size: 24rpx; color: #64748b; display: block; margin-bottom: 16rpx;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .story-meta { display: flex; gap: 16rpx;
      .author-name { font-size: 22rpx; color: #7c6af7; }
      .chapter-count { font-size: 22rpx; color: #94a3b8; }
    }
  }
  .story-arrow { font-size: 40rpx; color: #cbd5e1; flex-shrink: 0; }
}

// ===== 关注作者动态 =====
.author-feed-list {
  padding: 16rpx 24rpx;
  display: flex; flex-direction: column; gap: 16rpx;
}

.author-feed-item {
  background: #fff; border-radius: 20rpx; padding: 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);

  .feed-header {
    display: flex; align-items: center; flex-wrap: wrap; gap: 4rpx; margin-bottom: 16rpx;
    .feed-author { font-size: 26rpx; font-weight: 600; color: #7c6af7; }
    .feed-story { font-size: 24rpx; color: #64748b; }
    .feed-action { font-size: 24rpx; color: #94a3b8; }
  }

  .feed-chapter {
    display: flex; align-items: center; justify-content: space-between;
    background: #f8fafc; border-radius: 12rpx; padding: 16rpx 20rpx;
    .chapter-title {
      font-size: 28rpx; color: #1e293b; font-weight: 500;
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .chapter-time { font-size: 22rpx; color: #94a3b8; flex-shrink: 0; margin-left: 16rpx; }
  }
}

// ===== 空状态 =====
.empty-state {
  display: flex; flex-direction: column; align-items: center; padding: 120rpx 48rpx;
  .empty-icon { font-size: 100rpx; margin-bottom: 24rpx; }
  .empty-title { font-size: 32rpx; font-weight: 600; color: #1e293b; margin-bottom: 12rpx; }
  .empty-sub { font-size: 26rpx; color: #94a3b8; text-align: center; margin-bottom: 40rpx; line-height: 1.6; }
  .empty-btn {
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #fff; font-size: 28rpx; font-weight: 600;
    padding: 20rpx 60rpx; border-radius: 40rpx;
  }
}

// ===== 骨架屏 =====
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

%shimmer-base {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-grid-2 {
  display: flex; gap: 16rpx; padding: 0 0 8rpx; overflow: hidden;

  .skeleton-card-v {
    flex-shrink: 0; width: 200rpx;
    .sk-cover { width: 200rpx; height: 260rpx; border-radius: 16rpx; @extend %shimmer-base; }
    .sk-line { height: 24rpx; border-radius: 6rpx; margin-top: 10rpx; @extend %shimmer-base;
      &.short { width: 60%; }
    }
  }
}

.skeleton-list-h {
  display: flex; flex-direction: column; gap: 16rpx;

  .skeleton-row {
    display: flex; gap: 16rpx; align-items: center;
    .sk-cover-sm { width: 90rpx; height: 120rpx; border-radius: 10rpx; flex-shrink: 0; @extend %shimmer-base; }
    .sk-lines { flex: 1; display: flex; flex-direction: column; gap: 10rpx;
      .sk-line { height: 24rpx; border-radius: 6rpx; @extend %shimmer-base;
        &.short { width: 60%; }
      }
    }
  }
}

.skeleton-list {
  padding: 16rpx 24rpx; display: flex; flex-direction: column; gap: 20rpx;
}

.skeleton-card {
  display: flex; gap: 20rpx; padding: 20rpx; background: #fff; border-radius: 20rpx;
  .skeleton-cover { width: 120rpx; height: 160rpx; border-radius: 12rpx; flex-shrink: 0; @extend %shimmer-base; }
  .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 12rpx; padding-top: 8rpx; }
}

.skeleton-feed {
  display: flex; gap: 20rpx; padding: 24rpx; background: #fff; border-radius: 20rpx;
  .skeleton-avatar { width: 72rpx; height: 72rpx; border-radius: 50%; flex-shrink: 0; @extend %shimmer-base; }
  .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 12rpx; padding-top: 8rpx; }
}

.skeleton-title { height: 32rpx; border-radius: 8rpx; @extend %shimmer-base; }
.skeleton-meta { height: 24rpx; border-radius: 8rpx; @extend %shimmer-base;
  &.short { width: 60%; }
}

// ===== 通用 =====
.loading-more, .no-more {
  text-align: center; padding: 32rpx;
  font-size: 24rpx; color: #94a3b8;
}

.bottom-placeholder { height: 60rpx; }
</style>
