<template>
  <view class="create-page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">创作</text>
    </view>

    <!-- 新建故事入口 -->
    <view class="new-story-card" @tap="goNewStory">
      <view class="new-story-icon">✨</view>
      <view class="new-story-info">
        <text class="new-story-title">新建故事</text>
        <text class="new-story-desc">开启一个全新的故事世界</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <!-- 快速续写入口（空白续写页） -->
    <view class="quick-write-card" @tap="goQuickWrite">
      <view class="quick-write-icon">✍️</view>
      <view class="quick-write-info">
        <text class="quick-write-title">快速写作</text>
        <text class="quick-write-desc">进入空白写作页，自由创作</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <!-- 本地草稿箱 -->
    <view class="section-title">本地草稿</view>

    <view v-if="drafts.length === 0" class="empty-drafts">
      <text class="empty-icon">📝</text>
      <text class="empty-text">暂无草稿</text>
    </view>

    <view
      v-for="draft in drafts"
      :key="draft.key"
      class="draft-card"
    >
      <view class="draft-main" @tap="resumeDraft(draft)">
        <view class="draft-info">
          <text class="draft-title">{{ draft.title || '无标题' }}</text>
          <text class="draft-preview">{{ draft.preview }}</text>
          <text class="draft-time">{{ draft.timeText }}</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="draft-delete" @tap="deleteDraft(draft)">
        <text class="delete-icon">🗑</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'

interface DraftItem {
  key: string
  title: string
  content: string
  preview: string
  storyId: number | null
  parentId: number | null
  timeText: string
  savedAt: number
}

const drafts = ref<DraftItem[]>([])

function loadDrafts() {
  const result: DraftItem[] = []
  try {
    const info = uni.getStorageInfoSync()
    const draftKeys = (info.keys || []).filter((k: string) => k.startsWith('st_draft_'))
    for (const key of draftKeys) {
      try {
        const raw = uni.getStorageSync(key)
        if (!raw) continue
        const data = JSON.parse(raw)
        // key 格式：st_draft_{storyId}_p{parentId}
        const match = key.match(/^st_draft_(\w+)_p(\w+)$/)
        const storyId = match ? (match[1] === 'new' ? null : Number(match[1])) : null
        const parentId = match ? (match[2] === '0' ? null : Number(match[2])) : null
        const content: string = data.content || ''
        const savedAt: number = data.savedAt || 0
        result.push({
          key,
          title: data.title || '',
          content,
          preview: content.replace(/<[^>]+>/g, '').slice(0, 50) || '（无内容）',
          storyId,
          parentId,
          timeText: savedAt ? formatTime(savedAt) : '未知时间',
          savedAt,
        })
      } catch {
        // 忽略损坏的草稿
      }
    }
  } catch {
    // 忽略
  }
  // 按保存时间倒序
  result.sort((a, b) => b.savedAt - a.savedAt)
  drafts.value = result
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function goNewStory() {
  uni.navigateTo({ url: '/pages/story/create' })
}

function goQuickWrite() {
  uni.navigateTo({ url: '/pages/write/index' })
}

function resumeDraft(draft: DraftItem) {
  // 将草稿参数写入 storage，write 页读取后恢复
  uni.setStorageSync('st_write_resume', JSON.stringify({
    key: draft.key,
    storyId: draft.storyId,
    parentId: draft.parentId,
  }))
  uni.navigateTo({ url: '/pages/write/index' })
}

function deleteDraft(draft: DraftItem) {
  uni.showModal({
    title: '删除草稿',
    content: '确定要删除这份草稿吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync(draft.key)
        loadDrafts()
      }
    },
  })
}

onShow(() => {
  loadDrafts()
})
</script>

<style lang="scss" scoped>
.create-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 0 0 env(safe-area-inset-bottom);
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

.new-story-card,
.quick-write-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin: 24rpx 24rpx 0;
  padding: 28rpx 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);

  .new-story-icon,
  .quick-write-icon {
    font-size: 48rpx;
    width: 80rpx;
    text-align: center;
  }

  .new-story-info,
  .quick-write-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;

    .new-story-title,
    .quick-write-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #1e293b;
    }

    .new-story-desc,
    .quick-write-desc {
      font-size: 24rpx;
      color: #94a3b8;
    }
  }

  .arrow {
    font-size: 40rpx;
    color: #cbd5e1;
  }
}

.new-story-card {
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);

  .new-story-title { color: #ffffff; }
  .new-story-desc { color: rgba(255, 255, 255, 0.75); }
  .arrow { color: rgba(255, 255, 255, 0.6); }
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #94a3b8;
  padding: 36rpx 32rpx 16rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.empty-drafts {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  gap: 16rpx;

  .empty-icon { font-size: 64rpx; }

  .empty-text {
    font-size: 28rpx;
    color: #94a3b8;
  }
}

.draft-card {
  display: flex;
  align-items: center;
  margin: 0 24rpx 16rpx;
  background: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;

  .draft-main {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 24rpx;
    gap: 16rpx;

    .draft-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6rpx;

      .draft-title {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
      }

      .draft-preview {
        font-size: 24rpx;
        color: #64748b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 400rpx;
      }

      .draft-time {
        font-size: 22rpx;
        color: #94a3b8;
      }
    }

    .arrow {
      font-size: 40rpx;
      color: #cbd5e1;
    }
  }

  .draft-delete {
    padding: 24rpx 20rpx;
    border-left: 1rpx solid #f0f2f5;

    .delete-icon {
      font-size: 36rpx;
    }
  }
}
</style>

