# AI 并发处理优化方案

> 更新时间：2026-05-01  
> 状态：层次1-3均已完成（含v1路由迁移、API限流、超时熔断），WebSocket 实时推送已完成，仅 Worker 独立进程待实施

---

## 一、当前架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Express 主进程                                 │
│                                                                       │
│  ┌────────────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │ POST /continuation │   │ POST /polish │   │ POST /illust │       │
│  │  /submit           │   │              │   │  /submit     │       │
│  │ (整章/段落模式)     │   │              │   │              │       │
│  └──────┬─────────────┘   └──────┬───────┘   └──────┬───────┘       │
│         │                         │                   │               │
│    ┌────▼────┐               ┌────▼────┐         ┌────▼────┐        │
│    │公平调度 │               │公平调度 │         │公平调度 │        │
│    │任务去重 │               │任务去重 │         │任务去重 │        │
│    └────┬────┘               └────┬────┘         └────┬────┘        │
│         │                         │                   │               │
│  ┌──────▼─────────────────────────▼───────────────────▼──────┐       │
│  │                      Redis (Bull 队列)                      │       │
│  │  续写队列(并发3)*   润色队列(并发3)   插图队列(并发2)       │       │
│  └──────┬──────────────────────┬───────────────────┬──────────┘       │
│         │                      │                   │                  │
│  ┌──────▼──────────────────────▼───────────────────▼──────────┐      │
│  │              限流 + 熔断保护层                                │      │
│  │  TokenBucketLimiter (5 QPS)  +  CircuitBreaker (3次/60s)    │      │
│  └──────┬──────────────────────┬───────────────────┬──────────┘      │
│         │                      │                   │                  │
│  ┌──────▼───────┐      ┌──────▼───────┐   ┌──────▼───────┐          │
│  │ Worker ×3    │      │ Worker ×3    │   │ Worker ×2    │          │
│  │ (千问文本API) │      │ (千问文本API) │   │ (通义万相)   │          │
│  └──────────────┘      └──────────────┘   └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘

* 续写队列处理两种模式：
  - mode=chapter/full：章节AI创作（整章生成）
  - mode=segment：章节内AI续写段落（小段落续写）
