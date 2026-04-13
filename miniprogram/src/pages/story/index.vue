<template>
  <view class="story-page">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-page">
      <view class="loading-spinner" />
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="story">
      <!-- 封面区域 -->
      <view class="cover-section">
        <image
          class="cover-bg"
          :src="story.cover_image || '/static/images/default-cover.png'"
          mode="aspectFill"
        />
        <view class="cover-overlay" />

        <!-- 返回按钮 -->
        <view class="nav-bar">
          <view class="back-btn" @tap="goBack">
            <text class="back-icon">←</text>
          </view>
          <view class="nav-actions">
            <view class="nav-btn" @tap="toggleBookmark">
              <text>{{ isBookmarked ? '❤️' : '🤍' }}</text>
            </view>
            <view class="nav-btn" @tap="shareStory">
              <text>📤</text>
            </view>
          </view>
        </view>

        <!-- 故事基本信息 -->
        <view class="story-header">
          <text class="story-title">{{ story.title }}</text>
          <view class="story-meta">
            <image
              class="author-avatar"
              :src="story.author.avatar || '/static/images/default-avatar.png'"
              mode="aspectFill"
            />
            <text class="author-name">{{ story.author.username }}</text>
            <text class="story-time">{{ formatTime(story.created_at) }}</text>
          </view>
          <view class="story-stats-row">
            <view class="stat-badge">
              <text class="stat-icon">📖</text>
              <text class="stat-val">{{ story._count?.nodes || 0 }} 章节</text>
            </view>
            <view class="stat-badge">
              <text class="stat-icon">👥</text>
              <text class="stat-val">{{ story._count?.followers || 0 }} 追更</text>
            </view>
            <view class="stat-badge">
              <text class="stat-icon">🔖</text>
              <text class="stat-val">{{ story._count?.bookmarks || 0 }} 收藏</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 内容区域 -->
      <scroll-view class="content-scroll" scroll-y>
        <!-- 简介 -->
        <view class="section-card">
          <text class="section-title">故事简介</text>
          <text class="story-desc">{{ story.description || '暂无简介' }}</text>

          <!-- 标签 -->
          <view v-if="story.tags" class="tag-list">
            <text
              v-for="tag in story.tags.split(',')"
              :key="tag"
              class="tag"
            >
              {{ tag.trim() }}
            </text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="action-row">
          <button
            class="btn-follow"
            :class="{ followed: isFollowed }"
            @tap="toggleFollow"
          >
            {{ isFollowed ? '✓ 已追更' : '+ 追更' }}
          </button>
          <button class="btn-read" @tap="startReading">
            开始阅读 →
          </button>
        </view>

        <!-- 故事树 -->
        <view class="section-card">
          <view class="section-header">
            <text class="section-title">故事树</text>
            <text class="section-sub">{{ story._count?.nodes || 0 }} 个节点</text>
          </view>

          <!-- 节点树加载中 -->
          <view v-if="nodesLoading" class="nodes-loading">
            <text>加载故事树...</text>
          </view>

          <!-- 根节点 -->
          <view v-else-if="rootNode" class="root-node" @tap="goChapter(rootNode.id)">
            <view class="node-icon">🌳</view>
            <view class="node-info">
              <text class="node-title">{{ rootNode.title }}</text>
              <view class="node-meta">
                <text class="node-author">{{ rootNode.author.username }}</text>
                <text class="node-children">
                  {{ rootNode._count?.other_nodes || 0 }} 个分支
                </text>
              </view>
            </view>
            <text class="node-arrow">›</text>
          </view>
        </view>

        <!-- 协作者 -->
        <view v-if="story.allow_branch" class="section-card">
          <text class="section-title">协作创作</text>
          <text class="collab-desc">
            这是一个开放的协作故事，任何人都可以续写新的分支
          </text>
          <button
            v-if="userStore.isLoggedIn"
            class="btn-collab"
            @tap="startCollaborate"
          >
            ✍️ 参与续写
          </button>
          <button v-else class="btn-collab" @tap="goLogin">
            登录后参与续写
          </button>
        </view>

        <view class="bottom-placeholder" />
      </scroll-view>
    </template>

    <!-- 错误状态 -->
    <view v-else class="error-page">
      <text class="error-icon">😢</text>
      <text class="error-text">故事不存在或已被删除</text>
      <button class="btn-back" @tap="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getStory, followStory, unfollowStory, bookmarkStory, unbookmarkStory } from '@/api/stories'
import { getStoryNodes } from '@/api/nodes'
import { formatRelativeTime } from '@/utils/helpers'
import type { Story } from '@/api/stories'
import type { Node } from '@/api/nodes'

const userStore = useUserStore()

const loading = ref(true)
const nodesLoading = ref(true)
const story = ref<Story | null>(null)
const rootNode = ref<Node | null>(null)
const isFollowed = ref(false)
const isBookmarked = ref(false)

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const storyId = Number(currentPage.options?.id)
  if (storyId) {
    loadStory(storyId)
  }
})

async function loadStory(id: number) {
  loading.value = true
  try {
    const res = await getStory(id)
    story.value = res.story
    isFollowed.value = res.story.isFollowed ?? false
    isBookmarked.value = res.story.isBookmarked ?? false

    // 加载节点树
    loadNodes(id)
  } catch (err) {
    console.error('加载故事失败', err)
  } finally {
    loading.value = false
  }
}

