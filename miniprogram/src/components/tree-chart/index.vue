<template>
  <view class="tree-chart-wrap">
    <!-- 工具栏 -->
    <view class="tree-toolbar">
      <view class="toolbar-left">
        <view class="tb-btn" :class="{ active: layout === 'LR' }" @tap="setLayout('LR')">
          <text class="tb-icon">⇒</text>
          <text class="tb-label">横向</text>
        </view>
        <view class="tb-btn" :class="{ active: layout === 'TB' }" @tap="setLayout('TB')">
          <text class="tb-icon">⇓</text>
          <text class="tb-label">纵向</text>
        </view>
      </view>
      <view class="toolbar-right">
        <view class="tb-btn" @tap="zoomIn"><text class="tb-icon">＋</text></view>
        <view class="tb-btn" @tap="zoomOut"><text class="tb-icon">－</text></view>
        <view class="tb-btn" @tap="resetZoom"><text class="tb-icon">⊙</text></view>
      </view>
    </view>

    <!-- ECharts Canvas 容器 -->
    <view class="canvas-container" :style="{ height: canvasHeight + 'px' }">
      <canvas
        id="treeCanvas"
        type="2d"
        class="tree-canvas"
        :style="{
          width: canvasWidth + 'px',
          height: canvasHeight + 'px',
          display: 'block'
        }"
        @ready="onCanvasReady"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      />
      <view v-if="chartLoading" class="chart-loading">
        <view class="loading-ring" />
        <text class="loading-txt">渲染中...</text>
      </view>
      <view v-if="!chartLoading && !hasData" class="chart-empty">
        <text class="empty-icon">🌱</text>
        <text class="empty-txt">暂无章节</text>
      </view>
    </view>

    <!-- 底部统计 -->
    <view class="tree-footer">
      <text class="footer-txt">共 {{ totalNodes }} 个节点 · 双指缩放 · 单指拖拽</text>
    </view>

    <!-- Bottom Sheet 遮罩 -->
    <view v-if="sheet.visible" class="sheet-mask" @tap="closeSheet" />

    <!-- Bottom Sheet 面板 -->
    <view v-if="sheet.visible" class="bottom-sheet sheet-show">
      <view class="sheet-handle" />

      <!-- 节点信息头部 -->
      <view class="sheet-header">
        <view class="sheet-node-icon">
          <text>{{ sheet.isDraft ? '📝' : (sheet.isLeaf ? '🍃' : '🌿') }}</text>
        </view>
        <view class="sheet-node-info">
          <text class="sheet-title">{{ sheet.title }}</text>
          <view class="sheet-meta">
            <text class="sheet-author">{{ sheet.author }}</text>
            <text v-if="sheet.rating > 0" class="sheet-rating">★ {{ sheet.rating }}</text>
            <view v-if="sheet.isDraft" class="sheet-draft-badge">草稿</view>
          </view>
        </view>
        <view class="sheet-close" @tap="closeSheet"><text>×</text></view>
      </view>

      <!-- 节点统计 -->
      <view class="sheet-stats">
        <view class="stat-item">
          <text class="stat-num">{{ sheet.readCount }}</text>
          <text class="stat-lbl">阅读</text>
        </view>
        <view class="stat-divider" />
        <view class="stat-item">
          <text class="stat-num">{{ sheet.commentCount }}</text>
          <text class="stat-lbl">评论</text>
        </view>
        <view class="stat-divider" />
        <view class="stat-item">
          <text class="stat-num">{{ sheet.branchCount }}</text>
          <text class="stat-lbl">分支</text>
        </view>
      </view>

      <!-- 操作按钮区 -->
      <view class="sheet-actions">
        <!-- 阅读章节：已发布节点所有人可见；草稿仅作者/协作者可见 -->
        <view
          v-if="!sheet.isDraft || props.isAuthorOrCollab"
          class="action-item action-read"
          @tap="onRead"
        >
          <text class="action-icon">📖</text>
          <text class="action-label">阅读章节</text>
          <text class="action-arrow">›</text>
        </view>

        <!-- 发布草稿：草稿节点 且（故事主创 或 节点作者本人） -->
        <view
          v-if="sheet.isDraft && canPublishDraft"
          class="action-item action-publish"
          @tap="onPublishDraft"
        >
          <text class="action-icon">📢</text>
          <text class="action-label">发布草稿</text>
          <text class="action-arrow">›</text>
        </view>

        <!-- 续写分支：已登录 且 故事主创或协作者 且 已发布节点 -->
        <view
          v-if="!sheet.isDraft && props.isLoggedIn && props.isAuthorOrCollab"
          class="action-item action-write"
          @tap="onWriteBranch"
        >
          <text class="action-icon">✍️</text>
          <text class="action-label">续写分支</text>
          <text class="action-arrow">›</text>
        </view>

        <!-- AI 创作：已登录 且 故事主创或协作者 且 已发布节点 -->
        <view
          v-if="!sheet.isDraft && props.isLoggedIn && props.isAuthorOrCollab"
          class="action-item action-ai"
          @tap="onAiCreate"
        >
          <text class="action-icon">🤖</text>
          <text class="action-label">AI 创作章节</text>
          <text class="action-arrow">›</text>
        </view>

        <!-- 删除章节：故事主创 或 节点作者本人 -->
        <view
          v-if="canDelete"
          class="action-item action-delete"
          @tap="onDelete"
        >
          <text class="action-icon">🗑️</text>
          <text class="action-label">删除章节</text>
          <text class="action-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick, getCurrentInstance } from 'vue'
