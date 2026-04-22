<template>
  <view class="editor-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 顶部工具栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <view class="back-btn" @tap="handleBack">
          <text class="back-icon">←</text>
        </view>
        <text class="toolbar-title">{{ toolbarTitle }}</text>
      </view>
      <view class="toolbar-right">
        <text v-if="wordCount > 0 || form.title.length > 0" class="sync-status" :class="syncStatusClass">{{ syncStatusText }}</text>
        <button class="publish-btn" :disabled="publishing" @tap="handlePublish">
          {{ publishing ? '发布中...' : '发布' }}
        </button>
      </view>
    </view>

    <!-- 父章节上下文卡片（续写/Fork 模式下显示） -->
    <view v-if="parentId && parentNode" class="parent-context-card">
      <view class="parent-context-header">
        <text class="parent-context-label">续写自</text>
        <text class="parent-context-title" @tap="goParentChapter">{{ parentNode.title }}</text>
        <text class="parent-context-arrow">›</text>
      </view>
      <view class="parent-context-preview">
        <text class="parent-context-text">{{ parentPreviewText }}</text>
        <text
          v-if="!parentExpanded && parentNode.content.length > 200"
          class="expand-btn"
          @tap="parentExpanded = true"
        >展开全文</text>
      </view>
    </view>

    <!-- 故事名称（新建第一章时显示，只读） -->
    <view v-if="storyTitle && !parentId" class="story-name-bar">
      <text class="story-name-label">故事：</text>
      <text class="story-name-text">{{ storyTitle }}</text>
    </view>

    <!-- 写作区域 -->
    <scroll-view class="write-scroll" scroll-y>
      <view class="write-content">
        <!-- 章节标题 -->
        <view class="title-input-wrap">
          <input
            v-model="form.title"
            class="title-input"
            placeholder="章节标题（必填）"
            placeholder-class="title-placeholder"
            maxlength="50"
            @input="onFormInput"
          />
          <text class="title-count">{{ form.title.length }}/50</text>
        </view>

        <!-- 封面图片 -->
        <view class="image-section">
          <view v-if="form.image" class="image-preview">
            <image class="preview-img" :src="form.image" mode="aspectFill" />
            <view class="remove-img" @tap="removeImage">
              <text>×</text>
            </view>
          </view>
          <view v-else class="image-upload" @tap="chooseImage">
            <text class="upload-icon">🖼️</text>
            <text class="upload-text">添加章节插图（可选）</text>
          </view>
        </view>

        <!-- 正文编辑器 -->
        <view class="editor-section">
          <textarea
            v-model="form.content"
            class="content-textarea"
            placeholder="开始你的故事..."
            placeholder-class="content-placeholder"
            :auto-height="true"
            maxlength="50000"
            @input="onFormInput"
          />
        </view>

        <!-- 字数统计 -->
        <view class="word-count-bar">
          <text class="word-count">已写 {{ wordCount }} 字</text>
          <text v-if="wordCount < 100" class="word-hint">建议至少写100字</text>
        </view>

        <!-- AI 辅助工具 -->
        <view v-if="userStore.isLoggedIn" class="ai-tools">
          <text class="ai-tools-title">✨ AI 辅助</text>
          <view class="ai-actions">
            <view class="ai-btn" @tap="openAiPanel('polish')">
              <text class="ai-btn-icon">✨</text>
              <text class="ai-btn-label">AI 润色</text>
              <view v-if="aiQuota" class="ai-quota-badge" :class="getQuotaBadgeClass('polish')">
                <text class="ai-quota-text">{{ getQuotaText('polish') }}</text>
              </view>
            </view>
            <view class="ai-btn" @tap="openAiPanel('continue')">
              <text class="ai-btn-icon">✍️</text>
              <text class="ai-btn-label">AI 续写</text>
              <view v-if="aiQuota" class="ai-quota-badge" :class="getQuotaBadgeClass('continue')">
                <text class="ai-quota-text">{{ getQuotaText('continue') }}</text>
              </view>
            </view>
            <view class="ai-btn" @tap="openAiPanel('illustration')">
              <text class="ai-btn-icon">🎨</text>
              <text class="ai-btn-label">AI 插图</text>
              <view v-if="aiQuota" class="ai-quota-badge" :class="getQuotaBadgeClass('illustration')">
                <text class="ai-quota-text">{{ getQuotaText('illustration') }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- AI 面板 -->
    <ai-panel
      :visible="showAiPanel"
      :story-id="storyId || undefined"
      :node-id="parentId || undefined"
      :content="form.content"
      :chapter-title="form.title"
      :initial-tab="aiPanelInitialTab"
      @close="showAiPanel = false"
      @apply="onAiApply"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { onLoad, onHide, onUnload } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { createNode, updateNode, getNode, createDraftNode, updateDraftNode, publishNode } from '@/api/nodes'
import { getAiV2Quota } from '@/api/ai'
import { http } from '@/utils/request'
import AiPanel from '@/components/ai-panel/index.vue'
import type { Node } from '@/api/nodes'

const userStore = useUserStore()

const statusBarHeight = ref(20)

// ─── 路由参数 ──────────────────────────────────────────────────────────────────
// 编辑已有节点：nodeId
// 续写/Fork：storyId + parentId（可选 prefillContent/prefillTitle）
// 新建第一章：storyId（无 parentId）
const nodeId = ref<number | null>(null)       // 编辑模式的节点ID
const storyId = ref<number | null>(null)
const parentId = ref<number | null>(null)
const storyTitle = ref('')                    // 新建第一章时展示的故事名
const isEditing = ref(false)                  // 编辑已发布章节模式

// ─── 草稿状态 ──────────────────────────────────────────────────────────────────
// draftNodeId：当前草稿在服务端的 nodeId（首次创建后获得）
const draftNodeId = ref<number | null>(null)
// 同步状态：'synced' | 'local' | 'syncing' | 'error'
const syncStatus = ref<'synced' | 'local' | 'syncing' | 'error'>('synced')
// 是否有未同步的修改
const hasPendingSync = ref(false)
// 30秒定时同步器
let syncTimer: ReturnType<typeof setInterval> | null = null

// ─── 父章节数据 ────────────────────────────────────────────────────────────────
const parentNode = ref<Node | null>(null)
const parentExpanded = ref(false)
const parentPreviewText = computed(() => {
  if (!parentNode.value) return ''
  const text = parentNode.value.content
  if (parentExpanded.value) return text
  return text.length > 200 ? text.slice(0, 200) + '...' : text
})

// ─── 表单数据 ──────────────────────────────────────────────────────────────────
const form = reactive({
  title: '',
  content: '',
  image: '',
})

const wordCount = computed(() => form.content.replace(/\s/g, '').length)

// ─── AI ────────────────────────────────────────────────────────────────────────
const publishing = ref(false)
const showAiPanel = ref(false)
const aiPanelInitialTab = ref<'continue' | 'polish' | 'illustration'>('polish')
const aiQuota = ref<{
  quota: {
    continuation: { remaining: number; unlimited: boolean }
    polish: { remaining: number; unlimited: boolean }
    illustration: { remaining: number; unlimited: boolean }
  }
  costs: { continuation: number; polish: number; illustration: number }
} | null>(null)

// ─── 计算属性 ──────────────────────────────────────────────────────────────────
const toolbarTitle = computed(() => {
  if (isEditing.value) return '编辑章节'
  if (parentId.value) return '续写章节'
  return '新建章节'
})

const syncStatusText = computed(() => {
  switch (syncStatus.value) {
    case 'synced': return '已同步'
    case 'local': return '本地保存'
    case 'syncing': return '同步中...'
    case 'error': return '同步失败'
  }
})

const syncStatusClass = computed(() => ({
  'sync-synced': syncStatus.value === 'synced',
  'sync-local': syncStatus.value === 'local',
  'sync-syncing': syncStatus.value === 'syncing',
  'sync-error': syncStatus.value === 'error',
}))

// ─── 生命周期 ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const sysInfo = uni.getSystemInfoSync()
    statusBarHeight.value = sysInfo.statusBarHeight || 20
  } catch {
    statusBarHeight.value = 20
  }
})

