/**
 * 小程序 WebSocket 客户端
 * 
 * 功能：
 *   - 使用 uni.connectSocket 建立 WebSocket 连接
 *   - 自动重连（指数退避）
 *   - 心跳保活（30 秒 ping/pong）
 *   - 事件监听（on / off / once）
 *   - 降级兜底：WebSocket 断开后自动回退到短轮询
 *   - 恢复切换：重连成功后自动切回 WebSocket
 * 
 * 使用方式：
 *   import { mpWsClient } from '@/utils/ws-client'
 *   
 *   mpWsClient.connect()
 *   mpWsClient.watchTask(taskId, (data) => { ... })
 *   mpWsClient.unwatchTask(taskId)
 *   mpWsClient.isConnected()
 *   mpWsClient.disconnect()
 */

import { useUserStore } from '@/store/user'
import http from '@/utils/request'

// ==================== 配置 ====================
const CONFIG = {
  RECONNECT_BASE_DELAY: 2000,          // 初始重连延迟 2 秒
  RECONNECT_MAX_DELAY: 30000,          // 最大重连延迟 30 秒
  RECONNECT_MAX_ATTEMPTS: 10,          // 最大重连次数
  HEARTBEAT_INTERVAL: 30000,           // 心跳间隔 30 秒
  HEARTBEAT_TIMEOUT: 10000,            // 心跳超时 10 秒
  FALLBACK_POLL_INTERVAL: 5000,        // 降级轮询初始间隔 5 秒
  FALLBACK_POLL_MAX_INTERVAL: 30000,   // 降级轮询最大间隔 30 秒
}

// ==================== 类型定义 ====================
interface WsMessage {
  type: string
  data: any
  timestamp?: number
}

type EventCallback = (data: any) => void

// ==================== 状态 ====================
let socketTask: UniApp.SocketTask | null = null
let connected = false
let connecting = false
let manualClose = false

// 重连
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// 心跳
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null

// 事件监听器
const listeners = new Map<string, Set<EventCallback>>()

// 降级轮询
let fallbackPollingActive = false
let fallbackPollTimer: ReturnType<typeof setTimeout> | null = null
let fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL
/** 降级轮询时需要监控的任务 { taskId: callback } */
const pendingTasks = new Map<number, EventCallback>()

// ==================== 核心方法 ====================

/**
 * 建立 WebSocket 连接
 */
function connect(): void {
  if (connected || connecting) return

  const userStore = useUserStore()
  const token = userStore.token
  if (!token) {
    console.log('[WS] 未登录，跳过 WebSocket 连接')
    return
  }

  // 构建 WebSocket URL
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://your-domain.com'
  // 将 http(s) 替换为 ws(s)
  const wsBase = apiBase.replace(/^http/, 'ws')
  const wsUrl = `${wsBase}/api/ws?token=${encodeURIComponent(token)}`

  connecting = true
  manualClose = false

  console.log('[WS] 正在连接...', wsUrl.replace(/token=.*/, 'token=***'))

  socketTask = uni.connectSocket({
    url: wsUrl,
    success: () => {
      console.log('[WS] connectSocket 调用成功')
    },
    fail: (err) => {
      console.error('[WS] connectSocket 调用失败:', err)
      connecting = false
      scheduleReconnect()
    },
  })

  if (!socketTask) {
    connecting = false
    return
  }

  socketTask.onOpen(() => {
    console.log('[WS] 连接已建立')
    connected = true
    connecting = false
    reconnectAttempts = 0
    startHeartbeat()
    // 如果之前在降级轮询，停止轮询（恢复到 WebSocket 推送模式）
    stopFallbackPolling()
    emit('_connected', {})
  })

  socketTask.onMessage((res) => {
    const rawData = typeof res.data === 'string' ? res.data : ''
    if (!rawData) return

    // 心跳响应
    if (rawData === 'pong' || rawData === '{"type":"pong"}') {
      clearHeartbeatTimeout()
      return
    }

    try {
      const msg: WsMessage = JSON.parse(rawData)
      if (msg.type) {
        emit(msg.type, msg.data)
      }
    } catch {
      console.warn('[WS] 消息解析失败:', rawData)
    }
  })

  socketTask.onClose((res) => {
    console.log('[WS] 连接已关闭:', res.code, res.reason)
    cleanup()
    if (!manualClose) {
      scheduleReconnect()
      // 启动降级轮询
      startFallbackPolling()
    }
  })

  socketTask.onError((err) => {
    console.error('[WS] 连接错误:', err)
    cleanup()
    if (!manualClose) {
      scheduleReconnect()
      // 启动降级轮询
      startFallbackPolling()
    }
  })
}

