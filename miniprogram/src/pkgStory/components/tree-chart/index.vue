<template>
  <view class="tree-chart-wrap">
    <!-- 工具栏 -->
    <view class="tree-toolbar">
      <view class="toolbar-left">
        <view class="tb-btn" :class="{ active: layout === 'TB' }" @tap="setLayout('TB')">
          <text class="tb-icon">⇓</text>
          <text class="tb-label">纵向</text>
        </view>
        <view class="tb-btn" :class="{ active: layout === 'LR' }" @tap="setLayout('LR')">
          <text class="tb-icon">⇒</text>
          <text class="tb-label">横向</text>
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
      <!-- 微信原生组件 canvas 无法被普通 view 覆盖（始终在最上层）
           任何弹窗/遮罩显示期间必须用 v-if 完全卸载 canvas，否则会穿透弹窗 -->
      <canvas
        v-if="!hideCanvas && !sheet.visible"
        id="treeCanvas"
        type="2d"
        class="tree-canvas"
        :style="'width:' + canvasWidth + 'px;height:' + canvasHeight + 'px;display:block;'"
        @ready="onCanvasReady"
        @touchstart="onTouchStart"
        @touchmove.stop="onTouchMove"
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
          <text class="icon-text">{{ sheet.isDraft ? '📝' : (sheet.isLeaf ? '🍃' : '🌿') }}</text>
        </view>
        <view class="sheet-node-info">
          <text class="sheet-title">{{ sheet.title }}</text>
          <view class="sheet-meta">
            <text class="sheet-author">{{ sheet.author }}</text>
            <text v-if="sheet.rating > 0" class="sheet-rating">★ {{ sheet.rating }}</text>
            <view v-if="sheet.isDraft" class="sheet-draft-badge">草稿</view>
          </view>
        </view>
        <view class="sheet-close" @tap="closeSheet"><text class="close-text">×</text></view>
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
        <view class="stat-divider" />
        <view class="stat-item">
          <text class="stat-num stat-rating">{{ sheet.rating > 0 ? sheet.rating : '-' }}</text>
          <text class="stat-lbl">评分</text>
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

        <!-- 续写分支：已登录 且 故事主创或协作者（草稿节点同样允许续写，与网页端一致） -->
        <view
          v-if="props.isLoggedIn && props.isAuthorOrCollab"
          class="action-item action-write"
          @tap="onWriteBranch"
        >
          <text class="action-icon">✍️</text>
          <text class="action-label">续写分支</text>
          <text class="action-arrow">›</text>
        </view>

        <!-- AI 创作：已登录 且 故事主创或协作者（草稿节点同样允许 AI 创作，与网页端一致） -->
        <view
          v-if="props.isLoggedIn && props.isAuthorOrCollab"
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
import * as echartsStatic from 'echarts/core'
import { TreeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { Node } from '@/api/nodes'

echartsStatic.use([TreeChart, CanvasRenderer])

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
  /** 为 true 时隐藏 canvas（微信原生组件无法被普通 view 覆盖，弹窗显示期间需隐藏） */
  hideCanvas?: boolean
  /**
   * canvas 最大高度（px）。微信原生 canvas 不受 CSS overflow 约束，
   * 必须从源头限制 canvas 物理尺寸，让它不超出父容器。
   * 传入面板可用高度，组件会在此范围内自动计算 zoom 让所有节点可见。
   */
  maxHeight?: number
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
const layout = ref<'LR' | 'TB'>('TB')
const chartLoading = ref(true)
const hasData = ref(false)

// 微信小程序原生组件（canvas）的 CSS 尺寸必须在首次渲染前就是有效的 px 值
// 如果初始值为 0，原生组件会以 0px 宽高完成首次定位，后续 CSS 变化无法修正位置
// 优先使用父组件传入的 maxHeight 作为初始高度（最准确），
// 没有传入时才用屏幕高度的 55% 作为保守 fallback
// 注意：初始值同样要减去组件内部工具栏(44px)和底部统计(32px)，与 calcCanvasHeight 一致
const _INIT_TOOLBAR = 44
const _INIT_FOOTER  = 32
const _initSys = uni.getSystemInfoSync()
const canvasWidth = ref(_initSys.windowWidth)
const canvasHeight = ref(
  (props.maxHeight && props.maxHeight > 0)
    ? Math.max(props.maxHeight - _INIT_TOOLBAR - _INIT_FOOTER, 200)
    : Math.min(Math.max(_initSys.windowHeight * 0.55 - _INIT_TOOLBAR - _INIT_FOOTER, 200), 550)
)
const totalNodes = ref(0)

let chartInstance: any = null
// 初始值为 0：renderChart 里 currentZoom <= 0 时会调用 calcInitialZoom 计算自适应 zoom，
// 确保首次渲染和重置视图走完全相同的代码路径，两者结果一致
let currentZoom = 0
let _canvasNode: any = null  // 保存 canvas 节点引用，供 resize 时更新物理像素尺寸
let _destroyed = false       // 组件已销毁标记，防止异步回调在页面跳转后继续操作
const _pendingTimers: ReturnType<typeof setTimeout>[] = []  // 追踪所有定时器，销毁时统一清理
// canvas 高度上限（由父容器 .tree-chart-wrap 的实际高度决定，onMounted 时查询）
// 优先使用 props.maxHeight（父组件传入，最准确），否则用屏幕高度的 55% 作为 fallback
// 同样需要减去组件内部工具栏和底部统计高度
let _maxCanvasHeight = (props.maxHeight && props.maxHeight > 0)
  ? Math.max(props.maxHeight - _INIT_TOOLBAR - _INIT_FOOTER, 200)
  : Math.round(_initSys.windowHeight * 0.55) - _INIT_TOOLBAR - _INIT_FOOTER
// onMounted 完成 boundingClientRect 宽度修正后置为 true
// @ready 触发时若此标志未就绪，说明 onMounted 还没到，忽略（onMounted 会主动调用 initChart）
let _mountInitDone = false

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
// 安全定时器：自动追踪，组件销毁后不再执行回调
function safeTimeout(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    const idx = _pendingTimers.indexOf(id)
    if (idx !== -1) _pendingTimers.splice(idx, 1)
    if (_destroyed) return
    fn()
  }, ms)
  _pendingTimers.push(id)
}
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