onLoad(async (options: any) => {
  if (!options) return

  // 编辑已发布章节
  if (options.nodeId) {
    nodeId.value = Number(options.nodeId)
    isEditing.value = true
    await loadNodeForEdit(nodeId.value)
    return
  }

  // 续写/新建模式
  if (options.storyId) storyId.value = Number(options.storyId)
  if (options.parentId) parentId.value = Number(options.parentId)
  if (options.storyTitle) storyTitle.value = decodeURIComponent(options.storyTitle)
  if (options.prefillContent) form.content = decodeURIComponent(options.prefillContent)
  if (options.prefillTitle) form.title = decodeURIComponent(options.prefillTitle)

  // 如果是恢复草稿
  if (options.draftNodeId) {
    draftNodeId.value = Number(options.draftNodeId)
    await loadDraftFromServer(draftNodeId.value)
    return
  }

  // 加载父章节内容（用于上下文卡片）
  if (parentId.value) {
    loadParentNode(parentId.value)
  }

  // 尝试从本地 Storage 恢复草稿
  loadLocalDraft()

  // 启动 30 秒定时同步
  startSyncTimer()

  if (userStore.isLoggedIn) loadAiQuota()
})

onHide(() => {
  // 切后台/离开页面时强制同步一次
  if (hasPendingSync.value && !isEditing.value) {
    syncToServer()
  }
})