```

**系统最大并发 AI 调用数：8**（续写3 + 润色3 + 插图2）

**说明**：四项 AI 功能共用 3 个队列，其中"章节AI创作"和"章节内AI续写段落"共享同一个续写队列，通过 `mode` 参数区分。

---

## 二、已完成的优化 ✅

### 2.1 提升 Bull 队列并发度 ✅

**文件**：`api/src/workers/aiWorker.ts`

| 队列 | 改动前 | 改动后 | 原因 |
|------|--------|--------|------|
| 续写队列 | `process(async ...)` (并发1) | `process(3, async ...)` | AI调用是I/O等待，不消耗CPU |
| 润色队列 | `process(async ...)` (并发1) | `process(3, async ...)` | 同上 |
| 插图队列 | `process(async ...)` (并发1) | `process(2, async ...)` | 图片生成资源消耗较大，保守设置 |

**举例**：  
- 改动前：用户A提交续写 → 用户B提交续写 → B必须等A完成才开始处理（串行）
- 改动后：A和B的续写任务同时处理，互不阻塞

### 2.2 用户级公平调度（按类型分别限制）✅

**文件**：`api/src/routes/ai-v2.ts`

```typescript
const MAX_USER_ACTIVE_TASKS_PER_TYPE = {
  continuation: 2,  // 续写最多同时2个
  polish: 2,        // 润色最多同时2个
  illustration: 1   // 插图最多同时1个
};
```

**核心逻辑**：提交任务时，检查该用户**同类型**的 pending/processing 任务数，超限返回 HTTP 429。

**举例**：
- 用户同时提交2个续写 + 2个润色 + 1个插图 = 5个并行任务 ✅（不同类型互不影响）
- 用户尝试提交第3个续写 → 返回 429：「您当前有2个续写任务正在处理中」

### 2.3 任务去重 ✅

**文件**：`api/src/routes/ai-v2.ts`

**核心逻辑**：提交前检查是否已存在相同 `(userId, taskType, nodeId, storyId)` 且状态为 pending/processing 的任务。

**举例**：
- 用户对章节A连续点击3次"AI续写" → 只有第1次创建任务，后2次返回已有的 taskId
- 用户对章节A和章节B分别点击"AI续写" → 两个都正常创建（nodeId 不同）

### 2.4 润色接口智能降级 ✅

**文件**：`api/src/routes/ai-v2.ts`

**策略**：
1. 检查润色队列活跃数，如果已满（≥3），直接返回 taskId 异步模式
2. 如果队列有空位，尝试5秒内同步返回结果（向后兼容旧前端）
3. 5秒超时则降级为异步，返回 taskId 让前端轮询

**举例**：
- 队列空闲时：用户点击润色 → 3秒内直接返回润色结果（体感如同步）
- 队列繁忙时：用户点击润色 → 立即返回 `{taskId, status: "processing"}`，前端轮询获取结果

### 2.5 任务轮询返回队列位置 ✅

**文件**：`api/src/routes/ai-v2.ts` — `GET /tasks/:taskId`

当任务状态为 pending 时，返回额外信息：
```json
{
  "status": "pending",
  "queuePosition": 3,
  "estimatedWaitSeconds": 90,
  "message": "您的任务排在第3位，预计等待约90秒"
}
```

**举例**：前端可以展示"前面还有2个任务，预计等待60秒"，而不是让用户干等。

### 2.6 v1 同步路由迁移完成 ✅

**文件**：`api/src/routes/ai.ts`、`web/write.html`、`miniprogram/src/components/ai-panel/index.vue`、`miniprogram/src/api/ai.ts`

**迁移记录（2026-04-30）**：
- `web/write.html`：`showAiSuggestions()` 从 `/api/ai/generate` → `/api/ai/v2/continuation/submit` + `pollTaskStatus()`
- `miniprogram/src/components/ai-panel/index.vue`：续写 Tab 从 `http.post('/api/ai/generate')` → `/api/ai/v2/continuation/submit` + 轮询
- `miniprogram/src/api/ai.ts`：v1 函数（`createContinueTask`、`acceptAiOption`）标记 `@deprecated`
- `api/src/routes/ai.ts`：保留作为兜底，防止遗漏的旧版客户端调用

**效果**：所有四项 AI 功能（续写整章/续写段落/润色/插图）在 Web 端和小程序端均通过 v2 异步队列处理，享受并发控制、公平调度和任务去重。

---

## 三、四项 AI 功能优化覆盖情况

| AI功能 | 后端路由 | 前端调用（Web / 小程序） | 并发度提升 | 公平调度 | 任务去重 | 智能降级 |
|--------|---------|---------|:----------:|:--------:|:--------:|:--------:|
| **章节AI创作**（整章） | v2 `POST /continuation/submit` (mode=chapter/full) | `web/story.html` / `miniprogram story/index.vue` | ✅ | ✅ | ✅ | — |
| **章节内AI续写段落** | v2 `POST /continuation/submit` (mode=segment) | `web/write.html` / `miniprogram ai-panel` | ✅ | ✅ | ✅ | — |
| **章节内AI润色** | v2 `POST /polish` | `web/write.html` / `miniprogram ai-panel` | ✅ | ✅ | ❌* | ✅ |
| **章节内AI插图** | v2 `POST /illustration/submit` | `web/write.html` / `miniprogram ai-panel` | ✅ | ✅ | ✅ | — |

> *润色功能未做去重，因为润色是对内容的即时操作，不绑定 nodeId/storyId，重复提交的场景较少。
> 
> **全部四项功能已完成 v1→v2 迁移**，均通过异步队列处理，享受并发控制和公平调度。

---

## 四、「惊喜时间」功能优化分析

### 当前状态

「惊喜时间」功能**仅存在于续写（continuation）功能**中，润色和插图没有此功能。

| AI功能 | 是否支持惊喜时间 | 实现方式 |
|--------|:----------------:|---------|
| 章节AI创作 | ✅ 支持 | Bull 队列 `delay` 参数延迟执行 |
| 章节内AI续写段落 | ❌ 不支持（v1路由无此功能） | — |
| 章节内AI润色 | ❌ 不支持 | 即时操作，无需延迟 |
| 章节内AI插图 | ❌ 不支持 | 即时操作，无需延迟 |

### 惊喜时间的并发优化情况

惊喜时间通过 Bull 队列的 `delay` 参数实现：

```typescript
// ai-v2.ts 第 270 行
const delay = scheduledAt ? scheduledAt.getTime() - now.getTime() : 0;
await aiContinuationQueue.add(jobData, { delay: Math.max(delay, 0), priority: task.priority });
```

**已优化的点**：
- ✅ 惊喜时间任务进入 Bull 队列后，到达指定时间自动开始处理
- ✅ 受队列并发度（3）控制，不会无限并发
- ✅ 受用户并发限制（续写最多2个）控制

**潜在问题**：
- ⚠️ 如果多个用户设置了**相同的惊喜时间**（如"今晚22:00"），到达时间点时可能有大量任务同时从 delay 状态变为 waiting，队列瞬间堆积
- ⚠️ 惊喜时间任务的 `priority = 0`（低于立即执行的 `priority = 10`），意味着如果此时有立即执行的任务，惊喜时间任务会被排在后面

**举例**：
- 10个用户都设置了"今晚22:00"惊喜时间 → 22:00 时 10 个任务同时进入队列 → 续写队列并发3，需要处理4轮（约2分钟）→ 最后一个用户可能22:02才收到结果
- 这在当前用户量下不是问题，但如果用户量增长需要关注

---

## 五、并发场景分析

### 场景1：同一用户提交多个任务

| 操作顺序 | 结果 |
|----------|------|
| 章节A续写 | ✅ 通过（续写 1/2） |
| 章节B续写 | ✅ 通过（续写 2/2） |
| 章节C续写 | ❌ 返回429（续写已满） |
| 章节C润色 | ✅ 通过（润色 0/2，与续写互不影响） |
| 章节C插图 | ✅ 通过（插图 0/1，与续写互不影响） |

### 场景2：10个用户同时提交

```
续写队列(并发3): 用户1,2,3 立即处理 | 用户4,5 在队列中排队
润色队列(并发3): 用户6,7,8 立即处理
插图队列(并发2): 用户9,10 立即处理

