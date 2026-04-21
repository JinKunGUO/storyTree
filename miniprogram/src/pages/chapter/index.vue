<template>
  <view
    class="chapter-page"
    :style="{ background: bgColors[settings.theme], '--status-bar-height': statusBarHeight + 'px' }"
    @touchstart.passive="onPageTouchStart"
    @touchend.passive="onPageTouchEnd"
  >
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

          <!-- 只有一个后续节点：直接显示"阅读下一章"按钮 -->
          <view v-if="children.length === 1" class="next-chapter-btn" @tap="goChapter(children[0].id)">
            <view class="ncb-left">
              <text class="ncb-icon">📖</text>
              <view class="ncb-info">
                <text class="ncb-label">阅读下一章</text>
                <text class="ncb-title">{{ children[0].title }}</text>
              </view>
            </view>
            <text class="ncb-arrow">›</text>
          </view>

          <!-- 多个后续节点：点击展开全屏分支图 -->
          <view v-else class="branch-chart-trigger" @tap="showBranchChart = true">
            <view class="bct-left">
              <text class="bct-icon">🌿</text>
              <view class="bct-info">
                <text class="bct-title">查看故事分支图</text>
                <text class="bct-sub">{{ children.length }} 个分支，点击展开可视化图</text>
              </view>
            </view>
            <text class="bct-arrow">›</text>
          </view>
        </view>

        <!-- 无分支提示 -->
        <view v-else class="no-branch">
          <text class="no-branch-icon">🌿</text>
          <text class="no-branch-text">这是故事的末端，等待续写</text>
        </view>

        <!-- 续写 / AI 创作入口（始终展示，登录后可操作） -->
        <view class="write-actions-section">
          <view class="write-actions-title">
            <text class="write-actions-label">从此节点创作</text>
          </view>
          <view class="write-actions-row">
            <view
              class="write-action-btn"
              :class="{ disabled: !userStore.isLoggedIn }"
              @tap="userStore.isLoggedIn ? writeBranch() : goLogin()"
            >
              <text class="write-action-icon">✍️</text>
              <text class="write-action-text">续写章节</text>
            </view>
            <view
              class="write-action-btn ai-action-btn"
              :class="{ disabled: !userStore.isLoggedIn }"
              @tap="userStore.isLoggedIn ? openAiPanel() : goLogin()"
            >
              <text class="write-action-icon">🤖</text>
              <text class="write-action-text">AI 创作</text>
            </view>
          </view>
          <text v-if="!userStore.isLoggedIn" class="write-login-tip" @tap="goLogin">登录后可续写故事 →</text>
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
                <view
                  class="vote-btn"
                  :class="{ voted: comment.userVote === 'like' || (comment as any)._myVote === 'up' }"
                  @tap="voteOnComment(comment.id, 'up')"
                >
                  <text>👍 {{ comment.likeCount ?? comment._count?.votes ?? 0 }}</text>
                </view>
                <view class="reply-btn" @tap="openReply(comment.id, comment.user.username)">
                  <text>回复</text>
                </view>
              </view>

              <!-- 扁平化回复列表（与网页端一致） -->
              <block v-if="comment.other_comments && comment.other_comments.length">
                <view class="replies-wrap">
                  <!-- 前3条始终显示 -->
                  <view
                    v-for="(item, idx) in flattenReplies(comment.other_comments)"
                    :key="item.comment.id"
                    class="reply-item"
                    :class="{ hidden: idx >= 3 && !(comment as any)._showAllReplies }"
                  >
                    <text class="reply-username">{{ item.comment.user.username }}</text>
                    <text v-if="item.replyToUsername" class="reply-to-name"> @{{ item.replyToUsername }}：</text>
                    <text class="reply-text">{{ item.comment.content }}</text>
                    <view class="reply-actions">
                      <text class="reply-time">{{ formatTime(item.comment.created_at) }}</text>
                      <view
                        class="reply-vote"
                        :class="{ voted: item.comment.userVote === 'like' }"
                        @tap="voteOnComment(item.comment.id, 'up')"
                      >
                        <text>👍 {{ item.comment.likeCount ?? 0 }}</text>
                      </view>
                      <view class="reply-btn-inline" @tap="openReply(item.comment.id, item.comment.user.username)">
                        <text>回复</text>
                      </view>
                    </view>
                  </view>

                  <!-- 折叠/展开按钮（超过3条时显示） -->
                  <view
                    v-if="flattenReplies(comment.other_comments).length > 3"
                    class="toggle-replies-btn"
                    @tap="(comment as any)._showAllReplies = !(comment as any)._showAllReplies"
                  >
                    <text v-if="!(comment as any)._showAllReplies">
                      共 {{ flattenReplies(comment.other_comments).length }} 条回复，点击查看全部 ▼
                    </text>
                    <text v-else>收起回复 ▲</text>
                  </view>
                </view>
              </block>
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
    <view v-if="showCommentInput" class="comment-mask" @tap.self="closeCommentInput">
      <view class="comment-panel">
        <view v-if="replyTo" class="reply-hint">
          <text class="reply-hint-text">回复 @{{ replyTo.username }}</text>
          <text class="reply-hint-cancel" @tap="replyTo = null">取消回复</text>
        </view>
        <textarea
          v-model="commentText"
          class="comment-textarea"
          :placeholder="replyTo ? `回复 @${replyTo.username}...` : '写下你的评论...'"
          :auto-focus="true"
          maxlength="500"
        />
        <view class="comment-submit-row">
          <text class="char-count">{{ commentText.length }}/500</text>
          <button class="btn-submit-comment" @tap="submitComment">发送</button>
        </view>
      </view>
    </view>

    <!-- AI 创作面板 -->
    <ai-panel
      :visible="showAiPanel"
      :node-id="node?.id"
      :story-id="node?.story_id"
      :content="node?.content || ''"
      @close="showAiPanel = false"
      @apply="handleAiApply"
    />

    <!-- 全屏分支图面板（canvas 原生组件必须在 scroll-view 外渲染，否则定位异常） -->
    <view v-if="showBranchChart" class="branch-chart-mask">
      <!-- 遮罩背景区域：点击关闭 -->
      <view class="branch-chart-mask-bg" @tap="showBranchChart = false" />
      <!-- 面板主体：阻止事件冒泡到遮罩 -->
      <view class="branch-chart-panel" @tap.stop>
        <!-- 面板头部 -->
        <view class="bcp-header">
          <view class="bcp-handle" />
          <view class="bcp-title-row">
            <text class="bcp-title">故事分支图</text>
            <view class="bcp-close" @tap="showBranchChart = false">
              <text class="bcp-close-icon">×</text>
            </view>
          </view>
        </view>
        <!-- ECharts 分支图（canvas 原生组件不支持 scroll-view 滚动，通过 roam 拖拽查看） -->
        <tree-chart
          :root-node="branchTreeRoot"
          :is-author-or-collab="false"
          :is-logged-in="userStore.isLoggedIn"
          :hide-canvas="!showBranchChart || showSettings || showCommentInput || showAiPanel"
          :max-height="branchChartMaxHeight"
          @node-tap="onBranchNodeTap"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import { getNode, rateNode, bookmarkNode, unbookmarkNode, incrementReadCount, buildSubTree, getStoryNodes } from '@/api/nodes'
