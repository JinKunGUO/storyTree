/**
 * WebSocket 服务 — 实时推送替代轮询
 * 
 * 功能：
 *   - 连接管理（Map<userId, Set<WebSocket>>）
 *   - JWT 鉴权（复用 auth.ts 的 verifyJWT）
 *   - 心跳检测（30秒 ping/pong，超时断开）
 *   - 按用户推送 / 广播
 * 
 * 事件类型：
 *   - task:status    AI 任务状态变更（completed / failed / processing）
 *   - task:progress  AI 任务进度更新（队列位置等）
 *   - payment:status 支付状态变更
 *   - tree:update    故事树新章节
 *   - system:load    系统负载更新
 */

import { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyJWT } from './auth';

// ==================== 类型定义 ====================

/** WebSocket 消息格式 */
interface WsMessage {
  type: string;       // 事件类型，如 'task:status'
  data: any;          // 事件数据
  timestamp: number;  // 时间戳
}

/** 扩展 WebSocket，附加用户信息和心跳状态 */
interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  isAlive?: boolean;
  connectedAt?: number;
}

// ==================== WebSocket 服务类 ====================

class WebSocketService {
  private wss: WebSocketServer | null = null;
  /** userId → 该用户的所有连接 */
  private connections: Map<number, Set<AuthenticatedWebSocket>> = new Map();
  /** 心跳定时器 */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  /** 系统负载推送定时器 */
  private systemLoadInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 初始化 WebSocket 服务器，挂载到 HTTP Server
   */
  init(server: HTTPServer) {
    this.wss = new WebSocketServer({ noServer: true });

    // 处理 HTTP Upgrade 请求（仅拦截 /api/ws 路径）
    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      const pathname = this.getPathname(request);

      if (pathname === '/api/ws') {
        // 鉴权
        const userId = this.authenticate(request);
        if (!userId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          (ws as AuthenticatedWebSocket).userId = userId.userId;
          (ws as AuthenticatedWebSocket).username = userId.username;
          this.wss!.emit('connection', ws, request);
        });
      }
      // 非 /api/ws 路径不处理，留给其他 upgrade handler
    });

    // 新连接
    this.wss.on('connection', (ws: AuthenticatedWebSocket) => {
      ws.isAlive = true;
      ws.connectedAt = Date.now();

      const userId = ws.userId!;
      console.log(`🔌 WebSocket 连接: userId=${userId}, username=${ws.username}`);

      // 注册连接
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)!.add(ws);

      // pong 响应（客户端回复心跳）
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // 接收客户端消息（目前仅用于 ping/pong，未来可扩展）
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch {
          // 忽略非 JSON 消息
        }
      });

      // 断开连接
      ws.on('close', () => {
        console.log(`🔌 WebSocket 断开: userId=${userId}`);
        const userConns = this.connections.get(userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) {
            this.connections.delete(userId);
          }
        }
      });

      ws.on('error', (err) => {
        console.error(`WebSocket 错误: userId=${userId}`, err.message);
      });

      // 发送欢迎消息
      this.sendToSocket(ws, 'connected', {
        message: 'WebSocket 连接成功',
        userId,
      });
    });

    // 启动心跳检测（每 30 秒）
    this.startHeartbeat();

    // 启动系统负载定时推送（每 30 秒）
    this.startSystemLoadBroadcast();

    console.log('🔌 WebSocket 服务已启动，路径: /api/ws');
  }

  // ==================== 推送 API ====================

  /**
   * 向指定用户推送消息（所有连接）
   */
  sendToUser(userId: number, type: string, data: any): boolean {
    const userConns = this.connections.get(userId);
    if (!userConns || userConns.size === 0) {
      return false; // 用户不在线
    }

    const message: WsMessage = { type, data, timestamp: Date.now() };
    const payload = JSON.stringify(message);

    for (const ws of userConns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
    return true;
  }

  /**
   * 向所有在线用户广播消息
   */
  broadcast(type: string, data: any) {
    const message: WsMessage = { type, data, timestamp: Date.now() };
    const payload = JSON.stringify(message);

    for (const [, conns] of this.connections) {
      for (const ws of conns) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  /**
   * 检查用户是否在线（有活跃 WebSocket 连接）
   */
  isUserOnline(userId: number): boolean {
    const conns = this.connections.get(userId);
    if (!conns) return false;
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  /**
   * 获取在线统计
   */
  getStats() {
    let totalConnections = 0;
    for (const [, conns] of this.connections) {
      totalConnections += conns.size;
    }
    return {
      onlineUsers: this.connections.size,
      totalConnections,
    };
  }

  // ==================== 业务推送方法 ====================

  /**
   * 推送 AI 任务状态变更
   */
  sendTaskStatus(userId: number, taskId: number, status: string, result?: any, errorMessage?: string) {
    this.sendToUser(userId, 'task:status', {
      taskId,
      status,
      result: result || null,
      errorMessage: errorMessage || null,
    });
  }

  /**
   * 推送支付状态变更
   */
  sendPaymentStatus(userId: number, orderId: string, status: string, extra?: any) {
    this.sendToUser(userId, 'payment:status', {
      orderId,
      status,
      ...extra,
    });
  }

  /**
   * 推送故事树更新（新章节发布）
   */
  sendTreeUpdate(storyId: number, nodeId: number, action: string = 'created') {
    // 广播给所有在线用户（因为任何人都可能在看这个故事）
    this.broadcast('tree:update', {
      storyId,
      nodeId,
      action,
    });
  }

  // ==================== 内部方法 ====================

  private sendToSocket(ws: WebSocket, type: string, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
  }

  /**
   * 从 HTTP 请求中提取路径
   */
  private getPathname(request: IncomingMessage): string {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      return url.pathname;
    } catch {
      return request.url || '';
    }
  }

  /**
   * 从 HTTP 请求中鉴权（提取 JWT token）
   * 支持两种方式：
   *   1. URL 参数: ws://host/api/ws?token=xxx
   *   2. Sec-WebSocket-Protocol 头: token, xxx
   */
  private authenticate(request: IncomingMessage): { userId: number; username?: string } | null {
    let token: string | null = null;

    // 方式1：URL 参数
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      token = url.searchParams.get('token');
    } catch {
      // ignore
    }

    // 方式2：Authorization 头（部分 WebSocket 客户端支持）
    if (!token) {
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      console.log('🔒 WebSocket 鉴权失败: 缺少 token');
      return null;
    }

    const decoded = verifyJWT(token);
    if (!decoded) {
      console.log('🔒 WebSocket 鉴权失败: token 无效');
      return null;
    }

    return { userId: decoded.userId, username: decoded.username };
  }

  /**
   * 心跳检测：每 30 秒 ping 所有连接，超时未 pong 则断开
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [userId, conns] of this.connections) {
        for (const ws of conns) {
          if (ws.isAlive === false) {
            console.log(`💔 WebSocket 心跳超时，断开: userId=${userId}`);
            ws.terminate();
            conns.delete(ws);
            if (conns.size === 0) {
              this.connections.delete(userId);
            }
            continue;
          }
          ws.isAlive = false;
          ws.ping();
        }
      }
    }, 30000);
  }

  /**
   * 系统负载定时广播（每 30 秒）
   */
  private startSystemLoadBroadcast() {
    this.systemLoadInterval = setInterval(() => {
      // 仅当有在线用户时才计算和推送
      if (this.connections.size === 0) return;

      const memUsage = process.memoryUsage();
      const loadData = {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
        wsStats: this.getStats(),
      };

      this.broadcast('system:load', loadData);
    }, 30000);
  }

  /**
   * 优雅关闭
   */
  async close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.systemLoadInterval) {
      clearInterval(this.systemLoadInterval);
      this.systemLoadInterval = null;
    }

    // 关闭所有连接
    for (const [, conns] of this.connections) {
      for (const ws of conns) {
        ws.close(1000, 'Server shutting down');
      }
    }
    this.connections.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('🔌 WebSocket 服务已关闭');
  }
}

// 导出单例
export const wsServer = new WebSocketService();