→ 同时处理 8 个任务，2 个排队等待
→ 排队用户通过轮询接口可看到队列位置
```

---

## 六、未来优化方向（未实施）

### ~~6.1 废弃 v1 同步路由并迁移前端~~ ✅ 已完成

**已于 2026-04-30 完成迁移**，详见 2.6 节。v1 路由文件保留作为兜底。

---

### 6.2 Worker 独立进程

**问题**：当前 AI Worker 和 HTTP 服务在同一个 Node.js 进程中运行。如果 Worker 处理大量任务导致内存飙升，HTTP 服务也会受影响。

**方案**：通过 PM2 将 Worker 拆分为独立进程：

```
# ecosystem.config.js
{
  apps: [
    { name: 'api', script: 'dist/index.js' },           // HTTP 服务
    { name: 'ai-worker', script: 'dist/worker.js' }     // AI Worker
  ]
}
```

**举例**：
- 当前：AI Worker 内存泄漏 → 整个服务崩溃，用户无法访问网站
- 优化后：Worker 崩溃 → PM2 自动重启 Worker，HTTP 服务不受影响

**风险**：1核2G 服务器上多进程可能内存紧张（预计额外占用 100-200MB）。

---

### ~~6.3 AI API 供应商限流保护~~ ✅ 已完成

**已于 2026-04-30 实施**。

**文件**：`api/src/workers/aiWorker.ts`

**实现方式**：自研令牌桶限流器（`TokenBucketLimiter`），无需引入第三方依赖。

```typescript
// 令牌桶限流器：最大 5 QPS
const qwenLimiter = new TokenBucketLimiter(5, 5);