import { getNodeComments, createComment, voteComment } from '@/api/comments'
import { formatRelativeTime } from '@/utils/helpers'
import { getImageUrl } from '@/utils/request'
import AiPanel from '@/components/ai-panel/index.vue'
import TreeChart from '@/components/tree-chart/index.vue'
import type { Node } from '@/api/nodes'
import type { Comment } from '@/api/comments'

const userStore = useUserStore()
const appStore = useAppStore()

const loading = ref(true)
const hideNav = ref(false)
const statusBarHeight = ref(20) // 状态栏高度（px），动态获取避免与胶囊按钮重叠
const showSettings = ref(false)
const showCommentInput = ref(false)
const showAiPanel = ref(false)
const showBranchChart = ref(false)  // 全屏分支图面板
// 分支图面板可用高度（px）：面板总高 88vh 减去 header 区域，传给 tree-chart 限制 canvas 高度
// 微信原生 canvas 不受 CSS overflow 约束，必须从源头限制 canvas 物理尺寸
const branchChartMaxHeight = ref(0)
const commentText = ref('')
const replyTo = ref<{ id: number; username: string } | null>(null) // 当前回复的评论

const node = ref<Node | null>(null)
const parent = ref<{ id: number; title: string } | null>(null)  // 父节点（上一章）
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

