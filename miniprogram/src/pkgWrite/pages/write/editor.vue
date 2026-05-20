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

        <!-- 立项书 Tab -->
        <view class="outline-tab-section">
          <view class="outline-tab-header" @tap="toggleBriefPanel">
            <text class="outline-tab-icon">📋</text>
            <text class="outline-tab-title">立项书</text>
            <view v-if="isStoryAuthor" class="brief-edit-btn" @tap.stop="toggleBriefEdit">
              {{ isEditingBrief ? '✓ 保存' : '✏️ 编辑' }}
            </view>
            <view v-if="isStoryAuthor && isEditingBrief" class="brief-edit-btn brief-cancel-btn" @tap.stop="cancelBriefEdit">
              ✗ 取消
            </view>
            <!-- 未登录或无权限提示 -->
            <view v-if="briefData && !isStoryAuthor && userStore.isLoggedIn" class="brief-no-permission">只读</view>
            <view v-if="briefData && !userStore.isLoggedIn" class="brief-no-permission">登录编辑</view>
            <text class="outline-tab-arrow" :class="{ 'rotate': showBriefPanel }">›</text>
          </view>
          <view v-if="showBriefPanel" class="outline-panel">
            <view v-if="briefLoading" class="outline-loading">加载中...</view>
            <view v-else-if="briefError" class="outline-error">{{ briefError }}</view>
            <view v-else-if="briefData" class="outline-content">
              <!-- 查看模式 -->
              <template v-if="!isEditingBrief">
                <view v-if="briefData.title" class="outline-section">
                  <text class="outline-section-title">📖 故事标题</text>
                  <text class="outline-section-text">{{ briefData.title }}</text>
                </view>
                <view v-if="briefData.synopsis" class="outline-section">
                  <text class="outline-section-title">📝 故事梗概</text>
                  <text class="outline-section-text">{{ briefData.synopsis }}</text>
                </view>
                <view v-if="briefData.coreIdea" class="outline-section">
                  <text class="outline-section-title">💡 核心创意</text>
                  <text class="outline-section-text">{{ briefData.coreIdea }}</text>
                </view>
                <view v-if="briefData.targetAudience" class="outline-section">
                  <text class="outline-section-title">🎯 目标读者</text>
                  <text class="outline-section-text">{{ briefData.targetAudience }}</text>
                </view>
                <view v-if="briefData.genre" class="outline-section">
                  <text class="outline-section-title">🏷️ 类型标签</text>
                  <text class="outline-section-text">{{ briefData.genre }}</text>
                </view>
                <view v-if="briefData.writingStyle" class="outline-section">
                  <text class="outline-section-title">✍️ 期望文风</text>
                  <text class="outline-section-text">{{ briefData.writingStyle }}</text>
                </view>
                <view v-if="briefData.highlights && briefData.highlights.length > 0" class="outline-section">
                  <text class="outline-section-title">✨ 作品亮点</text>
                  <view v-for="(h, idx) in briefData.highlights" :key="idx" class="outline-character">
                    <text class="outline-character-desc">{{ h }}</text>
                  </view>
                </view>
              </template>
              <!-- 编辑模式 -->
              <template v-else>
                <view class="outline-section">
                  <text class="outline-section-title">📖 故事标题</text>
                  <input class="brief-edit-input" v-model="briefEditData.title" placeholder="输入故事标题" />
                </view>
                <view class="outline-section">
                  <text class="outline-section-title">📝 故事梗概</text>
                  <textarea class="brief-edit-textarea" v-model="briefEditData.synopsis" placeholder="输入故事梗概" :auto-height="true" />
                </view>
                <view class="outline-section">
                  <text class="outline-section-title">💡 核心创意</text>
                  <textarea class="brief-edit-textarea" v-model="briefEditData.coreIdea" placeholder="输入核心创意" :auto-height="true" />
                </view>
                <view class="outline-section">
                  <text class="outline-section-title">🎯 目标读者</text>
                  <input class="brief-edit-input" v-model="briefEditData.targetAudience" placeholder="目标读者（可选）" />
                </view>
                <view class="outline-section">
                  <text class="outline-section-title">🏷️ 类型标签</text>
                  <input class="brief-edit-input" v-model="briefEditData.genre" placeholder="类型标签（可选）" />
                </view>
                <view class="outline-section">
                  <text class="outline-section-title">✍️ 期望文风</text>
                  <input class="brief-edit-input" v-model="briefEditData.writingStyle" placeholder="期望文风（可选）" />
                </view>
                <view class="brief-edit-hint">
                  <text class="brief-edit-hint-text">点击右上角 "✓ 保存" 提交修改</text>
                </view>
              </template>
            </view>
            <view v-else class="outline-empty">
              <text class="outline-empty-icon">📋</text>
              <text class="outline-empty-text">暂无立项书</text>
              <text v-if="aiCreationMethod" class="outline-empty-hint">AI 辅助创作可自动生成立项书</text>
            </view>
          </view>
        </view>

        <!-- 大纲 Tab -->
        <view class="outline-tab-section">
          <view class="outline-tab-header" @tap="toggleOutlinePanel">
            <text class="outline-tab-icon">📝</text>
            <text class="outline-tab-title">故事大纲</text>
            <view v-if="outlineData && (isStoryAuthor || isCollaborator)" class="outline-action-btn" @tap.stop="toggleOutlineEdit">
              {{ isEditingOutline ? '✓ 保存' : '✏️ 编辑' }}
            </view>
            <view v-if="outlineData && isEditingOutline && (isStoryAuthor || isCollaborator)" class="outline-action-btn outline-cancel-btn" @tap.stop="cancelOutlineEdit">
              ✗ 取消
            </view>
            <view v-if="outlineData && !isEditingOutline && (isStoryAuthor || isCollaborator)" class="outline-action-btn outline-new-version-btn" @tap.stop="createNewOutlineVersion">
              + 新版本
            </view>
            <!-- 未登录或无权限提示 -->
            <view v-if="outlineData && !(isStoryAuthor || isCollaborator) && userStore.isLoggedIn" class="outline-no-permission">只读</view>
            <view v-if="outlineData && !userStore.isLoggedIn" class="outline-no-permission">登录编辑</view>
            <text class="outline-tab-arrow" :class="{ 'rotate': showOutlinePanel }">›</text>
          </view>
          <view v-if="showOutlinePanel" class="outline-panel">
            <view v-if="outlineLoading" class="outline-loading">加载中...</view>
            <view v-else-if="outlineError" class="outline-error">{{ outlineError }}</view>
            <view v-else-if="outlineData" class="outline-content">
              <!-- 版本选择器 -->
              <view v-if="outlineVersions.length > 1 && !isEditingOutline" class="outline-version-selector">
                <picker :range="outlineVersionLabels" @change="onOutlineVersionChange">
                  <view class="outline-version-picker">
                    <text class="outline-version-text">v{{ outlineData.version || 1 }} (当前)</text>
                    <text class="outline-version-arrow">▼</text>
                  </view>
                </picker>
              </view>
              <!-- 新版本编辑提示 -->
              <view v-if="isNewOutlineVersion" class="outline-new-version-hint">
                <text class="outline-new-version-hint-text">📝 编辑内容后点击"✓ 保存"保存为新版本（{{ newOutlineChangeNote }}）</text>
              </view>
              <!-- 世界观 -->
              <view v-if="outlineData.worldBuilding" class="outline-section">
                <text class="outline-section-title">🌍 世界观</text>
                <text v-if="!isEditingOutline" class="outline-section-text">{{ outlineData.worldBuilding }}</text>
                <textarea v-else class="outline-edit-textarea" v-model="outlineData.worldBuilding" placeholder="世界观设定" auto-height :maxlength="3000" />
              </view>
              <!-- 角色设定 -->
              <view v-if="outlineData.characters && outlineData.characters.length > 0" class="outline-section">
                <text class="outline-section-title">👥 角色</text>
                <view v-for="(char, ci) in outlineData.characters" :key="char.name + ci" class="outline-character">
                  <template v-if="!isEditingOutline">
                    <text class="outline-character-name">{{ char.name }}</text>
                    <text class="outline-character-role">{{ getRoleText(char.role) }}</text>
                    <text class="outline-character-desc">{{ char.description }}</text>
                  </template>
                  <template v-else>
                    <view class="outline-character-edit-header">
                      <input class="outline-edit-input outline-char-name" :value="char.name" placeholder="角色名" @input="onEditCharName($event, ci)" />
                      <picker :range="roleOptions" :range-key="'label'" :value="getRoleIndex(char.role)" @change="onEditCharRole($event, ci)">
                        <view class="outline-role-picker">{{ getRoleText(char.role) }} ▼</view>
                      </picker>
                    </view>
                    <textarea class="outline-edit-textarea" :value="char.description" placeholder="角色描述" auto-height :maxlength="500" @input="onEditCharDesc($event, ci)" />
                  </template>
                </view>
              </view>
              <!-- 三幕结构 -->
              <view v-if="outlineData.plotStructure" class="outline-section">
                <text class="outline-section-title">📖 故事结构</text>
                <view class="outline-act">
                  <text class="outline-act-title">第一幕</text>
                  <text v-if="!isEditingOutline" class="outline-act-text">{{ outlineData.plotStructure.act1 }}</text>
                  <textarea v-else class="outline-edit-textarea" v-model="outlineData.plotStructure.act1" placeholder="第一幕内容" auto-height :maxlength="1000" />
                </view>
                <view class="outline-act">
                  <text class="outline-act-title">第二幕</text>
                  <text v-if="!isEditingOutline" class="outline-act-text">{{ outlineData.plotStructure.act2 }}</text>
                  <textarea v-else class="outline-edit-textarea" v-model="outlineData.plotStructure.act2" placeholder="第二幕内容" auto-height :maxlength="1000" />
                </view>
                <view class="outline-act">
                  <text class="outline-act-title">第三幕</text>
                  <text v-if="!isEditingOutline" class="outline-act-text">{{ outlineData.plotStructure.act3 }}</text>
                  <textarea v-else class="outline-edit-textarea" v-model="outlineData.plotStructure.act3" placeholder="第三幕内容" auto-height :maxlength="1000" />
                </view>
              </view>
              <!-- 分章大纲 -->
              <view v-if="outlineData.chapterOutlines && outlineData.chapterOutlines.length > 0" class="outline-section">
                <text class="outline-section-title">📑 分章大纲</text>
                <view v-for="(chapter, ci) in outlineData.chapterOutlines" :key="chapter.chapter" class="outline-chapter">
                  <template v-if="!isEditingOutline">
                    <text class="outline-chapter-title">{{ chapter.title || '第' + chapter.chapter + '章' }}</text>
                    <text class="outline-chapter-summary">{{ chapter.summary }}</text>
                  </template>
                  <template v-else>
                    <input class="outline-edit-input" :value="chapter.title" placeholder="章节标题"
                      @input="onEditChapterTitle($event, ci)" />
                    <textarea class="outline-edit-textarea" :value="chapter.summary" placeholder="章节摘要" auto-height
                      @input="onEditChapterSummary($event, ci)" />
                  </template>
                </view>
              </view>
            </view>
            <view v-else class="outline-empty">
              <text class="outline-empty-icon">📝</text>
              <text class="outline-empty-text">暂无大纲</text>
              <text v-if="aiCreationMethod" class="outline-empty-hint">AI 创作的故事自动生成大纲</text>
              <view v-if="isStoryAuthor || isCollaborator" class="outline-empty-create" @tap="createNewOutlineVersion">
                <text class="outline-empty-create-text">+ 创建大纲</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- AI 面板 - 使用 v-if 配合懒加载，只在需要时加载组件 -->
    <ai-panel
      v-if="showAiPanel"
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
import type { Node } from '@/api/nodes'