/**
 * 手动断开连接
 */
function disconnect(): void {
  manualClose = true
  stopHeartbeat()
  stopFallbackPolling()
  cleanup()
  if (socketTask) {
    try {
      socketTask.close({
        code: 1000,
        reason: 'manual disconnect',
      })
    } catch {
      // 忽略
    }
    socketTask = null
  }
}

/**
 * 清理定时器和状态
 */
function cleanup(): void {
  connected = false
  connecting = false
  stopHeartbeat()
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

/**
 * 是否已连接
 */
function isConnected(): boolean {
  return connected
}

// ==================== 心跳 ====================

function startHeartbeat(): void {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (!connected || !socketTask) return
    try {
      socketTask.send({
        data: JSON.stringify({ type: 'ping' }),
        fail: () => {
          console.warn('[WS] 心跳发送失败')
        },
      })
      // 设置心跳超时
      heartbeatTimeoutTimer = setTimeout(() => {
        console.warn('[WS] 心跳超时，断开重连')
        cleanup()
        if (socketTask) {
          try { socketTask.close({ code: 4000, reason: 'heartbeat timeout' }) } catch {}
          socketTask = null
        }
        scheduleReconnect()
      }, CONFIG.HEARTBEAT_TIMEOUT)
    } catch {
      // 忽略
    }
  }, CONFIG.HEARTBEAT_INTERVAL)
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  clearHeartbeatTimeout()
}

function clearHeartbeatTimeout(): void {
  if (heartbeatTimeoutTimer) {
    clearTimeout(heartbeatTimeoutTimer)
    heartbeatTimeoutTimer = null
  }
}

// ==================== 重连 ====================

