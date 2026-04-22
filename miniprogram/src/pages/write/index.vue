<template>
  <view class="write-center-page">
    <!-- 顶部标题栏 -->
    <view class="page-header">
      <text class="page-title">写作中心</text>
    </view>

    <!-- 未登录提示 -->
    <view v-if="!userStore.isLoggedIn" class="login-prompt">
      <text class="login-prompt-icon">✍️</text>
      <text class="login-prompt-text">登录后开始创作</text>
      <button class="login-btn" @tap="goLogin">立即登录</button>
    </view>

    <template v-else>
      <!-- 开始新故事按钮 -->
      <view class="new-story-card" @tap="goCreateStory">
        <view class="new-story-icon">✨</view>
        <view class="new-story-info">
          <text class="new-story-title">开始新故事</text>
          <text class="new-story-desc">创建一个全新的故事世界</text>
        </view>
        <text class="card-arrow">›</text>
      </view>

      <!-- 草稿箱 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">草稿箱</text>
          <text v-if="drafts.length > 0" class="section-count">{{ drafts.length }}</text>
        </view>

        <view v-if="draftsLoading" class="loading-row">
          <text class="loading-text">加载中...</text>
        </view>

        <view v-else-if="drafts.length === 0" class="empty-hint">
          <text class="empty-text">暂无草稿</text>
        </view>

        <view
          v-for="draft in drafts"
          :key="draft.id"
          class="draft-card"
          @tap="openDraft(draft)"
        >
          <view class="draft-card-main">
            <view class="draft-icon">📝</view>
            <view class="draft-info">
              <text class="draft-title">{{ draft.title || '未命名章节' }}</text>
              <text class="draft-meta">
                《{{ draft.story?.title }}》
                <template v-if="draft.parent_title">续 {{ draft.parent_title }}</template>
                <template v-else>第一章</template>
              </text>
              <text class="draft-time">{{ formatTime(draft.updated_at) }} · {{ getWordCount(draft.content) }}字</text>
            </view>
            <text class="card-arrow">›</text>
          </view>
          <view class="draft-delete-btn" @tap.stop="deleteDraft(draft)">
            <text class="delete-icon">🗑</text>
          </view>
        </view>
      </view>

      <!-- 我的故事 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">我的故事</text>
          <text v-if="myStories.length > 0" class="section-count">{{ myStories.length }}</text>
        </view>

        <view v-if="storiesLoading" class="loading-row">
          <text class="loading-text">加载中...</text>
        </view>

        <view v-else-if="myStories.length === 0" class="empty-hint">
          <text class="empty-text">还没有故事，点击上方开始创作</text>
        </view>

        <view
          v-for="story in myStories"
          :key="story.id"
          class="story-card"
        >
          <view class="story-card-header" @tap="goStory(story.id)">
            <image
              class="story-cover"
              :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
              mode="aspectFill"
            />
            <view class="story-info">
              <text class="story-title">{{ story.title }}</text>
              <text class="story-meta">
                {{ story._count?.nodes || 0 }} 章节
                <template v-if="story.isCollaborator"> · 协作者</template>
              </text>
            </view>
            <text class="card-arrow">›</text>
          </view>
          <view class="story-card-actions">
            <view class="story-action-btn" @tap="continueStory(story)">
              <text class="action-icon">✍️</text>
              <text class="action-label">续写</text>
            </view>
            <view class="story-action-divider" />
            <view class="story-action-btn" @tap="manageStory(story.id)">
              <text class="action-icon">⚙️</text>
              <text class="action-label">管理</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { getMyDrafts, deleteDraftNode } from '@/api/nodes'
import { getMyStories } from '@/api/stories'
import { getImageUrl } from '@/utils/request'
import type { DraftNode } from '@/api/nodes'
import type { Story } from '@/api/stories'

const userStore = useUserStore()

const drafts = ref<DraftNode[]>([])
const myStories = ref<Array<Story & { isAuthor: boolean; isCollaborator: boolean }>>([])
const draftsLoading = ref(false)
const storiesLoading = ref(false)

onShow(async () => {
  if (!userStore.isLoggedIn) return
  loadDrafts()
  loadStories()
})

async function loadDrafts() {
  draftsLoading.value = true
  try {
    const res = await getMyDrafts()
    drafts.value = res.drafts
  } catch {
    // 静默失败
  } finally {
    draftsLoading.value = false
  }
}

async function loadStories() {
  storiesLoading.value = true
  try {
    const res = await getMyStories()
    myStories.value = res.stories
  } catch {
    // 静默失败
  } finally {
    storiesLoading.value = false
  }
}

function openDraft(draft: DraftNode) {
  uni.navigateTo({
    url: `/pages/write/editor?draftNodeId=${draft.id}`,
  })
}

