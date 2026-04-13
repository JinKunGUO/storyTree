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

      <!-- 功能选项 -->
      <view class="actions-section">
        <text class="section-label">选择功能</text>
        <view class="action-grid">
          <view
            v-for="action in aiActions"
            :key="action.type"
            class="action-card"
            :class="{ active: selectedAction === action.type }"
            @tap="selectAction(action.type)"
          >
            <text class="action-icon">{{ action.icon }}</text>
            <text class="action-name">{{ action.name }}</text>
            <text class="action-desc">{{ action.desc }}</text>
          </view>
        </view>
      </view>

      <!-- 风格选择（续写时显示） -->
      <view v-if="selectedAction === 'continue'" class="style-section">
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

      <!-- 自定义提示词 -->
      <view class="prompt-section">
        <text class="section-label">补充说明（可选）</text>
        <textarea
          v-model="customPrompt"
          class="prompt-input"
          placeholder="例如：请写得更悬疑一些，加入更多对话..."
          :maxlength="200"
          auto-height
        />
      </view>

      <!-- 生成结果 -->
      <view v-if="result" class="result-section">
        <view class="result-header">
          <text class="section-label">生成结果</text>
          <view class="result-actions">
            <text class="result-action-btn" @tap="copyResult">复制</text>
            <text class="result-action-btn primary" @tap="applyResult">应用</text>
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
          class="generate-btn"
          :disabled="!selectedAction || generating"
          :loading="generating"
          @tap="generate"
        >
          {{ generating ? 'AI 生成中...' : '开始生成' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { aiApi } from '@/api'

const props = defineProps<{
  visible: boolean
  storyId?: number
  nodeId?: number
  content?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', content: string): void
}>()

const selectedAction = ref<string>('')
const selectedStyle = ref('default')
const customPrompt = ref('')
const generating = ref(false)
const result = ref('')
const error = ref('')

const aiActions = [
  {
    type: 'continue',
    icon: '✍️',
    name: 'AI 续写',
    desc: '基于当前内容智能续写',
  },
  {
    type: 'polish',
    icon: '💎',
    name: 'AI 润色',
    desc: '优化文字表达和语言',
  },
  {
    type: 'summary',
    icon: '📋',
    name: 'AI 摘要',
    desc: '生成内容摘要',
  },
  {
    type: 'branch',
    icon: '🌿',
    name: 'AI 分支',
    desc: '生成故事分支方向',
  },
]

const writingStyles = [
  { label: '默认', value: 'default' },
  { label: '悬疑', value: 'mystery' },
  { label: '浪漫', value: 'romance' },
  { label: '奇幻', value: 'fantasy' },
  { label: '科幻', value: 'scifi' },
  { label: '武侠', value: 'wuxia' },
  { label: '现实', value: 'realistic' },
]

function selectAction(type: string) {
  selectedAction.value = type
  result.value = ''
  error.value = ''
}

async function generate() {
  if (!selectedAction.value || generating.value) return
  if (!props.storyId || !props.nodeId) {
    error.value = '请先选择故事和章节'
    return
  }

  generating.value = true
  error.value = ''
  result.value = ''

  try {
    let res: any

    switch (selectedAction.value) {
      case 'continue':
        res = await aiApi.createContinueTask({
          story_id: props.storyId,
          node_id: props.nodeId,
          style: selectedStyle.value !== 'default' ? selectedStyle.value : undefined,
        })
        break
      case 'polish':
        res = await aiApi.createPolishTask({
          node_id: props.nodeId,
          content: props.content || '',
        })
        break
      case 'summary':
        res = await aiApi.createSummaryTask({
          node_id: props.nodeId,
        })
        break
      default:
        throw new Error('未知操作类型')
    }

    // 轮询任务状态
    if (res?.task?.id) {
      await pollTaskResult(res.task.id)
    }
  } catch (e: any) {
    error.value = e?.message || 'AI 生成失败，请稍后重试'
  } finally {
    generating.value = false
  }
}

async function pollTaskResult(taskId: number, retries = 20) {
  for (let i = 0; i < retries; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    try {
      const res = await aiApi.getTaskStatus(taskId)
      if (res.task.status === 'completed' && res.task.result_data) {
        const data = JSON.parse(res.task.result_data)
        result.value = data.content || data.summary || data.result || ''
        return
      }
      if (res.task.status === 'failed') {
        throw new Error(res.task.error_message || 'AI 生成失败')
      }
    } catch (e) {
      throw e
    }
  }
  throw new Error('AI 生成超时，请稍后重试')
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

        .panel-icon {
          font-size: 36rpx;
        }

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

    .section-label {
      font-size: 26rpx;
      color: #64748b;
      display: block;
      margin-bottom: 16rpx;
    }

    .actions-section {
      padding: 24rpx 32rpx;

      .action-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16rpx;

        .action-card {
          padding: 24rpx;
          border-radius: 16rpx;
          border: 2rpx solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 8rpx;
          transition: all 0.2s;

          &.active {
            border-color: #7c6af7;
            background: rgba(124, 106, 247, 0.06);
          }

          .action-icon {
            font-size: 40rpx;
          }

          .action-name {
            font-size: 28rpx;
            font-weight: 600;
            color: #1e293b;
          }

          .action-desc {
            font-size: 22rpx;
            color: #94a3b8;
          }
        }
      }
    }

    .style-section {
      padding: 0 32rpx 24rpx;

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
    }

    .prompt-section {
      padding: 0 32rpx 24rpx;

      .prompt-input {
        width: 100%;
        min-height: 120rpx;
        padding: 16rpx;
        border-radius: 12rpx;
        border: 1rpx solid #e2e8f0;
        font-size: 26rpx;
        color: #1e293b;
        background: #f8fafc;
        box-sizing: border-box;
      }
    }

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

        .result-text {
          font-size: 28rpx;
          color: #1e293b;
          line-height: 1.8;
        }
      }
    }

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

        &[disabled] {
          opacity: 0.5;
        }
      }
    }
  }
}
</style>

