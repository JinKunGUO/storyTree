<template>
  <view class="story-page">
    <!-- AI 任务完成横幅 -->
    <view
      v-if="aiTaskBanner.show"
      class="ai-task-banner"
      :class="{ 'banner-enter': aiTaskBanner.show }"
    >
      <text class="banner-icon">🤖</text>
      <text class="banner-text">{{ aiTaskBanner.message }}</text>
      <view class="banner-close" @tap="aiTaskBanner.show = false">
        <text>×</text>
      </view>
    </view>

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
          <view v-if="story.tags && story.tags.trim()" class="tag-list">
            <text
              v-for="tag in story.tags.split(',').map(t => t.trim()).filter(t => t)"
              :key="tag"
              class="tag"
            >
              {{ tag }}
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
        </view>

        <!-- 故事分支树 -->
        <view class="section-card">
          <view v-if="nodesLoading" class="nodes-loading">
            <text>加载故事树...</text>
          </view>
          <chapter-tree
            v-else
            :root-node="treeRoot"
            :is-author-or-collab="story.isAuthor || story.isCollaborator"
            :is-logged-in="userStore.isLoggedIn"
            :highlight-node-id="highlightNodeId"
            @node-tap="goChapter"
            @write-branch="handleWriteBranch"
            @ai-create="handleAiCreate"
          />

          <!-- 未登录提示 -->
          <view v-if="!userStore.isLoggedIn" class="tree-login-tip">
            <text class="tip-text">登录后可从任意节点续写故事</text>
            <text class="tip-link" @tap="goLogin">去登录 →</text>
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

    <!-- AI 创作章节弹窗 -->
    <view v-if="showAiCreatePanel" class="ai-create-mask" @tap.self="showAiCreatePanel = false">
      <view class="ai-create-panel" @tap.stop>
        <!-- 标题栏 -->
        <view class="ai-panel-header">
          <text class="ai-panel-icon">🤖</text>
          <text class="ai-panel-title">AI 创作章节</text>
          <view class="ai-panel-close" @tap="showAiCreatePanel = false">
            <text>×</text>
          </view>
        </view>

        <scroll-view scroll-y class="ai-panel-scroll">
          <!-- 惊喜时间 -->
          <view class="ai-section">
            <view class="ai-section-header">
              <text class="ai-section-icon">🕐</text>
              <text class="ai-section-label">选择惊喜时间</text>
              <text class="ai-section-desc">AI 将在指定时间为你创作新章节</text>
            </view>
            <view class="ai-time-grid">
              <view
                v-for="t in timeOptions"
                :key="t.value"
                class="ai-time-item"
                :class="{ active: aiForm.surpriseTime === t.value }"
                @tap="aiForm.surpriseTime = t.value"
              >
                <text class="time-icon">{{ t.icon }}</text>
                <text class="time-label">{{ t.label }}</text>
              </view>
            </view>
          </view>

          <!-- 续写风格 -->
          <view class="ai-section">
            <view class="ai-section-header">
              <text class="ai-section-icon">🎨</text>
              <text class="ai-section-label">选择续写风格</text>
            </view>
            <view class="ai-style-grid">
              <view
                v-for="s in styleOptions"
                :key="s"
                class="ai-style-item"
                :class="{ active: aiForm.style === s }"
                @tap="aiForm.style = aiForm.style === s ? undefined : s"
              >
                <text>{{ s }}</text>
              </view>
            </view>
          </view>

          <!-- 期望字数 -->
          <view class="ai-section">
            <view class="ai-section-header">
              <text class="ai-section-icon">📝</text>
              <text class="ai-section-label">期望生成字数</text>
              <text class="ai-section-desc">AI 将生成接近此字数的内容</text>
            </view>
            <view class="ai-wordcount-row">
              <view
                v-for="w in wordCountOptions"
                :key="w.value"
                class="ai-wordcount-item"
                :class="{ active: aiForm.wordCount === w.value && !aiForm.customWordCount }"
                @tap="selectWordCount(w.value)"
              >
                <text class="wc-name">{{ w.label }}</text>
                <text class="wc-value">约 {{ w.value }} 字</text>
              </view>
              <view
                class="ai-wordcount-item custom"
                :class="{ active: !!aiForm.customWordCount }"
                @tap="showWordCountInput = true"
              >
                <text class="wc-name">自定义</text>
                <text class="wc-value">{{ aiForm.customWordCount ? aiForm.customWordCount + ' 字' : '输入字数' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- 底部操作按钮 -->
        <view class="ai-panel-footer">
          <button
            class="ai-footer-btn draft-btn"
            :loading="aiSubmitting"
            @tap="submitAiCreate(false)"
          >
            💾 生成后保存为草稿
          </button>
          <button
            class="ai-footer-btn publish-btn"
            :loading="aiSubmitting"
            @tap="submitAiCreate(true)"
          >
            ✏️ 生成并自动发布
          </button>
        </view>
      </view>
    </view>

    <!-- 自定义字数输入弹窗 -->
    <view v-if="showWordCountInput" class="wc-input-mask" @tap.self="showWordCountInput = false">
      <view class="wc-input-panel" @tap.stop>
        <text class="wc-input-title">自定义字数</text>
        <input
          v-model="customWordCountInput"
          class="wc-input"
          type="number"
          placeholder="请输入字数（100-10000）"
          maxlength="5"
        />
        <view class="wc-input-actions">
          <view class="wc-cancel" @tap="showWordCountInput = false">取消</view>
          <view class="wc-confirm" @tap="confirmCustomWordCount">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { getStory, followStory, unfollowStory, bookmarkStory, applyCollaboration, leaveCollaboration } from '@/api/stories'
import { formatRelativeTime } from '@/utils/helpers'
import { getImageUrl } from '@/utils/request'
import ChapterTree from '@/components/chapter-tree/index.vue'
import { submitAiCreateChapter, getAiTaskStatus } from '@/api/ai'
import type { Story } from '@/api/stories'
import type { Node } from '@/api/nodes'
import type { AiWritingStyle, AiSurpriseTime } from '@/api/ai'

const userStore = useUserStore()

const loading = ref(true)
const nodesLoading = ref(false)
const story = ref<Story | null>(null)
const rootNode = ref<Node | null>(null)
const treeRoot = ref<Node | null>(null)   // 带 children 的树形根节点
const isFollowed = ref(false)
const isBookmarked = ref(false)
const applyLoading = ref(false)
const leaveLoading = ref(false)

// AI 创作章节弹窗
const showAiCreatePanel = ref(false)
const showWordCountInput = ref(false)
const aiSubmitting = ref(false)
const customWordCountInput = ref('')
const aiTargetNodeId = ref<number | null>(null)   // 触发 AI 创作的父节点 id

// AI 任务轮询 & 通知横幅
const aiTaskBanner = reactive({ show: false, message: '' })
const highlightNodeId = ref<number | null>(null)   // 新节点高亮 id
let aiPollTimer: ReturnType<typeof setInterval> | null = null

const aiForm = reactive<{
  surpriseTime: AiSurpriseTime
  style?: AiWritingStyle
  wordCount: number
  customWordCount: number | null
}>({
  surpriseTime: 'immediate',
  style: undefined,
  wordCount: 1500,
  customWordCount: null,
})

const timeOptions = [
  { value: 'immediate' as AiSurpriseTime, icon: '⚡', label: '立即生成' },
  { value: '1hour' as AiSurpriseTime, icon: '⏳', label: '1小时后' },
  { value: 'tonight' as AiSurpriseTime, icon: '🌙', label: '今晚22:00' },
  { value: 'tomorrow' as AiSurpriseTime, icon: '☀️', label: '明天8:00' },
]

const styleOptions: AiWritingStyle[] = ['悬疑', '温情', '脑洞', '科幻', '武侠', '现实', '浪漫', '奇幻']

const wordCountOptions = [
  { label: '短篇', value: 800 },
  { label: '中篇', value: 1500 },
  { label: '长篇', value: 3000 },
]

function selectWordCount(val: number) {
  aiForm.wordCount = val
  aiForm.customWordCount = null
}

function confirmCustomWordCount() {
  const n = parseInt(customWordCountInput.value)
  if (isNaN(n) || n < 100 || n > 10000) {
    uni.showToast({ title: '请输入100-10000之间的字数', icon: 'none' })
    return
  }
  aiForm.customWordCount = n
  aiForm.wordCount = n
  showWordCountInput.value = false
  customWordCountInput.value = ''
}

async function submitAiCreate(publishImmediately: boolean) {
  if (!aiTargetNodeId.value || !story.value) return
  if (aiSubmitting.value) return
  aiSubmitting.value = true
  try {
    const res = await submitAiCreateChapter({
      storyId: story.value.id,
      nodeId: aiTargetNodeId.value,
      surpriseTime: aiForm.surpriseTime,
      style: aiForm.style,
      wordCount: aiForm.customWordCount || aiForm.wordCount,
      publishImmediately,
    })
    showAiCreatePanel.value = false
    uni.showToast({ title: res.message || (publishImmediately ? '任务已提交，将自动发布' : '任务已提交，完成后保存为草稿'), icon: 'success', duration: 3000 })

    if (res.taskId) {
      if (res.scheduledAt) {
        // 定时任务：计算距离执行时间的延迟，到时间后再开始轮询
        // 提前 10 秒开始轮询，避免因网络延迟错过
        const delay = Math.max(0, new Date(res.scheduledAt).getTime() - Date.now() - 10000)
        console.log(`[AI轮询] 定时任务，将在 ${Math.round(delay / 1000)} 秒后开始轮询（scheduledAt: ${res.scheduledAt}）`)
        setTimeout(() => {
          startPollTask(res.taskId!, publishImmediately)
        }, delay)
      } else {
        // 立即任务：直接开始轮询
        startPollTask(res.taskId, publishImmediately)
      }
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || 'AI 创作提交失败', icon: 'none' })
  } finally {
    aiSubmitting.value = false
  }
}

/** 轮询 AI 任务状态，完成后刷新章节树并显示顶部横幅
 * 参照网页端 ai-tasks.html 的轮询思路：
 * 用 setInterval 定时全量查询任务状态，不依赖递归 setTimeout
 */
function startPollTask(taskId: number, publishImmediately: boolean) {
  stopPollTask()
  let attempts = 0
  const maxAttempts = 40  // 最多轮询 40 次（3s × 40 = 2分钟）

  aiPollTimer = setInterval(async () => {
    attempts++
    if (attempts > maxAttempts) {
      stopPollTask()
      return
    }

    try {
      const res = await getAiTaskStatus(taskId)

      if (res.status === 'completed') {
        stopPollTask()
        // 刷新章节树
        if (story.value) {
          const newNodeId = res.result?.acceptedNodeId ?? null
          await refreshTree(story.value.id)
          // 高亮新节点
          if (newNodeId) {
            highlightNodeId.value = newNodeId
            setTimeout(() => { highlightNodeId.value = null }, 4000)
          }
        }
        // 显示顶部横幅
        const action = publishImmediately ? '已自动发布' : '已保存为草稿'
        aiTaskBanner.message = `AI 续写章节${action}，下拉可刷新`
        aiTaskBanner.show = true
        setTimeout(() => { aiTaskBanner.show = false }, 8000)
        return
      }

      if (res.status === 'failed') {
        stopPollTask()
        uni.showToast({ title: `AI 创作失败：${res.errorMessage || '未知错误'}`, icon: 'none', duration: 3000 })
      }
      // pending / processing：继续等下一个 interval
    } catch {
      // 网络错误不中断轮询，等下一个 interval 重试
    }
  }, 3000)
}

function stopPollTask() {
  if (aiPollTimer !== null) {
    clearInterval(aiPollTimer)
    aiPollTimer = null
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const storyId = Number(currentPage.options?.id)
  if (storyId) {
    loadStory(storyId)
  }
})

// 从 write 页面发布新章节后返回时，刷新章节树（不触发全屏 loading）
onShow(() => {
  try {
    const refreshFlag = uni.getStorageSync('st_story_refresh')
    if (refreshFlag && story.value && Number(refreshFlag) === story.value.id) {
      uni.removeStorageSync('st_story_refresh')
      refreshTree(story.value.id)
    }
  } catch {
    // 忽略
  }
})

/** 只刷新章节树，不改变 loading 状态（避免页面闪烁） */
async function refreshTree(storyId: number) {
  nodesLoading.value = true
  try {
    const res = await getStory(storyId)
    const nodes = res.nodes || []
    rootNode.value = nodes.find((n: Node) => !n.parent_id) || null
    treeRoot.value = buildTree(nodes)
    // 同步更新章节计数
    if (story.value && res.story._count) {
      story.value._count = res.story._count
    }
  } catch (err) {
    console.error('刷新章节树失败', err)
  } finally {
    nodesLoading.value = false
  }
}

// 将扁平节点数组构建为树形结构
function buildTree(nodes: Node[]): Node | null {
  if (!nodes || nodes.length === 0) return null
  const map = new Map<number, Node>()
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }))
  let root: Node | null = null
  map.forEach(node => {
    if (!node.parent_id) {
      root = node
    } else {
      const parent = map.get(node.parent_id)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(node)
      }
    }
  })
  return root
}

