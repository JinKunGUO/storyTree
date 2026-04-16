<template>
  <view class="write-page" :style="{ '--status-bar-height': statusBarHeight + 'px' }">
    <!-- 顶部工具栏 -->
    <view class="toolbar">
      <view class="toolbar-left">
        <view class="back-btn" @tap="handleBack">
          <text class="back-icon">←</text>
        </view>
        <text class="toolbar-title">{{ isEditing ? '编辑章节' : '新建章节' }}</text>
      </view>
      <view class="toolbar-right">
        <view class="draft-btn" @tap="saveDraft">
          <text class="draft-text">存草稿</text>
        </view>
        <button class="publish-btn" :disabled="publishing" @tap="handlePublish">
          {{ publishing ? '发布中...' : '发布' }}
        </button>
      </view>
    </view>

    <!-- 父节点信息条（续写时显示，告知用户从哪个节点续写） -->
    <view v-if="parentNodeTitle" class="parent-node-bar">
      <text class="parent-label">续写自：</text>
      <text class="parent-title" @tap="goParentChapter">{{ parentNodeTitle }}</text>
      <text class="parent-arrow">›</text>
    </view>

    <!-- 故事选择（新建时） -->
    <view v-if="!isEditing && !storyId" class="story-select-section">
      <text class="section-label">选择故事</text>
      <view class="story-select-card" @tap="showStoryPicker = true">
        <template v-if="selectedStory">
          <image
            class="selected-story-cover"
            :src="getImageUrl(selectedStory.cover_image) || '/static/images/default-cover.png'"
            mode="aspectFill"
          />
          <view class="selected-story-info">
            <text class="selected-story-title">{{ selectedStory.title }}</text>
            <text class="selected-story-meta">续写故事</text>
          </view>
          <text class="change-text">更换</text>
        </template>
        <template v-else>
          <text class="select-placeholder">+ 选择要续写的故事</text>
        </template>
      </view>
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
          />
          <text class="title-count">{{ form.title.length }}/50</text>
        </view>

        <!-- 封面图片 -->
        <view class="image-section">
          <view v-if="form.image" class="image-preview">
            <image class="preview-img" :src="form.image" mode="aspectFill" />
            <view class="remove-img" @tap="form.image = ''">
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
            @input="onContentInput"
          />
        </view>

        <!-- 字数统计 -->
        <view class="word-count-bar">
          <text class="word-count">已写 {{ wordCount }} 字</text>
          <text v-if="wordCount < 100" class="word-hint">建议至少写100字</text>
        </view>

        <!-- AI 辅助工具（登录即可使用） -->
        <view v-if="userStore.isLoggedIn" class="ai-tools">
          <text class="ai-tools-title">✨ AI 辅助</text>
          <view class="ai-actions">
            <view class="ai-btn" @tap="openAiPanel('continue')">
              <text class="ai-btn-icon">🤖</text>
              <text class="ai-btn-label">AI 续写</text>
            </view>
            <view class="ai-btn" @tap="openAiPanel('polish')">
              <text class="ai-btn-icon">✨</text>
              <text class="ai-btn-label">AI 润色</text>
            </view>
            <view class="ai-btn" @tap="openAiPanel('summary')">
              <text class="ai-btn-icon">📋</text>
              <text class="ai-btn-label">生成摘要</text>
            </view>
            <view class="ai-btn" @tap="chooseImage">
              <text class="ai-btn-icon">🎨</text>
              <text class="ai-btn-label">AI 插图</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 故事选择弹窗 -->
    <view v-if="showStoryPicker" class="picker-mask" @tap.self="showStoryPicker = false">
      <view class="picker-panel">
        <text class="picker-title">选择故事</text>
        <scroll-view class="picker-scroll" scroll-y>
          <view
            v-for="story in myStories"
            :key="story.id"
            class="picker-story-item"
            @tap="selectStory(story)"
          >
            <image
              class="picker-cover"
              :src="getImageUrl(story.cover_image) || '/static/images/default-cover.png'"
              mode="aspectFill"
            />
            <view class="picker-info">
              <text class="picker-title-text">{{ story.title }}</text>
              <text class="picker-meta">{{ story._count?.nodes || 0 }} 章节</text>
            </view>
          </view>
          <view v-if="myStories.length === 0" class="picker-empty">
            <text>还没有故事，先去创建一个吧</text>
          </view>
        </scroll-view>
        <button class="btn-create-story" @tap="goCreateStory">+ 创建新故事</button>
      </view>
    </view>

    <!-- AI 面板 -->
    <ai-panel
      :visible="showAiPanel"
      :story-id="storyId || undefined"
      :node-id="parentId || undefined"
      :content="form.content"
      @close="showAiPanel = false"
      @apply="onAiApply"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { createNode, updateNode, getNode } from '@/api/nodes'
