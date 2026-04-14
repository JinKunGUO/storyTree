<template>
  <view class="chapter-page" :style="{ background: bgColors[settings.theme] }">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar" :class="{ hidden: hideNav }">
      <view class="navbar-inner">
        <view class="back-btn" @tap="goBack">
          <text class="back-icon" :style="{ color: textColors[settings.theme] }">←</text>
        </view>
        <view class="navbar-title">
          <text class="chapter-title-nav" :style="{ color: textColors[settings.theme] }">
            {{ node?.title || '阅读' }}
          </text>
        </view>
        <view class="setting-btn" @tap="showSettings = true">
          <text :style="{ color: textColors[settings.theme] }">Aa</text>
        </view>
      </view>
    </view>

    <!-- 阅读内容 -->
    <scroll-view
      class="reading-scroll"
      scroll-y
      @tap="toggleNav"
      @scroll="onScroll"
    >
      <view v-if="loading" class="loading-wrap">
        <view class="loading-spinner" />
      </view>

      <view v-else-if="node" class="reading-content" :style="contentStyle">
        <!-- 章节标题 -->
        <text class="chapter-title" :style="{ color: textColors[settings.theme] }">
          {{ node.title }}
        </text>

        <!-- 作者信息 -->
        <view class="author-row">
          <image
            class="author-avatar"
            :src="getImageUrl(node.author.avatar) || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
          <text class="author-name" :style="{ color: subTextColors[settings.theme] }">
            {{ node.author.username }}
          </text>
          <text class="read-count" :style="{ color: subTextColors[settings.theme] }">
            {{ node.read_count }} 次阅读
          </text>
        </view>

        <!-- 章节插图 -->
        <image
          v-if="node.image"
          class="chapter-image"
          :src="node.image"
          mode="widthFix"
        />

        <!-- 正文内容 -->
        <text
          class="chapter-content"
          :style="{
            fontSize: settings.fontSize + 'rpx',
            lineHeight: settings.lineHeight,
            color: textColors[settings.theme],
          }"
        >{{ node.content }}</text>

        <!-- 评分 -->
        <view class="rating-section">
          <text class="rating-label" :style="{ color: subTextColors[settings.theme] }">
            给这个章节评分
          </text>
          <view class="stars">
            <text
              v-for="star in 5"
              :key="star"
              class="star"
              :class="{ active: (userRating || node.rating_avg) >= star }"
              @tap="rateChapter(star)"
            >
              ★
            </text>
          </view>
          <text class="rating-avg" :style="{ color: subTextColors[settings.theme] }">
            {{ node.rating_avg.toFixed(1) }} ({{ node.rating_count }} 人评分)
          </text>
        </view>

        <!-- 分支选择 -->
        <view v-if="children.length > 0" class="branches-section">
          <view class="branches-header">
            <text class="branches-title">选择你的故事走向</text>
            <text class="branches-count">{{ children.length }} 个分支</text>
          </view>
          <view
            v-for="child in children"
            :key="child.id"
            class="branch-card"
            @tap="goChapter(child.id)"
          >
            <view class="branch-info">
              <text class="branch-title">{{ child.title }}</text>
              <view class="branch-meta">
                <text class="branch-author">{{ child.author.username }}</text>
                <text class="branch-rating">★ {{ child.rating_avg.toFixed(1) }}</text>
              </view>
            </view>
            <text class="branch-arrow">›</text>
          </view>
        </view>

        <!-- 无分支提示 -->
        <view v-else class="no-branch">
          <text class="no-branch-icon">🌿</text>
          <text class="no-branch-text">这是故事的末端</text>
          <button
            v-if="userStore.isLoggedIn"
            class="btn-write-branch"
            @tap="writeBranch"
          >
            ✍️ 续写新分支
          </button>
          <button v-else class="btn-write-branch" @tap="goLogin">
            登录后续写
          </button>
        </view>

        <!-- 评论区 -->
        <view class="comments-section">
          <view class="comments-header">
            <text class="comments-title">评论</text>
            <text class="comments-count">{{ totalComments }} 条</text>
          </view>

          <!-- 评论输入 -->
          <view v-if="userStore.isLoggedIn" class="comment-input-row">
            <image
              class="user-avatar"
              :src="userStore.avatarUrl"
              mode="aspectFill"
            />
            <view class="comment-input-wrap" @tap="showCommentInput = true">
              <text class="comment-placeholder">说点什么...</text>
            </view>
          </view>

          <!-- 评论列表 -->
          <view v-for="comment in comments" :key="comment.id" class="comment-item">
            <image
              class="comment-avatar"
              :src="getImageUrl(comment.user.avatar) || '/static/images/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="comment-content">
              <text class="comment-username">{{ comment.user.username }}</text>
              <text class="comment-text">{{ comment.content }}</text>
              <view class="comment-actions">
                <text class="comment-time">{{ formatTime(comment.created_at) }}</text>
                <view class="vote-btn" @tap="voteOnComment(comment.id, 'up')">
                  <text>👍 {{ comment._count?.votes || 0 }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 加载更多评论 -->
          <view v-if="hasMoreComments" class="load-more-comments" @tap="loadMoreComments">
            查看更多评论
          </view>
        </view>

        <view class="bottom-placeholder" />
      </view>
    </scroll-view>

    <!-- 底部工具栏 -->
    <view class="bottom-bar" :class="{ hidden: hideNav }">
      <view class="tool-btn" @tap="toggleBookmark">
        <text>{{ isBookmarked ? '❤️' : '🤍' }}</text>
        <text class="tool-label">收藏</text>
      </view>
      <view class="tool-btn" @tap="showCommentInput = true">
        <text>💬</text>
        <text class="tool-label">评论</text>
      </view>
      <view class="tool-btn" @tap="shareChapter">
        <text>📤</text>
        <text class="tool-label">分享</text>
      </view>
    </view>

    <!-- 阅读设置弹窗 -->
    <view v-if="showSettings" class="settings-mask" @tap.self="showSettings = false">
      <view class="settings-panel">
        <text class="settings-title">阅读设置</text>

        <!-- 字号 -->
        <view class="setting-row">
          <text class="setting-label">字号</text>
          <view class="font-size-controls">
            <view class="size-btn" @tap="changeFontSize(-4)">A-</view>
            <text class="size-value">{{ settings.fontSize }}</text>
            <view class="size-btn" @tap="changeFontSize(4)">A+</view>
          </view>
        </view>

        <!-- 行距 -->
        <view class="setting-row">
          <text class="setting-label">行距</text>
          <view class="line-height-options">
            <view
              v-for="opt in lineHeightOptions"
              :key="opt.value"
              class="lh-option"
              :class="{ active: settings.lineHeight === opt.value }"
              @tap="settings.lineHeight = opt.value"
            >
              {{ opt.label }}
            </view>
          </view>
        </view>

        <!-- 主题 -->
        <view class="setting-row">
          <text class="setting-label">背景</text>
          <view class="theme-options">
            <view
              v-for="theme in themeOptions"
              :key="theme.value"
              class="theme-option"
              :class="{ active: settings.theme === theme.value }"
              :style="{ background: theme.bg }"
              @tap="settings.theme = theme.value"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 评论输入弹窗 -->
    <view v-if="showCommentInput" class="comment-mask" @tap.self="showCommentInput = false">
      <view class="comment-panel">
        <textarea
          v-model="commentText"
          class="comment-textarea"
          placeholder="写下你的评论..."
          :auto-focus="true"
          maxlength="500"
        />
        <view class="comment-submit-row">
          <text class="char-count">{{ commentText.length }}/500</text>
          <button class="btn-submit-comment" @tap="submitComment">发送</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import { getNode, getNodeChildren, rateNode, bookmarkNode, unbookmarkNode, incrementReadCount } from '@/api/nodes'
import { getNodeComments, createComment, voteComment } from '@/api/comments'
import { formatRelativeTime } from '@/utils/helpers'
import { getImageUrl } from '@/utils/request'
import type { Node } from '@/api/nodes'
import type { Comment } from '@/api/comments'

const userStore = useUserStore()
const appStore = useAppStore()

const loading = ref(true)
const hideNav = ref(false)
const showSettings = ref(false)
const showCommentInput = ref(false)
const commentText = ref('')

const node = ref<Node | null>(null)
const children = ref<Node[]>([])
const comments = ref<Comment[]>([])
const totalComments = ref(0)
const hasMoreComments = ref(false)
const commentsPage = ref(1)
const isBookmarked = ref(false)
const userRating = ref(0)

const settings = reactive({
  fontSize: appStore.readerSettings.fontSize * 2, // rpx
  lineHeight: String(appStore.readerSettings.lineHeight),
  theme: appStore.readerSettings.theme as 'light' | 'dark' | 'sepia',
})

const bgColors = { light: '#ffffff', dark: '#1a1a2e', sepia: '#f5f0e8' }
const textColors = { light: '#1e293b', dark: '#e2e8f0', sepia: '#3d2b1f' }
const subTextColors = { light: '#94a3b8', dark: '#64748b', sepia: '#8b7355' }

const contentStyle = computed(() => ({
  padding: '0 48rpx 40rpx',
}))

const lineHeightOptions = [
  { label: '紧凑', value: '1.6' },
  { label: '适中', value: '1.8' },
  { label: '宽松', value: '2.2' },
]

const themeOptions = [
  { value: 'light', bg: '#ffffff' },
  { value: 'sepia', bg: '#f5f0e8' },
  { value: 'dark', bg: '#1a1a2e' },
]

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const nodeId = Number(currentPage.options?.id)
  if (nodeId) {
    loadNode(nodeId)
  }
})