async function loadNodes(storyId: number) {
  nodesLoading.value = true
  try {
    const res = await getStoryNodes(storyId)
    rootNode.value = res.rootNode
  } catch (err) {
    console.error('加载节点失败', err)
  } finally {
    nodesLoading.value = false
  }
}

async function toggleFollow() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  try {
    if (isFollowed.value) {
      await unfollowStory(story.value!.id)
      isFollowed.value = false
    } else {
      await followStory(story.value!.id)
      isFollowed.value = true
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function toggleBookmark() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  try {
    if (isBookmarked.value) {
      await unbookmarkStory(story.value!.id)
      isBookmarked.value = false
      uni.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      await bookmarkStory(story.value!.id)
      isBookmarked.value = true
      uni.showToast({ title: '收藏成功', icon: 'success' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

function startReading() {
  if (rootNode.value) {
    goChapter(rootNode.value.id)
  }
}

function goChapter(nodeId: number) {
  uni.navigateTo({ url: `/pages/chapter/index?id=${nodeId}` })
}

function startCollaborate() {
  uni.navigateTo({ url: `/pages/write/index?storyId=${story.value?.id}&parentId=${rootNode.value?.id}` })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function shareStory() {
  uni.showShareMenu({ withShareTicket: true })
}

function goBack() {
  uni.navigateBack()
}

function formatTime(date: string) {
  return formatRelativeTime(date)
}
</script>

<style lang="scss" scoped>
.story-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;

  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid #f0f2f5;
    border-top-color: #7c6af7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 20rpx;
  }

  .loading-text {
    font-size: 26rpx;
    color: #94a3b8;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cover-section {
  position: relative;
  height: 520rpx;

  .cover-bg {
    width: 100%;
    height: 100%;
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%);
  }
}

.nav-bar {
  position: absolute;
  top: 88rpx;
  left: 0;
  right: 0;
  padding: 0 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    .back-icon {
      font-size: 36rpx;
      color: #ffffff;
    }
  }

  .nav-actions {
    display: flex;
    gap: 16rpx;

    .nav-btn {
      width: 64rpx;
      height: 64rpx;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32rpx;
    }
  }
}

.story-header {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 32rpx 32rpx;

  .story-title {
    font-size: 40rpx;
    font-weight: 700;
    color: #ffffff;
    display: block;
    margin-bottom: 16rpx;
  }

  .story-meta {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 16rpx;

    .author-avatar {
      width: 48rpx;
      height: 48rpx;
      border-radius: 50%;
      border: 2rpx solid rgba(255, 255, 255, 0.4);
    }

    .author-name {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.9);
    }

    .story-time {
      font-size: 22rpx;
      color: rgba(255, 255, 255, 0.6);
    }
  }

  .story-stats-row {
    display: flex;
    gap: 16rpx;

    .stat-badge {
      display: flex;
      align-items: center;
      gap: 6rpx;
      background: rgba(255, 255, 255, 0.15);
      padding: 8rpx 16rpx;
      border-radius: 20rpx;

      .stat-icon {
        font-size: 24rpx;
      }

      .stat-val {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.9);
      }
    }
  }
}

.content-scroll {
  height: calc(100vh - 520rpx);
}

.section-card {
  margin: 20rpx 24rpx 0;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx 28rpx;

  .section-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 16rpx;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;

    .section-sub {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }
}

.story-desc {
  font-size: 26rpx;
  color: #475569;
  line-height: 1.8;
  display: block;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;

  .tag {
    font-size: 22rpx;
    color: #7c6af7;
    background: rgba(124, 106, 247, 0.08);
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
  }
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin: 20rpx 24rpx 0;

  .btn-follow {
    flex: 1;
    height: 88rpx;
    border: 2rpx solid #7c6af7;
    background: transparent;
    color: #7c6af7;
    font-size: 28rpx;
    font-weight: 600;
    border-radius: 16rpx;

    &.followed {
      background: rgba(124, 106, 247, 0.1);
    }
  }

  .btn-read {
    flex: 2;
    height: 88rpx;
    background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
    color: #ffffff;
    font-size: 28rpx;
    font-weight: 600;
    border-radius: 16rpx;
    border: none;
  }
}

.nodes-loading {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #94a3b8;
}

.root-node {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  background: #f8fafc;
  border-radius: 16rpx;

  .node-icon {
    font-size: 48rpx;
  }

  .node-info {
    flex: 1;

    .node-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
      display: block;
    }

    .node-meta {
      display: flex;
      gap: 16rpx;
      margin-top: 8rpx;

      .node-author,
      .node-children {
        font-size: 22rpx;
        color: #94a3b8;
      }
    }
  }

  .node-arrow {
    font-size: 40rpx;
    color: #7c6af7;
  }
}

.collab-desc {
  font-size: 26rpx;
  color: #64748b;
  line-height: 1.7;
  display: block;
  margin-bottom: 20rpx;
}

.btn-collab {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
}

.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;

  .error-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .error-text {
    font-size: 28rpx;
    color: #475569;
    margin-bottom: 40rpx;
  }

  .btn-back {
    background: #7c6af7;
    color: #ffffff;
    padding: 20rpx 60rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    border: none;
  }
}

.bottom-placeholder {
  height: 60rpx;
}
</style>