// 所有 AI API 调用前先获取令牌
async function callQwenAPI(prompt, maxTokens, temperature) {
  await qwenLimiter.acquire();  // 等待令牌，超过 5 QPS 自动排队
  // ...实际调用
}
```

**效果**：
- 8个任务同时调用千问 API → 令牌桶控制最多 5 QPS → 多余请求自动等待 200ms 后发出
- 避免触发千问 API 的 QPS 限制导致批量 429 错误

---

### ~~6.4 超时和熔断机制~~ ✅ 已完成

**已于 2026-04-30 实施**。

**文件**：`api/src/workers/aiWorker.ts`

**实现方式**：

1. **单任务超时**：使用 `AbortController` + `setTimeout`
   - 文本 API（续写/润色）：30 秒超时
   - 图像 API 提交：15 秒超时（轮询阶段单独 2 分钟超时）

2. **熔断器**（`CircuitBreaker` 类，三态模型）：
   - `CLOSED`（正常）→ 连续 3 次失败 → `OPEN`（熔断）
   - `OPEN`（熔断）→ 60 秒后 → `HALF_OPEN`（半开，尝试恢复）
   - `HALF_OPEN` → 成功 → `CLOSED` | 失败 → 重新 `OPEN`

```typescript
// 熔断器：连续 3 次失败后熔断 60 秒
const qwenCircuitBreaker = new CircuitBreaker(3, 60000);