// 以当前节点为根的完整多层分支树（包含所有子孙节点）
// 初始由 children 构成第一层，加载故事完整树后替换为多层
const branchTreeRoot = ref<import('@/api/nodes').Node | null>(null)

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

// 页面加载时开启右上角转发按钮（开发者工具不支持，跳过）
onLoad(() => {
  const { platform } = uni.getSystemInfoSync()
  if (platform === 'devtools') return
  try {
    uni.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  } catch (e) { /* ignore */ }
})

// 定义分享内容
onShareAppMessage(() => ({
  title: node.value ? `《${node.value.title}》- StoryTree` : 'StoryTree - 协作式故事创作',
  path: node.value ? `/pages/chapter/index?id=${node.value.id}` : '/pages/index/index',
}))

onMounted(() => {
  // 动态获取状态栏高度
  try {
    const sysInfo = uni.getSystemInfoSync()
    statusBarHeight.value = sysInfo.statusBarHeight || 20
    // 计算分支图面板可用高度：面板总高 88vh，减去 header（约 90px）、工具栏（约 50px）、底部统计行（约 32px）
    // 这个高度用于限制 tree-chart 内 canvas 的物理尺寸，防止原生 canvas 超出面板边界
    const panelH = sysInfo.windowHeight * 0.88
    branchChartMaxHeight.value = Math.max(panelH - 90 - 50 - 32, 300)
  } catch {
    statusBarHeight.value = 20
    branchChartMaxHeight.value = 500
  }

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
    const [nodeRes, commentsRes] = await Promise.all([
      getNode(id),
      getNodeComments(id, { page: 1, pageSize: 10 }),
    ])
    node.value = nodeRes.node
    // 后端 GET /api/nodes/:id 同时返回 branches（子节点列表，只有第一层）
    children.value = (nodeRes as any).branches || []
    parent.value = (nodeRes as any).parent || null

    // 先用第一层子节点构造初始树，让 tree-chart 立即可渲染
    if (children.value.length > 0) {
      branchTreeRoot.value = { ...nodeRes.node, children: children.value }
    }

    comments.value = commentsRes.comments
    totalComments.value = commentsRes.total
    hasMoreComments.value = commentsRes.total > 10
    isBookmarked.value = nodeRes.node.isBookmarked ?? false
    userRating.value = nodeRes.node.userRating ?? 0

    // 异步加载完整故事节点树，构建多层分支图（不阻塞首屏渲染）
    if (nodeRes.node.story_id && children.value.length > 0) {
      getStoryNodes(nodeRes.node.story_id).then(({ nodes }) => {
        const fullSubTree = buildSubTree(nodes, id)
        if (fullSubTree) {
          branchTreeRoot.value = fullSubTree
        }
      }).catch(() => {
        // 完整树加载失败时保留第一层，不影响用户体验
      })
    }
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
    const payload: { node_id: number; content: string; parent_id?: number } = {
      node_id: node.value!.id,
      content: commentText.value.trim(),
    }
    if (replyTo.value) {
      payload.parent_id = replyTo.value.id
    }
    await createComment(payload)
    totalComments.value++
    commentText.value = ''
    replyTo.value = null
    showCommentInput.value = false
    uni.showToast({ title: '评论成功', icon: 'success' })
    // 重新加载评论列表（与网页端一致，确保 other_comments 结构正确）
    const res = await getNodeComments(node.value!.id, { page: 1, pageSize: 10 })
    comments.value = res.comments
    hasMoreComments.value = res.total > 10
  } catch (err: any) {
    uni.showToast({ title: err.message || '评论失败', icon: 'none' })
  }
}

/** 递归查找评论（包括 other_comments 中的子评论） */
function findComment(list: any[], id: number): any | null {
  for (const c of list) {
    if (c.id === id) return c
    if (c.other_comments?.length) {
      const found = findComment(c.other_comments, id)
      if (found) return found
    }
  }
  return null
}