import * as echartsStatic from 'echarts'
import type { Node } from '@/api/nodes'

// 在 setup 同步阶段保存 Vue 内部实例引用（稳定不变）
// $scope（微信原生组件实例）会在组件 attached 后注入，不能在此时直接取
const _internalInstance = getCurrentInstance()

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  rootNode?: Node | null
  isAuthorOrCollab?: boolean
  isLoggedIn?: boolean
  highlightNodeId?: number | null
  currentUserId?: number | null
  storyAuthorId?: number | null
}>()

// ─── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'node-tap', id: number): void
  (e: 'write-branch', id: number): void
  (e: 'ai-create', id: number): void
  (e: 'publish-draft', id: number): void
  (e: 'delete-node', id: number, title: string): void
}>()

// ─── State ────────────────────────────────────────────────────────────────────
const layout = ref<'LR' | 'TB'>('LR')
const chartLoading = ref(true)
const hasData = ref(false)

// 微信小程序原生组件（canvas）的 CSS 尺寸必须在首次渲染前就是有效的 px 值
// 如果初始值为 0，原生组件会以 0px 宽高完成首次定位，后续 CSS 变化无法修正位置
// 因此在 setup 同步阶段立即读取屏幕宽高作为初始值
const _initSys = uni.getSystemInfoSync()
const canvasWidth = ref(_initSys.windowWidth)
const canvasHeight = ref(Math.min(Math.max(_initSys.windowHeight * 0.55, 400), 600))
const totalNodes = ref(0)

let chartInstance: any = null
let currentZoom = 1

// Bottom Sheet 状态
const sheet = reactive({
  visible: false,
  nodeId: 0,
  title: '',
  author: '',
  rating: 0,
  readCount: 0,
  commentCount: 0,
  branchCount: 0,
  isDraft: false,
  isLeaf: false,
  authorId: 0,
})

// ─── Computed ─────────────────────────────────────────────────────────────────
const canPublishDraft = computed(() => {
  if (!props.currentUserId) return false
  return sheet.authorId === props.currentUserId ||
    (!!props.storyAuthorId && props.storyAuthorId === props.currentUserId)
})

const canDelete = computed(() => {
  if (!props.currentUserId) return false
  return sheet.authorId === props.currentUserId ||
    (!!props.storyAuthorId && props.storyAuthorId === props.currentUserId)
})

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function countNodes(node: Node | null | undefined): number {
  if (!node) return 0
  let count = 1
  if (node.children) {
    for (const c of node.children) count += countNodes(c)
  }
  return count
}

