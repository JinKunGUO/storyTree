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
          :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
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

          <!-- 作者行 + 身份勋章 -->
          <view class="story-meta">
            <image
              class="author-avatar"
              :src="getImageUrl(story.author.avatar) || '/static/images/default-avatar.png'"
              mode="aspectFill"
            />
            <text class="author-name">{{ story.author.username }}</text>
            <!-- 身份勋章 -->
            <view v-if="story.isAuthor" class="badge badge-author">主创</view>
            <view v-else-if="story.isCollaborator" class="badge badge-collab">共创者</view>
            <view v-else-if="story.isFollowed" class="badge badge-follow">追更中</view>
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

        <!-- 操作按钮（普通读者） -->
        <view v-if="!story.isAuthor && !story.isCollaborator" class="action-row">
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

        <!-- 主创 / 协作者操作区 -->
        <view v-else class="action-row">
          <button class="btn-read" @tap="startReading">开始阅读 →</button>
          <button v-if="story.isAuthor" class="btn-manage" @tap="goManage">
            ⚙️ 管理故事
          </button>
          <button v-if="story.isAuthor || story.isCollaborator" class="btn-write" @tap="startCollaborate">
            ✍️ 续写章节
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

        <!-- 协作者列表 -->
        <view v-if="story.collaborators && story.collaborators.length > 0" class="section-card">
          <text class="section-title">共创者</text>
          <view class="collab-list">
            <view
              v-for="c in story.collaborators"
              :key="c.id"
              class="collab-item"
            >
              <image
                class="collab-avatar"
                :src="getImageUrl(c.avatar) || '/static/images/default-avatar.png'"
                mode="aspectFill"
              />
              <text class="collab-name">{{ c.username }}</text>
            </view>
          </view>
        </view>

        <!-- 申请协作 / 协作入口 -->
        <view class="section-card collab-section">
          <view class="collab-header">
            <text class="section-title">协作创作</text>
            <text v-if="story.allow_branch" class="collab-open-tag">开放中</text>
            <text v-else class="collab-closed-tag">已关闭</text>
          </view>
          <text class="collab-desc">
            {{ story.allow_branch ? '这是一个开放的协作故事，可以申请成为共创者，续写新的分支。' : '该故事暂未开放协作续写。' }}
          </text>

          <!-- 未登录 -->
          <button v-if="!userStore.isLoggedIn" class="btn-collab-apply" @tap="goLogin">
            登录后申请协作
          </button>
          <!-- 主创自己 -->
          <view v-else-if="story.isAuthor" class="collab-author-tip">
            <text>你是本故事的主创，可直接续写章节</text>
          </view>
          <!-- 已是协作者 -->
          <view v-else-if="story.isCollaborator" class="collab-author-tip">
            <text>✓ 你已是本故事的共创者</text>
            <button class="btn-leave-collab" :loading="leaveLoading" @tap="leaveCollab">
              退出共创
            </button>
          </view>
          <!-- 申请待审核 -->
          <view v-else-if="story.collaborationRequestStatus === 'pending'" class="collab-pending-tip">
            <text>⏳ 协作申请已提交，等待主创审核</text>
          </view>
          <!-- 申请被拒绝 -->
          <view v-else-if="story.collaborationRequestStatus === 'rejected'" class="collab-rejected-tip">
            <text>✗ 上次申请被拒绝，可重新申请</text>
            <button v-if="story.allow_branch" class="btn-collab-apply" :loading="applyLoading" @tap="applyForCollaboration">
              重新申请协作
            </button>
          </view>
          <!-- 可申请 -->
          <button
            v-else-if="story.allow_branch"
            class="btn-collab-apply"
            :loading="applyLoading"
            @tap="applyForCollaboration"
          >
            申请成为共创者
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
import { getStory, followStory, unfollowStory, bookmarkStory, applyCollaboration, leaveCollaboration } from '@/api/stories'
import { formatRelativeTime } from '@/utils/helpers'
import { getImageUrl } from '@/utils/request'
import type { Story } from '@/api/stories'
import type { Node } from '@/api/nodes'