async function voteOnComment(commentId: number, type: 'up' | 'down') {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  // 递归查找，支持顶级评论和子评论点赞
  const comment = findComment(comments.value, commentId)
  if (!comment) return

  // 后端逻辑：POST 相同 voteType 会自动切换（已投则取消，未投则添加）
  // 后端返回 'like'/'dislike'，本地用 _myVote 缓存当前状态
  const backendVote = type === 'up' ? 'like' : 'dislike'
  const alreadyVoted = comment.userVote === backendVote || (comment as any)._myVote === type
  try {
    await voteComment(commentId, type)
    if (!comment._count) comment._count = { votes: 0 }
    if (alreadyVoted) {
      // 取消点赞
      comment._count.votes = Math.max(0, (comment._count.votes || 0) - 1)
      comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1)
      comment.userVote = null;
      (comment as any)._myVote = null
    } else {
      // 新增点赞
      comment._count.votes = (comment._count.votes || 0) + 1
      comment.likeCount = (comment.likeCount || 0) + 1
      comment.userVote = backendVote as 'like' | 'dislike';
      (comment as any)._myVote = type
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '操作失败', icon: 'none' })
  }
}

function toggleNav() {
  hideNav.value = !hideNav.value
}

function openReply(commentId: number, username: string) {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/auth/login/index' })
    return
  }
  replyTo.value = { id: commentId, username }
  showCommentInput.value = true
}

function closeCommentInput() {
  showCommentInput.value = false
  replyTo.value = null
  commentText.value = ''
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
  // 用 redirectTo 替换当前页，避免连续阅读时页面栈超过 10 层限制
  uni.redirectTo({ url: `/pages/chapter/index?id=${id}` })
}

function onBranchNodeTap(id: number) {
  showBranchChart.value = false
  // 用 redirectTo 替换当前页，避免页面栈超限；延迟让面板关闭后再跳转
  setTimeout(() => {
    uni.redirectTo({ url: `/pages/chapter/index?id=${id}` })
  }, 150)
}

function writeBranch() {
  uni.setStorageSync('st_write_params', JSON.stringify({
    storyId: node.value?.story_id,
    parentId: node.value?.id,
    parentTitle: node.value?.title,
  }))
  uni.switchTab({ url: '/pages/write/index' })
}

function openAiPanel() {
  showAiPanel.value = true
}

function handleAiApply(content: string) {
  // AI 创作完成后，跳转到写作页并预填内容
  uni.setStorageSync('st_write_params', JSON.stringify({
    storyId: node.value?.story_id,
    parentId: node.value?.id,
    parentTitle: node.value?.title,
    prefillContent: content || '',
  }))
  showAiPanel.value = false
  uni.switchTab({ url: '/pages/write/index' })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login/index' })
}

function shareChapter() {
  uni.showToast({ title: '请点击右上角"..."分享', icon: 'none' })
}