import AiPanel from '@/components/ai-panel/index.vue'

const userStore = useUserStore()

const statusBarHeight = ref(20)
const menuButtonInfo = ref({ width: 0, right: 0 })  // 胶囊按钮信息

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

// ─── 大纲面板 ──────────────────────────────────────────────────────────────────
const showOutlinePanel = ref(false)
const outlineLoading = ref(false)
const outlineError = ref('')
const outlineData = ref<any>(null)
const aiCreationMethod = ref<string | null>(null)
const outlineVersions = ref<Array<{ version: number; isActive: boolean; changeNote: string; createdAt: string }>>([])
const outlineVersionLabels = computed(() =>
  outlineVersions.value.map(v => {
    const date = new Date(v.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    return `v${v.version}${v.isActive ? ' (当前)' : ''} - ${v.changeNote || date}`
  })
)
const isEditingOutline = ref(false)
const isNewOutlineVersion = ref(false)  // 是否在新建大纲版本模式
const newOutlineChangeNote = ref('')    // 新建大纲版本的版本说明
const outlineBackup = ref<any>(null)   // 编辑前的大纲数据备份

// 本地用户信息副本（用于权限检查）
let localUserId: number | null = null

// ─── 立项书面板 ────────────────────────────────────────────────────────────────
const showBriefPanel = ref(false)
const briefLoading = ref(false)
const briefError = ref('')
const briefData = ref<any>(null)
const isEditingBrief = ref(false)
const isStoryAuthor = ref(false)
const isCollaborator = ref(false)
const briefEditData = reactive({
  title: '',
  synopsis: '',
  coreIdea: '',
  targetAudience: '',
  genre: '',
  writingStyle: '',
})

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

    // 获取胶囊按钮位置信息，用于避免重叠
    const menuButton = uni.getMenuButtonBoundingClientRect()
    if (menuButton) {
      menuButtonInfo.value = {
        width: menuButton.width,
        right: sysInfo.windowWidth - menuButton.right
      }
      console.log('[onMounted] 胶囊按钮信息:', menuButtonInfo.value)
    }
  } catch {
    statusBarHeight.value = 20
  }
})

