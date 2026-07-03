/**
 * 千问 API 流式调用工具
 * 
 * 提供 SSE 流式输出能力，直接将千问 API 的流式响应透传给 HTTP 客户端。
 * 用于 /api/ai/stream/* 系列接口。
 */

import { Response } from 'express';
import { scanSensitiveWords, maskSensitiveWords } from './sensitiveWords';

const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus';
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export interface StreamOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeoutMs?: number;
  enableThinking?: boolean;
  expectedKeys?: number;
}

/**
 * 清理 JSON 字符串中的 <thinking>...</thinking> 标签
 * 千问模型输出的 JSON 可能包含 thinking 标签，需要清理后再解析
 */
export function cleanThinkingTags(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

/**
 * Thinking 状态机：解析 <thinking> 标签，分离思考内容和 JSON 内容
 * 初始状态为 'json'（安全默认值），只有检测到标签才切换
 */
class ThinkingParser {
  private state: 'json' | 'thinking' = 'json';
  private tagBuffer: string = '';
  private lastKeys: string[] = [];

  /**
   * 处理一个 delta chunk，返回 { thinking?, json? }
   * thinking: 思考过程文本（如果有）
   * json: JSON 内容文本（如果有）
   */
  process(delta: string): { thinking?: string; json?: string } {
    let combined = this.tagBuffer + delta;
    this.tagBuffer = '';

    let thinking = '';
    let json = '';

    while (combined.length > 0) {
      if (this.state === 'json') {
        // 查找 <think 或 <thinking 开始标签
        const openMatch = combined.match(/<think(?:king)?\s*>/i);
        if (openMatch && openMatch.index !== undefined) {
          // 标签前的内容是 JSON
          json += combined.slice(0, openMatch.index);
          combined = combined.slice(openMatch.index + openMatch[0].length);
          this.state = 'thinking';
        } else {
          // 没有找到开始标签，检查末尾是否有不完整标签
          const tail = combined.slice(-12);
          if (/<think(?:king)?\s*$/i.test(tail) || /<thi(?:nk(?:ing)?)?\s*$/i.test(tail) || /<th(?:i)?$/i.test(tail)) {
            // 末尾可能是不完整的标签，缓存到 tagBuffer
            json += combined.slice(0, combined.length - tail.length);
            this.tagBuffer = tail;
            combined = '';
          } else {
            // 全部是 JSON 内容
            json += combined;
            combined = '';
          }
        }
      } else {
        // thinking 状态，查找 </think 或 </thinking 结束标签
        const closeMatch = combined.match(/<\/think(?:king)?\s*>/i);
        if (closeMatch && closeMatch.index !== undefined) {
          thinking += combined.slice(0, closeMatch.index);
          combined = combined.slice(closeMatch.index + closeMatch[0].length);
          this.state = 'json';
        } else {
          // 没有找到结束标签，检查末尾是否有不完整标签
          const tail = combined.slice(-13);
          if (/<\/think(?:king)?\s*$/i.test(tail) || /<\/thi(?:nk(?:ing)?)?\s*$/i.test(tail) || /<\/th(?:i)?$/i.test(tail) || /<\/?$/i.test(tail)) {
            thinking += combined.slice(0, combined.length - tail.length);
            this.tagBuffer = tail;
            combined = '';
          } else {
            // 全部是 thinking 内容
            thinking += combined;
            combined = '';
          }
        }
      }
    }

    const result: { thinking?: string; json?: string } = {};
    if (thinking) result.thinking = thinking;
    if (json) result.json = json;
    return result;
  }

  /**
   * 从 fullText 中检测 JSON key，返回已完成的 key 和当前正在生成的 key
   */
  detectNewKeys(fullText: string, expectedKeys?: number): { keys: string[]; currentKey?: string; totalKeys?: number } | null {
    const allKeys = [...fullText.matchAll(/"(\w+)"\s*:/g)].map(m => m[1]);
    const uniqueKeys = [...new Set(allKeys)];
    const hasNew = uniqueKeys.length > this.lastKeys.length;
    if (!hasNew) return null;
    this.lastKeys = uniqueKeys;
    // 最后一个 key 是当前正在生成的，之前的都是已完成的
    const completedKeys = uniqueKeys.slice(0, -1);
    const currentKey = uniqueKeys[uniqueKeys.length - 1];
    return { keys: completedKeys, currentKey, totalKeys: expectedKeys };
  }
}

/**
 * 向客户端发送 SSE 事件
 */
export function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // 强制刷新响应缓冲区，确保 SSE 数据立即发送到客户端
  // Node.js 的 res.write() 可能被内核缓冲，需要显式 flush
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
}