function deleteDraft(draft: DraftNode) {
  uni.showModal({
    title: '删除草稿',
    content: `确定要删除草稿「${draft.title || '未命名章节'}」吗？`,
    confirmText: '删除',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteDraftNode(draft.id)
          drafts.value = drafts.value.filter(d => d.id !== draft.id)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}

function goCreateStory() {
  uni.navigateTo({ url: '/pages/story/create' })
}

function goStory(id: number) {
  uni.navigateTo({ url: `/pages/story/index?id=${id}` })
}

async function continueStory(story: Story) {
  // 获取故事最新章节，作为续写的父节点
  // 如果故事没有章节，则写第一章
  if (!story.root_node_id) {
    // 还没有章节，写第一章
    uni.navigateTo({
      url: `/pages/write/editor?storyId=${story.id}&storyTitle=${encodeURIComponent(story.title)}`,
    })
    return
  }

  // 有章节，让用户选择在哪个节点续写（跳转到故事树页面）
  uni.showModal({
    title: '续写方式',
    content: '请在故事树中选择要续写的章节',
    confirmText: '去选择',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: `/pages/story/index?id=${story.id}` })
      }
    },
  })
}

function manageStory(id: number) {
  uni.navigateTo({ url: `/pages/story/manage?id=${id}` })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getWordCount(content: string): number {
  return content ? content.replace(/\s/g, '').length : 0
}
</script>

<style lang="scss" scoped>
.write-center-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: env(safe-area-inset-bottom);
}

.page-header {
  padding: 60rpx 32rpx 32rpx;
  background: #1a1a2e;

  .page-title {
    font-size: 48rpx;
    font-weight: 700;
    color: #ffffff;
  }
}

// 未登录
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
  gap: 24rpx;

  .login-prompt-icon { font-size: 80rpx; }

  .login-prompt-text {
    font-size: 30rpx;
    color: #64748b;
  }

  .login-btn {
    background: #7c6af7;
    color: #ffffff;
    border: none;
    border-radius: 40rpx;
    padding: 20rpx 60rpx;
    font-size: 28rpx;
    font-weight: 600;
    margin-top: 16rpx;
  }
}

// 新建故事卡片
.new-story-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin: 24rpx 24rpx 0;
  padding: 28rpx 24rpx;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(124, 106, 247, 0.35);

  .new-story-icon {
    font-size: 48rpx;
    width: 80rpx;
    text-align: center;
  }

  .new-story-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;

    .new-story-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #ffffff;
    }

    .new-story-desc {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.75);
    }
  }

  .card-arrow {
    font-size: 40rpx;
    color: rgba(255, 255, 255, 0.6);
  }
}

// 分区
.section {
  margin-top: 32rpx;
  padding: 0 24rpx;

  .section-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 16rpx;

    .section-title {
      font-size: 26rpx;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 2rpx;
      text-transform: uppercase;
    }

    .section-count {
      font-size: 22rpx;
      color: #7c6af7;
      background: rgba(124, 106, 247, 0.1);
      padding: 4rpx 14rpx;
      border-radius: 20rpx;
      font-weight: 600;
    }
  }
}

.loading-row {
  padding: 40rpx 0;
  text-align: center;

  .loading-text {
    font-size: 26rpx;
    color: #94a3b8;
  }
}

.empty-hint {
  padding: 40rpx 0;
  text-align: center;

  .empty-text {
    font-size: 26rpx;
    color: #94a3b8;
  }
}

// 草稿卡片
.draft-card {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;

  .draft-card-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 24rpx;

    .draft-icon {
      font-size: 40rpx;
      flex-shrink: 0;
    }

    .draft-info {
      flex: 1;
      min-width: 0;

      .draft-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .draft-meta {
        font-size: 24rpx;
        color: #64748b;
        display: block;
        margin-top: 6rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .draft-time {
        font-size: 22rpx;
        color: #94a3b8;
        display: block;
        margin-top: 4rpx;
      }
    }

    .card-arrow {
      font-size: 36rpx;
      color: #cbd5e1;
      flex-shrink: 0;
    }
  }

  .draft-delete-btn {
    padding: 24rpx 20rpx;
    border-left: 1rpx solid #f0f2f5;
    display: flex;
    align-items: center;

    .delete-icon { font-size: 36rpx; }
  }
}

// 故事卡片
.story-card {
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;

  .story-card-header {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 24rpx;

    .story-cover {
      width: 80rpx;
      height: 60rpx;
      border-radius: 8rpx;
      flex-shrink: 0;
    }

    .story-info {
      flex: 1;
      min-width: 0;

      .story-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .story-meta {
        font-size: 22rpx;
        color: #94a3b8;
        display: block;
        margin-top: 6rpx;
      }
    }

    .card-arrow {
      font-size: 36rpx;
      color: #cbd5e1;
      flex-shrink: 0;
    }
  }

  .story-card-actions {
    display: flex;
    border-top: 1rpx solid #f0f2f5;

    .story-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8rpx;
      padding: 20rpx;

      .action-icon { font-size: 28rpx; }

      .action-label {
        font-size: 24rpx;
        color: #475569;
        font-weight: 500;
      }
    }

    .story-action-divider {
      width: 1rpx;
      background: #f0f2f5;
    }
  }
}
</style>