async function loadNode(id: number) {
  loading.value = true
  try {
    const [nodeRes, childrenRes, commentsRes] = await Promise.all([
      getNode(id),
      getNodeChildren(id),
      getNodeComments(id, { page: 1, pageSize: 10 }),
    ])
    node.value = nodeRes.node
    children.value = childrenRes.children
    comments.value = commentsRes.comments
    totalComments.value = commentsRes.total
    hasMoreComments.value = commentsRes.total > 10
    isBookmarked.value = nodeRes.node.isBookmarked ?? false
    userRating.value = nodeRes.node.userRating ?? 0

    // 增加阅读次数
    incrementReadCount(id).catch(() => {})
  } catch (err) {
    console.error('加载章节失败', err)
  } finally {
    loading.value = false
  }
}

async function loadMoreComments() {
  commentsPage.value++
  try {
    const res = await getNodeComments(node.value!.id, { page: commentsPage.value, pageSize: 10 })
    comments.value.push(...res.comments)
    hasMoreComments.value = comments.value.length < res.total
  } catch (err) {
    console.error('加载评论失败', err)
  }
}

async function rateChapter(score: number) {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  try {
    await rateNode(node.value!.id, score)
    userRating.value = score
    uni.showToast({ title: '评分成功', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err.message || '评分失败', icon: 'none' })
  }
}