onLoad(async (options: any) => {
  if (!options) return

  // 兼容旧参数：id 曾被误用为 storyId（create-ai.vue）
  if (options.id && !options.nodeId && !options.storyId && !options.draftNodeId) {
    options.storyId = options.id
  }

  // 编辑已发布章节
  if (options.nodeId) {
    nodeId.value = Number(options.nodeId)
    isEditing.value = true
    // 先确保用户信息已加载
    await ensureUserInfo()
    await loadNodeForEdit(nodeId.value)
    return
  }

  // 续写/新建模式
  if (options.storyId) storyId.value = Number(options.storyId)
  if (options.parentId) parentId.value = Number(options.parentId)
  if (options.storyTitle) storyTitle.value = decodeURIComponent(options.storyTitle)
  if (options.prefillContent) form.content = decodeURIComponent(options.prefillContent)
  if (options.prefillTitle) form.title = decodeURIComponent(options.prefillTitle)

  // 提前判断故事作者权限（不等展开大纲/立项书面板）
  await ensureUserInfo()
  if (storyId.value && localUserId) {
    checkStoryAuthorship(storyId.value)
  } else if (storyId.value && userStore.isLoggedIn) {
    // 如果本地变量仍是 null，直接从 API 获取用户信息
    try {
      const meRes = await http.get('/api/users/me')
      if (meRes.user) {
        userStore.setUserInfo(meRes.user)
        localUserId = meRes.user.id
        await checkStoryAuthorship(storyId.value)
      }
    } catch (e) {
      console.log('[onLoad] 从 API 获取用户信息失败', e)
    }
  }

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
    // 编辑模式下也需判断作者权限
    if (storyId.value && userStore.isLoggedIn) {
      checkStoryAuthorship(storyId.value)
    }
    if (userStore.isLoggedIn) loadAiQuota()
  } catch {
    uni.showToast({ title: '加载章节失败', icon: 'none' })
  }
}