// ─── WxCanvas 包装类（完全对齐 echarts-for-weixin 官方 wx-canvas.js）──────────
class WxCanvas {
  ctx: any
  canvasId: string
  chart: any
  canvasNode: any

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

  // ZRender HandlerDomProxy 初始化时会调用 addEventListener/removeEventListener
  // 微信小程序不需要 ZRender 自动绑定 DOM 事件（我们手动转发 touch 事件），用空实现
  addEventListener() {}
  removeEventListener() {}
  // 旧版 ZRender 兼容
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
// 注意：@ready 可能在 onMounted 的 boundingClientRect 修正宽度之前触发，
// 此时 _mountInitDone 为 false，忽略这次调用，等 onMounted 主动调用 initChart()。
function onCanvasReady(_e: any) {
  if (!_mountInitDone) return
  queryCanvas()
}

function queryCanvas() {
  if (_destroyed) return
  const wxScope = (_internalInstance as any)?.ctx?.$scope
  if (!wxScope) {
    console.error('[TreeChart][queryCanvas] wxScope 不可用')
    chartLoading.value = false
    return
  }

  wx.createSelectorQuery().in(wxScope)
    .select('#treeCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (_destroyed) return
      const canvasRes = res[0]
      if (!canvasRes || !canvasRes.node) {
        console.error('[TreeChart][queryCanvas] canvas 节点获取失败, res:', JSON.stringify(res))
        chartLoading.value = false
        return
      }
      setupChart(canvasRes.node)
    })
}