onUnload(() => {
  // 页面销毁（navigateBack）时也强制同步一次
  if (hasPendingSync.value && !isEditing.value) {
    syncToServer()
  }
  stopSyncTimer()
})

onUnmounted(() => {
  stopSyncTimer()
})

// ─── 草稿相关逻辑 ──────────────────────────────────────────────────────────────

function getLocalDraftKey() {
  // 优先用服务端 draftNodeId 作为 key，其次用 storyId+parentId
  if (draftNodeId.value) return `st_editor_draft_node_${draftNodeId.value}`
  return `st_editor_draft_${storyId.value || 'new'}_p${parentId.value || 0}`
}

function saveLocalDraft() {
  try {
    uni.setStorageSync(getLocalDraftKey(), JSON.stringify({
      title: form.title,
      content: form.content,
      image: form.image,
      draftNodeId: draftNodeId.value,
      savedAt: Date.now(),
    }))
    syncStatus.value = 'local'
  } catch {
    // 忽略
  }
}

function loadLocalDraft() {
  try {
    const raw = uni.getStorageSync(getLocalDraftKey())
    if (raw) {
      const data = JSON.parse(raw)
      if (!form.title) form.title = data.title || ''
      if (!form.content) form.content = data.content || ''
      if (!form.image) form.image = data.image || ''
      if (data.draftNodeId) draftNodeId.value = data.draftNodeId
    }
  } catch {
    // 忽略
  }
}

async function loadDraftFromServer(id: number) {
  try {
    const res = await getNode(id)
    form.title = res.node.title
    form.content = res.node.content
    form.image = res.node.image || ''
    storyId.value = res.node.story_id
    parentId.value = res.node.parent_id || null
    // 恢复故事标题（用于顶部名称栏显示）
    if (res.node.story?.title) {
      storyTitle.value = res.node.story.title
    }
    if (parentId.value) loadParentNode(parentId.value)
    syncStatus.value = 'synced'
    startSyncTimer()
    if (userStore.isLoggedIn) loadAiQuota()
  } catch {
    uni.showToast({ title: '加载草稿失败', icon: 'none' })
  }
}

async function syncToServer() {
  if (!userStore.isLoggedIn) return
  if (!form.title.trim() && !form.content.trim()) return
  if (!storyId.value) return

  syncStatus.value = 'syncing'
  hasPendingSync.value = false

  try {
    if (draftNodeId.value) {
      // 更新已有草稿
      await updateDraftNode(draftNodeId.value, {
        title: form.title || '未命名章节',
        content: form.content,
        image: form.image || undefined,
      })
    } else {
      // 首次创建草稿节点
      const res = await createDraftNode({
        story_id: storyId.value,
        parent_id: parentId.value || undefined,
        title: form.title || '未命名章节',
        content: form.content || ' ',
        image: form.image || undefined,
      })
      draftNodeId.value = res.node.id
      // 更新本地 Storage 的 key（加入 draftNodeId）
      saveLocalDraft()
    }
    syncStatus.value = 'synced'
  } catch {
    syncStatus.value = 'error'
    hasPendingSync.value = true
  }
}

function startSyncTimer() {
  stopSyncTimer()
  syncTimer = setInterval(() => {
    if (hasPendingSync.value) syncToServer()
  }, 30000)
}

function stopSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

function onFormInput() {
  saveLocalDraft()
  hasPendingSync.value = true
  syncStatus.value = 'local'
}

// ─── 加载数据 ──────────────────────────────────────────────────────────────────

async function loadNodeForEdit(id: number) {
  try {
    const res = await getNode(id)
    form.title = res.node.title
    form.content = res.node.content
    form.image = res.node.image || ''
    storyId.value = res.node.story_id
    if (userStore.isLoggedIn) loadAiQuota()
  } catch {
    uni.showToast({ title: '加载章节失败', icon: 'none' })
  }
}

async function loadParentNode(id: number) {
  try {
    const res = await getNode(id)
    parentNode.value = res.node
  } catch {
    // 静默失败
  }
}

async function loadAiQuota() {
  try {
    aiQuota.value = await getAiV2Quota()
  } catch {
    // 静默失败
  }
}

