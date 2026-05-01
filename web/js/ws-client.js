/**
 * StoryTree WebSocket 客户端
 * 
 * 功能：
 *   - 自动连接 / 自动重连（指数退避）
 *   - 心跳保活（30秒 ping/pong）
 *   - 事件监听（on / off / once）
 *   - 降级回退：WebSocket 断开后自动回退到短轮询
 *   - 恢复切换：重连成功后自动切回 WebSocket
 * 
 * 使用方式：
 *   // 连接
 *   StoryTreeWS.connect();
 *   
 *   // 监听事件
 *   StoryTreeWS.on('task:status', (data) => { ... });
 *   StoryTreeWS.on('payment:status', (data) => { ... });
 *   StoryTreeWS.on('tree:update', (data) => { ... });
 *   StoryTreeWS.on('system:load', (data) => { ... });
 *   
 *   // 检查连接状态
 *   StoryTreeWS.isConnected();
 *   
 *   // 手动断开
 *   StoryTreeWS.disconnect();
 */

const StoryTreeWS = (() => {
  // ==================== 配置 ====================
  const CONFIG = {
    // 重连
    RECONNECT_BASE_DELAY: 1000,   // 初始重连延迟 1 秒
    RECONNECT_MAX_DELAY: 30000,   // 最大重连延迟 30 秒
    RECONNECT_MAX_ATTEMPTS: 20,   // 最大重连次数（之后停止重连，仅用降级轮询）
    // 心跳
    HEARTBEAT_INTERVAL: 25000,    // 心跳间隔 25 秒（服务端 30 秒超时）
    HEARTBEAT_TIMEOUT: 10000,     // 心跳响应超时 10 秒
    // 降级轮询
    FALLBACK_POLL_INTERVAL: 5000, // 降级轮询间隔 5 秒
    FALLBACK_POLL_MAX_INTERVAL: 30000, // 降级轮询最大间隔 30 秒
  };

  // ==================== 状态 ====================
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let heartbeatTimeoutTimer = null;
  let isManualClose = false;
  let isConnected = false;

  // 降级轮询
  let fallbackPollingActive = false;
  let fallbackPollingTimer = null;
  let fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL;
  /** 降级轮询时需要监控的任务 { taskId: callback } */
  const pendingTasks = new Map();

  // 事件监听器 { eventType: [callback, ...] }
  const listeners = {};

  // ==================== 公共 API ====================

  /**
   * 建立 WebSocket 连接
   */
  function connect() {
    // 获取 token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      console.log('[WS] 未登录，跳过 WebSocket 连接');
      return;
    }

    // 如果已连接，跳过
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    isManualClose = false;

    // 构建 WebSocket URL
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/api/ws?token=${encodeURIComponent(token)}`;

    console.log('[WS] 正在连接...');

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[WS] 创建连接失败:', err);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('[WS] 连接成功');
      isConnected = true;
      reconnectAttempts = 0;

      // 启动心跳
      startHeartbeat();

      // 如果之前在降级轮询，停止轮询
      stopFallbackPolling();

      // 触发连接事件
      emit('ws:connected', {});
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') {
          // 心跳响应
          clearTimeout(heartbeatTimeoutTimer);
          return;
        }
        // 分发事件
        emit(msg.type, msg.data);
      } catch (err) {
        console.warn('[WS] 消息解析失败:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] 连接关闭: code=${event.code}, reason=${event.reason}`);
      isConnected = false;
      stopHeartbeat();

      if (!isManualClose) {
        scheduleReconnect();
        // 启动降级轮询
        startFallbackPolling();
      }

      emit('ws:disconnected', { code: event.code, reason: event.reason });
    };

    ws.onerror = (event) => {
      console.error('[WS] 连接错误');
      // onclose 会紧随其后被调用，不在这里处理重连
    };
  }

  /**
   * 手动断开连接
   */
  function disconnect() {
    isManualClose = true;
    clearTimeout(reconnectTimer);
    stopHeartbeat();
    stopFallbackPolling();

    if (ws) {
      ws.close(1000, 'Manual disconnect');
      ws = null;
    }
    isConnected = false;
  }

  /**
   * 监听事件
   * @param {string} type 事件类型
   * @param {Function} callback 回调函数
   * @returns {Function} 取消监听的函数
   */
  function on(type, callback) {
    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(callback);

    // 返回取消函数
    return () => off(type, callback);
  }

  /**
   * 取消监听
   */
  function off(type, callback) {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter(cb => cb !== callback);
  }

  /**
   * 监听一次
   */
  function once(type, callback) {
    const wrapper = (data) => {
      off(type, wrapper);
      callback(data);
    };
    on(type, wrapper);
  }

  /**
   * 注册一个需要监控的 AI 任务（用于降级轮询）
   * @param {number} taskId 任务 ID
   * @param {Function} callback 状态变更回调 (data) => void
   */
  function watchTask(taskId, callback) {
    pendingTasks.set(taskId, callback);
    // 如果 WebSocket 未连接，立即启动降级轮询
    if (!isConnected) {
      startFallbackPolling();
    }
  }

  /**
   * 取消监控任务
   */
  function unwatchTask(taskId) {
    pendingTasks.delete(taskId);
    // 如果没有待监控任务，停止降级轮询
    if (pendingTasks.size === 0) {
      stopFallbackPolling();
    }
  }

  /**
   * 获取连接状态
   */
  function getConnected() {
    return isConnected;
  }

  // ==================== 内部方法 ====================

  /** 分发事件 */
  function emit(type, data) {
    const cbs = listeners[type];
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[WS] 事件处理器错误 (${type}):`, err);
        }
      }
    }

    // task:status 事件特殊处理：通知 pendingTasks 中的回调
    if (type === 'task:status' && data && data.taskId) {
      const taskCallback = pendingTasks.get(data.taskId);
      if (taskCallback) {
        try {
          taskCallback(data);
        } catch (err) {
          console.error('[WS] 任务回调错误:', err);
        }
        // 任务完成或失败后自动移除监控
        if (data.status === 'completed' || data.status === 'failed') {
          pendingTasks.delete(data.taskId);
        }
      }
    }
  }

  /** 心跳 */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        // 设置超时：如果 10 秒内没收到 pong，认为连接已断
        heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('[WS] 心跳超时，关闭连接');
          if (ws) ws.close();
        }, CONFIG.HEARTBEAT_TIMEOUT);
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    clearTimeout(heartbeatTimeoutTimer);
    heartbeatTimer = null;
    heartbeatTimeoutTimer = null;
  }

  /** 重连（指数退避） */
  function scheduleReconnect() {
    if (isManualClose) return;
    if (reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
      console.log('[WS] 达到最大重连次数，停止重连，使用降级轮询');
      return;
    }

    const delay = Math.min(
      CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
      CONFIG.RECONNECT_MAX_DELAY
    );
    reconnectAttempts++;

    console.log(`[WS] ${delay / 1000}秒后重连 (第${reconnectAttempts}次)`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  // ==================== 降级轮询 ====================

  /** 启动降级轮询 */
  function startFallbackPolling() {
    if (fallbackPollingActive) return;
    if (pendingTasks.size === 0) return;

    fallbackPollingActive = true;
    fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL;
    console.log('[WS] 降级：启动短轮询');

    pollOnce();
  }

  /** 停止降级轮询 */
  function stopFallbackPolling() {
    fallbackPollingActive = false;
    clearTimeout(fallbackPollingTimer);
    fallbackPollingTimer = null;
    fallbackPollInterval = CONFIG.FALLBACK_POLL_INTERVAL;
  }

  /** 执行一次轮询 */
  async function pollOnce() {
    if (!fallbackPollingActive || pendingTasks.size === 0) {
      stopFallbackPolling();
      return;
    }

    // 如果 WebSocket 已重连成功，停止轮询
    if (isConnected) {
      stopFallbackPolling();
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      stopFallbackPolling();
      return;
    }

    // 逐个轮询任务状态
    for (const [taskId, callback] of pendingTasks) {
      try {
        const response = await fetch(`/api/ai/v2/tasks/${taskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) continue;

        const data = await response.json();
        if (data.status === 'completed' || data.status === 'failed') {
          // 通过 emit 分发，让所有监听者都能收到
          emit('task:status', {
            taskId: data.taskId || taskId,
            status: data.status,
            result: data.result,
            errorMessage: data.errorMessage,
          });
          pendingTasks.delete(taskId);
        }
      } catch (err) {
        console.warn(`[WS] 降级轮询任务 ${taskId} 失败:`, err);
      }
    }

    // 如果还有待监控任务，继续轮询（递增间隔）
    if (pendingTasks.size > 0 && fallbackPollingActive) {
      fallbackPollInterval = Math.min(fallbackPollInterval * 1.5, CONFIG.FALLBACK_POLL_MAX_INTERVAL);
      fallbackPollingTimer = setTimeout(pollOnce, fallbackPollInterval);
    } else {
      stopFallbackPolling();
    }
  }

  // ==================== 页面可见性优化 ====================

  // 页面隐藏时不主动断开（保持连接），但页面恢复时检查连接状态
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !isManualClose) {
        // 页面恢复可见，检查连接是否还活着
        if (!isConnected) {
          reconnectAttempts = 0; // 重置重连计数
          connect();
        }
      }
    });
  }

  // ==================== 导出 ====================

  return {
    connect,
    disconnect,
    on,
    off,
    once,
    watchTask,
    unwatchTask,
    isConnected: getConnected,
  };
})();

