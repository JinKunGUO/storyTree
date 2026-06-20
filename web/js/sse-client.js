/**
 * SSE 流式客户端
 * 
 * 通过 fetch + ReadableStream 接收后端 SSE 流式响应，
 * 支持逐字回调、完成回调、错误处理和中断控制。
 * 
 * 用法：
 *   const stream = new SSEStream('/api/ai/stream/continuation', {
 *     body: { storyId, context, ... },
 *     onChunk: (text, fullText) => { 渲染增量文字 },
 *     onDone: (result) => { 处理完成结果 },
 *     onError: (message) => { 显示错误 },
 *     onStart: () => { 显示开始状态 }
 *   });
 *   stream.start();
 *   // 需要中断时：
 *   stream.abort();
 */

class SSEStream {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.controller = null;
    this.fullText = '';
    this.aborted = false;
  }

  /**
   * 开始流式请求
   */
  async start() {
    this.controller = new AbortController();
    this.fullText = '';
    this.aborted = false;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      this.options.onError?.('未登录，请先登录');
      return;
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(this.options.body || {}),
        signal: this.controller.signal
      });

      // 非 SSE 响应（错误情况）
      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
        const errorData = await response.json().catch(() => ({ error: '请求失败' }));
        this.options.onError?.(errorData.error || `请求失败 (${response.status})`);
        return;
      }

      this.options.onStart?.();

      // 读取 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按双换行分割 SSE 事件
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // 保留不完整的最后部分

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          this._processEvent(eventBlock);
        }
      }

      // 处理最后的 buffer
      if (buffer.trim()) {
        this._processEvent(buffer);
      }

      // 如果没有收到 done 事件但流结束了，手动触发
      if (this.fullText && !this.aborted) {
        // done 事件可能已经在 _processEvent 中触发
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // 用户主动中断，不报错
        this.options.onAbort?.(this.fullText);
        return;
      }
      this.options.onError?.(error.message || '网络连接失败');
    }
  }

  /**
   * 解析并处理单个 SSE 事件块
   */
  _processEvent(eventBlock) {
    let eventName = 'message';
    let data = '';

    for (const line of eventBlock.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim();
      }
    }

    if (!data) return;

    try {
      const parsed = JSON.parse(data);

      switch (eventName) {
        case 'start':
          // 流开始
          break;

        case 'chunk':
          if (parsed.text) {
            this.fullText += parsed.text;
            this.options.onChunk?.(parsed.text, this.fullText);
          }
          break;

        case 'done':
          this.options.onDone?.({
            fullText: parsed.fullText || this.fullText,
            usage: parsed.usage
          });
          break;

        // 多步骤流式事件
        case 'step':
          // 新步骤开始，重置当前步骤文本
          this._stepText = '';
          this.options.onStep?.(parsed); // { step, title, total }
          break;

        case 'step_done':
          // 当前步骤完成
          this.options.onStepDone?.(parsed); // { step, result }
          this._stepText = '';
          this.fullText = ''; // 重置 fullText 供下一步使用
          break;

        case 'complete':
          // 多步骤全部完成
          this.options.onComplete?.(parsed); // { result }
          break;

        case 'error':
          this.options.onError?.(parsed.message || 'AI 生成出错');
          break;
      }
    } catch (e) {
      // 忽略解析失败的事件
      console.warn('[SSEStream] 解析事件失败:', data, e);
    }
  }

  /**
   * 中断流式请求
   */
  abort() {
    this.aborted = true;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}

// 便捷工厂方法
window.SSEStream = SSEStream;
