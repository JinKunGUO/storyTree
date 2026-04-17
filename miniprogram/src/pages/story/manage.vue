<template>
  <view class="manage-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 顶部栏 -->
    <view class="top-bar">
      <view class="back-btn" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="top-title">管理故事</text>
      <view class="save-btn" @tap="saveSettings">
        <text class="save-text">保存</text>
      </view>
    </view>

    <scroll-view v-if="story" class="content-scroll" scroll-y>
      <!-- 基本信息 -->
      <view class="section-card">
        <text class="section-title">基本信息</text>

        <!-- 封面 -->
        <view class="cover-row" @tap="changeCover">
          <image
            class="cover-thumb"
            :src="getImageUrl(form.cover_image) || '/static/images/default-cover.png'"
            mode="aspectFill"
          />
          <view class="cover-info">
            <text class="cover-label">故事封面</text>
            <text class="cover-hint">点击更换封面图片</text>
          </view>
          <text class="arrow">›</text>
        </view>

        <!-- 标题 -->
        <view class="field-row">
          <text class="field-label">故事标题</text>
          <input
            v-model="form.title"
            class="field-input"
            placeholder="请输入故事标题"
            placeholder-class="field-placeholder"
            maxlength="50"
          />
        </view>

        <!-- 简介 -->
        <view class="field-row field-row-textarea">
          <text class="field-label">故事简介</text>
          <textarea
            v-model="form.description"
            class="field-textarea"
            placeholder="请输入故事简介（可选）"
            placeholder-class="field-placeholder"
            maxlength="500"
            :auto-height="true"
          />
        </view>

        <!-- 标签 -->
        <view class="field-row">
          <text class="field-label">标签</text>
          <input
            v-model="form.tags"
            class="field-input"
            placeholder="多个标签用逗号分隔"
            placeholder-class="field-placeholder"
          />
        </view>
      </view>

      <!-- 权限设置 -->
      <view class="section-card">
        <text class="section-title">权限设置</text>

        <!-- 可见性 -->
        <view class="field-row">
          <text class="field-label">可见范围</text>
          <picker
            class="picker-wrap"
            :value="visibilityIndex"
            :range="visibilityOptions"
            range-key="label"
            @change="onVisibilityChange"
          >
            <view class="picker-value">
              <text>{{ visibilityOptions[visibilityIndex]?.label }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <!-- 允许协作续写 -->
        <view class="switch-row">
          <view class="switch-info">
            <text class="switch-label">开放协作续写</text>
            <text class="switch-desc">允许其他用户申请成为共创者</text>
          </view>
          <switch
            :checked="form.allow_branch"
            color="#7c6af7"
            @change="form.allow_branch = $event.detail.value"
          />
        </view>

        <!-- 自动批准协作申请 -->
        <view v-if="form.allow_branch" class="switch-row">
          <view class="switch-info">
            <text class="switch-label">自动批准申请</text>
            <text class="switch-desc">无需审核，申请即通过</text>
          </view>
          <switch
            :checked="form.auto_approve"
            color="#7c6af7"
            @change="form.auto_approve = $event.detail.value"
          />
        </view>

        <!-- 允许评论 -->
        <view class="switch-row">
          <view class="switch-info">
            <text class="switch-label">允许评论</text>
            <text class="switch-desc">读者可以在章节下发表评论</text>
          </view>
          <switch
            :checked="form.allow_comment"
            color="#7c6af7"
            @change="form.allow_comment = $event.detail.value"
          />
        </view>
      </view>

      <!-- 协作申请列表 -->
      <view v-if="form.allow_branch" class="section-card">
        <view class="section-header">
          <text class="section-title">协作申请</text>
          <text v-if="pendingRequests.length > 0" class="pending-badge">{{ pendingRequests.length }} 待审核</text>
        </view>

        <view v-if="requestsLoading" class="list-loading">
          <text>加载中...</text>
        </view>
        <view v-else-if="pendingRequests.length === 0" class="list-empty">
          <text>暂无待审核的协作申请</text>
        </view>
        <view
          v-for="req in pendingRequests"
          :key="req.id"
          class="request-item"
        >
          <image
            class="req-avatar"
            :src="getImageUrl(req.user.avatar) || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
          <view class="req-info">
            <text class="req-username">{{ req.user.username }}</text>
            <text v-if="req.message" class="req-message">{{ req.message }}</text>
            <text class="req-time">{{ formatTime(req.created_at) }}</text>
          </view>
          <view class="req-actions">
            <view class="btn-approve" @tap="approveRequest(req)">通过</view>
            <view class="btn-reject" @tap="rejectRequest(req)">拒绝</view>
          </view>
        </view>
      </view>

      <!-- 共创者列表 -->
      <view class="section-card">
        <text class="section-title">当前共创者</text>
        <view v-if="collaborators.length === 0" class="list-empty">
          <text>还没有共创者</text>
        </view>
        <view
          v-for="c in collaborators"
          :key="c.id"
          class="collab-item"
        >
          <image
            class="collab-avatar"
            :src="getImageUrl(c.avatar) || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
          <text class="collab-name">{{ c.username }}</text>
          <view class="btn-remove" @tap="removeCollaborator(c)">移除</view>
        </view>
      </view>

      <!-- 危险操作 -->
      <view class="section-card danger-section">
        <text class="section-title danger-title">危险操作</text>
        <view class="danger-btn" @tap="confirmDelete">
          <text class="danger-btn-text">删除故事</text>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- 加载中 -->
    <view v-else-if="loading" class="loading-page">
      <view class="loading-spinner" />
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { getStory, updateStory, deleteStory } from '@/api/stories'
import { http, getImageUrl } from '@/utils/request'
import { formatRelativeTime } from '@/utils/helpers'
import type { Story } from '@/api/stories'

const userStore = useUserStore()

const loading = ref(true)
const saving = ref(false)
const requestsLoading = ref(false)
const statusBarHeight = ref(20) // 状态栏高度（px），动态获取避免与胶囊按钮重叠
const storyId = ref<number>(0)
const story = ref<Story | null>(null)

const form = reactive({
  title: '',
  description: '',
  cover_image: '',
  tags: '',
  visibility: 'public',
  allow_branch: true,
  allow_comment: true,
  auto_approve: false,
})

const pendingRequests = ref<any[]>([])
const collaborators = ref<any[]>([])

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '追更者可见', value: 'followers' },
  { label: '协作者可见', value: 'collaborators' },
  { label: '仅自己', value: 'author_only' },
]