async function callQwenAPI(prompt, maxTokens, temperature) {
  await qwenLimiter.acquire();
  return qwenCircuitBreaker.execute(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      // ...
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('超时');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
```

**效果**：
- 千问 API 故障 → 第 1-3 个任务各等 30 秒超时 → 第 4 个任务立即返回"AI 服务暂时不可用" → 60 秒后自动恢复
- 避免 8 个并发位全被慢请求占满导致队列雪崩

---

### ~~6.5 WebSocket 实时推送（替代短轮询）~~ ✅ 已完成

**已于 2026-05-01 实施**。

**问题**：前端使用短轮询（Short Polling）获取 AI 任务状态，每 2-3 秒发一次 HTTP 请求。8 个用户同时提交 AI 任务时，产生 2.67 QPS 的无效轮询请求，浪费服务器资源且增加延迟。

**方案**：使用原生 WebSocket（`ws` 库）替代短轮询，AI 任务完成/失败时由后端主动推送给前端。

**改动文件**：

| 文件 | 改动说明 |
|------|---------|
| `api/package.json` | 新增 `ws` + `@types/ws` 依赖 |
| `api/src/utils/websocket.ts` | **新建** — WebSocket 服务（连接管理、JWT 鉴权、心跳、按用户推送） |
| `api/src/index.ts` | `app.listen()` → `http.createServer(app)` + 挂载 WebSocket |
| `api/src/workers/aiWorker.ts` | 续写/润色/插图任务完成/失败时调用 `wsServer.sendTaskStatus()` |
| `api/src/routes/payment.ts` | 支付回调成功/取消时调用 `wsServer.sendToUser()` |
| `web/js/ws-client.js` | **新建** — Web 端统一 WebSocket 客户端（自动重连 + 降级轮询） |
| `web/write.html` | `pollTaskStatus()` → WebSocket 监听 + 降级轮询 |
| `web/story.html` | `pollAiChapterTaskStatus()` → WebSocket 监听 + 降级轮询 |
| `web/payment.html` | `startPaymentPolling()` → WebSocket 监听 + 降级轮询 |
| `web/ai-tasks.html` | 30秒定时刷新 → WebSocket 实时更新 |
| `web/story-tree.html` | 30秒自动刷新 → WebSocket 实时更新 |
| `web/js/system-load-widget.js` | 30秒轮询 → WebSocket 推送 + 60秒降级轮询 |
| `miniprogram/src/utils/ws-client.ts` | **新建** — 小程序 WebSocket 客户端（`uni.connectSocket`） |
| `miniprogram/src/components/ai-panel/index.vue` | `while` 循环轮询 → `waitForTaskResult()` WebSocket + 降级 |
| `miniprogram/src/pages/story/index.vue` | `startPollTask()` → WebSocket 监听 + 降级轮询 |

**架构**：

```
前端（Web / 小程序）
  │
  │ WebSocket 长连接 ws://域名/api/ws?token=xxx
  │
后端（Express + ws）
  │
  ├─ 连接管理: Map<userId, Set<WebSocket>>
  ├─ JWT 鉴权: 连接时验证 token
  ├─ 心跳检测: 30秒 ping/pong，超时断开
  │
  └─ 推送事件:
       ├─ task:status    — AI 任务完成/失败（由 aiWorker 触发）
       ├─ payment:status — 支付成功/取消（由 payment 回调触发）
       ├─ tree:update    — 故事树更新
       └─ system:load    — 系统负载
```

**降级策略**：WebSocket 不是 100% 可靠，所有场景均保留降级轮询兜底：
- WebSocket 连接时：轮询间隔放宽到 5-10 秒（仅作兜底）
- WebSocket 断开时：自动回退到原始 2-3 秒短轮询
- WebSocket 重连成功：自动切回实时推送

**效果**：
- AI 任务完成延迟：3 秒（轮询间隔）→ 0 秒（实时推送）
- 轮询 QPS：2.67 QPS/8用户 → 0 QPS（WebSocket 连接时）
- 每个连接内存占用约 50KB，100 连接 ≈ 5MB

---

### 6.6 跨用户公平调度（FIFO 优先级）

**问题**：当前 Bull 队列是 FIFO，如果一个用户连续提交了2个任务占满了自己的限额，其他用户的任务自然排在后面。但如果多个用户各提交1个任务，先提交的先处理，不存在不公平。

**潜在问题**：如果未来放开单用户限制（如 VIP 用户不限量），可能出现 VIP 用户大量任务霸占队列的情况。

**方案**：引入"首次提交优先"策略——用户当前没有活跃任务时，新提交的任务优先级更高：

```typescript
const hasActiveTasks = await prisma.ai_tasks.count({
  where: { user_id: userId, status: 'processing' }
});
const priority = hasActiveTasks > 0 ? 5 : 10; // 首次提交优先级更高
```

**举例**：
- 用户A已有1个任务在处理，又提交1个（priority=5）
- 用户B第一次提交（priority=10，更高）
- 队列中 B 的任务排在 A 前面

---

## 七、资源评估（1核2G 环境）

| 方案 | CPU 影响 | 内存影响 | 实施难度 |
|------|---------|---------|---------|
| ✅ 并发度提升 | 几乎无（I/O等待） | +50-100MB | 低（改1行代码） |
| ✅ 公平调度+去重 | 极低（1次DB查询） | 无 | 低 |
| ✅ 润色智能降级 | 无 | 无 | 低 |
| ✅ v1 路由迁移 | 无 | 无 | 中（已完成） |
| ⬜ Worker 独立进程 | 额外进程开销 | +100-200MB | 中 |
| ✅ API 限流保护 | 极低 | 极低 | 低（已完成） |
| ✅ 超时熔断 | 极低 | 极低 | 低（已完成） |
| ✅ WebSocket 实时推送 | 极低 | +5MB/100连接 | 中（已完成） |

---

## 八、建议实施优先级

1. ~~提升队列并发度~~ ✅
2. ~~公平调度 + 任务去重~~ ✅
3. ~~润色智能降级~~ ✅
4. ~~v1 路由迁移~~ ✅
5. ~~API 限流保护~~ ✅
6. ~~超时熔断~~ ✅
7. ~~WebSocket 实时推送（替代短轮询）~~ ✅
8. **Worker 独立进程**（用户量增长后再做）