function nodeToEChartsData(node: Node, depth = 0): any {
  const isLeaf = !node.children || node.children.length === 0
  const isDraft = !node.is_published
  const name = node.title.length > 6 ? node.title.slice(0, 6) + '…' : node.title

  const itemStyle = isDraft
    ? { color: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2 }
    : isLeaf
      ? { color: '#F0FDF4', borderColor: '#4ADE80', borderWidth: 1.5 }
      : { color: '#EEF2FF', borderColor: '#818CF8', borderWidth: 1.5 }

  return {
    id: node.id,
    name,
    fullTitle: node.title,
    authorId: node.author_id,
    author: node.author?.username || '未知',
    rating: node.rating_avg ? Number(node.rating_avg).toFixed(1) : 0,
    readCount: node.read_count || 0,
    commentCount: (node as any).comment_count || node._count?.comments || 0,
    branchCount: node.children?.length || 0,
    isDraft,
    isLeaf,
    symbolSize: depth === 0 ? 14 : 10,
    itemStyle,
    label: {
      show: true,
      color: isDraft ? '#92400E' : '#374151',
      fontWeight: depth === 0 ? 'bold' : 'normal',
    },
    children: node.children?.map(c => nodeToEChartsData(c, depth + 1)) || [],
  }
}

// ─── WxCanvas 包装类（参考 echarts-for-weixin 源码）────────────────────────────
class WxCanvas {
  ctx: any
  canvasId: string
  chart: any
  canvasNode: any
  // ECharts/ZRender 初始化时会读取 style，必须提供空对象
  style: Record<string, any> = {}

  constructor(ctx: any, canvasId: string, canvasNode: any) {
    this.ctx = ctx
    this.canvasId = canvasId
    this.chart = null
    this.canvasNode = canvasNode
  }

  getContext(contextType: string) {
    if (contextType === '2d') return this.ctx
    return null
  }

  setChart(chart: any) {
    this.chart = chart
  }

  // ZRender 会调用这些 DOM 事件方法，小程序环境下用空实现
  // 触摸事件由我们在 onTouchStart/Move/End 中手动转发给 ZRender handler
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}

  // ZRender 还会调用 attachEvent/detachEvent（旧版兼容）
  attachEvent() {}
  detachEvent() {}

  set width(w: number) {
    if (this.canvasNode) this.canvasNode.width = w
  }
  set height(h: number) {
    if (this.canvasNode) this.canvasNode.height = h
  }
  get width() {
    return this.canvasNode ? this.canvasNode.width : 0
  }
  get height() {
    return this.canvasNode ? this.canvasNode.height : 0
  }
}

// ─── 初始化 ECharts ───────────────────────────────────────────────────────────

// canvas @ready 回调：微信小程序 type="2d" canvas 的 @ready 事件不携带 detail.canvas，
// 统一通过 SelectorQuery 获取 canvas 节点（这是唯一可靠的方式）
function onCanvasReady(_e: any) {
  queryCanvas()
}

function queryCanvas() {
  const wxScope = (_internalInstance as any)?.ctx?.$scope
  if (!wxScope) {
    console.error('微信原生组件实例($scope)不可用')
    chartLoading.value = false
    return
  }

  wx.createSelectorQuery().in(wxScope)
    .select('#treeCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      const canvasRes = res[0]
      if (!canvasRes || !canvasRes.node) {
        console.error('canvas 节点获取失败')
        chartLoading.value = false
        return
      }
      setupChart(canvasRes.node, canvasRes.width, canvasRes.height)
    })
}

function setupChart(canvasNode: any, width?: number, height?: number) {
  if (!props.rootNode) return

  const sys = uni.getSystemInfoSync()
  const dpr = sys.pixelRatio || 2
  // 优先用 SelectorQuery 返回的 CSS 尺寸（单位 px，逻辑像素）
  const w = width || sys.windowWidth
  const h = height || canvasHeight.value

  // 同步 canvas 的物理像素尺寸（必须设置，否则 type="2d" canvas 渲染尺寸不正确）
  canvasNode.width = w * dpr
  canvasNode.height = h * dpr

  // 更新 CSS 尺寸状态，让容器高度与 canvas 一致
  canvasWidth.value = w
  canvasHeight.value = h

  // 销毁旧实例
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }

  const ctx = canvasNode.getContext('2d')
  const wxCanvas = new WxCanvas(ctx, 'treeCanvas', canvasNode)

  echartsStatic.setCanvasCreator(() => wxCanvas)

  chartInstance = echartsStatic.init(wxCanvas as any, null, {
    width: w,
    height: h,
    devicePixelRatio: dpr,
  })

  wxCanvas.setChart(chartInstance)
  renderChart()
  chartLoading.value = false

  chartInstance.on('click', (params: any) => {
    if (params.data && params.data.id) {
      openSheet(params.data)
    }
  })
}