// 确保用户信息已加载
async function ensureUserInfo(): Promise<void> {
  console.log('[ensureUserInfo] 开始，isLoggedIn:', userStore.isLoggedIn, 'user:', userStore.user)
  if (userStore.isLoggedIn && !userStore.user) {
    // 直接从存储中读取用户信息
    const storedUser = uni.getStorageSync('st_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed && parsed.id) {
          userStore.setUserInfo(parsed)
          localUserId = parsed.id
          console.log('[ensureUserInfo] 从存储恢复成功:', parsed.id)
        }
      } catch (e) {
        console.log('[ensureUserInfo] 解析失败', e)
      }
    }
  } else if (userStore.user) {
    localUserId = userStore.user.id
  }
  // 如果仍然没有用户信息，调用 checkLoginStatus
  if (!localUserId && userStore.isLoggedIn) {
    userStore.checkLoginStatus()
    await new Promise(resolve => setTimeout(resolve, 100))
    if (userStore.user) {
      localUserId = userStore.user.id
    }
  }
  console.log('[ensureUserInfo] 结束，localUserId:', localUserId)
}

// 提前判断故事作者权限
async function checkStoryAuthorship(sid: number) {
  // 调试：打印用户登录状态
  console.log('[权限检查] 开始检查权限', {
    isLoggedIn: userStore.isLoggedIn,
    hasUser: !!userStore.user,
    userId: userStore.user?.id,
    localUserId: localUserId
  })

  // 优先使用本地变量 localUserId
  const currentUserId = localUserId || userStore.user?.id

  // 如果用户仍未登录，不检查权限
  if (!currentUserId) {
    console.log('[权限检查] 用户未登录，跳过权限检查')
    return
  }
  try {
    const storyRes = await http.get(`/api/stories/${sid}`)
    if (storyRes.story) {
      console.log('[权限检查] 故事作者ID:', storyRes.story.author_id, '当前用户ID:', currentUserId)
      // 检查是否是作者
      if (storyRes.story.author_id === currentUserId) {
        isStoryAuthor.value = true
        console.log('[权限检查] 用户是故事作者')
      }
      // 检查是否是协作者
      if (!isStoryAuthor.value) {
        try {
          const roleRes = await http.get(`/api/stories/${sid}/role`)
          if (roleRes.is_collaborator) {
            isCollaborator.value = true
            console.log('[权限检查] 用户是协作者')
          }
        } catch (e) {
          console.log('[权限检查] 获取协作者角色失败', e)
        }
      }
    }
  } catch (e) {
    console.log('[权限检查] 获取故事信息失败', e)
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
    uni.navigateTo({ url: `/pkgStory/pages/chapter/index?id=${parentId.value}` })
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

// ─── 大纲面板相关 ──────────────────────────────────────────────────────────────

function toggleBriefPanel() {
  showBriefPanel.value = !showBriefPanel.value
  if (showBriefPanel.value && !briefData.value && !briefLoading.value) {
    loadBrief()
  }
}

async function loadBrief() {
  if (!storyId.value) return

  // 确保用户信息已加载
  if (userStore.isLoggedIn && !userStore.user) {
    userStore.checkLoginStatus()
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  briefLoading.value = true
  briefError.value = ''

  try {
    // 如果还没判断过作者权限，先获取故事信息
    if (!isStoryAuthor.value && userStore.user) {
      try {
        const storyRes = await http.get(`/api/stories/${storyId.value}`)
        if (storyRes.story && storyRes.story.author_id === userStore.user.id) {
          isStoryAuthor.value = true
          console.log('[立项书] 用户是故事作者')
        }
      } catch (e) {
        console.log('[立项书] 获取故事信息失败', e)
      }
    }

    const res = await http.get(`/api/ai/creation/stories/${storyId.value}/project-brief`)
    if (res.projectBrief) {
      briefData.value = res.projectBrief
    } else {
      briefData.value = null
    }
  } catch (err: any) {
    if (err.statusCode === 404) {
      briefData.value = null
    } else {
      briefError.value = '加载立项书失败'
    }
  } finally {
    briefLoading.value = false
  }
}

function toggleBriefEdit() {
  if (!isStoryAuthor.value) {
    uni.showToast({ title: '只有作者可以编辑立项书', icon: 'none' })
    return
  }

  if (!isEditingBrief.value) {
    // 进入编辑模式，复制当前数据到编辑表单
    briefEditData.title = briefData.value?.title || ''
    briefEditData.synopsis = briefData.value?.synopsis || ''
    briefEditData.coreIdea = briefData.value?.coreIdea || ''
    briefEditData.targetAudience = briefData.value?.targetAudience || ''
    briefEditData.genre = briefData.value?.genre || ''
    briefEditData.writingStyle = briefData.value?.writingStyle || ''
    isEditingBrief.value = true
  } else {
    // 保存并退出编辑模式
    saveBrief()
  }
}

// 取消立项书编辑
function cancelBriefEdit() {
  isEditingBrief.value = false
}

async function saveBrief() {
  if (!storyId.value) return

  uni.showLoading({ title: '保存中...' })
  try {
    await http.put(`/api/ai/creation/stories/${storyId.value}/project-brief`, {
      projectBrief: {
        title: briefEditData.title,
        synopsis: briefEditData.synopsis,
        coreIdea: briefEditData.coreIdea,
        targetAudience: briefEditData.targetAudience,
        genre: briefEditData.genre,
        writingStyle: briefEditData.writingStyle,
      }
    })
    isEditingBrief.value = false
    // 重新加载立项书
    await loadBrief()
    uni.showToast({ title: '立项书已保存', icon: 'success' })
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

function toggleOutlinePanel() {
  showOutlinePanel.value = !showOutlinePanel.value
  if (showOutlinePanel.value && !outlineData.value && !outlineLoading.value) {
    loadOutline()
  }
}

async function loadOutline() {
  if (!storyId.value) return

  // 确保用户信息已加载
  if (userStore.isLoggedIn && !userStore.user) {
    userStore.checkLoginStatus()
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  outlineLoading.value = true
  outlineError.value = ''

  try {
    // 先加载故事信息，检查是否是 AI 创作的，同时判断当前用户是否是作者
    const storyRes = await http.get(`/api/stories/${storyId.value}`)
    if (storyRes.story) {
      aiCreationMethod.value = storyRes.story.ai_assisted_created
        ? storyRes.story.ai_creation_method
        : null
      // 判断当前用户是否是故事作者或协作者
      if (userStore.user && storyRes.story.author_id === userStore.user.id) {
        isStoryAuthor.value = true
        console.log('[大纲] 用户是故事作者')
      }
      // 检查是否是协作者
      if (userStore.user && !isStoryAuthor.value) {
        try {
          const roleRes = await http.get(`/api/stories/${storyId.value}/role`)
          if (roleRes.is_collaborator) {
            isCollaborator.value = true
            console.log('[大纲] 用户是协作者')
          }
        } catch (e) {
          console.log('[大纲] 获取协作者角色失败', e)
        }
      }
    }

    // 并行加载大纲和版本列表
    const [outlineRes, versionsRes] = await Promise.allSettled([
      http.get(`/api/ai/creation/stories/${storyId.value}/outlines/active`),
      http.get(`/api/ai/creation/stories/${storyId.value}/outlines`)
    ])

    // 处理大纲
    if (outlineRes.status === 'fulfilled' && outlineRes.value?.outline) {
      const raw = outlineRes.value.outline
      outlineData.value = typeof raw === 'string' ? JSON.parse(raw) : raw
    } else {
      outlineData.value = null
    }

    // 处理版本列表
    if (versionsRes.status === 'fulfilled' && versionsRes.value?.outlines) {
      outlineVersions.value = versionsRes.value.outlines.map((v: any) => ({
        version: v.version,
        isActive: v.isActive || v.is_active || false,
        changeNote: v.changeNote || v.change_note || '',
        createdAt: v.createdAt || v.created_at || ''
      }))
    } else {
      outlineVersions.value = []
    }
  } catch (err: any) {
    if (err.statusCode === 404) {
      outlineData.value = null
    } else {
      outlineError.value = '加载大纲失败'
    }
  } finally {
    outlineLoading.value = false
  }
}

// 切换大纲版本
async function onOutlineVersionChange(e: any) {
  const index = e.detail.value
  const version = outlineVersions.value[index]
  if (!version || !storyId.value) return

  // 编辑模式下不允许切换版本
  if (isEditingOutline.value) {
    uni.showToast({ title: '请先保存或取消编辑后再切换版本', icon: 'none' })
    return
  }

  // 如果选的就是当前版本，不操作
  if (version.isActive) return

  uni.showLoading({ title: '切换版本...' })
  try {
    // 调用后端激活该版本
    await http.post(`/api/ai/creation/stories/${storyId.value}/outlines/${version.version}/activate`)
    // 重新加载大纲
    await loadOutline()
    uni.showToast({ title: '已切换到 v' + version.version, icon: 'success' })
  } catch {
    uni.showToast({ title: '切换版本失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

function getRoleText(role: string): string {
  const roleMap: Record<string, string> = {
    protagonist: '主角',
    antagonist: '反派',
    supporting: '配角',
    love_interest: '感情线',
  }
  return roleMap[role] || role
}

const roleOptions = [
  { value: 'protagonist', label: '主角' },
  { value: 'antagonist', label: '反派' },
  { value: 'supporting', label: '配角' },
  { value: 'love_interest', label: '感情线' },
]

function getRoleIndex(role: string): number {
  return roleOptions.findIndex(r => r.value === role)
}

// 编辑角色名
function onEditCharName(e: any, index: number) {
  if (outlineData.value?.characters) {
    outlineData.value.characters[index].name = e.detail.value
  }
}

// 编辑角色类型
function onEditCharRole(e: any, index: number) {
  if (outlineData.value?.characters) {
    outlineData.value.characters[index].role = roleOptions[e.detail.value]?.value || outlineData.value.characters[index].role
  }
}

// 编辑角色描述
function onEditCharDesc(e: any, index: number) {
  if (outlineData.value?.characters) {
    outlineData.value.characters[index].description = e.detail.value
  }
}

// 切换大纲编辑模式
async function toggleOutlineEdit() {
  if (isEditingOutline.value) {
    // 保存编辑
    isEditingOutline.value = false
    outlineBackup.value = null  // 清除备份
    await saveOutlineEdit()
  } else {
    // 进入编辑模式——备份原始数据
    outlineBackup.value = JSON.parse(JSON.stringify(outlineData.value))
    isNewOutlineVersion.value = false
    newOutlineChangeNote.value = ''
    isEditingOutline.value = true
  }
}

// 取消大纲编辑（恢复备份）
function cancelOutlineEdit() {
  if (outlineBackup.value) {
    outlineData.value = outlineBackup.value
    outlineBackup.value = null
  }
  isEditingOutline.value = false
  isNewOutlineVersion.value = false
  newOutlineChangeNote.value = ''
}

// 编辑章节标题
function onEditChapterTitle(e: any, index: number) {
  if (outlineData.value?.chapterOutlines) {
    outlineData.value.chapterOutlines[index].title = e.detail.value
  }
}

// 编辑章节摘要
function onEditChapterSummary(e: any, index: number) {
  if (outlineData.value?.chapterOutlines) {
    outlineData.value.chapterOutlines[index].summary = e.detail.value
  }
}

// 保存大纲编辑
async function saveOutlineEdit() {
  if (!storyId.value || !outlineData.value) return

  const wasNewVersion = isNewOutlineVersion.value
  const savedChangeNote = newOutlineChangeNote.value
  // 重置新建版本状态
  isNewOutlineVersion.value = false
  newOutlineChangeNote.value = ''

  const version = outlineData.value.version || currentOutlineVersion.value || 1

  try {
    if (wasNewVersion) {
      // 新建版本模式：POST 创建新版本
      const result: any = await http.post(`/api/ai/creation/stories/${storyId.value}/outlines`, {
        outline: outlineData.value,
        changeNote: savedChangeNote || '手动创建新版本'
      })
      uni.showToast({ title: '新版本 v' + (result.version || '?') + ' 已创建', icon: 'success' })
      // 重新加载大纲
      await loadOutline()
    } else {
      // 编辑当前版本模式：PUT 更新当前版本
      await http.put(`/api/ai/creation/stories/${storyId.value}/outlines/${version}`, {
        outline: outlineData.value,
        changeNote: '手动编辑'
      })
      uni.showToast({ title: '大纲已保存', icon: 'success' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '保存失败', icon: 'none' })
    // 保存失败时恢复新建版本状态和原始数据
    if (wasNewVersion) {
      isNewOutlineVersion.value = true
      newOutlineChangeNote.value = savedChangeNote
    }
    // 恢复编辑前的原始数据
    if (outlineBackup.value) {
      outlineData.value = outlineBackup.value
    }
    isEditingOutline.value = false
    isNewOutlineVersion.value = false
    newOutlineChangeNote.value = ''
    outlineBackup.value = null
  }
}

// 当前激活大纲版本号（computed）
const currentOutlineVersion = computed(() => {
  const active = outlineVersions.value.find(v => v.isActive)
  return active?.version || 1
})

// 创建新的大纲版本（或初始大纲）
async function createNewOutlineVersion() {
  if (!storyId.value) return

  // 如果没有大纲数据，创建一个空白模板
  if (!outlineData.value) {
    outlineData.value = {
      worldBuilding: '',
      characters: [],
      plotStructure: { act1: '', act2: '', act3: '' },
      chapterOutlines: []
    }
  }

  uni.showModal({
    title: isNewOutlineVersion.value ? '新建大纲版本' : (outlineVersions.value.length === 0 ? '创建大纲' : '新建大纲版本'),
    editable: true,
    placeholderText: '请输入版本说明（可选）',
    success: async (res) => {
      if (!res.confirm) {
        // 如果是首次创建且取消了，恢复空状态
        if (outlineVersions.value.length === 0 && outlineData.value && !outlineData.value.worldBuilding && (!outlineData.value.chapterOutlines || outlineData.value.chapterOutlines.length === 0)) {
          outlineData.value = null
        }
        return
      }

      const changeNote = res.content || (outlineVersions.value.length === 0 ? '初始大纲' : '手动创建新版本')
      // 记录新建版本信息，进入编辑模式（与 Web 端一致）
      isNewOutlineVersion.value = true
      newOutlineChangeNote.value = changeNote
      // 备份原始数据，以便取消时恢复
      outlineBackup.value = JSON.parse(JSON.stringify(outlineData.value))
      isEditingOutline.value = true
    }
  })
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
  padding: calc(var(--status-bar-height, 20px) + 10px) 24rpx 16rpx 100rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f2f5;
  position: sticky;
  top: 0;
  z-index: 10;
  box-sizing: border-box;

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
    gap: 12rpx;
    padding-right: 100rpx;  // 避免与微信原生导航按钮重叠（三个点按钮区域）
    box-sizing: border-box;
    max-width: 50%;  // 限制最大宽度，防止挤占右侧空间

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

// 立项书 Tab（复用 outline-tab-section 样式）
.brief-edit-btn {
  font-size: 22rpx;
  color: #7c6af7;
  padding: 4rpx 12rpx;
  border: 1rpx solid #7c6af7;
  border-radius: 8rpx;
  margin-right: 12rpx;
}

.brief-cancel-btn {
  color: #94a3b8;
  border-color: #94a3b8;
}

.brief-no-permission {
  font-size: 20rpx;
  color: #94a3b8;
  padding: 8rpx 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  margin-right: 12rpx;
  background: #f8fafc;
  line-height: 1.2;
}

.outline-no-permission {
  font-size: 20rpx;
  color: #94a3b8;
  padding: 8rpx 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  margin-right: 12rpx;
  background: #f8fafc;
  line-height: 1.2;
}

.brief-edit-input {
  width: 100%;
  padding: 12rpx 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #1e293b;
  background: #f8fafc;
  box-sizing: border-box;
}

.brief-edit-textarea {
  width: 100%;
  padding: 12rpx 16rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #1e293b;
  line-height: 1.6;
  background: #f8fafc;
  min-height: 120rpx;
  box-sizing: border-box;
}

.brief-edit-hint {
  margin-top: 16rpx;
  padding: 12rpx 16rpx;
  background: rgba(124, 106, 247, 0.05);
  border-radius: 8rpx;

  .brief-edit-hint-text {
    font-size: 22rpx;
    color: #7c6af7;
  }
}

// 大纲 Tab
.outline-tab-section {
  margin: 0 24rpx 24rpx;
  background: #ffffff;
  border-radius: 16rpx;
  border: 1rpx solid #e2e8f0;
  overflow: hidden;

  .outline-tab-header {
    display: flex;
    align-items: center;
    padding: 20rpx 24rpx;
    background: #f8fafc;
    border-bottom: 1rpx solid #e2e8f0;

    .outline-tab-icon {
      font-size: 32rpx;
      margin-right: 12rpx;
    }

    .outline-tab-title {
      flex: 1;
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
    }

    .outline-tab-arrow {
      font-size: 32rpx;
      color: #94a3b8;
      transition: transform 0.3s ease;

      &.rotate {
        transform: rotate(90deg);
      }
    }
  }

  .outline-panel {
    max-height: 600rpx;
    overflow-y: auto;
    background: #ffffff;
  }

  .outline-loading,
  .outline-error,
  .outline-empty {
    padding: 40rpx 24rpx;
    text-align: center;
  }

  .outline-loading {
    font-size: 26rpx;
    color: #94a3b8;
  }

  .outline-error {
    font-size: 26rpx;
    color: #ef4444;
  }

  .outline-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;

    .outline-empty-icon {
      font-size: 64rpx;
      opacity: 0.5;
    }

    .outline-empty-text {
      font-size: 26rpx;
      color: #64748b;
    }

    .outline-empty-hint {
      font-size: 22rpx;
      color: #94a3b8;
    }

    .outline-empty-create {
      margin-top: 12rpx;
      padding: 12rpx 32rpx;
      background: rgba(124, 106, 247, 0.08);
      border: 1rpx solid rgba(124, 106, 247, 0.3);
      border-radius: 12rpx;
    }

    .outline-empty-create-text {
      font-size: 26rpx;
      color: #7c6af7;
      font-weight: 500;
    }
  }

  .outline-content {
    padding: 24rpx;
  }

  .outline-version-selector {
    margin-bottom: 20rpx;
    padding-bottom: 20rpx;
    border-bottom: 1rpx solid #f0f2f5;
  }

  .outline-version-picker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12rpx 20rpx;
    background: #f8fafc;
    border-radius: 12rpx;
    border: 1rpx solid #e2e8f0;
  }

  .outline-version-text {
    font-size: 24rpx;
    color: #7c6af7;
    font-weight: 500;
  }

  .outline-version-arrow {
    font-size: 20rpx;
    color: #94a3b8;
    margin-left: 8rpx;
  }

  .outline-action-btn {
    font-size: 22rpx;
    color: #7c6af7;
    padding: 4rpx 12rpx;
    border: 1rpx solid #7c6af7;
    border-radius: 8rpx;
    margin-left: 8rpx;
  }

  .outline-new-version-btn {
    color: #10b981;
    border-color: #10b981;
  }

  .outline-cancel-btn {
    color: #94a3b8;
    border-color: #94a3b8;
  }

  .outline-new-version-hint {
    margin-bottom: 20rpx;
    padding: 16rpx 20rpx;
    background: rgba(124, 106, 247, 0.05);
    border-radius: 10rpx;
    border: 1rpx dashed rgba(124, 106, 247, 0.3);
  }

  .outline-new-version-hint-text {
    font-size: 24rpx;
    color: #7c6af7;
    line-height: 1.6;
  }

  .outline-character-edit-header {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 8rpx;
  }

  .outline-char-name {
    flex: 2;
  }

  .outline-role-picker {
    padding: 8rpx 16rpx;
    background: #f0f2f5;
    border-radius: 8rpx;
    font-size: 22rpx;
    color: #7c6af7;
    flex-shrink: 0;
  }

  .outline-edit-input {
    width: 100%;
    padding: 12rpx 16rpx;
    border: 1rpx solid #e2e8f0;
    border-radius: 8rpx;
    font-size: 26rpx;
    color: #1e293b;
    background: #f8fafc;
    box-sizing: border-box;
    margin-bottom: 8rpx;
  }

  .outline-edit-textarea {
    width: 100%;
    padding: 12rpx 16rpx;
    border: 1rpx solid #e2e8f0;
    border-radius: 8rpx;
    font-size: 26rpx;
    color: #1e293b;
    line-height: 1.6;
    background: #f8fafc;
    min-height: 80rpx;
    box-sizing: border-box;
  }

  .outline-section {
    margin-bottom: 24rpx;
    padding-bottom: 24rpx;
    border-bottom: 1rpx solid #f0f2f5;

    &:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .outline-section-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
      display: block;
      margin-bottom: 16rpx;
    }

    .outline-section-text {
      font-size: 26rpx;
      color: #64748b;
      line-height: 1.7;
      display: block;
    }
  }

  .outline-character {
    display: block;
    padding: 16rpx;
    margin-bottom: 12rpx;
    background: #f8fafc;
    border-radius: 12rpx;

    .outline-character-name {
      font-size: 26rpx;
      font-weight: 600;
      color: #1e293b;
      display: block;
      margin-bottom: 4rpx;
    }

    .outline-character-role {
      font-size: 22rpx;
      color: #7c6af7;
      display: block;
      margin-bottom: 8rpx;
    }

    .outline-character-desc {
      font-size: 24rpx;
      color: #64748b;
      line-height: 1.6;
      display: block;
    }
  }

  .outline-act {
    display: block;
    padding: 16rpx;
    margin-bottom: 12rpx;
    background: #f8fafc;
    border-left: 4rpx solid #7c6af7;
    border-radius: 8rpx;

    .outline-act-title {
      font-size: 24rpx;
      font-weight: 600;
      color: #7c6af7;
      display: block;
      margin-bottom: 8rpx;
    }

    .outline-act-text {
      font-size: 24rpx;
      color: #64748b;
      line-height: 1.6;
      display: block;
    }
  }

  .outline-chapter {
    display: block;
    padding: 16rpx;
    margin-bottom: 12rpx;
    background: #f8fafc;
    border-radius: 12rpx;

    .outline-chapter-title {
      font-size: 26rpx;
      font-weight: 600;
      color: #1e293b;
      display: block;
      margin-bottom: 8rpx;
    }

    .outline-chapter-summary {
      font-size: 24rpx;
      color: #64748b;
      line-height: 1.6;
      display: block;
    }
  }
}
</style>