function scheduleReconnect(): void {
  if (manualClose) return
  if (reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
    console.warn('[WS] 达到最大重连次数，停止重连')
    return
  }

  const delay = Math.min(
    CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
    CONFIG.RECONNECT_MAX_DELAY
  )
  reconnectAttempts++

  console.log(`[WS] ${delay / 1000}秒后重连（第${reconnectAttempts}次）`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

// ==================== 事件系统 ====================

function on(type: string, callback: EventCallback): void {
  if (!listeners.has(type)) {
    listeners.set(type, new Set())
  }
  listeners.get(type)!.add(callback)
}

function off(type: string, callback: EventCallback): void {
  const cbs = listeners.get(type)
  if (cbs) {
    cbs.delete(callback)
    if (cbs.size === 0) {
      listeners.delete(type)
    }
  }
}

function once(type: string, callback: EventCallback): void {
  const wrapper: EventCallback = (data) => {
    off(type, wrapper)
    callback(data)
  }
  on(type, wrapper)
}

function emit(type: string, data: any): void {
  const cbs = listeners.get(type)
  if (cbs) {
    cbs.forEach((cb) => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[WS] 事件回调错误 (${type}):`, err)
      }
    })
  }

  // task:status 事件特殊处理：通知 pendingTasks 中的回调
  if (type === 'task:status' && data && data.taskId) {
    const taskCallback = pendingTasks.get(data.taskId)
    if (taskCallback) {
      try {
        taskCallback(data)
      } catch (err) {
        console.error('[WS] 任务回调错误:', err)
      }
      // 任务完成或失败后自动移除监控
      if (data.status === 'completed' || data.status === 'failed') {
        pendingTasks.delete(data.taskId)
        // 如果没有待监控任务，停止降级轮询
        if (pendingTasks.size === 0) {
          stopFallbackPolling()
        }
      }
    }
  }
}

// ==================== 便捷方法 ====================

/**
 * 注册一个需要监控的 AI 任务（用于降级轮询）
 * - WebSocket 连接时，通过 task:status 事件实时推送
 * - WebSocket 断开时，自动启动降级轮询
 * 
 * @param taskId 任务 ID
 * @param callback 状态变更回调 (data) => void
 * @returns 取消监听的函数
 */
function watchTask(taskId: number, callback: (data: any) => void): () => void {
  // 注册到 pendingTasks，降级轮询时会使用
  pendingTasks.set(taskId, callback)
  // 同时注册事件监听（WS 推送时触发）
  const handler: EventCallback = (data) => {
    if (data.taskId === taskId) {
      callback(data)
    }
  }
  on('task:status', handler)
  // 如果 WebSocket 未连接，立即启动降级轮询
  if (!connected) {
    startFallbackPolling()
  }
  // 返回取消函数（同时移除事件监听和 pendingTasks）
  return () => {
    off('task:status', handler)
    pendingTasks.delete(taskId)
    // 如果没有待监控任务，停止降级轮询
    if (pendingTasks.size === 0) {
      stopFallbackPolling()
    }
  }
}

/**
 * 取消监控任务
 */
function unwatchTask(taskId: number): void {
  pendingTasks.delete(taskId)
  // 如果没有待监控任务，停止降级轮询
  if (pendingTasks.size === 0) {
    stopFallbackPolling()
  }
}

// ==================== 降级轮询 ====================

/** 启动降级轮询 */
function startFallbackPolling(): void {
  if (fallbackPollingActive) return
  if (pendingTasks.size === 0) return

  fallbackPollingActive = true
  fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL
  console.log('[WS] 降级：启动短轮询')

  pollOnce()
}

/** 停止降级轮询 */
function stopFallbackPolling(): void {
  fallbackPollingActive = false
  if (fallbackPollTimer) {
    clearTimeout(fallbackPollTimer)
    fallbackPollTimer = null
  }
  fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL
}

/** 执行一次轮询 */
async function pollOnce(): Promise<void> {
  if (!fallbackPollingActive || pendingTasks.size === 0) {
    stopFallbackPolling()
    return
  }

  // 如果 WebSocket 已重连成功，停止轮询
  if (connected) {
    stopFallbackPolling()
    return
  }

  // 逐个轮询任务状态
  for (const [taskId, callback] of pendingTasks) {
    try {
      const data = await http.get<{
        status: string
        taskId?: number
        result?: any
        errorMessage?: string
      }>(`/api/ai/v2/tasks/${taskId}`, undefined, { showError: false })

      if (data.status === 'completed' || data.status === 'failed') {
        // 通过 emit 分发，让所有监听者都能收到
        emit('task:status', {
          taskId: data.taskId || taskId,
          status: data.status,
          result: data.result,
          errorMessage: data.errorMessage,
        })
        // pendingTasks 的删除由 emit 中的 task:status 处理完成
      }
    } catch (err) {
      console.warn(`[WS] 降级轮询任务 ${taskId} 失败:`, err)
    }
  }

  // 如果还有待监控任务，继续轮询（递增间隔）
  if (pendingTasks.size > 0 && fallbackPollingActive) {
    fallbackPollInterval = Math.min(fallbackPollInterval * 1.5, CONFIG.FALLBACK_POLL_MAX_INTERVAL)
    fallbackPollTimer = setTimeout(pollOnce, fallbackPollInterval)
  } else {
    stopFallbackPolling()
  }
}

// ==================== 导出 ====================

export const mpWsClient = {
  connect,
  disconnect,
  isConnected,
  on,
  off,
  once,
  watchTask,
  unwatchTask,
}

export default mpWsClient