async function toggleBookmark() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  try {
    if (isBookmarked.value) {
      await unbookmarkNode(node.value!.id)
      isBookmarked.value = false
    } else {
      await bookmarkNode(node.value!.id)
      isBookmarked.value = true
      uni.showToast({ title: '收藏成功', icon: 'success' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function submitComment() {
  if (!commentText.value.trim()) return
  try {
    const res = await createComment({ node_id: node.value!.id, content: commentText.value.trim() })
    comments.value.unshift(res.comment)
    totalComments.value++
    commentText.value = ''
    showCommentInput.value = false
    uni.showToast({ title: '评论成功', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err.message || '评论失败', icon: 'none' })
  }
}

async function voteOnComment(commentId: number, type: 'up' | 'down') {
  if (!userStore.isLoggedIn) return
  try {
    await voteComment(commentId, type)
  } catch {
    // 忽略
  }
}

function toggleNav() {
  hideNav.value = !hideNav.value
}

function onScroll() {
  // 可扩展：记录阅读进度
}

function changeFontSize(delta: number) {
  const newSize = settings.fontSize + delta
  if (newSize >= 24 && newSize <= 56) {
    settings.fontSize = newSize
  }
}

function goChapter(id: number) {
  uni.navigateTo({ url: `/pages/chapter/index?id=${id}` })
}

function writeBranch() {
  uni.navigateTo({ url: `/pages/write/index?storyId=${node.value?.story_id}&parentId=${node.value?.id}` })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function shareChapter() {
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
.chapter-page {
  min-height: 100vh;
  position: relative;
}

.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-top: 88rpx;
  transition: opacity 0.3s, transform 0.3s;

  &.hidden {
    opacity: 0;
    transform: translateY(-100%);
  }

  .navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16rpx 32rpx;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);

    .back-btn {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;

      .back-icon {
        font-size: 36rpx;
      }
    }

    .navbar-title {
      flex: 1;
      text-align: center;
      padding: 0 20rpx;

      .chapter-title-nav {
        font-size: 28rpx;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .setting-btn {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      font-size: 28rpx;
      font-weight: 600;
    }
  }
}

.reading-scroll {
  height: 100vh;
  padding-top: 160rpx;
}

.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;

  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid #f0f2f5;
    border-top-color: #7c6af7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.reading-content {
  .chapter-title {
    font-size: 44rpx;
    font-weight: 700;
    line-height: 1.4;
    display: block;
    margin-bottom: 24rpx;
    padding-top: 20rpx;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 32rpx;
    padding-bottom: 24rpx;
    border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);

    .author-avatar {
      width: 48rpx;
      height: 48rpx;
      border-radius: 50%;
    }

    .author-name,
    .read-count {
      font-size: 24rpx;
    }
  }

  .chapter-image {
    width: 100%;
    border-radius: 16rpx;
    margin-bottom: 32rpx;
  }

  .chapter-content {
    display: block;
    word-break: break-all;
    white-space: pre-wrap;
    margin-bottom: 48rpx;
  }
}

.rating-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
  margin-bottom: 40rpx;

  .rating-label {
    font-size: 26rpx;
    margin-bottom: 16rpx;
  }

  .stars {
    display: flex;
    gap: 12rpx;
    margin-bottom: 12rpx;

    .star {
      font-size: 48rpx;
      color: #e2e8f0;

      &.active {
        color: #f59e0b;
      }
    }
  }

  .rating-avg {
    font-size: 24rpx;
  }
}

.branches-section {
  margin-bottom: 40rpx;

  .branches-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .branches-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .branches-count {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .branch-card {
    display: flex;
    align-items: center;
    padding: 24rpx;
    background: rgba(124, 106, 247, 0.06);
    border-radius: 16rpx;
    margin-bottom: 16rpx;
    border: 1rpx solid rgba(124, 106, 247, 0.15);

    .branch-info {
      flex: 1;

      .branch-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
      }

      .branch-meta {
        display: flex;
        gap: 16rpx;
        margin-top: 8rpx;

        .branch-author,
        .branch-rating {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }

    .branch-arrow {
      font-size: 40rpx;
      color: #7c6af7;
    }
  }
}

.no-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0;
  margin-bottom: 40rpx;

  .no-branch-icon {
    font-size: 80rpx;
    margin-bottom: 16rpx;
  }

  .no-branch-text {
    font-size: 28rpx;
    color: #94a3b8;
    margin-bottom: 32rpx;
  }

  .btn-write-branch {
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    color: #ffffff;
    padding: 20rpx 60rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    font-weight: 600;
    border: none;
  }
}

.comments-section {
  .comments-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 24rpx;

    .comments-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .comments-count {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .comment-input-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 24rpx;

    .user-avatar {
      width: 64rpx;
      height: 64rpx;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .comment-input-wrap {
      flex: 1;
      background: #f8fafc;
      border-radius: 40rpx;
      padding: 18rpx 24rpx;

      .comment-placeholder {
        font-size: 26rpx;
        color: #94a3b8;
      }
    }
  }

  .comment-item {
    display: flex;
    gap: 16rpx;
    margin-bottom: 24rpx;

    .comment-avatar {
      width: 64rpx;
      height: 64rpx;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .comment-content {
      flex: 1;

      .comment-username {
        font-size: 24rpx;
        font-weight: 600;
        color: #475569;
        display: block;
        margin-bottom: 8rpx;
      }

      .comment-text {
        font-size: 26rpx;
        color: #1e293b;
        line-height: 1.6;
        display: block;
        margin-bottom: 10rpx;
      }

      .comment-actions {
        display: flex;
        align-items: center;
        gap: 20rpx;

        .comment-time {
          font-size: 22rpx;
          color: #94a3b8;
        }

        .vote-btn {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }
  }

  .load-more-comments {
    text-align: center;
    padding: 24rpx;
    font-size: 26rpx;
    color: #7c6af7;
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-around;
  padding: 16rpx 0 calc(16rpx + env(safe-area-inset-bottom));
  transition: opacity 0.3s, transform 0.3s;

  &.hidden {
    opacity: 0;
    transform: translateY(100%);
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6rpx;
    padding: 8rpx 40rpx;
    font-size: 36rpx;

    .tool-label {
      font-size: 20rpx;
      color: #94a3b8;
    }
  }
}

.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.settings-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));

  .settings-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
    display: block;
    margin-bottom: 40rpx;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40rpx;

    .setting-label {
      font-size: 28rpx;
      color: #475569;
    }
  }

  .font-size-controls {
    display: flex;
    align-items: center;
    gap: 24rpx;

    .size-btn {
      width: 64rpx;
      height: 64rpx;
      background: #f0f2f5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24rpx;
      font-weight: 600;
      color: #475569;
    }

    .size-value {
      font-size: 28rpx;
      color: #1e293b;
      min-width: 48rpx;
      text-align: center;
    }
  }

  .line-height-options {
    display: flex;
    gap: 16rpx;

    .lh-option {
      padding: 12rpx 24rpx;
      border-radius: 20rpx;
      font-size: 24rpx;
      color: #94a3b8;
      background: #f0f2f5;

      &.active {
        background: #7c6af7;
        color: #ffffff;
      }
    }
  }

  .theme-options {
    display: flex;
    gap: 16rpx;

    .theme-option {
      width: 64rpx;
      height: 64rpx;
      border-radius: 50%;
      border: 4rpx solid transparent;

      &.active {
        border-color: #7c6af7;
      }
    }
  }
}

.comment-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.comment-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));

  .comment-textarea {
    width: 100%;
    min-height: 200rpx;
    font-size: 28rpx;
    color: #1e293b;
    line-height: 1.6;
    margin-bottom: 24rpx;
  }

  .comment-submit-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .char-count {
      font-size: 24rpx;
      color: #94a3b8;
    }

    .btn-submit-comment {
      background: #7c6af7;
      color: #ffffff;
      padding: 16rpx 48rpx;
      border-radius: 40rpx;
      font-size: 28rpx;
      border: none;
    }
  }
}

.bottom-placeholder {
  height: 160rpx;
}
</style>