/**
 * 初始化 SSE 响应头
 */
export function initSSEResponse(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx 禁用缓冲
  res.flushHeaders();

  // 禁用 Nagle 算法，确保每个 write() 立即发送
  const socket = (res as any).socket;
  if (socket && typeof socket.setNoDelay === 'function') {
    socket.setNoDelay(true);
  }
}

/**
 * 流式调用千问 API，仅推送 chunk 事件，不发送 start/done，不关闭连接。
 * 适用于多步骤流式场景，由调用方管理生命周期。
 * 
 * 返回完整文本（已做敏感词遮罩）。出错时向客户端发 error 事件并抛出异常。
 */
export async function streamQwenStep(res: Response, options: StreamOptions): Promise<string> {
  const {
    prompt,
    systemPrompt,
    maxTokens = 2000,
    temperature = 0.8,
    topP = 0.9,
    timeoutMs = 60000,
    enableThinking = false,
    expectedKeys
  } = options;

  if (!QWEN_API_KEY) {
    throw new Error('AI 服务未配置');
  }

  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(QWEN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stream: true,
        ...(enableThinking ? {
          reasoning_level: { level: 'high' }
        } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`千问API调用失败: ${response.status} ${errorText}`);
    }

    clearTimeout(connectTimeout);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    if (!reader) throw new Error('无法读取响应流');

    let fullText = '';
    let buffer = '';
    const STREAM_IDLE_TIMEOUT = 60000;
    const parser = enableThinking ? new ThinkingParser() : null;

    while (true) {
      const readPromise = reader.read();
      const idleTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('流式输出超时')), STREAM_IDLE_TIMEOUT);
      });

      const { done, value } = await Promise.race([readPromise, idleTimeout]);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) throw new Error(`千问API错误: ${data.error.code} - ${data.error.message}`);

          // 千问 API 可能先发送 reasoning_content，再发送 content
          // 需要在 if (delta) 之外单独处理 reasoning_content
          const reasoning = data.choices?.[0]?.delta?.reasoning_content || '';
          if (parser && reasoning) {
            sendSSE(res, 'thinking', { text: reasoning });
          }

          const delta = data.choices?.[0]?.delta?.content || '';
          if (delta) {
            if (parser) {
              // 第2层：thinking 标签状态机
              const parts = parser.process(delta);
              if (parts.thinking) {
                sendSSE(res, 'thinking', { text: parts.thinking });
              }
              if (parts.json) {
                fullText += parts.json;
                sendSSE(res, 'chunk', { text: parts.json });
              }
              // progress 检测
              const keyInfo = parser.detectNewKeys(fullText, expectedKeys);
              if (keyInfo) {
                sendSSE(res, 'progress', keyInfo);
              }
            } else {
              fullText += delta;
              sendSSE(res, 'chunk', { text: delta });
            }
          }
        } catch (parseError: any) {
          if (parseError.message?.includes('千问API错误')) throw parseError;
        }
      }
    }

    // 清理可能残留的 thinking 标签
    fullText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    // 敏感词扫描
    const scanResult = scanSensitiveWords(fullText);
    if (scanResult.found) {
      fullText = maskSensitiveWords(fullText);
      console.warn(`[AI 内容安全] 步骤输出命中敏感词: ${scanResult.words.join(', ')}`);
    }

    return fullText;
  } catch (error: any) {
    const message = error.name === 'AbortError'
      ? 'AI 连接超时，请稍后重试'
      : (error.message || 'AI 生成失败');
    throw new Error(message);
  } finally {
    clearTimeout(connectTimeout);
  }
}