// ─── 发布 ──────────────────────────────────────────────────────────────────────

async function handlePublish() {
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入章节标题', icon: 'none' })
    return
  }
  if (!form.content.trim()) {
    uni.showToast({ title: '请输入章节内容', icon: 'none' })
    return
  }
  if (!storyId.value) {
    uni.showToast({ title: '缺少故事信息', icon: 'none' })
    return
  }

  publishing.value = true
  try {
    if (isEditing.value && nodeId.value) {
      // 编辑已发布章节
      await updateNode(nodeId.value, {
        title: form.title.trim(),
        content: form.content.trim(),
        image: form.image || undefined,
      })
    } else if (draftNodeId.value) {
      // 先同步最新内容，再发布草稿
      await updateDraftNode(draftNodeId.value, {
        title: form.title.trim(),
        content: form.content.trim(),
        image: form.image || undefined,
      })
      await publishNode(draftNodeId.value)
    } else {
      // 直接创建并发布
      await createNode({
        story_id: storyId.value,
        parent_id: parentId.value || undefined,
        title: form.title.trim(),
        content: form.content.trim(),
        image: form.image || undefined,
      })
    }

    // 清除本地草稿
    try { uni.removeStorageSync(getLocalDraftKey()) } catch { /* 忽略 */ }
    stopSyncTimer()

    // 写入刷新标记
    uni.setStorageSync('st_story_refresh', String(storyId.value))

    uni.showToast({ title: '发布成功！', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack({ delta: 1 })
    }, 1500)
  } catch (err: any) {
    uni.showToast({ title: err.message || '发布失败', icon: 'none' })
  } finally {
    publishing.value = false
  }
}

// ─── 其他操作 ──────────────────────────────────────────────────────────────────

function goParentChapter() {
  if (parentId.value) {
    uni.navigateTo({ url: `/pages/chapter/index?id=${parentId.value}` })
  }
}

async function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0]
      try {
        const uploadRes = await http.upload({
          url: '/api/upload/image',
          filePath: tempPath,
          name: 'image',
        })
        form.image = uploadRes.url
        onFormInput()
      } catch {
        uni.showToast({ title: '图片上传失败', icon: 'none' })
      }
    },
  })
}

function removeImage() {
  form.image = ''
  onFormInput()
}

function openAiPanel(action: string = 'polish') {
  aiPanelInitialTab.value = action as 'continue' | 'polish' | 'illustration'
  showAiPanel.value = true
}

function onAiApply(content: string) {
  form.content = form.content ? form.content + '\n\n' + content : content
  onFormInput()
}

function getQuotaText(type: 'continue' | 'polish' | 'illustration'): string {
  if (!aiQuota.value) return ''
  const key = type === 'continue' ? 'continuation' : type
  const q = aiQuota.value.quota[key as keyof typeof aiQuota.value.quota]
  const cost = aiQuota.value.costs[type === 'continue' ? 'continuation' : type as keyof typeof aiQuota.value.costs]
  if (q.unlimited) return '∞'
  if (q.remaining > 0) return String(q.remaining)
  return `${cost}积分`
}

function getQuotaBadgeClass(type: 'continue' | 'polish' | 'illustration'): string {
  if (!aiQuota.value) return ''
  const key = type === 'continue' ? 'continuation' : type
  const q = aiQuota.value.quota[key as keyof typeof aiQuota.value.quota]
  if (q.unlimited) return 'unlimited'
  if (q.remaining <= 0) return 'exhausted'
  if (q.remaining <= 3) return 'low'
  return ''
}

function handleBack() {
  const doBack = () => {
    stopSyncTimer()
    uni.navigateBack({ delta: 1 })
  }

  if (form.content.trim() || form.title.trim()) {
    uni.showModal({
      title: '退出写作',
      content: draftNodeId.value
        ? '内容已保存为草稿，可在写作中心继续编辑'
        : '当前内容仅保存在本地，确定退出吗？',
      confirmText: '退出',
      cancelText: '继续写',
      success: (res) => {
        if (res.confirm) doBack()
      },
    })
  } else {
    doBack()
  }
}
</script>