const userStore = useUserStore()

const loading = ref(true)
const nodesLoading = ref(false)
const story = ref<Story | null>(null)
const rootNode = ref<Node | null>(null)
const isFollowed = ref(false)
const isBookmarked = ref(false)
const applyLoading = ref(false)
const leaveLoading = ref(false)

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
    // isFollowed 优先使用后端注入字段
    isFollowed.value = res.story.isFollowed ?? false
    // isBookmarked 由后端注入，准确反映当前用户的收藏状态
    isBookmarked.value = res.story.isBookmarked ?? false

    // 从同一响应中提取根节点，无需额外请求
    const nodes = res.nodes || []
    rootNode.value = nodes.find((n: Node) => !n.parent_id) || null
  } catch (err) {
    console.error('加载故事失败', err)
  } finally {
    loading.value = false
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
      if (story.value) {
        story.value.isFollowed = false
        if (story.value._count) {
          story.value._count.followers = Math.max(0, (story.value._count.followers || 0) - 1)
        }
      }
      uni.showToast({ title: '已取消追更', icon: 'none' })
    } else {
      await followStory(story.value!.id)
      isFollowed.value = true
      if (story.value) {
        story.value.isFollowed = true
        if (story.value._count) {
          story.value._count.followers = (story.value._count.followers || 0) + 1
        }
      }
      uni.showToast({ title: '追更成功', icon: 'success' })
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
    // 书签接口是切换型：同一接口根据当前状态自动收藏/取消收藏，并返回实际结果
    const res = await bookmarkStory(story.value!.id)
    const nowBookmarked = res.bookmarked
    const wasBookmarked = isBookmarked.value

    isBookmarked.value = nowBookmarked
    if (story.value) story.value.isBookmarked = nowBookmarked

    // 根据前后状态变化同步计数
    if (story.value?._count) {
      if (!wasBookmarked && nowBookmarked) {
        story.value._count.bookmarks = (story.value._count.bookmarks || 0) + 1
      } else if (wasBookmarked && !nowBookmarked) {
        story.value._count.bookmarks = Math.max(0, (story.value._count.bookmarks || 0) - 1)
      }
    }

    uni.showToast({ title: nowBookmarked ? '收藏成功' : '已取消收藏', icon: nowBookmarked ? 'success' : 'none' })
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
  // write 是 tabBar 页面，不能用 navigateTo；先把参数写入 storage，再 switchTab
  uni.setStorageSync('st_write_params', JSON.stringify({
    storyId: story.value?.id,
    parentId: rootNode.value?.id,
  }))
  uni.switchTab({ url: '/pages/write/index' })
}

function goManage() {
  uni.navigateTo({ url: `/pages/story/manage?id=${story.value?.id}` })
}

async function applyForCollaboration() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  if (applyLoading.value) return
  applyLoading.value = true
  try {
    const res = await applyCollaboration(story.value!.id)
    uni.showToast({ title: res.message || '申请已提交', icon: 'success' })
    // 后端返回自动通过时，直接刷新为协作者状态
    if (story.value) {
      const autoApproved = res.message?.includes('自动通过') || res.message?.includes('现在是协作者')
      if (autoApproved) {
        story.value.isCollaborator = true
        story.value.collaborationRequestStatus = 'approved'
        // 将自己加入协作者列表
        if (story.value.collaborators && userStore.userInfo) {
          const alreadyIn = story.value.collaborators.some(c => c.id === userStore.userInfo!.id)
          if (!alreadyIn) {
            story.value.collaborators.push({
              id: userStore.userInfo.id,
              username: userStore.userInfo.username,
              avatar: userStore.userInfo.avatar,
            })
          }
        }
      } else {
        story.value.collaborationRequestStatus = 'pending'
      }
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '申请失败', icon: 'none' })
  } finally {
    applyLoading.value = false
  }
}