async function initChart() {
  if (!props.rootNode) {
    chartLoading.value = false
    hasData.value = false
    return
  }

  chartLoading.value = true
  hasData.value = true
  totalNodes.value = countNodes(props.rootNode)

  // @ready 事件会在 canvas 渲染完成后自动触发 onCanvasReady
  // 如果 canvas 已经存在（数据更新场景），直接走 queryCanvas fallback
  await nextTick()
  if (!chartInstance) {
    queryCanvas()
  }
}

// ─── 渲染 / 更新图表 ──────────────────────────────────────────────────────────
function renderChart() {
  if (!chartInstance || !props.rootNode) return

  const data = nodeToEChartsData(props.rootNode)
  const isHorizontal = layout.value === 'LR'
  const nodeCount = totalNodes.value || countNodes(props.rootNode)

  // 根据节点数量自动计算初始缩放，节点越多缩放越小，确保全部可见
  // 横向：节点深度决定宽度；纵向：叶子节点数决定高度
  // 经验值：每个节点约需 28px，画布宽/高约为 canvasWidth/canvasHeight
  const canvasW = canvasWidth.value || 375
  const canvasH = canvasHeight.value || 500
  const refSize = isHorizontal ? canvasH : canvasW
  const estimatedSpread = nodeCount * 22  // 每节点估算占用 22px
  const autoZoom = Math.min(1, refSize / Math.max(estimatedSpread, refSize))
  // 限制在合理范围内，不要太小
  const initZoom = Math.max(autoZoom, 0.25)

  // 如果用户没有手动调整过缩放，使用自动缩放
  if (currentZoom === 1) {
    currentZoom = initZoom
  }

  const option = {
    series: [
      {
        type: 'tree',
        data: [data],
        top: isHorizontal ? '5%' : '8%',
        left: isHorizontal ? '10%' : '5%',
        bottom: isHorizontal ? '5%' : '10%',
        right: isHorizontal ? '20%' : '5%',
        orient: layout.value,
        layout: 'orthogonal',
        initialTreeDepth: -1,
        roam: true,
        zoom: currentZoom,
        center: ['50%', '50%'],
        scaleLimit: { min: 0.1, max: 4 },
        symbolSize: 10,
        expandAndCollapse: false,
        animationDuration: 350,
        animationDurationUpdate: 400,
        lineStyle: {
          color: '#A5B4FC',
          width: 1.5,
          curveness: 0.1,
        },
        itemStyle: {
          color: '#EEF2FF',
          borderColor: '#818CF8',
          borderWidth: 1.5,
          shadowBlur: 3,
          shadowColor: 'rgba(99,102,241,0.15)',
        },
        label: {
          show: true,
          position: isHorizontal ? 'left' : 'top',
          verticalAlign: 'middle',
          align: isHorizontal ? 'right' : 'center',
          fontSize: 11,
          color: '#374151',
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          distance: isHorizontal ? 6 : 4,
        },
        leaves: {
          label: {
            position: isHorizontal ? 'right' : 'bottom',
            align: isHorizontal ? 'left' : 'center',
            fontSize: 11,
            color: '#374151',
            fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
            distance: isHorizontal ? 6 : 4,
          },
          itemStyle: {
            color: '#F0FDF4',
            borderColor: '#4ADE80',
            borderWidth: 1.5,
          },
        },
        emphasis: {
          focus: 'ancestor',
          itemStyle: {
            color: '#6366F1',
            borderColor: '#4338CA',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(99,102,241,0.5)',
          },
          lineStyle: { color: '#6366F1', width: 2.5 },
        },
      },
    ],
  }

  chartInstance.setOption(option, { notMerge: true })
}

// ─── 触摸事件（参考 echarts-for-weixin 实现）──────────────────────────────────
function wrapTouch(event: any) {
  for (let i = 0; i < event.touches.length; i++) {
    const touch = event.touches[i]
    touch.offsetX = touch.x
    touch.offsetY = touch.y
  }
  // ECharts 内部（如 RoamController）会调用 event.preventDefault/stopPropagation
  if (!event.preventDefault) event.preventDefault = () => {}
  if (!event.stopPropagation) event.stopPropagation = () => {}
  return event
}

function onTouchStart(e: any) {
  if (!chartInstance) return
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    const handler = chartInstance.getZr().handler
    const evt = { zrX: touch.x, zrY: touch.y, preventDefault: () => {}, stopPropagation: () => {} }
    handler.dispatch('mousedown', evt)
    handler.dispatch('mousemove', evt)
    handler.processGesture(wrapTouch(e), 'start')
  }
}

