<template>
  <view v-if="visible" class="ai-panel">
    <!-- 遮罩 -->
    <view class="mask" @tap="$emit('close')" />

    <!-- 面板内容 -->
    <view class="panel">
      <!-- 顶部标题 -->
      <view class="panel-header">
        <view class="header-left">
          <text class="panel-icon">✨</text>
          <text class="panel-title">AI 创作助手</text>
        </view>
        <view class="close-btn" @tap="$emit('close')">
          <text class="close-icon">×</text>
        </view>
      </view>

      <!-- 功能 Tab（与网页端对齐：润色 / 续写 / 插图） -->
      <view class="tab-bar">
        <view
          v-for="tab in tabs"
          :key="tab.type"
          class="tab-item"
          :class="{ active: activeTab === tab.type }"
          @tap="switchTab(tab.type)"
        >
          <text class="tab-icon">{{ tab.icon }}</text>
          <text class="tab-label">{{ tab.label }}</text>
          <!-- 配额徽章 -->
          <view
            v-if="quota"
            class="quota-badge"
            :class="quotaBadgeClass(tab.type)"
          >
            <text class="quota-text">{{ quotaBadgeText(tab.type) }}</text>
          </view>
          <view v-else-if="quotaLoading" class="quota-badge loading">
            <text class="quota-text">…</text>
          </view>
        </view>
      </view>

      <!-- ===== 续写面板 ===== -->
      <view v-if="activeTab === 'continue'" class="tab-content">
        <view class="section">
          <text class="section-label">写作风格</text>
          <scroll-view class="style-scroll" scroll-x>
            <view class="style-list">
              <view
                v-for="style in writingStyles"
                :key="style.value"
                class="style-tag"
                :class="{ active: selectedStyle === style.value }"
                @tap="selectedStyle = style.value"
              >
                {{ style.label }}
              </view>
            </view>
          </scroll-view>
        </view>
        <view class="section">
          <text class="section-label">补充说明（可选）</text>
          <textarea
            v-model="customPrompt"
            class="prompt-input"
            placeholder="例如：请写得更悬疑一些，加入更多对话..."
            :maxlength="200"
            auto-height
          />
        </view>
      </view>

      <!-- ===== 润色面板 ===== -->
      <view v-if="activeTab === 'polish'" class="tab-content">
        <view class="section">
          <text class="section-label">润色风格</text>
          <view class="style-grid">
            <view
              v-for="style in polishStyles"
              :key="style.value"
              class="style-card"
              :class="{ active: selectedPolishStyle === style.value }"
              @tap="selectedPolishStyle = style.value"
            >
              <text class="style-card-icon">{{ style.icon }}</text>
              <text class="style-card-name">{{ style.label }}</text>
            </view>
          </view>
        </view>
        <view class="section">
          <text class="section-label">待润色内容</text>
          <textarea
            class="polish-textarea"
            :class="{ empty: !polishContent || polishContent.trim().length < 10 }"
            v-model="polishContent"
            placeholder="请输入或粘贴要润色的内容..."
            :maxlength="5000"
          />
          <!-- 内容不足时的提示 -->
          <view v-if="!polishContent || !polishContent.trim()" class="polish-hint warn">
            <text class="polish-hint-text">✏️ 请先在编辑器中写一些内容，再使用 AI 润色</text>
          </view>
          <view v-else-if="polishContent.trim().length < 10" class="polish-hint warn">
            <text class="polish-hint-text">✏️ 内容至少需要 10 个字才能润色（当前 {{ polishContent.trim().length }} 字）</text>
          </view>
          <text v-else class="char-count">{{ polishContent.trim().length }} / 5000 字</text>
        </view>
      </view>

      <!-- ===== 插图面板 ===== -->
      <view v-if="activeTab === 'illustration'" class="tab-content">
        <view class="section illustration-intro">
          <text class="intro-icon">🎨</text>
          <text class="intro-title">AI 插图生成</text>
          <text class="intro-desc">AI 将根据章节标题和内容自动生成配套插图，任务完成后将通过通知告知您。</text>
        </view>
        <view class="section">
          <text class="section-label">章节标题</text>
          <view class="info-row">
            <text class="info-text">{{ chapterTitle || '（未填写标题）' }}</text>
          </view>
        </view>
        <view v-if="!storyId || !nodeId" class="section">
          <view class="warn-tip">
            <text class="warn-text">⚠️ 插图功能需要先保存章节草稿，请先点击「存草稿」</text>
          </view>
        </view>
      </view>

      <!-- 生成结果（续写 / 润色） -->
      <view v-if="result && activeTab !== 'illustration'" class="result-section">
        <view class="result-header">
          <text class="section-label">生成结果</text>
          <view class="result-actions">
            <text class="result-action-btn" @tap="copyResult">复制</text>
            <text class="result-action-btn" @tap="generate" :class="{ disabled: generating }">重新生成</text>
          </view>
        </view>
        <view class="result-content">
          <text class="result-text">{{ result }}</text>
        </view>
      </view>

      <!-- 错误提示 -->
      <view v-if="error" class="error-tip">
        <text class="error-text">{{ error }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="panel-footer">
        <button
          v-if="result && activeTab !== 'illustration'"
          class="generate-btn apply-btn"
          @tap="applyResult"
        >
          应用
        </button>
        <button
          v-else
          class="generate-btn"
          :disabled="!canGenerate || generating"
          :loading="generating"
          @tap="generate"
        >
          {{ generateBtnText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getAiV2Quota, createV2PolishTask, submitIllustrationTask } from '@/api/ai'
import http from '@/utils/request'

const props = defineProps<{
  visible: boolean
  storyId?: number
  nodeId?: number        // 父节点 id（续写时是父节点，润色/插图时是当前节点）
  content?: string       // 当前编辑器内容
  chapterTitle?: string  // 当前章节标题
  initialTab?: 'continue' | 'polish' | 'illustration'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', content: string): void
  (e: 'image-generated', url: string): void
}>()

// ——— 配额 ———
interface QuotaItem {
  used: number
  limit: number
  remaining: number
  unlimited: boolean
}
interface QuotaData {
  quota: { continuation: QuotaItem; polish: QuotaItem; illustration: QuotaItem }
  costs: { continuation: number; polish: number; illustration: number }
  points: number
}
const quota = ref<QuotaData | null>(null)
const quotaLoading = ref(false)

async function loadQuota() {
  quotaLoading.value = true
  try {
    quota.value = await getAiV2Quota()
  } catch {
    // 静默失败，不影响功能
  } finally {
    quotaLoading.value = false
  }
}

function quotaBadgeText(type: string): string {
  if (!quota.value) return ''
  const key = type === 'continue' ? 'continuation' : type === 'polish' ? 'polish' : 'illustration'
  const q = quota.value.quota[key as keyof typeof quota.value.quota]
  const cost = quota.value.costs[key as keyof typeof quota.value.costs]
  if (q.unlimited) return '∞'
  if (q.remaining > 0) return String(q.remaining)
  return `${cost}积分`
}

function quotaBadgeClass(type: string): string {
  if (!quota.value) return ''
  const key = type === 'continue' ? 'continuation' : type === 'polish' ? 'polish' : 'illustration'
  const q = quota.value.quota[key as keyof typeof quota.value.quota]
  if (q.unlimited) return 'unlimited'
  if (q.remaining <= 0) return 'exhausted'
  if (q.remaining <= 3) return 'low'
  return ''
}

// ——— Tab ———
const tabs = [
  { type: 'polish', icon: '✨', label: 'AI 润色' },
  { type: 'continue', icon: '✍️', label: 'AI 续写' },
  { type: 'illustration', icon: '🎨', label: 'AI 插图' },
]

const activeTab = ref<'continue' | 'polish' | 'illustration'>('polish')

function switchTab(type: string) {
  activeTab.value = type as 'continue' | 'polish' | 'illustration'
  result.value = ''
  error.value = ''
}

// 面板打开时初始化
watch(
  () => props.visible,
  (val) => {
    if (val) {
      activeTab.value = props.initialTab || 'polish'
      result.value = ''
      error.value = ''
      customPrompt.value = ''
      polishContent.value = props.content || ''
      loadQuota()
    }
  }
)

// ——— 续写 ———
const selectedStyle = ref('default')
const customPrompt = ref('')

const writingStyles = [
  { label: '默认', value: 'default' },
  { label: '悬疑', value: 'mystery' },
  { label: '浪漫', value: 'romance' },
  { label: '奇幻', value: 'fantasy' },
  { label: '科幻', value: 'scifi' },
  { label: '武侠', value: 'wuxia' },
  { label: '现实', value: 'realistic' },
]

// ——— 润色 ———
const selectedPolishStyle = ref('elegant')

const polishStyles = [
  { value: 'elegant', icon: '💎', label: '优雅精炼' },
  { value: 'concise', icon: '✂️', label: '简洁明了' },
  { value: 'vivid', icon: '🌈', label: '生动形象' },
  { value: 'formal', icon: '📜', label: '正式严谨' },
]

const contentPreview = computed(() => {
  const c = props.content || ''
  return c.length > 100 ? c.slice(0, 100) + '...' : (c || '（编辑器内容为空）')
})

// 润色内容：可编辑，初始值来自 props.content，用户可自行修改
const polishContent = ref('')

// ——— 状态 ———
const generating = ref(false)
const result = ref('')
const error = ref('')

const canGenerate = computed(() => {
  if (activeTab.value === 'illustration') {
    return !!(props.storyId && props.nodeId && props.chapterTitle)
  }
  if (activeTab.value === 'continue') {
    return !!(props.storyId && props.nodeId)
  }
  // 润色只需要有内容（用可编辑的 polishContent）
  return !!(polishContent.value && polishContent.value.trim().length >= 10)
})

const generateBtnText = computed(() => {
  if (generating.value) return 'AI 生成中...'
  if (activeTab.value === 'illustration') return '提交插图任务'
  return '开始生成'
})

// ——— 生成 ———
async function generate() {
  if (!canGenerate.value || generating.value) return

  generating.value = true
  error.value = ''
  result.value = ''

  try {
    if (activeTab.value === 'continue') {
      // 使用 v2 异步队列模式提交续写任务
      const submitRes = await http.post<{ taskId: number; status: string; message: string }>('/api/ai/v2/continuation/submit', {
        storyId: props.storyId,
        nodeId: props.nodeId,
        context: props.content || '',
        style: selectedStyle.value !== 'default' ? selectedStyle.value : undefined,
        count: 1,
        mode: 'segment',
      }, { showError: false })

      const taskId = submitRes.taskId
      if (!taskId) {
        error.value = 'AI 任务提交失败，请重试'
        return
      }

      // 轮询任务状态（每2秒一次，最多60次=2分钟）
      const maxAttempts = 60
      let attempts = 0
      while (attempts < maxAttempts) {
        attempts++
        await new Promise(resolve => setTimeout(resolve, 2000))
        const taskRes = await http.get<{
          status: string
          result?: { options?: Array<{ content: string; title?: string; style?: string }> }
          errorMessage?: string
          queuePosition?: number | null
        }>(`/api/ai/v2/tasks/${taskId}`, undefined, { showError: false })

        if (taskRes.status === 'completed') {
          const options = taskRes.result?.options || []
          if (options.length > 0) {
            result.value = options[0].content || ''
          } else {
            error.value = 'AI 未返回续写内容，请重试'
          }
          break
        } else if (taskRes.status === 'failed') {
          error.value = taskRes.errorMessage || 'AI 续写失败，请重试'
          break
        }
        // pending/processing 继续轮询
      }
      if (attempts >= maxAttempts && !result.value && !error.value) {
        error.value = '生成超时，请稍后在任务列表中查看'
      }
      // 续写完成后刷新配额
      loadQuota()
    } else if (activeTab.value === 'polish') {
      const content = polishContent.value.trim()
      if (content.length < 10) {
        error.value = '请先写一些内容（至少10字）再进行润色'
        return
      }
      if (content.length > 5000) {
        error.value = '内容过长（超过5000字），请减少内容后再润色'
        return
      }
      const res = await createV2PolishTask({
        content,
        style: selectedPolishStyle.value,
      })
      result.value = res.polished || ''
      if (!result.value) error.value = 'AI 润色失败，请重试'
      // 润色完成后刷新配额
      loadQuota()
    } else if (activeTab.value === 'illustration') {
      await submitIllustrationTask({
        storyId: props.storyId!,
        nodeId: props.nodeId!,
        chapterTitle: props.chapterTitle || '',
        chapterContent: props.content || '',
      })
      uni.showToast({ title: '插图任务已提交，完成后将通知您', icon: 'none', duration: 3000 })
      // 插图是异步任务，关闭面板
      emit('close')
      // 刷新配额
      loadQuota()
      return
    }
  } catch (e: any) {
    error.value = e?.message || 'AI 生成失败，请稍后重试'
  } finally {
    generating.value = false
  }
}

function copyResult() {
  uni.setClipboardData({
    data: result.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    },
  })
}

function applyResult() {
  emit('apply', result.value)
  emit('close')
}
</script>

<style lang="scss" scoped>
.ai-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;

  .mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    border-radius: 32rpx 32rpx 0 0;
    max-height: 90vh;
    overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom);

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 32rpx 32rpx 24rpx;
      border-bottom: 1rpx solid #f0f2f5;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12rpx;

        .panel-icon { font-size: 36rpx; }
        .panel-title {
          font-size: 32rpx;
          font-weight: 700;
          color: #1e293b;
        }
      }

      .close-btn {
        width: 56rpx;
        height: 56rpx;
        border-radius: 50%;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;

        .close-icon {
          font-size: 36rpx;
          color: #64748b;
          line-height: 1;
        }
      }
    }

    // ===== Tab 栏 =====
    .tab-bar {
      display: flex;
      padding: 0 24rpx;
      border-bottom: 1rpx solid #f0f2f5;

      .tab-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20rpx 8rpx 16rpx;
        position: relative;
        gap: 6rpx;

        .tab-icon { font-size: 32rpx; }
        .tab-label {
          font-size: 24rpx;
          color: #94a3b8;
        }

        &.active {
          .tab-label { color: #7c6af7; font-weight: 600; }
          &::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 20%;
            right: 20%;
            height: 4rpx;
            background: #7c6af7;
            border-radius: 2rpx;
          }
        }

        // 配额徽章
        .quota-badge {
          position: absolute;
          top: 12rpx;
          right: 12rpx;
          min-width: 32rpx;
          height: 32rpx;
          padding: 0 8rpx;
          border-radius: 16rpx;
          background: #7c6af7;
          display: flex;
          align-items: center;
          justify-content: center;

          .quota-text {
            font-size: 18rpx;
            color: #ffffff;
            font-weight: 700;
          }

          &.unlimited {
            background: #10b981;
          }
          &.low {
            background: #f59e0b;
          }
          &.exhausted {
            background: #94a3b8;
            .quota-text { font-size: 16rpx; }
          }
          &.loading {
            background: #e2e8f0;
            .quota-text { color: #94a3b8; }
          }
        }
      }
    }

    // ===== 内容区 =====
    .tab-content {
      padding: 24rpx 32rpx 0;
    }

    .section {
      margin-bottom: 24rpx;
    }

    .section-label {
      font-size: 26rpx;
      color: #64748b;
      display: block;
      margin-bottom: 16rpx;
    }

    // 风格横向滚动（续写）
    .style-scroll {
      white-space: nowrap;
      .style-list {
        display: flex;
        gap: 12rpx;
        .style-tag {
          display: inline-flex;
          padding: 10rpx 24rpx;
          border-radius: 40rpx;
          border: 1rpx solid #e2e8f0;
          font-size: 26rpx;
          color: #475569;
          background: #f8fafc;
          white-space: nowrap;
          &.active {
            border-color: #7c6af7;
            color: #7c6af7;
            background: rgba(124, 106, 247, 0.08);
          }
        }
      }
    }

    // 润色风格网格
    .style-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12rpx;

      .style-card {
        padding: 16rpx 8rpx;
        border-radius: 16rpx;
        border: 2rpx solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8rpx;

        &.active {
          border-color: #7c6af7;
          background: rgba(124, 106, 247, 0.06);
        }

        .style-card-icon { font-size: 36rpx; }
        .style-card-name {
          font-size: 22rpx;
          color: #475569;
          text-align: center;
        }
      }
    }

    // 润色内容可编辑文本框
    .polish-textarea {
      width: 100%;
      height: 200rpx;
      padding: 16rpx;
      background: #f8fafc;
      border-radius: 12rpx;
      border: 1rpx solid #e2e8f0;
      font-size: 26rpx;
      color: #1e293b;
      line-height: 1.7;
      box-sizing: border-box;
      &.empty {
        border-color: #fca5a5;
        background: #fff5f5;
      }
    }

    .char-count {
      display: block;
      text-align: right;
      font-size: 22rpx;
      color: #94a3b8;
      margin-top: 8rpx;
    }

    // 润色可用性提示
    .polish-hint {
      margin-top: 12rpx;
      padding: 12rpx 16rpx;
      border-radius: 10rpx;
      .polish-hint-text {
        font-size: 24rpx;
        line-height: 1.6;
      }
      &.warn {
        background: #fffbeb;
        border: 1rpx solid #fde68a;
        .polish-hint-text { color: #92400e; }
      }
    }

    // 插图介绍
    .illustration-intro {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24rpx;
      background: rgba(124, 106, 247, 0.04);
      border-radius: 16rpx;
      border: 1rpx solid rgba(124, 106, 247, 0.12);
      gap: 12rpx;

      .intro-icon { font-size: 56rpx; }
      .intro-title {
        font-size: 30rpx;
        font-weight: 700;
        color: #1e293b;
      }
      .intro-desc {
        font-size: 24rpx;
        color: #64748b;
        text-align: center;
        line-height: 1.7;
      }
    }

    .info-row {
      padding: 12rpx 16rpx;
      background: #f8fafc;
      border-radius: 12rpx;
      border: 1rpx solid #e2e8f0;
      .info-text {
        font-size: 26rpx;
        color: #475569;
      }
    }

    .warn-tip {
      padding: 16rpx;
      background: #fffbeb;
      border-radius: 12rpx;
      border: 1rpx solid #fde68a;
      .warn-text {
        font-size: 24rpx;
        color: #92400e;
        line-height: 1.6;
      }
    }

    // 提示词输入
    .prompt-input {
      width: 100%;
      min-height: 100rpx;
      padding: 16rpx;
      border-radius: 12rpx;
      border: 1rpx solid #e2e8f0;
      font-size: 26rpx;
      color: #1e293b;
      background: #f8fafc;
      box-sizing: border-box;
    }

    // 生成结果
    .result-section {
      padding: 0 32rpx 24rpx;

      .result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16rpx;

        .result-actions {
          display: flex;
          gap: 16rpx;

          .result-action-btn {
            font-size: 26rpx;
            color: #64748b;
            padding: 8rpx 20rpx;
            border-radius: 8rpx;
            border: 1rpx solid #e2e8f0;

            &.primary {
              color: #7c6af7;
              border-color: #7c6af7;
            }
          }
        }
      }

      .result-content {
        padding: 24rpx;
        background: #f8fafc;
        border-radius: 12rpx;
        border: 1rpx solid #e2e8f0;
        max-height: 400rpx;
        overflow-y: auto;

        .result-text {
          font-size: 28rpx;
          color: #1e293b;
          line-height: 1.8;
        }
      }
    }

    // 错误提示
    .error-tip {
      margin: 0 32rpx 16rpx;
      padding: 16rpx;
      background: #fef2f2;
      border-radius: 12rpx;

      .error-text {
        font-size: 26rpx;
        color: #ef4444;
      }
    }

    // 底部按钮
    .panel-footer {
      padding: 16rpx 32rpx 32rpx;

        .generate-btn {
          width: 100%;
          height: 88rpx;
          background: linear-gradient(135deg, #7c6af7, #a855f7);
          border-radius: 44rpx;
          color: #ffffff;
          font-size: 30rpx;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;

          &[disabled] {
            opacity: 0.5;
          }

          &.apply-btn {
            background: linear-gradient(135deg, #10b981, #059669);
          }
        }
    }
  }
}
</style>