function setupChart(canvasNode: any, width?: number, height?: number) {
  if (_destroyed || !props.rootNode) return

  const sys = uni.getSystemInfoSync()
  const dpr = sys.pixelRatio || 2
  const w = (width && width > 0) ? width : (canvasWidth.value || sys.windowWidth)

  // 直接用 calcCanvasHeight 计算正确高度
  canvasWidth.value = w
  const h = calcCanvasHeight(props.rootNode)

  // 设置 canvas 物理像素尺寸
  canvasNode.width  = w * dpr
  canvasNode.height = h * dpr

  canvasWidth.value  = w
  canvasHeight.value = h

  // 销毁旧实例
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  _canvasNode = canvasNode
  const ctx = canvasNode.getContext('2d')
  const wxCanvas = new WxCanvas(ctx, 'treeCanvas', canvasNode)

  echartsStatic.setPlatformAPI({ createCanvas: () => wxCanvas as any })

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

// 计算叶子节点数（决定横向布局时树的高度 / 纵向布局时树的宽度）
function leafCount(node: Node | null | undefined): number {
  if (!node) return 0
  if (!node.children || node.children.length === 0) return 1
  return node.children.reduce((s, c) => s + leafCount(c), 0)
}

// 计算树的最大深度（决定横向布局时树的宽度 / 纵向布局时树的高度）
function treeDepth(node: Node | null | undefined, d = 0): number {
  if (!node) return d
  if (!node.children || node.children.length === 0) return d + 1
  return Math.max(...node.children.map(c => treeDepth(c, d + 1)))
}

// tree-chart-wrap 内部固定占用的高度（工具栏 + 底部统计），canvas 不能超过剩余空间
// 这两个值与 .tree-toolbar（padding-bottom:16rpx + 按钮约28px≈44px）
// 和 .tree-footer（line-height约36px）的实际渲染高度对应
const INTERNAL_TOOLBAR_H = 44  // .tree-toolbar 高度（px）
const INTERNAL_FOOTER_H  = 32  // .tree-footer 高度（px）

// 根据树的结构动态计算 canvas 高度，确保每个节点都有足够的物理空间
// canvas 高度 = 父组件传入的可用高度 - 组件内部工具栏 - 底部统计
// 微信原生 canvas 不受 CSS overflow 约束，必须从源头限制物理尺寸
function calcCanvasHeight(_rootNode: Node): number {
  // 优先使用父组件传入的 maxHeight，其次用 onMounted 查询到的 _maxCanvasHeight
  const maxH = (props.maxHeight && props.maxHeight > 0) ? props.maxHeight : _maxCanvasHeight
  // 减去组件内部工具栏和底部统计占用的高度，留给 canvas 的净高度
  const canvasH = maxH - INTERNAL_TOOLBAR_H - INTERNAL_FOOTER_H
  return Math.max(canvasH, 200)
}

// 计算初始 zoom（初始化和重置视图时使用）
//
// 核心设计原则：
// 1. 【节点可读优先】每个节点必须有足够的物理间距，确保用户能点击和阅读标签
// 2. 【节点少时铺满】节点数量少时，自动放大让树铺满整个容器（不留大量空白）
// 3. 【节点多时可拖拽】节点数量多时，不追求一屏显示所有节点，
//    保持合理间距让用户通过拖拽/缩放查看完整树
// 4. 【纵/横向一致】纵向和横向使用相同的节点间距标准，视觉感受一致
//
// ECharts tree 系列的 zoom 是相对于"默认布局"的缩放比。
// 默认布局下，ECharts 会把树铺满整个 canvas 区域（top/left/bottom/right 留白内），
// zoom=1 时已经是"铺满"状态，zoom>1 会让树缩小（节点间距增大），zoom<1 会放大。
//
// 注意：ECharts tree 的 zoom 语义与普通图表相反——
// zoom 越大，树在 canvas 中越小（因为"视口"变大了），节点间距越大。
// zoom=2 时，树占 canvas 的 1/2，每个节点占据的物理空间是 zoom=1 时的 2 倍。
function calcInitialZoom(rootNode: Node): number {
  const leaves = leafCount(rootNode)
  const depth  = treeDepth(rootNode)
  const canvasH = calcCanvasHeight(rootNode)
  const W      = canvasWidth.value || uni.getSystemInfoSync().windowWidth

  const MIN_H = 44  // 高度方向最小间距（px）
  const MIN_W = 60  // 宽度方向最小间距（px）

  // ECharts 默认布局（zoom=1）下的可用区域，必须与 renderChart 中的留白一致：
  // 纵向(TB)：top=10%,bottom=20%,left=5%,right=5%  → 可用高=70%×canvasH，可用宽=90%×W
  // 横向(LR)：top=5%,bottom=5%,left=15%,right=20%  → 可用高=90%×canvasH，可用宽=65%×W
  let zoomForH: number
  let zoomForW: number

  if (layout.value === 'LR') {
    const availH = canvasH * 0.90
    const availW = W * 0.65
    zoomForH = (leaves > 1) ? (MIN_H * leaves) / availH : 1
    zoomForW = (depth > 1)  ? (MIN_W * depth)  / availW : 1
  } else {
    const availH = canvasH * 0.70
    const availW = W * 0.90
    zoomForH = (depth > 1)  ? (MIN_H * depth)  / availH : 1
    zoomForW = (leaves > 1) ? (MIN_W * leaves)  / availW : 1
  }

  const minZoom = Math.max(zoomForH, zoomForW)

  // zoom 限制在 [1.0, 3.0]
  return Math.max(1.0, Math.min(minZoom, 3.0))
}

function renderChart() {
  if (!chartInstance || !props.rootNode) return

  const data = nodeToEChartsData(props.rootNode)
  const isHorizontal = layout.value === 'LR'

  // canvas 高度固定为面板可用高度，不随节点数量变化
  const newH = calcCanvasHeight(props.rootNode)
  if (Math.abs(newH - canvasHeight.value) > 20) {
    canvasHeight.value = newH
    const dpr = uni.getSystemInfoSync().pixelRatio || 2
    if (_canvasNode) {
      _canvasNode.height = newH * dpr
    }
    // resize 后需要强制重绘，微信小程序 canvas 不会自动响应
    chartInstance.resize({ width: canvasWidth.value, height: newH })
  }

  // currentZoom <= 0 表示需要重新计算自适应 zoom（初始化或重置时）
  // 否则保留用户手动缩放的值
  const isReset = currentZoom <= 0
  if (isReset) {
    currentZoom = calcInitialZoom(props.rootNode)
  }

  // 重置时不设置 center，完全依赖 top/left/bottom/right 留白来定位根节点。
  // ECharts tree 的布局规则：根节点始终位于绘图区域的"起始端"：
  //   纵向(TB)：根节点在 top 留白处，叶子在 bottom 留白处
  //   横向(LR)：根节点在 left 留白处，叶子在 right 留白处
  // 使用百分比留白，与 calcInitialZoom 中的可用区域计算保持一致。
  // 纵向 top 留 10%：给根节点标签（position:top, 约 15px）足够空间，避免被工具栏遮挡。
  // 纵向 bottom 留 20%：给叶子节点标签（position:bottom）足够空间。
  // 非重置时：setOption notMerge=false，ECharts 会保留上次的 roam pan 偏移，
  // 视图位置不会改变。

  const option: any = {
    series: [
      {
        type: 'tree',
        data: [data],
        // 留白必须与 calcInitialZoom 中的可用区域计算一致：
        // TB: top=10%,bottom=20%,left=5%,right=5%  → 可用 70%×H, 90%×W
        // LR: top=5%,bottom=5%,left=15%,right=20%  → 可用 90%×H, 65%×W
        top:    isHorizontal ? '5%'   : '10%',
        left:   isHorizontal ? '15%'  : '5%',
        bottom: isHorizontal ? '5%'   : '20%',
        right:  isHorizontal ? '20%'  : '5%',
        orient: layout.value,
        layout: 'orthogonal',
        initialTreeDepth: -1,
        roam: true,
        zoom: currentZoom,
        scaleLimit: { min: 0.1, max: 5 },
        symbolSize: 10,
        expandAndCollapse: false,
        animationDuration: 300,
        animationDurationUpdate: 350,
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

// ─── 触摸事件（完全对齐 echarts-for-weixin 官方实现）────────────────────────────

// 构造一个 ZRender dispatch 可安全使用的事件对象
// ZRender 内部（如 RoamController）会对事件调用 preventDefault/stopPropagation，
// 裸对象没有这些方法会报错，必须提供空实现
function makeZrEvent(x: number, y: number): any {
  return {
    zrX: x,
    zrY: y,
    preventDefault: () => {},
    stopPropagation: () => {},
    cancelBubble: true,
  }
}

// 给每个 touch 设置 offsetX/offsetY，供 ZRender GestureMgr 的 clientToLocal 使用
// 同时给 event 本身加上 zrX/zrY（供 processGesture 内部 findHover 使用）
// 以及 preventDefault/stopPropagation（供 RoamController 内部 stop() 调用）
function wrapTouch(event: any) {
  for (let i = 0; i < event.touches.length; i++) {
    const touch = event.touches[i]
    touch.offsetX = touch.x
    touch.offsetY = touch.y
  }
  // 用第一个触点坐标作为事件的主坐标
  if (event.touches.length > 0) {
    event.zrX = event.touches[0].x
    event.zrY = event.touches[0].y
  }
  // ZRender 内部 stop() 会调用这两个方法，微信 touch 事件没有，必须补充
  if (!event.preventDefault) event.preventDefault = () => {}
  if (!event.stopPropagation) event.stopPropagation = () => {}
  return event
}

// 双指缩放：记录上一次两指间距，用于计算缩放比例
let _lastPinchDist = 0
// 单指点击判断：记录 touchstart 的坐标，touchend 时比较位移
// 位移 < TAP_THRESHOLD 才认为是点击（而非拖拽），避免拖拽时误触节点
let _tapStartX = 0
let _tapStartY = 0
const TAP_THRESHOLD = 8  // px，超过此位移认为是拖拽

function onTouchStart(e: any) {
  if (!chartInstance || e.touches.length === 0) return
  const handler = chartInstance.getZr().handler
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    _tapStartX = touch.x
    _tapStartY = touch.y
    handler.dispatch('mousedown', makeZrEvent(touch.x, touch.y))
    handler.dispatch('mousemove', makeZrEvent(touch.x, touch.y))
    handler.processGesture(wrapTouch(e), 'start')
  } else if (e.touches.length === 2) {
    // 双指：先取消第一根手指触发的拖拽状态，再记录初始间距
    // 微信小程序双指 touchstart 会先触发一次 touches.length=1，再触发一次 touches.length=2
    // 第一次已经 dispatch 了 mousedown，这里发 mouseup 取消拖拽，避免干扰 pinch
    const t0 = e.touches[0]
    handler.dispatch('mouseup', makeZrEvent(t0.x, t0.y))
    const t1 = e.touches[1]
    const dx = t1.x - t0.x
    const dy = t1.y - t0.y
    _lastPinchDist = Math.sqrt(dx * dx + dy * dy)
  }
}

function onTouchMove(e: any) {
  if (!chartInstance || e.touches.length === 0) return
  const handler = chartInstance.getZr().handler
  if (e.touches.length === 1) {
    // 单指：派发 mousemove 触发拖拽
    const touch = e.touches[0]
    handler.dispatch('mousemove', makeZrEvent(touch.x, touch.y))
    handler.processGesture(wrapTouch(e), 'change')
  } else if (e.touches.length === 2) {
    // 双指：手动计算缩放比例，直接用 dispatchAction 缩放
    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const dx = t1.x - t0.x
    const dy = t1.y - t0.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (_lastPinchDist > 0) {
      const scale = dist / _lastPinchDist
      // 限制每次缩放幅度，避免过于灵敏
      const clampedScale = Math.max(0.85, Math.min(1.15, scale))
      currentZoom = Math.max(0.1, Math.min(4, currentZoom * clampedScale))
      chartInstance.setOption({ series: [{ zoom: currentZoom }] })
    }
    _lastPinchDist = dist
  }
}

function onTouchEnd(e: any) {
  if (!chartInstance) return
  const wasPinch = _lastPinchDist > 0
  _lastPinchDist = 0
  const touch = e.changedTouches?.[0] || { x: 0, y: 0 }
  const handler = chartInstance.getZr().handler

  handler.dispatch('mouseup', makeZrEvent(touch.x, touch.y))
  handler.processGesture(wrapTouch(e), 'end')

  // 双指缩放结束时不触发 click，避免误触节点
  if (wasPinch) return

  // 判断是否为点击（而非拖拽）：位移 < TAP_THRESHOLD 才认为是点击
  const dx = touch.x - _tapStartX
  const dy = touch.y - _tapStartY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > TAP_THRESHOLD) return

  // 延迟一帧再触发 click，确保 ZRender 完成 mouseup 的拖拽状态清理（isDragging=false）
  // 否则 ZRender 内部会将 click 判断为拖拽结束而忽略 hitTest
  const tapX = touch.x
  const tapY = touch.y
  safeTimeout(() => {
    if (!chartInstance) return
    chartInstance.getZr().handler.dispatch('click', makeZrEvent(tapX, tapY))
  }, 16)
}

// ─── 工具栏操作 ───────────────────────────────────────────────────────────────
function setLayout(l: 'LR' | 'TB') {
  layout.value = l
  currentZoom = 0  // 置0触发 renderChart 里重新计算自适应 zoom
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
  if (!chartInstance || !props.rootNode) return
  // 置0触发 renderChart 里重新计算自适应 zoom
  currentZoom = 0
  // renderChart 会用 notMerge:true 完整重设 option（包含 zoom 和 center），
  // 相当于完全重置视图，不需要单独调用 restore
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

// ─── 监听弹窗状态变化：canvas 重新出现时需重新初始化图表 ─────────────────────
// 微信原生 canvas 组件被 v-if 卸载后，DOM 节点被销毁，重新显示时必须重新 query + init
// 注意：重建时【不重置 currentZoom】，保留用户上次的缩放比例，
// 这样关闭 sheet 后视图缩放程度与点击前一致（pan 偏移因实例销毁无法恢复，但缩放可以保留）
function reinitCanvasIfNeeded() {
  if (_destroyed || !props.rootNode) return
  chartInstance?.dispose()
  chartInstance = null
  _canvasNode = null
  // currentZoom 保持不变，不置 0，重建后 renderChart 会用上次的 zoom 值
  nextTick(() => {
    if (_destroyed) return
    queryCanvas()
  })
}

watch(
  () => props.hideCanvas,
  (hidden) => {
    // 只在 hideCanvas 从 true→false 时恢复，且 sheet 也未显示
    if (!hidden && !sheet.visible) {
      reinitCanvasIfNeeded()
    }
  }
)

watch(
  () => sheet.visible,
  (visible) => {
    if (!visible) {
      // sheet 关闭时，closeSheet() 和 emit() 是同步执行的：
      // 例如 onAiCreate() 先 closeSheet()，再 emit('ai-create')，父组件响应后设置 hideCanvas=true。
      // 但父组件的 prop 更新是异步的，此时 props.hideCanvas 可能还是 false（旧值），
      // 导致误判为"需要重建 canvas"，而实际上 canvas 马上就会被 hideCanvas 卸载。
      // 等一个 nextTick 让父组件的 prop 更新完成，再检查 hideCanvas 状态。
      nextTick(() => {
        if (!props.hideCanvas) {
          reinitCanvasIfNeeded()
        }
      })
    }
  }
)

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
      safeTimeout(() => {
        chartInstance?.dispatchAction({ type: 'downplay', seriesIndex: 0, name })
      }, 2500)
    }
  }
)

// ─── 生命周期 ─────────────────────────────────────────────────────────────────

// 查询容器尺寸并初始化图表
// retryOnZeroHeight=true 时，若查到容器宽度为 0（布局未稳定），500ms 后重试一次
function _doMountInit(retryOnZeroHeight = true) {
  if (_destroyed) return
  const wxScope = (_internalInstance as any)?.ctx?.$scope
  if (!wxScope) {
    console.warn('[TreeChart] wxScope 不可用，跳过 boundingClientRect 查询，直接 initChart')
    _mountInitDone = true
    initChart()
    return
  }

  wx.createSelectorQuery().in(wxScope)
    .select('.canvas-container')
    .boundingClientRect()
    .exec((res: any) => {
      if (_destroyed) return
      const containerRect = res[0]
      const gotWidth = containerRect && containerRect.width > 0

      if (gotWidth) {
        canvasWidth.value = containerRect.width
      } else if (retryOnZeroHeight) {
        // 布局未稳定，500ms 后重试（不再继续重试，避免死循环）
        console.warn('[TreeChart] 容器宽度为0，500ms后重试')
        safeTimeout(() => _doMountInit(false), 500)
        return
      } else {
        console.warn('[TreeChart] 重试后容器宽度仍为0，使用默认宽度:', canvasWidth.value)
      }

      // 优先使用 props.maxHeight（父组件传入的可用高度，最可靠）
      if (props.maxHeight && props.maxHeight > 0) {
        _maxCanvasHeight = Math.max(props.maxHeight - INTERNAL_TOOLBAR_H - INTERNAL_FOOTER_H, 200)
      } else {
        // 没有传 maxHeight：用屏幕高度的 50% 作为保守 fallback
        const sys = uni.getSystemInfoSync()
        _maxCanvasHeight = Math.max(Math.round(sys.windowHeight * 0.5) - INTERNAL_TOOLBAR_H - INTERNAL_FOOTER_H, 200)
      }

      // 宽度修正完成，允许 @ready 触发的 queryCanvas 正常执行
      _mountInitDone = true
      initChart()
    })
}

onMounted(() => {
  // 延迟 300ms 再初始化：
  // 1. 组件挂载时父页面布局可能尚未稳定（图片、文字还在渲染）
  // 2. canvas 的 @ready 事件会在此之前触发，通过 _mountInitDone 标志位阻止提前初始化
  // 延迟从 150ms 增加到 300ms，减少布局未稳定时查询到错误尺寸的概率
  safeTimeout(() => _doMountInit(true), 300)
})

onUnmounted(() => {
  _destroyed = true
  for (const id of _pendingTimers) clearTimeout(id)
  _pendingTimers.length = 0
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  _canvasNode = null
})

// ─── 对外暴露：父页面滚动后调用 refresh() 刷新 ECharts 坐标系 ──────────────
// 微信原生 canvas 的事件坐标映射是在初始化时基于视口位置计算的。
// 页面发生滚动后，canvas 的视口位置变化，但 ECharts 内部缓存的坐标系没有更新，
// 导致图表内容渲染位置偏移。调用 resize() 可以强制 ECharts 重新计算坐标系。
defineExpose({
  refresh() {
    if (!chartInstance || !_canvasNode) return
    chartInstance.resize({ width: canvasWidth.value, height: canvasHeight.value })
  }
})
</script>

<style lang="scss" scoped>
.tree-chart-wrap {
  position: relative;
  overflow: hidden;
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

  .icon-text { font-size: 36rpx; }
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

  .close-text { font-size: 32rpx; color: #94a3b8; line-height: 1; }
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
  .stat-num.stat-rating { color: #f59e0b; }
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