import { getUserStories } from '@/api/stories'
import { getImageUrl } from '@/utils/request'
import AiPanel from '@/components/ai-panel/index.vue'
import type { Story } from '@/api/stories'

const userStore = useUserStore()

const statusBarHeight = ref(20) // 状态栏高度（px），默认 20px 兜底

const publishing = ref(false)
const showAiPanel = ref(false)
const showStoryPicker = ref(false)
const isEditing = ref(false)

const storyId = ref<number | null>(null)
const parentId = ref<number | null>(null)
const nodeId = ref<number | null>(null)
const parentNodeTitle = ref<string>('')   // 父节点标题，用于展示"续写自：xxx"

const selectedStory = ref<Story | null>(null)
const myStories = ref<Story[]>([])

const form = reactive({
  title: '',
  content: '',
  image: '',
})

const wordCount = computed(() => {
  return form.content.replace(/\s/g, '').length
})

onMounted(async () => {
  // 动态获取状态栏高度，避免与微信胶囊按钮重叠
  try {
    const sysInfo = uni.getSystemInfoSync()
    statusBarHeight.value = sysInfo.statusBarHeight || 20
  } catch {
    statusBarHeight.value = 20
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const options = currentPage.options || {}

  // 优先读取 URL 参数（navigateTo 方式，如从编辑入口进入）
  if (options.storyId) storyId.value = Number(options.storyId)
  if (options.parentId) parentId.value = Number(options.parentId)
  if (options.nodeId) {
    nodeId.value = Number(options.nodeId)
    isEditing.value = true
    loadNodeForEdit(nodeId.value)
  }

  // 若无 URL 参数，尝试从 storage 读取（switchTab 传参方式）
  let mode = ''
  let hasPrefill = false
  if (!storyId.value && !options.nodeId) {
    // 优先检查是否从草稿箱恢复
    try {
      const resumeRaw = uni.getStorageSync('st_write_resume')
      if (resumeRaw) {
        const resume = JSON.parse(resumeRaw)
        uni.removeStorageSync('st_write_resume')
        if (resume.storyId) storyId.value = Number(resume.storyId)
        if (resume.parentId) parentId.value = Number(resume.parentId)
        // 直接加载对应草稿
        if (!isEditing.value) {
          loadDraft()
        }
        if (storyId.value) {
          loadMyStories()
        }
        return
      }
    } catch {
      // 忽略
    }

    try {
      const raw = uni.getStorageSync('st_write_params')
      if (raw) {
        const params = JSON.parse(raw)
        if (params.storyId) storyId.value = Number(params.storyId)
        if (params.parentId) parentId.value = Number(params.parentId)
        if (params.parentTitle) parentNodeTitle.value = params.parentTitle
        if (params.prefillContent) {
          form.content = params.prefillContent
          hasPrefill = true
        }
        if (params.prefillTitle) {
          form.title = params.prefillTitle
          hasPrefill = true
        }
        if (params.mode) mode = params.mode
        uni.removeStorageSync('st_write_params')
      }
    } catch {
      // 忽略
    }
  }

  // 加载父节点标题（若已从 storage 获取则跳过）
  if (parentId.value && !parentNodeTitle.value) {
    loadParentNodeTitle(parentId.value)
  }

  // 加载草稿：
  // - 有 prefill 内容（AI 生成）时跳过，避免覆盖
  // - 编辑模式时跳过
  // 草稿 key 同时包含 storyId + parentId，避免不同父节点间互相污染
  if (!isEditing.value && !hasPrefill) {
    loadDraft()
  }

  // 如果没有选定故事，加载我的故事列表
  if (!storyId.value) {
    loadMyStories()
  }

  // AI 模式：直接打开 AI 面板
  if (mode === 'ai') {
    setTimeout(() => {
      showAiPanel.value = true
    }, 300)
  }
})

async function loadParentNodeTitle(id: number) {
  try {
    const res = await getNode(id)
    parentNodeTitle.value = res.node.title
  } catch {
    // 静默失败
  }
}

function goParentChapter() {
  if (parentId.value) {
    uni.navigateTo({ url: `/pages/chapter/index?id=${parentId.value}` })
  }
}

async function loadNodeForEdit(id: number) {
  try {
    const res = await getNode(id)
    form.title = res.node.title
    form.content = res.node.content
    form.image = res.node.image || ''
    storyId.value = res.node.story_id
  } catch (err) {
    console.error('加载节点失败', err)
  }
}

async function loadMyStories() {
  if (!userStore.isLoggedIn || !userStore.userInfo) return
  try {
    const res = await getUserStories(userStore.userInfo.id)
    myStories.value = res.stories
  } catch (err) {
    console.error('加载故事列表失败', err)
  }
}

function loadDraft() {
  try {
    const key = `st_draft_${storyId.value || 'new'}_p${parentId.value || 0}`
    const draft = uni.getStorageSync(key)
    if (draft) {
      const data = JSON.parse(draft)
      form.title = data.title || ''
      form.content = data.content || ''
    }
  } catch {
    // 忽略
  }
}

function saveDraft() {
  try {
    const key = `st_draft_${storyId.value || 'new'}_p${parentId.value || 0}`
    uni.setStorageSync(key, JSON.stringify({
      title: form.title,
      content: form.content,
      savedAt: Date.now(),
    }))
    uni.showToast({ title: '草稿已保存', icon: 'success' })
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

async function handlePublish() {
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入章节标题', icon: 'none' })
    return
  }
  if (!form.content.trim()) {
    uni.showToast({ title: '请输入章节内容', icon: 'none' })
    return
  }
  if (!storyId.value && !selectedStory.value) {
    uni.showToast({ title: '请选择所属故事', icon: 'none' })
    return
  }

  publishing.value = true
  try {
    const data = {
      story_id: storyId.value || selectedStory.value!.id,
      parent_id: parentId.value || undefined,
      title: form.title.trim(),
      content: form.content.trim(),
      image: form.image || undefined,
    }

    if (isEditing.value && nodeId.value) {
      await updateNode(nodeId.value, { title: data.title, content: data.content, image: data.image })
    } else {
      await createNode(data)
    }

    // 清除草稿
    const key = `st_draft_${storyId.value || 'new'}_p${parentId.value || 0}`
    uni.removeStorageSync(key)

    uni.showToast({ title: '发布成功！', icon: 'success' })
    // 写入刷新标记，通知故事详情页在 onShow 时重新加载章节树
    const targetStoryId = storyId.value || selectedStory.value?.id
    if (targetStoryId) {
      uni.setStorageSync('st_story_refresh', String(targetStoryId))
    }
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    }, 1500)
  } catch (err: any) {
    uni.showToast({ title: err.message || '发布失败', icon: 'none' })
  } finally {
    publishing.value = false
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
        const uploadRes = await import('@/utils/request').then(m => m.http.upload({
          url: '/api/upload/image',
          filePath: tempPath,
          name: 'image',
        }))
        form.image = uploadRes.url
      } catch (err) {
        uni.showToast({ title: '图片上传失败', icon: 'none' })
      }
    },
  })
}