<style lang="scss" scoped>
.editor-page {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height, 20px) + 10px) 24rpx 16rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f2f5;
  position: sticky;
  top: 0;
  z-index: 10;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16rpx;

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

    .toolbar-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #1e293b;
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .sync-status {
      font-size: 22rpx;

      &.sync-synced { color: #10b981; }
      &.sync-local { color: #f59e0b; }
      &.sync-syncing { color: #94a3b8; }
      &.sync-error { color: #ef4444; }
    }

    .publish-btn {
      background: #7c6af7;
      color: #ffffff;
      padding: 14rpx 32rpx;
      border-radius: 40rpx;
      font-size: 26rpx;
      font-weight: 600;
      border: none;
      line-height: 1;

      &[disabled] { opacity: 0.6; }
    }
  }
}

// 父章节上下文卡片
.parent-context-card {
  margin: 20rpx 24rpx;
  padding: 20rpx 24rpx;
  background: rgba(124, 106, 247, 0.05);
  border-radius: 16rpx;
  border: 1rpx solid rgba(124, 106, 247, 0.15);

  .parent-context-header {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 12rpx;

    .parent-context-label {
      font-size: 22rpx;
      color: #94a3b8;
    }

    .parent-context-title {
      font-size: 24rpx;
      font-weight: 600;
      color: #7c6af7;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .parent-context-arrow {
      font-size: 28rpx;
      color: #7c6af7;
    }
  }

  .parent-context-preview {
    .parent-context-text {
      font-size: 24rpx;
      color: #64748b;
      line-height: 1.7;
      display: block;
    }

    .expand-btn {
      font-size: 22rpx;
      color: #7c6af7;
      margin-top: 8rpx;
      display: block;
    }
  }
}

// 故事名称栏
.story-name-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  background: #f8fafc;
  border-bottom: 1rpx solid #f0f2f5;

  .story-name-label {
    font-size: 24rpx;
    color: #94a3b8;
  }

  .story-name-text {
    font-size: 24rpx;
    font-weight: 600;
    color: #1e293b;
  }
}

.write-scroll {
  flex: 1;
}

.write-content {
  padding: 0 0 80rpx;
}

.title-input-wrap {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx 16rpx;
  border-bottom: 1rpx solid #f0f2f5;

  .title-input {
    flex: 1;
    font-size: 36rpx;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.4;
  }

  .title-placeholder {
    color: #cbd5e1;
    font-weight: 400;
  }

  .title-count {
    font-size: 22rpx;
    color: #cbd5e1;
    margin-left: 12rpx;
    flex-shrink: 0;
  }
}

.image-section {
  padding: 16rpx 32rpx;
  border-bottom: 1rpx solid #f0f2f5;

  .image-preview {
    position: relative;
    display: inline-block;

    .preview-img {
      width: 200rpx;
      height: 150rpx;
      border-radius: 12rpx;
    }

    .remove-img {
      position: absolute;
      top: -12rpx;
      right: -12rpx;
      width: 40rpx;
      height: 40rpx;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 24rpx;
    }
  }

  .image-upload {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 16rpx 0;

    .upload-icon { font-size: 36rpx; }

    .upload-text {
      font-size: 26rpx;
      color: #94a3b8;
    }
  }
}

.editor-section {
  padding: 24rpx 32rpx;

  .content-textarea {
    width: 100%;
    font-size: 30rpx;
    color: #1e293b;
    line-height: 1.8;
    min-height: 400rpx;
  }

  .content-placeholder {
    color: #cbd5e1;
  }
}

.word-count-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 32rpx 24rpx;

  .word-count {
    font-size: 24rpx;
    color: #94a3b8;
  }

  .word-hint {
    font-size: 22rpx;
    color: #f59e0b;
  }
}

.ai-tools {
  margin: 0 24rpx 24rpx;
  padding: 24rpx;
  background: rgba(124, 106, 247, 0.04);
  border-radius: 20rpx;
  border: 1rpx solid rgba(124, 106, 247, 0.12);

  .ai-tools-title {
    font-size: 26rpx;
    font-weight: 600;
    color: #475569;
    display: block;
    margin-bottom: 20rpx;
  }

  .ai-actions {
    display: flex;
    gap: 16rpx;
  }

  .ai-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    padding: 20rpx 12rpx;
    background: #ffffff;
    border-radius: 16rpx;
    border: 1rpx solid rgba(124, 106, 247, 0.15);
    position: relative;

    .ai-btn-icon { font-size: 40rpx; }

    .ai-btn-label {
      font-size: 22rpx;
      color: #475569;
    }

    .ai-quota-badge {
      position: absolute;
      top: -8rpx;
      right: -8rpx;
      min-width: 36rpx;
      height: 36rpx;
      border-radius: 18rpx;
      padding: 0 8rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #7c6af7;

      &.unlimited { background: #10b981; }
      &.low { background: #f59e0b; }
      &.exhausted { background: #94a3b8; }

      .ai-quota-text {
        font-size: 18rpx;
        color: #ffffff;
        font-weight: 600;
      }
    }
  }
}
</style>

