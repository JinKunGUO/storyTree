/**
 * 小程序 WebSocket 客户端
 * 
 * 功能：
 *   - 使用 uni.connectSocket 建立 WebSocket 连接
 *   - 自动重连（指数退避）
 *   - 心跳保活（30 秒 ping/pong）
 *   - 事件监听（on / off / once）
 *   - 降级兜底：WebSocket 断开后由调用方自行回退轮询
 * 
 * 使用方式：
 *   import { mpWsClient } from '@/utils/ws-client'
 *   
 *   mpWsClient.connect()
 *   mpWsClient.on('task:status', (data) => { ... })
 *   mpWsClient.isConnected()
 *   mpWsClient.disconnect()
 */

import { useUserStore } from '@/store/user'

// ==================== 配置 ====================
const CONFIG = {
  RECONNECT_BASE_DELAY: 2000,   // 初始重连延迟 2 秒
  RECONNECT_MAX_DELAY: 30000,   // 最大重连延迟 30 秒
  RECONNECT_MAX_ATTEMPTS: 10,   // 最大重连次数
  HEARTBEAT_INTERVAL: 30000,    // 心跳间隔 30 秒
  HEARTBEAT_TIMEOUT: 10000,     // 心跳超时 10 秒
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
    }
  })

  socketTask.onError((err) => {
    console.error('[WS] 连接错误:', err)
    cleanup()
    if (!manualClose) {
      scheduleReconnect()
    }
  })
}

/**
 * 手动断开连接
 */
function disconnect(): void {
  manualClose = true
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
}

// ==================== 便捷方法 ====================

/**
 * 监听指定任务的状态变更
 * 返回取消监听的函数
 */
function watchTask(taskId: number, callback: (data: any) => void): () => void {
  const handler: EventCallback = (data) => {
    if (data.taskId === taskId) {
      callback(data)
    }
  }
  on('task:status', handler)
  return () => off('task:status', handler)
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
}

export default mpWsClient