async function leaveCollab() {
  if (leaveLoading.value) return
  uni.showModal({
    title: '退出共创',
    content: '确定要退出本故事的共创吗？退出后需要重新申请才能续写。',
    confirmText: '确定退出',
    confirmColor: '#ef4444',
    success: async ({ confirm }) => {
      if (!confirm) return
      leaveLoading.value = true
      try {
        await leaveCollaboration(story.value!.id)
        uni.showToast({ title: '已退出共创', icon: 'success' })
        if (story.value) {
          story.value.isCollaborator = false
          story.value.collaborationRequestStatus = null
          // 从共创者列表中移除自己
          if (story.value.collaborators && userStore.userInfo) {
            story.value.collaborators = story.value.collaborators.filter(
              c => c.id !== userStore.userInfo!.id
            )
          }
        }
      } catch (err: any) {
        uni.showToast({ title: err.message || '操作失败', icon: 'none' })
      } finally {
        leaveLoading.value = false
      }
    }
  })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function shareStory() {
  // 微信小程序分享通过 onShareAppMessage 声明式配置实现，
  // showShareMenu 在部分环境下受限，改为提示用户长按页面进行分享
  uni.showToast({ title: '长按页面可分享给好友', icon: 'none', duration: 2000 })
}

// 微信小程序原生分享配置（声明式，供框架调用）
defineExpose({
  onShareAppMessage() {
    return {
      title: story.value?.title || '发现一个好故事',
      path: `/pages/story/index?id=${story.value?.id}`,
      imageUrl: story.value?.cover_image || '',
    }
  }
})

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
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
    line-height: 88rpx;
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
    line-height: 88rpx;
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
  line-height: 88rpx;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
}

// ===== 身份勋章 =====
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: 600;
  margin-left: 8rpx;

  &.badge-author {
    background: rgba(251, 191, 36, 0.25);
    color: #fbbf24;
    border: 1rpx solid rgba(251, 191, 36, 0.4);
  }

  &.badge-collab {
    background: rgba(124, 106, 247, 0.25);
    color: #a78bfa;
    border: 1rpx solid rgba(124, 106, 247, 0.4);
  }

  &.badge-follow {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1rpx solid rgba(16, 185, 129, 0.3);
  }
}

// ===== 主创/协作者操作区 =====
.btn-manage {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border: 2rpx solid #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  color: #f59e0b;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: 16rpx;
}

.btn-write {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
}

// ===== 共创者列表 =====
.collab-list {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 8rpx;

  .collab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;

    .collab-avatar {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      border: 2rpx solid rgba(124, 106, 247, 0.3);
    }

    .collab-name {
      font-size: 20rpx;
      color: #64748b;
      max-width: 80rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

// ===== 申请协作区 =====
.collab-section {
  .collab-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 16rpx;

    .section-title {
      margin-bottom: 0;
    }

    .collab-open-tag {
      font-size: 20rpx;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      padding: 4rpx 14rpx;
      border-radius: 20rpx;
    }

    .collab-closed-tag {
      font-size: 20rpx;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.1);
      padding: 4rpx 14rpx;
      border-radius: 20rpx;
    }
  }
}

.btn-collab-apply {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
  margin-top: 8rpx;
}

.collab-author-tip {
  padding: 20rpx 24rpx;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 12rpx;
  border: 1rpx solid rgba(16, 185, 129, 0.2);
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  text {
    font-size: 26rpx;
    color: #10b981;
  }

  .btn-leave-collab {
    font-size: 22rpx;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    border: 1rpx solid rgba(239, 68, 68, 0.25);
    border-radius: 20rpx;
    padding: 8rpx 24rpx;
    height: auto;
    line-height: 1.5;
    min-height: unset;
    flex-shrink: 0;
  }
}

.collab-pending-tip {
  padding: 20rpx 24rpx;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 12rpx;
  border: 1rpx solid rgba(245, 158, 11, 0.2);
  margin-top: 8rpx;

  text {
    font-size: 26rpx;
    color: #f59e0b;
  }
}

.collab-rejected-tip {
  margin-top: 8rpx;

  text {
    font-size: 26rpx;
    color: #ef4444;
    display: block;
    margin-bottom: 16rpx;
  }
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