function goBack() {
  // 优先 navigateBack 回到页面栈中已有的故事详情页
  // （章节页用 redirectTo 跳转，页面栈里保留了进入前的故事详情页）
  const pages = getCurrentPages()
  const storyPageIdx = pages.findLastIndex((p: any) =>
    p.route?.includes('story') && !p.route?.includes('chapter')
  )
  if (storyPageIdx >= 0) {
    // 计算需要回退的层数
    uni.navigateBack({ delta: pages.length - 1 - storyPageIdx })
  } else if (node.value?.story_id) {
    // 页面栈里没有故事详情页（如从分享直接进入），则跳转
    uni.redirectTo({ url: `/pages/story/index?id=${node.value.story_id}` })
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

// ─── 左滑返回上一章手势 ─────────────────────────────────────────────────────────
// 参考微信读书方案：从屏幕左侧 1/4 区域内起始，横向右滑距离 > 60px
// 且横向位移 > 纵向位移（确保是横向手势，避免与纵向滚动冲突）
const _swipe = { startX: 0, startY: 0, active: false }
const _screenWidth = uni.getSystemInfoSync().windowWidth

function onPageTouchStart(e: any) {
  // 任何弹窗打开时禁用手势，避免误触
  if (showSettings.value || showCommentInput.value || showAiPanel.value) return
  const touch = e.touches?.[0]
  if (!touch) return
  // 只在左侧 1/4 区域内起始才激活手势（参考 iOS 系统边缘返回的逻辑）
  if (touch.clientX <= _screenWidth * 0.25) {
    _swipe.startX = touch.clientX
    _swipe.startY = touch.clientY
    _swipe.active = true
  } else {
    _swipe.active = false
  }
}

function onPageTouchEnd(e: any) {
  if (!_swipe.active) return
  _swipe.active = false
  const touch = e.changedTouches?.[0]
  if (!touch) return
  const dx = touch.clientX - _swipe.startX
  const dy = Math.abs(touch.clientY - _swipe.startY)
  // 右滑 > 60px 且横向位移大于纵向位移（排除竖向滚动误判）
  if (dx > 60 && dx > dy) {
    goPrevChapter()
  }
}

function goPrevChapter() {
  if (!parent.value) {
    uni.showToast({ title: '已是第一章', icon: 'none', duration: 1200 })
    return
  }
  // 章节间用 redirectTo 跳转，页面栈里没有上一章，直接 redirectTo 替换当前页
  uni.redirectTo({ url: `/pages/chapter/index?id=${parent.value.id}` })
}

function formatTime(date: string) {
  return formatRelativeTime(date)
}

/**
 * 扁平化回复列表（与网页端 comments.js 一致）
 * 递归将 other_comments 展开为一维数组，并记录被回复的用户名
 */
function flattenReplies(
  replies: any[],
  parentComment: any = null
): Array<{ comment: any; replyToUsername: string | null }> {
  let result: Array<{ comment: any; replyToUsername: string | null }> = []
  replies.forEach(reply => {
    result.push({
      comment: reply,
      replyToUsername: parentComment ? parentComment.user.username : null,
    })
    if (reply.other_comments && reply.other_comments.length > 0) {
      result = result.concat(flattenReplies(reply.other_comments, reply))
    }
  })
  return result
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
  padding-top: var(--status-bar-height, 20px);
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

  // 只有一个后续节点时的"阅读下一章"按钮
  .next-chapter-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 24rpx;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(52, 211, 153, 0.06) 100%);
    border-radius: 20rpx;
    border: 1rpx solid rgba(16, 185, 129, 0.2);

    .ncb-left {
      display: flex;
      align-items: center;
      gap: 20rpx;

      .ncb-icon {
        font-size: 48rpx;
      }

      .ncb-info {
        display: flex;
        flex-direction: column;
        gap: 6rpx;

        .ncb-label {
          font-size: 22rpx;
          color: #10b981;
          font-weight: 500;
        }

        .ncb-title {
          font-size: 28rpx;
          font-weight: 600;
          color: #1e293b;
          max-width: 460rpx;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .ncb-arrow {
      font-size: 44rpx;
      color: #10b981;
      font-weight: 300;
    }
  }

  // 分支图入口按钮
  .branch-chart-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 24rpx;
    background: linear-gradient(135deg, rgba(124, 106, 247, 0.06) 0%, rgba(167, 139, 250, 0.06) 100%);
    border-radius: 20rpx;
    border: 1rpx solid rgba(124, 106, 247, 0.18);

    .bct-left {
      display: flex;
      align-items: center;
      gap: 20rpx;

      .bct-icon {
        font-size: 48rpx;
      }

      .bct-info {
        display: flex;
        flex-direction: column;
        gap: 6rpx;

        .bct-title {
          font-size: 28rpx;
          font-weight: 600;
          color: #1e293b;
        }

        .bct-sub {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }
    }

    .bct-arrow {
      font-size: 44rpx;
      color: #7c6af7;
      font-weight: 300;
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
  padding: 32rpx 0 16rpx;

  .no-branch-icon {
    font-size: 64rpx;
    margin-bottom: 12rpx;
  }

  .no-branch-text {
    font-size: 26rpx;
    color: #94a3b8;
  }
}

.write-actions-section {
  margin-bottom: 40rpx;
  padding: 24rpx;
  background: rgba(124, 106, 247, 0.04);
  border-radius: 20rpx;
  border: 1rpx solid rgba(124, 106, 247, 0.12);

  .write-actions-title {
    margin-bottom: 20rpx;

    .write-actions-label {
      font-size: 26rpx;
      font-weight: 600;
      color: #475569;
    }
  }

  .write-actions-row {
    display: flex;
    gap: 20rpx;
  }

  .write-action-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    padding: 24rpx 16rpx;
    background: #ffffff;
    border-radius: 16rpx;
    border: 1rpx solid #e2e8f0;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    &.ai-action-btn {
      background: linear-gradient(135deg, rgba(124, 106, 247, 0.08) 0%, rgba(167, 139, 250, 0.08) 100%);
      border-color: rgba(124, 106, 247, 0.2);
    }

    &.disabled {
      opacity: 0.5;
    }

    .write-action-icon {
      font-size: 40rpx;
    }

    .write-action-text {
      font-size: 24rpx;
      font-weight: 600;
      color: #1e293b;
    }
  }

  .write-login-tip {
    display: block;
    text-align: center;
    margin-top: 16rpx;
    font-size: 24rpx;
    color: #7c6af7;
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

          &.voted {
            color: #7c6af7;
          }
        }

        .reply-btn {
          font-size: 22rpx;
          color: #94a3b8;
        }
      }

      .replies-wrap {
        margin-top: 12rpx;
        padding: 16rpx;
        background: #f8fafc;
        border-radius: 12rpx;

        .reply-item {
          margin-bottom: 16rpx;

          &:last-child { margin-bottom: 0; }

          &.hidden { display: none; }

          .reply-username {
            font-size: 22rpx;
            font-weight: 600;
            color: #7c6af7;
            margin-right: 4rpx;
          }

          .reply-to-name {
            font-size: 22rpx;
            color: #7c6af7;
            margin-right: 4rpx;
          }

          .reply-text {
            font-size: 24rpx;
            color: #475569;
          }

          .reply-actions {
            display: flex;
            align-items: center;
            gap: 16rpx;
            margin-top: 8rpx;

            .reply-time {
              font-size: 20rpx;
              color: #94a3b8;
            }

            .reply-vote {
              font-size: 20rpx;
              color: #94a3b8;

              &.voted { color: #7c6af7; }
            }

            .reply-btn-inline {
              font-size: 20rpx;
              color: #94a3b8;
            }
          }
        }

        .toggle-replies-btn {
          margin-top: 12rpx;
          padding: 10rpx 0;
          text-align: center;
          font-size: 22rpx;
          color: #7c6af7;
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

  .reply-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12rpx 16rpx;
    background: rgba(124, 106, 247, 0.08);
    border-radius: 12rpx;
    margin-bottom: 16rpx;

    .reply-hint-text {
      font-size: 24rpx;
      color: #7c6af7;
    }

    .reply-hint-cancel {
      font-size: 22rpx;
      color: #94a3b8;
    }
  }

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

// ── 全屏分支图面板 ──────────────────────────────────────────────────────────────
.branch-chart-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-end;

  // 半透明背景遮罩（独立节点，点击关闭）
  .branch-chart-mask-bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }
}

.branch-chart-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 88vh;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .bcp-header {
    flex-shrink: 0;
    padding: 16rpx 32rpx 0;

    .bcp-handle {
      width: 60rpx;
      height: 6rpx;
      border-radius: 3rpx;
      background: #e2e8f0;
      margin: 0 auto 20rpx;
    }

    .bcp-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 20rpx;
      border-bottom: 1rpx solid #f1f5f9;

      .bcp-title {
        font-size: 32rpx;
        font-weight: 700;
        color: #1e293b;
      }

      .bcp-close {
        width: 56rpx;
        height: 56rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        border-radius: 50%;

        .bcp-close-icon {
          font-size: 36rpx;
          color: #64748b;
          line-height: 1;
        }
      }
    }
  }

  // tree-chart 组件撑满剩余空间，overflow:hidden 确保 canvas 不超出面板边界
  .tree-chart-wrap {
    flex: 1;
    overflow: hidden;
    padding: 16rpx 16rpx 0;
  }
}
</style>