// 打开 AI 面板并预选功能
function openAiPanel(action?: string) {
  showAiPanel.value = true
}

// AI 面板生成内容后应用到编辑器
function onAiApply(content: string) {
  form.content = form.content ? form.content + '\n\n' + content : content
}

function onContentInput() {
  // 自动保存草稿（防抖）
}

function selectStory(story: Story) {
  selectedStory.value = story
  storyId.value = story.id
  showStoryPicker.value = false
}

function goCreateStory() {
  showStoryPicker.value = false
  uni.showModal({
    title: '提示',
    content: '请先在"发现"页面找到感兴趣的故事，或在首页创建新故事后再续写章节',
    showCancel: false,
    confirmText: '知道了',
  })
}

function handleBack() {
  const doBack = () => {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: '/pages/index/index' })
    }
  }

  if (form.content.trim() || form.title.trim()) {
    uni.showModal({
      title: '提示',
      content: '内容尚未保存，确定要退出吗？',
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
.write-page {
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

    .draft-btn {
      padding: 12rpx 24rpx;

      .draft-text {
        font-size: 26rpx;
        color: #94a3b8;
      }
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

      &[disabled] {
        opacity: 0.6;
      }
    }
  }
}

.story-select-section {
  padding: 24rpx 32rpx;
  background: #f8fafc;
  border-bottom: 1rpx solid #f0f2f5;

  .section-label {
    font-size: 24rpx;
    color: #94a3b8;
    display: block;
    margin-bottom: 12rpx;
  }

  .story-select-card {
    display: flex;
    align-items: center;
    gap: 16rpx;
    background: #ffffff;
    border-radius: 16rpx;
    padding: 16rpx 20rpx;
    border: 1rpx solid #e2e8f0;

    .selected-story-cover {
      width: 80rpx;
      height: 60rpx;
      border-radius: 8rpx;
    }

    .selected-story-info {
      flex: 1;

      .selected-story-title {
        font-size: 26rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
      }

      .selected-story-meta {
        font-size: 22rpx;
        color: #94a3b8;
        margin-top: 4rpx;
        display: block;
      }
    }

    .change-text {
      font-size: 24rpx;
      color: #7c6af7;
    }

    .select-placeholder {
      font-size: 26rpx;
      color: #94a3b8;
      text-align: center;
      width: 100%;
      padding: 8rpx 0;
    }
  }
}

.write-scroll {
  flex: 1;
}

.write-content {
  padding: 0 0 60rpx;
}

.parent-node-bar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 32rpx;
  background: rgba(124, 106, 247, 0.05);
  border-bottom: 1rpx solid rgba(124, 106, 247, 0.1);

  .parent-label {
    font-size: 24rpx;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .parent-title {
    flex: 1;
    font-size: 24rpx;
    color: #7c6af7;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .parent-arrow {
    font-size: 28rpx;
    color: #cbd5e1;
    flex-shrink: 0;
  }
}

.title-input-wrap {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f0f2f5;

  .title-input {
    flex: 1;
    font-size: 36rpx;
    font-weight: 700;
    color: #1e293b;
    height: 80rpx;
  }

  .title-count {
    font-size: 22rpx;
    color: #cbd5e1;
    flex-shrink: 0;
  }
}

.title-placeholder {
  color: #cbd5e1;
  font-weight: normal;
}

.image-section {
  padding: 20rpx 32rpx;
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
      background: rgba(0, 0, 0, 0.6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      text {
        font-size: 28rpx;
        color: #ffffff;
        line-height: 1;
      }
    }
  }

  .image-upload {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 16rpx 0;

    .upload-icon { font-size: 32rpx; }
    .upload-text { font-size: 26rpx; color: #94a3b8; }
  }
}

.editor-section {
  padding: 24rpx 32rpx;

  .content-textarea {
    width: 100%;
    min-height: 600rpx;
    font-size: 30rpx;
    color: #1e293b;
    line-height: 1.8;
  }
}

.content-placeholder { color: #cbd5e1; }

.word-count-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 32rpx 24rpx;

  .word-count { font-size: 24rpx; color: #94a3b8; }
  .word-hint { font-size: 22rpx; color: #f59e0b; }
}

.ai-tools {
  margin: 0 32rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(124, 106, 247, 0.06) 0%, rgba(167, 139, 250, 0.06) 100%);
  border-radius: 20rpx;
  border: 1rpx solid rgba(124, 106, 247, 0.15);

  .ai-tools-title {
    font-size: 26rpx;
    font-weight: 600;
    color: #7c6af7;
    display: block;
    margin-bottom: 20rpx;
  }

  .ai-actions {
    display: flex;
    gap: 16rpx;

    .ai-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8rpx;
      padding: 16rpx 0;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 16rpx;

      .ai-btn-icon { font-size: 32rpx; }
      .ai-btn-label { font-size: 20rpx; color: #475569; }
    }
  }
}

.picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.picker-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 0 calc(20rpx + env(safe-area-inset-bottom));
  max-height: 70vh;
  display: flex;
  flex-direction: column;

  .picker-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
    display: block;
    padding: 0 40rpx 24rpx;
    border-bottom: 1rpx solid #f0f2f5;
  }

  .picker-scroll {
    flex: 1;
    padding: 16rpx 0;
  }

  .picker-story-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 40rpx;

    .picker-cover {
      width: 100rpx;
      height: 75rpx;
      border-radius: 12rpx;
      flex-shrink: 0;
    }

    .picker-info {
      flex: 1;

      .picker-title-text {
        font-size: 28rpx;
        font-weight: 600;
        color: #1e293b;
        display: block;
      }

      .picker-meta {
        font-size: 24rpx;
        color: #94a3b8;
        margin-top: 6rpx;
        display: block;
      }
    }
  }

  .picker-empty {
    text-align: center;
    padding: 60rpx 40rpx;
    font-size: 26rpx;
    color: #94a3b8;
  }

  .btn-create-story {
    margin: 16rpx 40rpx 0;
    background: #7c6af7;
    color: #ffffff;
    border-radius: 16rpx;
    font-size: 28rpx;
    font-weight: 600;
    border: none;
    height: 88rpx;
  }
}
</style>