function onTouchMove(e: any) {
  if (!chartInstance) return
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    const handler = chartInstance.getZr().handler
    const evt = { zrX: touch.x, zrY: touch.y, preventDefault: () => {}, stopPropagation: () => {} }
    handler.dispatch('mousemove', evt)
    handler.processGesture(wrapTouch(e), 'change')
  }
}

function onTouchEnd(e: any) {
  if (!chartInstance) return
  const touch = e.changedTouches ? e.changedTouches[0] : { x: 0, y: 0 }
  const handler = chartInstance.getZr().handler
  const evt = { zrX: touch.x, zrY: touch.y, preventDefault: () => {}, stopPropagation: () => {} }
  handler.dispatch('mouseup', evt)
  handler.dispatch('click', evt)
  handler.processGesture(wrapTouch(e), 'end')
}

// ─── 工具栏操作 ───────────────────────────────────────────────────────────────
function setLayout(l: 'LR' | 'TB') {
  layout.value = l
  currentZoom = 1  // 重置为1，让renderChart重新计算自动缩放
  renderChart()
}

function zoomIn() {
  currentZoom = Math.min(currentZoom * 1.3, 4)
  chartInstance?.setOption({ series: [{ zoom: currentZoom }] })
}

function zoomOut() {
  currentZoom = Math.max(currentZoom / 1.3, 0.1)
  chartInstance?.setOption({ series: [{ zoom: currentZoom }] })
}

function resetZoom() {
  currentZoom = 1  // 重置为1，让renderChart重新计算自动缩放
  renderChart()
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function openSheet(data: any) {
  sheet.nodeId = data.id
  sheet.title = data.fullTitle || data.name
  sheet.author = data.author || '未知'
  sheet.rating = data.rating || 0
  sheet.readCount = data.readCount || 0
  sheet.commentCount = data.commentCount || 0
  sheet.branchCount = data.branchCount || 0
  sheet.isDraft = !!data.isDraft
  sheet.isLeaf = !!data.isLeaf
  sheet.authorId = data.authorId || 0
  sheet.visible = true
}

function closeSheet() {
  sheet.visible = false
}

function onRead() {
  const id = sheet.nodeId
  closeSheet()
  emit('node-tap', id)
}

function onPublishDraft() {
  const id = sheet.nodeId
  closeSheet()
  emit('publish-draft', id)
}

function onWriteBranch() {
  const id = sheet.nodeId
  closeSheet()
  emit('write-branch', id)
}

function onAiCreate() {
  const id = sheet.nodeId
  closeSheet()
  emit('ai-create', id)
}

function onDelete() {
  const id = sheet.nodeId
  const title = sheet.title
  closeSheet()
  emit('delete-node', id, title)
}

// ─── 监听数据变化 ─────────────────────────────────────────────────────────────
watch(
  () => props.rootNode,
  (newVal) => {
    if (newVal) {
      totalNodes.value = countNodes(newVal)
      if (chartInstance) {
        renderChart()
      } else {
        initChart()
      }
    }
  },
  { deep: false }
)

// ─── 高亮新节点（新写入时短暂高亮） ──────────────────────────────────────────
watch(
  () => props.highlightNodeId,
  (id) => {
    if (!id || !chartInstance) return
    // ECharts tree 系列通过 name 或 dataIndex 高亮，这里通过节点 id 找到对应 name
    // 由于 tree 系列不支持直接按 id 高亮，用 dispatchAction 指定 name
    const findName = (node: Node | null | undefined): string | null => {
      if (!node) return null
      if (node.id === id) return node.title.length > 6 ? node.title.slice(0, 6) + '…' : node.title
      if (node.children) {
        for (const c of node.children) {
          const found = findName(c)
          if (found) return found
        }
      }
      return null
    }
    const name = findName(props.rootNode)
    if (name) {
      chartInstance.dispatchAction({ type: 'highlight', seriesIndex: 0, name })
      setTimeout(() => {
        chartInstance?.dispatchAction({ type: 'downplay', seriesIndex: 0, name })
      }, 2500)
    }
  }
)

// ─── 生命周期 ─────────────────────────────────────────────────────────────────
onMounted(() => {
  nextTick(() => {
    // canvasWidth/canvasHeight 已在 setup 同步阶段用 getSystemInfoSync 初始化
    // 这里只做精确修正：查询容器实际宽度（考虑页面内边距等）
    const wxScope = (_internalInstance as any)?.ctx?.$scope
    if (wxScope) {
      wx.createSelectorQuery().in(wxScope)
        .select('.canvas-container')
        .boundingClientRect((rect: any) => {
          if (rect && rect.width > 0) {
            canvasWidth.value = rect.width
          }
          initChart()
        })
        .exec()
    } else {
      initChart()
    }
  })
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style lang="scss" scoped>
.tree-chart-wrap {
  position: relative;
}

/* ── 工具栏 ── */
.tree-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx 16rpx;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8rpx;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 8rpx 18rpx;
  border-radius: 20rpx;
  background: #f1f5f9;
  border: 1rpx solid #e2e8f0;

  &.active {
    background: rgba(124, 106, 247, 0.12);
    border-color: #7c6af7;
  }

  .tb-icon {
    font-size: 28rpx;
    color: #64748b;
    line-height: 1;
  }

  .tb-label {
    font-size: 22rpx;
    color: #64748b;
  }

  &.active .tb-icon,
  &.active .tb-label {
    color: #7c6af7;
    font-weight: 600;
  }
}

/* ── Canvas 容器 ── */
.canvas-container {
  position: relative;
  width: 100%;
  border-radius: 16rpx;
  overflow: hidden;
  background: #fafbff;
  border: 1rpx solid #e8eaf6;
}

.tree-canvas {
  display: block;
}

.chart-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(250, 251, 255, 0.9);
  gap: 16rpx;

  .loading-ring {
    width: 56rpx;
    height: 56rpx;
    border: 4rpx solid #e0e7ff;
    border-top-color: #7c6af7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-txt {
    font-size: 24rpx;
    color: #94a3b8;
  }
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;

  .empty-icon { font-size: 72rpx; }
  .empty-txt { font-size: 28rpx; color: #94a3b8; }
}

/* ── 底部统计 ── */
.tree-footer {
  padding: 12rpx 4rpx 0;
  text-align: center;

  .footer-txt {
    font-size: 22rpx;
    color: #cbd5e1;
  }
}

/* ── Bottom Sheet 遮罩 ── */
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 900;
}

/* ── Bottom Sheet 面板 ── */
.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 901;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 0 0 env(safe-area-inset-bottom);
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.12);
}