const visibilityIndex = computed(() => {
  return visibilityOptions.findIndex(o => o.value === form.visibility) || 0
})

function onVisibilityChange(e: any) {
  form.visibility = visibilityOptions[e.detail.value]?.value || 'public'
}

onMounted(() => {
  // 动态获取状态栏高度
  try {
    const sysInfo = uni.getSystemInfoSync()
    statusBarHeight.value = sysInfo.statusBarHeight || 20
  } catch {
    statusBarHeight.value = 20
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const id = Number(currentPage.options?.id)
  if (id) {
    storyId.value = id
    loadStory(id)
  }
})

async function loadStory(id: number) {
  loading.value = true
  try {
    const res = await getStory(id)
    story.value = res.story

    // 填充表单
    form.title = res.story.title
    form.description = res.story.description || ''
    form.cover_image = res.story.cover_image || ''
    form.tags = res.story.tags ? (() => {
      try {
        const parsed = JSON.parse(res.story.tags)
        if (Array.isArray(parsed)) return parsed.join(',')
      } catch { /* 不是JSON */ }
      return res.story.tags
    })() : ''
    form.visibility = res.story.visibility || 'public'
    form.allow_branch = res.story.allow_branch ?? true
    form.allow_comment = res.story.allow_comment ?? true

    // 加载协作者列表
    collaborators.value = res.story.collaborators || []

    // 加载待审核申请
    if (res.story.allow_branch) {
      loadPendingRequests(id)
    }
  } catch (err) {
    console.error('加载故事失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadPendingRequests(id: number) {
  requestsLoading.value = true
  try {
    const res = await http.get<{ requests: any[] }>(
      `/api/collaboration-requests/story/${id}?status=pending`
    )
    pendingRequests.value = res.requests || []
  } catch (err) {
    console.error('加载协作申请失败', err)
  } finally {
    requestsLoading.value = false
  }
}

async function saveSettings() {
  if (!form.title.trim()) {
    uni.showToast({ title: '故事标题不能为空', icon: 'none' })
    return
  }
  saving.value = true
  try {
    // 更新基本信息
    await updateStory(storyId.value, {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      cover_image: form.cover_image || undefined,
    } as any)

    // 更新权限设置
    await http.put(`/api/stories/${storyId.value}/settings`, {
      visibility: form.visibility,
      allow_branch: form.allow_branch,
      allow_comment: form.allow_comment,
      auto_approve_collaborators: form.auto_approve,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    })

    uni.showToast({ title: '保存成功', icon: 'success' })
    // 延迟返回，让用户看到 toast
    setTimeout(() => goBack(), 1200)
  } catch (err: any) {
    uni.showToast({ title: err.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function changeCover() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      try {
        const uploadRes = await http.upload({
          url: '/api/upload/image',
          filePath: res.tempFilePaths[0],
          name: 'image',
        })
        form.cover_image = uploadRes.url
      } catch {
        uni.showToast({ title: '图片上传失败', icon: 'none' })
      }
    },
  })
}

async function approveRequest(req: any) {
  try {
    await http.put(`/api/collaboration-requests/${req.id}/approve`, {})
    pendingRequests.value = pendingRequests.value.filter(r => r.id !== req.id)
    // 将该用户加入共创者列表
    collaborators.value.push(req.user)
    uni.showToast({ title: '已通过申请', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function rejectRequest(req: any) {
  try {
    await http.put(`/api/collaboration-requests/${req.id}/reject`, {})
    pendingRequests.value = pendingRequests.value.filter(r => r.id !== req.id)
    uni.showToast({ title: '已拒绝申请', icon: 'none' })
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

async function removeCollaborator(c: any) {
  uni.showModal({
    title: '确认移除',
    content: `确定要移除共创者「${c.username}」吗？`,
    confirmText: '移除',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await http.delete(`/api/stories/${storyId.value}/collaborators/${c.id}`)
        collaborators.value = collaborators.value.filter(col => col.id !== c.id)
        uni.showToast({ title: '已移除', icon: 'success' })
      } catch (err: any) {
        uni.showToast({ title: err.message || '操作失败', icon: 'none' })
      }
    },
  })
}

function confirmDelete() {
  uni.showModal({
    title: '删除故事',
    content: '删除后无法恢复，故事下所有章节也会一并删除，确定要删除吗？',
    confirmText: '删除',
    confirmColor: '#ef4444',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteStory(storyId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' })
        }, 1200)
      } catch (err: any) {
        uni.showToast({ title: err.message || '删除失败', icon: 'none' })
      }
    },
  })
}

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
.manage-page {
  min-height: 100vh;
  background: #f0f2f5;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height, 20px) + 10px) 32rpx 20rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f2f5;

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    .back-icon {
      font-size: 36rpx;
      color: #1e293b;
    }
  }

  .top-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
  }

  .save-btn {
    padding: 12rpx 28rpx;
    background: #7c6af7;
    border-radius: 40rpx;
    .save-text {
      font-size: 26rpx;
      color: #ffffff;
      font-weight: 600;
    }
  }
}

.content-scroll {
  height: calc(100vh - 160rpx);
}

.section-card {
  margin: 20rpx 24rpx 0;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;

  .section-title {
    font-size: 28rpx;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 20rpx;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .pending-badge {
      font-size: 22rpx;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 4rpx 14rpx;
      border-radius: 20rpx;
    }
  }
}

// 封面行
.cover-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f2f5;
  margin-bottom: 16rpx;

  .cover-thumb {
    width: 100rpx;
    height: 70rpx;
    border-radius: 12rpx;
    background: #f0f2f5;
    flex-shrink: 0;
  }

  .cover-info {
    flex: 1;
    .cover-label {
      font-size: 28rpx;
      color: #1e293b;
      display: block;
    }
    .cover-hint {
      font-size: 22rpx;
      color: #94a3b8;
      margin-top: 4rpx;
    }
  }

  .arrow {
    font-size: 36rpx;
    color: #cbd5e1;
  }
}

// 表单字段
.field-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f2f5;

  &:last-child { border-bottom: none; }

  &.field-row-textarea {
    align-items: flex-start;
  }

  .field-label {
    font-size: 28rpx;
    color: #475569;
    width: 140rpx;
    flex-shrink: 0;
  }

  .field-input {
    flex: 1;
    font-size: 28rpx;
    color: #1e293b;
    text-align: right;
  }

  .field-textarea {
    flex: 1;
    font-size: 26rpx;
    color: #1e293b;
    min-height: 80rpx;
    line-height: 1.6;
  }
}