async function loadStory(id: number) {
  loading.value = true
  try {
    const res = await getStory(id)
    story.value = res.story
    isFollowed.value = res.story.isFollowed ?? false
    isBookmarked.value = res.story.isBookmarked ?? false

    const nodes = res.nodes || []
    rootNode.value = nodes.find((n: Node) => !n.parent_id) || null
    // 构建完整分支树
    treeRoot.value = buildTree(nodes)
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
    const res = await bookmarkStory(story.value!.id)
    const nowBookmarked = res.bookmarked
    const wasBookmarked = isBookmarked.value
    isBookmarked.value = nowBookmarked
    if (story.value) story.value.isBookmarked = nowBookmarked
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

// 从指定节点续写（人工写作）
function handleWriteBranch(parentNodeId: number) {
  // 从树中查找节点标题，用于 write 页面显示「续写自：xxx」
  function findNodeTitle(node: Node | null, id: number): string {
    if (!node) return ''
    if (node.id === id) return node.title
    if (node.children) {
      for (const c of node.children) {
        const t = findNodeTitle(c, id)
        if (t) return t
      }
    }
    return ''
  }
  const parentTitle = findNodeTitle(treeRoot.value, parentNodeId)
  uni.setStorageSync('st_write_params', JSON.stringify({
    storyId: story.value?.id,
    parentId: parentNodeId,
    parentTitle,
    mode: 'write',
  }))
  uni.navigateTo({ url: '/pages/write/index' })
}

// 从指定节点发起 AI 创作（打开独立弹窗）
function handleAiCreate(parentNodeId: number) {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  // 重置表单
  aiTargetNodeId.value = parentNodeId
  aiForm.surpriseTime = 'immediate'
  aiForm.style = undefined
  aiForm.wordCount = 1500
  aiForm.customWordCount = null
  showAiCreatePanel.value = true
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
    if (story.value) {
      const autoApproved = res.message?.includes('自动通过') || res.message?.includes('现在是协作者')
      if (autoApproved) {
        story.value.isCollaborator = true
        story.value.collaborationRequestStatus = 'approved'
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
  uni.showToast({ title: '长按页面可分享给好友', icon: 'none', duration: 2000 })
}

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

.tree-login-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: rgba(124, 106, 247, 0.05);
  border-radius: 12rpx;
  border: 1rpx solid rgba(124, 106, 247, 0.12);

  .tip-text {
    font-size: 24rpx;
    color: #64748b;
  }

  .tip-link {
    font-size: 24rpx;
    color: #7c6af7;
    font-weight: 600;
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

/* ——— AI 创作章节弹窗 ——— */
.ai-create-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}

.ai-create-panel {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);

  .ai-panel-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 32rpx 32rpx 24rpx;
    border-bottom: 1rpx solid #f0f2f5;

    .ai-panel-icon { font-size: 36rpx; }

    .ai-panel-title {
      flex: 1;
      font-size: 32rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .ai-panel-close {
      width: 48rpx;
      height: 48rpx;
      background: #f0f2f5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32rpx;
      color: #64748b;
    }
  }

  .ai-panel-scroll {
    flex: 1;
    overflow: hidden;
  }
}

.ai-section {
  padding: 28rpx 32rpx 0;

  .ai-section-header {
    display: flex;
    align-items: baseline;
    gap: 8rpx;
    margin-bottom: 20rpx;

    .ai-section-icon { font-size: 28rpx; }
    .ai-section-label {
      font-size: 28rpx;
      font-weight: 600;
      color: #1e293b;
    }
    .ai-section-desc {
      font-size: 22rpx;
      color: #94a3b8;
    }
  }
}

.ai-time-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 8rpx;

  .ai-time-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 20rpx 24rpx;
    border-radius: 16rpx;
    border: 2rpx solid #e2e8f0;
    background: #f8fafc;

    &.active {
      border-color: #7c6af7;
      background: rgba(124, 106, 247, 0.08);
    }

    .time-icon { font-size: 28rpx; }
    .time-label { font-size: 26rpx; color: #1e293b; font-weight: 500; }
  }
}

.ai-style-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 8rpx;

  .ai-style-item {
    padding: 14rpx 28rpx;
    border-radius: 40rpx;
    border: 2rpx solid #e2e8f0;
    background: #f8fafc;
    font-size: 26rpx;
    color: #475569;

    &.active {
      border-color: #7c6af7;
      background: rgba(124, 106, 247, 0.1);
      color: #7c6af7;
      font-weight: 600;
    }
  }
}

.ai-wordcount-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 8rpx;

  .ai-wordcount-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 8rpx;
    border-radius: 16rpx;
    border: 2rpx solid #e2e8f0;
    background: #f8fafc;

    &.active {
      border-color: #7c6af7;
      background: rgba(124, 106, 247, 0.1);
    }

    &.custom {
      border-style: dashed;
    }

    .wc-name { font-size: 24rpx; font-weight: 600; color: #1e293b; }
    .wc-value { font-size: 20rpx; color: #94a3b8; margin-top: 4rpx; }
  }
}

.ai-panel-footer {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx 32rpx;
  border-top: 1rpx solid #f0f2f5;

  .ai-footer-btn {
    flex: 1;
    padding: 24rpx 0;
    border-radius: 20rpx;
    font-size: 26rpx;
    font-weight: 600;
    border: none;
    line-height: 1;

    &.draft-btn {
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
      color: #ffffff;
    }

    &.publish-btn {
      background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
      color: #ffffff;
    }
  }
}

/* 自定义字数输入弹窗 */
.wc-input-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wc-input-panel {
  width: 560rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx;

  .wc-input-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 24rpx;
    text-align: center;
  }

  .wc-input {
    width: 100%;
    height: 80rpx;
    border: 2rpx solid #e2e8f0;
    border-radius: 16rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #1e293b;
    margin-bottom: 32rpx;
    box-sizing: border-box;
  }

  .wc-input-actions {
    display: flex;
    gap: 20rpx;

    .wc-cancel, .wc-confirm {
      flex: 1;
      text-align: center;
      padding: 20rpx 0;
      border-radius: 16rpx;
      font-size: 28rpx;
      font-weight: 600;
    }

    .wc-cancel {
      background: #f0f2f5;
      color: #64748b;
    }

    .wc-confirm {
      background: #7c6af7;
      color: #ffffff;
    }
  }
}

/* ——— AI 任务完成横幅 ——— */
.ai-task-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  box-shadow: 0 4rpx 20rpx rgba(124, 106, 247, 0.4);
  animation: bannerSlideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

  .banner-icon {
    font-size: 32rpx;
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    font-size: 26rpx;
    color: #ffffff;
    font-weight: 500;
    line-height: 1.5;
  }

  .banner-close {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    color: #ffffff;
    flex-shrink: 0;
  }
}

@keyframes bannerSlideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>