<template>
  <view class="rich-editor">
    <!-- 工具栏 -->
    <view class="toolbar">
      <view
        v-for="tool in toolbarItems"
        :key="tool.key"
        class="tool-item"
        :class="{ active: activeFormats[tool.key] }"
        @tap="applyFormat(tool.key)"
      >
        <text class="tool-icon">{{ tool.icon }}</text>
      </view>
    </view>

    <!-- 编辑区域 -->
    <editor
      class="editor-content"
      :placeholder="placeholder"
      :read-only="readonly"
      :show-img-size="true"
      :show-img-toolbar="true"
      :show-img-resize="true"
      @ready="onEditorReady"
      @input="onInput"
      @statuschange="onStatusChange"
    />

    <!-- 字数统计 -->
    <view class="word-count">
      <text class="count-text">{{ wordCount }} 字</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  maxLength?: number
}>(), {
  modelValue: '',
  placeholder: '开始创作你的故事...',
  readonly: false,
  maxLength: 50000,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

// 编辑器上下文
let editorCtx: any = null
const wordCount = ref(0)
const activeFormats = reactive<Record<string, boolean>>({
  bold: false,
  italic: false,
  underline: false,
})

// 工具栏配置
const toolbarItems = [
  { key: 'bold', icon: 'B' },
  { key: 'italic', icon: 'I' },
  { key: 'underline', icon: 'U' },
  { key: 'header1', icon: 'H1' },
  { key: 'header2', icon: 'H2' },
  { key: 'insertOrderedList', icon: '1.' },
  { key: 'insertUnorderedList', icon: '•' },
  { key: 'indent', icon: '→' },
  { key: 'outdent', icon: '←' },
]

function onEditorReady() {
  const query = uni.createSelectorQuery()
  query.select('.editor-content').context((res: any) => {
    editorCtx = res.context
    // 设置初始内容
    if (props.modelValue) {
      editorCtx.setContents({
        html: props.modelValue,
      })
    }
  }).exec()
}

function onInput(e: any) {
  const html = e.detail?.html || ''
  const text = e.detail?.text || ''
  wordCount.value = text.length
  emit('update:modelValue', html)
  emit('change', html)
}

function onStatusChange(e: any) {
  const formats = e.detail || {}
  Object.keys(activeFormats).forEach(key => {
    activeFormats[key] = !!formats[key]
  })
}

function applyFormat(key: string) {
  if (!editorCtx) return
  switch (key) {
    case 'bold':
    case 'italic':
    case 'underline':
      editorCtx.format('fontStyle', key)
      break
    case 'header1':
      editorCtx.format('header', 'h1')
      break
    case 'header2':
      editorCtx.format('header', 'h2')
      break
    case 'insertOrderedList':
    case 'insertUnorderedList':
      editorCtx.format(key)
      break
    case 'indent':
      editorCtx.format('indent', '+1')
      break
    case 'outdent':
      editorCtx.format('indent', '-1')
      break
  }
}
</script>

<style lang="scss" scoped>
.rich-editor {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid #e2e8f0;

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 4rpx;
    padding: 12rpx 16rpx;
    border-bottom: 1rpx solid #f0f2f5;
    background: #f8fafc;

    .tool-item {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8rpx;
      transition: all 0.2s;

      &.active {
        background: rgba(124, 106, 247, 0.15);
      }

      .tool-icon {
        font-size: 24rpx;
        font-weight: 600;
        color: #475569;
      }
    }
  }

  .editor-content {
    min-height: 400rpx;
    padding: 24rpx;
    font-size: 30rpx;
    line-height: 1.8;
    color: #1e293b;
  }

  .word-count {
    padding: 8rpx 24rpx;
    border-top: 1rpx solid #f0f2f5;
    text-align: right;

    .count-text {
      font-size: 22rpx;
      color: #94a3b8;
    }
  }
}
</style>