// Picker
.picker-wrap {
  flex: 1;
  display: flex;
  justify-content: flex-end;

  .picker-value {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 28rpx;
    color: #475569;

    .picker-arrow {
      font-size: 32rpx;
      color: #cbd5e1;
    }
  }
}

// Switch 行
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f2f5;

  &:last-child { border-bottom: none; }

  .switch-info {
    flex: 1;
    margin-right: 24rpx;

    .switch-label {
      font-size: 28rpx;
      color: #1e293b;
      display: block;
    }

    .switch-desc {
      font-size: 22rpx;
      color: #94a3b8;
      margin-top: 4rpx;
    }
  }
}

// 加载/空状态
.list-loading,
.list-empty {
  text-align: center;
  padding: 32rpx;
  font-size: 26rpx;
  color: #94a3b8;
}

// 协作申请
.request-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f2f5;

  &:last-child { border-bottom: none; }

  .req-avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .req-info {
    flex: 1;

    .req-username {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
      display: block;
    }

    .req-message {
      font-size: 24rpx;
      color: #64748b;
      display: block;
      margin-top: 4rpx;
    }

    .req-time {
      font-size: 22rpx;
      color: #94a3b8;
      display: block;
      margin-top: 4rpx;
    }
  }

  .req-actions {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    flex-shrink: 0;

    .btn-approve {
      font-size: 22rpx;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      padding: 8rpx 20rpx;
      border-radius: 20rpx;
      text-align: center;
    }

    .btn-reject {
      font-size: 22rpx;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 8rpx 20rpx;
      border-radius: 20rpx;
      text-align: center;
    }
  }
}

// 共创者
.collab-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f2f5;

  &:last-child { border-bottom: none; }

  .collab-avatar {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
  }

  .collab-name {
    flex: 1;
    font-size: 28rpx;
    color: #1e293b;
  }

  .btn-remove {
    font-size: 22rpx;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
  }
}

// 危险操作
.danger-section {
  .danger-title {
    color: #ef4444 !important;
  }

  .danger-btn {
    padding: 24rpx;
    background: rgba(239, 68, 68, 0.06);
    border: 1rpx solid rgba(239, 68, 68, 0.2);
    border-radius: 16rpx;
    text-align: center;

    .danger-btn-text {
      font-size: 28rpx;
      color: #ef4444;
      font-weight: 600;
    }
  }
}

.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 20rpx;
  font-size: 26rpx;
  color: #94a3b8;

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

.bottom-placeholder {
  height: 60rpx;
}

.field-placeholder {
  color: #cbd5e1;
}
</style>