.sheet-handle {
  width: 60rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: #e2e8f0;
  margin: 16rpx auto 0;
}

/* ── Sheet 头部 ── */
.sheet-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.sheet-node-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(124, 106, 247, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  text { font-size: 36rpx; }
}

.sheet-node-info {
  flex: 1;
  min-width: 0;
}

.sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1e293b;
  display: block;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.sheet-author { font-size: 24rpx; color: #64748b; }
.sheet-rating { font-size: 24rpx; color: #f59e0b; }

.sheet-draft-badge {
  background: rgba(245, 158, 11, 0.12);
  border-radius: 8rpx;
  padding: 2rpx 10rpx;
  font-size: 20rpx;
  color: #d97706;
}

.sheet-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  text { font-size: 32rpx; color: #94a3b8; line-height: 1; }
}

/* ── Sheet 统计 ── */
.sheet-stats {
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid #f1f5f9;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;

  .stat-num { font-size: 32rpx; font-weight: 700; color: #1e293b; }
  .stat-lbl { font-size: 22rpx; color: #94a3b8; }
}

.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: #e2e8f0;
}

/* ── Sheet 操作区 ── */
.sheet-actions {
  padding: 8rpx 0 16rpx;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  position: relative;

  &:active { background: #f8fafc; }

  &::after {
    content: '';
    position: absolute;
    left: 80rpx;
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: #f1f5f9;
  }

  &:last-child::after { display: none; }
}

.action-icon {
  font-size: 36rpx;
  width: 48rpx;
  text-align: center;
  flex-shrink: 0;
}

.action-label { flex: 1; font-size: 28rpx; color: #1e293b; }
.action-arrow { font-size: 32rpx; color: #cbd5e1; }

.action-publish .action-label { color: #059669; font-weight: 600; }
.action-write .action-label { color: #475569; }
.action-ai .action-label { color: #7c6af7; font-weight: 600; }
.action-delete .action-label { color: #ef4444; }
.action-delete .action-arrow { color: #fca5a5; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