/**
 * 流式调用千问 API 并将结果通过 SSE 逐 chunk 推送给客户端
 * 
 * SSE 事件格式：
 * - event: start    data: { model }
 * - event: chunk    data: { text: "增量文字" }
 * - event: done     data: { fullText: "完整文字", usage: { input, output } }
 * - event: error    data: { message: "错误信息" }
 * 
 * 注意：此函数会发送 start/done 并关闭连接，适用于单步骤场景。
 * 多步骤场景请使用 streamQwenStep。
 */
export async function streamQwenToClient(res: Response, options: StreamOptions): Promise<string> {
  const {
    prompt,
    systemPrompt,
    maxTokens = 2000,
    temperature = 0.8,
    topP = 0.9,
    timeoutMs = 60000,
    enableThinking = false,
    expectedKeys
  } = options;

  if (!QWEN_API_KEY) {
    sendSSE(res, 'error', { message: 'AI 服务未配置' });
    res.end();
    return '';
  }

  const controller = new AbortController();
  const connectTimeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(QWEN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stream: true,
        ...(enableThinking ? {
          reasoning_level: { level: 'high' }
        } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`千问API调用失败: ${response.status} ${errorText}`);
    }

    clearTimeout(connectTimeout);

    // 开始流式透传
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let buffer = '';
    const STREAM_IDLE_TIMEOUT = 60000;
    const parser = enableThinking ? new ThinkingParser() : null;

    // 发送开始事件
    sendSSE(res, 'start', { model: QWEN_MODEL });

    while (true) {
      const readPromise = reader.read();
      const idleTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('流式输出超时')), STREAM_IDLE_TIMEOUT);
      });

      const { done, value } = await Promise.race([readPromise, idleTimeout]);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 行
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.error) {
            throw new Error(`千问API错误: ${data.error.code} - ${data.error.message}`);
          }

          // 千问 API 可能先发送 reasoning_content，再发送 content
          // 需要在 if (delta) 之外单独处理 reasoning_content
          const reasoning = data.choices?.[0]?.delta?.reasoning_content || '';
          if (parser && reasoning) {
            sendSSE(res, 'thinking', { text: reasoning });
          }

          const delta = data.choices?.[0]?.delta?.content || '';
          if (delta) {
            if (parser) {
              // 第2层：thinking 标签状态机
              const parts = parser.process(delta);
              if (parts.thinking) {
                sendSSE(res, 'thinking', { text: parts.thinking });
              }
              if (parts.json) {
                fullText += parts.json;
                sendSSE(res, 'chunk', { text: parts.json });
              }
              // progress 检测
              const keyInfo = parser.detectNewKeys(fullText, expectedKeys);
              if (keyInfo) {
                sendSSE(res, 'progress', keyInfo);
              }
            } else {
              fullText += delta;
              sendSSE(res, 'chunk', { text: delta });
            }
          }

          // usage 信息（通常在最后一条）
          if (data.usage) {
            inputTokens = data.usage.prompt_tokens || 0;
            outputTokens = data.usage.completion_tokens || 0;
          }
        } catch (parseError: any) {
          if (parseError.message?.includes('千问API错误')) throw parseError;
          // 忽略解析失败的单行
        }
      }
    }

    // 后置敏感词扫描
    // 先清理可能残留的 thinking 标签
    fullText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    let safeText = fullText;

    const scanResult = scanSensitiveWords(fullText);
    let contentWarning: { found: boolean; category?: string; masked: boolean } | undefined;

    if (scanResult.found) {
      // 对命中敏感词的内容进行遮罩处理
      safeText = maskSensitiveWords(fullText);
      contentWarning = {
        found: true,
        category: scanResult.category,
        masked: true
      };
      console.warn(`[AI 内容安全] 流式输出命中敏感词: ${scanResult.words.join(', ')}`);
    }

    // 发送完成事件
    sendSSE(res, 'done', {
      fullText: safeText,
      usage: { input: inputTokens, output: outputTokens },
      ...(contentWarning ? { contentWarning } : {})
    });

    return safeText;
  } catch (error: any) {
    const message = error.name === 'AbortError'
      ? 'AI 连接超时，请稍后重试'
      : (error.message || 'AI 生成失败');

    sendSSE(res, 'error', { message });
    return '';
  } finally {
    clearTimeout(connectTimeout);
    res.end();
  }
}
