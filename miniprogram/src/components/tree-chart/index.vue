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
// 因此在 setup 同步阶段立即读取屏幕宽高作为初始值
const _initSys = uni.getSystemInfoSync()
const canvasWidth = ref(_initSys.windowWidth)
const canvasHeight = ref(Math.min(Math.max(_initSys.windowHeight * 0.55, 400), 600))
const totalNodes = ref(0)

let chartInstance: any = null
let currentZoom = 1
let _canvasNode: any = null  // 保存 canvas 节点引用，供 resize 时更新物理像素尺寸
// canvas 高度上限（由父容器 .tree-chart-wrap 的实际高度决定，onMounted 时查询）
// 默认用 windowHeight * 0.7，onMounted 修正后会更新
let _maxCanvasHeight = _initSys.windowHeight * 0.7
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
      // 注意：canvas 刚被 v-if 创建时，@ready 可能在 CSS 尺寸生效前触发，
      // 导致 fields({ size: true }) 返回 width/height 为 0。
      // 这里不传 size，直接让 setupChart 使用已知的 canvasWidth/canvasHeight 值，
      // 这两个值在 setup 阶段已用 getSystemInfoSync 初始化，onMounted 里已做精确修正。
      setupChart(canvasRes.node)
    })
}

function setupChart(canvasNode: any, width?: number, height?: number) {
  if (!props.rootNode) return

  const sys = uni.getSystemInfoSync()
  const dpr = sys.pixelRatio || 2
  const w = (width && width > 0) ? width : (canvasWidth.value || sys.windowWidth)

  // 直接用 calcCanvasHeight 计算正确高度，避免先用初始值 init 再 resize 导致布局错位
  // calcCanvasHeight 依赖 canvasWidth.value，需先更新 w
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

// 根据树的结构动态计算 canvas 高度，确保每个节点都有足够的物理空间
// canvas 高度固定为面板可用高度（maxHeight），通过 zoom 让所有节点在可见范围内显示
function calcCanvasHeight(rootNode: Node): number {
  // 优先使用父组件传入的 maxHeight，其次用 onMounted 查询到的 _maxCanvasHeight
  const maxH = (props.maxHeight && props.maxHeight > 0) ? props.maxHeight : _maxCanvasHeight
  // canvas 高度就等于面板可用高度，让 canvas 精确填满面板，不超出也不留白
  return Math.max(maxH, 300)
}

// 计算初始 zoom，让整棵树在 canvas 范围内完整显示（fit to container）
// ECharts tree 系列的 zoom 是相对于"默认布局"的缩放比
// 默认布局下，树会撑满整个 canvas（受 top/left/bottom/right 留白影响）
// 因此 zoom=1 时树已经适配了 canvas 尺寸，不需要额外缩放
// 但当节点非常多时，节点间距会变得极小（重叠），需要缩小 zoom 让节点间距合理
function calcInitialZoom(rootNode: Node): number {
  const isHorizontal = layout.value === 'LR'
  const leaves = leafCount(rootNode)
  const depth  = treeDepth(rootNode)
  const maxH   = (props.maxHeight && props.maxHeight > 0) ? props.maxHeight : _maxCanvasHeight
  const W      = canvasWidth.value || uni.getSystemInfoSync().windowWidth

  // 估算"理想情况下"树需要的高度（每个叶子/深度需要的空间）
  let idealH: number
  if (isHorizontal) {
    idealH = leaves * 52 + 80
  } else {
    idealH = depth * 110 + 80
  }

  // 估算"理想情况下"树需要的宽度
  let idealW: number
  if (isHorizontal) {
    idealW = depth * 120 + 80
  } else {
    idealW = leaves * 60 + 40
  }

  // 计算高度和宽度方向各需要多少缩放才能 fit
  const zoomByH = idealH > maxH ? maxH / idealH : 1
  const zoomByW = idealW > W ? W / idealW : 1

  // 取两个方向的最小值（保证两个方向都能 fit），并限制在合理范围
  return Math.min(Math.max(Math.min(zoomByH, zoomByW), 0.15), 1)
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
  if (currentZoom <= 0) {
    currentZoom = calcInitialZoom(props.rootNode)
  }

  const option = {
    series: [
      {
        type: 'tree',
        data: [data],
        // 留白：横向左侧留给非叶子标签，右侧留给叶子标签
        // 纵向：顶部留给根节点标签，底部留给叶子标签
        top:    isHorizontal ? '3%'  : '8%',
        left:   isHorizontal ? '18%' : '5%',
        bottom: isHorizontal ? '3%'  : '10%',
        right:  isHorizontal ? '22%' : '5%',
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

function onTouchStart(e: any) {
  if (!chartInstance || e.touches.length === 0) return
  console.log('[TreeChart] touchStart touches:', e.touches.length)
  const handler = chartInstance.getZr().handler
  if (e.touches.length === 1) {
    const touch = e.touches[0]
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
    console.log('[TreeChart] pinch start dist:', _lastPinchDist)
  }
}

function onTouchMove(e: any) {
  if (!chartInstance || e.touches.length === 0) return
  console.log('[TreeChart] touchMove touches:', e.touches.length, '_lastPinchDist:', _lastPinchDist)
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
    console.log('[TreeChart] pinch dist:', dist, 'last:', _lastPinchDist, 'zoom:', currentZoom)
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
  // 双指缩放结束时不触发 click，避免误触节点
  if (!wasPinch) {
    handler.dispatch('click', makeZrEvent(touch.x, touch.y))
  }
  handler.processGesture(wrapTouch(e), 'end')
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
  currentZoom = 0  // 置0触发 renderChart 里重新计算自适应 zoom
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
function reinitCanvasIfNeeded() {
  if (!props.rootNode) return
  chartInstance?.dispose()
  chartInstance = null
  _canvasNode = null
  nextTick(() => {
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
      setTimeout(() => {
        chartInstance?.dispatchAction({ type: 'downplay', seriesIndex: 0, name })
      }, 2500)
    }
  }
)

// ─── 生命周期 ─────────────────────────────────────────────────────────────────
onMounted(() => {
  // 延迟 150ms 再初始化：组件挂载时父页面（story）的封面图、简介等内容
  // 布局可能尚未稳定，boundingClientRect 会返回错误的宽度导致 canvas 位置偏移。
  // 等待布局完成后再查询，确保获取到正确的容器尺寸。
  // 同时，canvas 的 @ready 事件会在此之前触发，通过 _mountInitDone 标志位阻止提前初始化。
  setTimeout(() => {
    const wxScope = (_internalInstance as any)?.ctx?.$scope
    if (wxScope) {
      // 同时查询 canvas-container 宽度和 tree-chart-wrap 高度
      wx.createSelectorQuery().in(wxScope)
        .select('.canvas-container')
        .boundingClientRect()
        .select('.tree-chart-wrap')
        .boundingClientRect()
        .exec((res: any) => {
          const containerRect = res[0]
          const wrapRect = res[1]
          if (containerRect && containerRect.width > 0) {
            canvasWidth.value = containerRect.width
          }
          // 用父容器实际高度作为 canvas 高度上限，确保 canvas 不超出面板边界
          // 减去工具栏高度（约 60px）和底部统计行（约 40px）
          if (wrapRect && wrapRect.height > 0) {
            _maxCanvasHeight = Math.max(wrapRect.height - 60, 400)
          }
          // 宽度修正完成，允许 @ready 触发的 queryCanvas 正常执行
          _mountInitDone = true
          initChart()
        })
    } else {
      _mountInitDone = true
      initChart()
    }
  }, 150)
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  _canvasNode = null
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

