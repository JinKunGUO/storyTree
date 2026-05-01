# AI 并发处理优化方案

> 更新时间：2026-05-01  
> 状态：层次1-3均已完成（含v1路由迁移、API限流、超时熔断），WebSocket 实时推送已完成，仅 Worker 独立进程待实施

---

## 〇、核心概念科普：轮询 vs 并发 vs WebSocket

> 如果你对这三个概念不太熟悉，这一节用生活中的比喻帮你彻底搞懂。

### 它们解决的是什么问题？

这三个概念解决的是**完全不同层面**的问题，不要混为一谈：

| 概念 | 解决什么问题 | 生活比喻 |
|------|------------|---------|
| **并发优化** | 后端同时能处理多少个 AI 任务、怎么排队 | 餐厅厨房有几个厨师、怎么安排做菜顺序 |
| **轮询（Polling）** | 前端怎么知道后端的任务完成了 | 你点了菜之后，怎么知道菜做好了 |
| **WebSocket** | 一种替代轮询的通信技术 | 服务员主动把菜端上来，而不是你反复去问 |

### 1. 并发优化 —— "厨房管理"

**并发**是指后端同时处理多个任务的能力。

想象一个餐厅厨房：
- **没有并发**：只有 1 个厨师，10 个人点菜，必须一个一个做，第 10 个人要等很久
- **有并发**：有 3 个厨师同时做菜，10 个人点菜，3 个同时处理，7 个排队
- **公平调度**：不能让一个人点了 5 道菜就把所有厨师占满，别人一道菜都吃不上
- **限流保护**：厨房最多同时做 8 道菜，再多就让客人排队等
- **熔断机制**：如果食材供应商（AI API）出了问题，连续 3 道菜做失败了，就暂停做菜 60 秒，避免浪费食材

本项目中，并发优化的代码在 `api/src/workers/aiWorker.ts`（Bull 队列、限流器、熔断器）。

### 2. 轮询（Polling）—— "你不停跑去厨房问"

**轮询**是前端获取后端结果的一种方式：前端每隔几秒发一次 HTTP 请求，问后端"任务好了没？"

```
你：菜好了吗？    服务员：还没。
（等 3 秒）
你：菜好了吗？    服务员：还没。
（等 3 秒）
你：菜好了吗？    服务员：还没。
（等 3 秒）
你：菜好了吗？    服务员：好了！给你。
```

**优点**：实现简单，前后端都不需要特殊技术。
**缺点**：
- **浪费资源**：90% 的请求得到的回答是"还没好"，白白消耗服务器资源
- **有延迟**：任务在两次轮询之间完成，你要等到下一次轮询才知道（平均延迟 = 轮询间隔 / 2）
- **不可扩展**：8 个用户同时等结果 = 每秒 2.67 次无效请求，100 个用户就是 33 次/秒

**轮询分两种**：
- **短轮询（Short Polling）**：固定间隔请求，不管有没有结果都立即返回。**本项目之前用的就是这种**。
- **长轮询（Long Polling）**：服务器收到请求后不立即返回，而是"挂住"连接，等有结果了再返回。减少了无效请求，但实现更复杂。

### 3. WebSocket —— "服务员主动端菜上来"

**WebSocket** 是一种全双工通信协议。和 HTTP 的"一问一答"不同，WebSocket 建立连接后，**服务器可以主动给客户端发消息**。

```
你：（坐在座位上等）
服务员：（菜做好了，主动端过来）您的菜好了！
```

**工作原理**：
1. 客户端发一个 HTTP 请求说"我要升级为 WebSocket"
2. 服务器同意，连接"升级"为 WebSocket
3. 之后双方可以随时互发消息，不需要每次都建立新连接

```
HTTP（短轮询）：                    WebSocket：
客户端 → 服务器（请求1）            客户端 ←→ 服务器（一条长连接）
服务器 → 客户端（响应1）            
客户端 → 服务器（请求2）            服务器随时可以主动推消息给客户端
服务器 → 客户端（响应2）            客户端也可以随时发消息给服务器
客户端 → 服务器（请求3）
...每次都是新的请求-响应             只有一条连接，双向通信
```

**优点**：
- **零延迟**：任务完成的瞬间就能通知前端
- **省资源**：不需要反复建立 HTTP 连接，一条连接可以传输无数消息
- **可扩展**：100 个用户 = 100 条连接，几乎不消耗 CPU

**缺点**：
- **实现复杂**：需要处理连接管理、断线重连、心跳保活
- **不 100% 可靠**：某些网络环境（企业防火墙、旧代理服务器）可能不支持 WebSocket
- **需要降级方案**：WebSocket 连不上时，必须回退到轮询

### 4. 三者的关系

```
┌──────────────────────────────────────────────────────────────┐
│                     用户点击"AI续写"                          │
│                          │                                    │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────┐             │
│  │           后端：并发优化                       │             │
│  │  任务进入 Bull 队列 → 公平调度 → Worker 处理  │             │
│  │  （限流 5QPS + 熔断保护 + 并发度 3）          │             │
│  └──────────────────────┬──────────────────────┘             │
│                          │ 任务完成了，怎么通知前端？          │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────┐             │
│  │           通知方式的选择                       │             │
│  │                                               │             │
│  │  方式A：短轮询（旧方案）                       │             │
│  │    前端每 3 秒问一次"好了没"                   │             │
│  │    延迟 ~1.5 秒，浪费请求                      │             │
│  │                                               │             │
│  │  方式B：WebSocket（新方案）                    │             │
│  │    后端完成后主动推送给前端                     │             │
│  │    延迟 ~0 秒，零额外请求                      │             │
│  │                                               │             │
│  │  降级：WebSocket 断开时自动回退到方式A          │             │
│  └─────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

**总结**：
- **并发优化**管的是"后厨"——任务怎么排队、怎么限流、怎么防雪崩
- **轮询/WebSocket**管的是"前厅"——任务完成后怎么通知用户
- 两者是互补关系，不是替代关系。即使用了 WebSocket，后端的并发控制、限流、熔断仍然必不可少

### 5. 本项目的演进路径

```
阶段1（最初）：同步调用，无并发
  前端 → 后端 → AI API → 返回结果（30秒等待，一次只能处理一个）

阶段2（并发优化）：异步队列 + 短轮询
  前端 → 提交任务 → 每3秒问一次"好了没" → 拿到结果
  后端 → Bull队列 → 同时处理8个任务 → 限流+熔断保护

阶段3（当前）：异步队列 + WebSocket 实时推送
  前端 → 提交任务 → WebSocket 等待推送 → 0延迟拿到结果
  后端 → Bull队列 → 同时处理8个任务 → 完成后主动推送
  降级 → WebSocket 断开时自动回退短轮询
```

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

**已于 2026-05-01 实施**。全部 15 个文件改动均已完成。

**问题**：前端使用短轮询（Short Polling）获取 AI 任务状态，每 2-3 秒发一次 HTTP 请求。8 个用户同时提交 AI 任务时，产生 2.67 QPS 的无效轮询请求，浪费服务器资源且增加延迟。

**方案**：使用原生 WebSocket（`ws` 库）替代短轮询，AI 任务完成/失败时由后端主动推送给前端。

#### 6.5.1 技术选型

选 `ws` 而非 `socket.io` 的理由：
- 小程序原生支持 WebSocket（`uni.connectSocket`），但**不支持** socket.io 的私有协议
- `ws` 更轻量（无额外依赖），1核2G 服务器资源有限
- Nginx 已配置 WebSocket 升级头（`Upgrade`、`Connection`），无需额外改动

#### 6.5.2 改动文件清单（15 个文件）

**后端（4 个文件）**：

| 文件 | 改动说明 |
|------|---------|
| `api/package.json` | 新增 `ws@^8.20.0` + `@types/ws@^8.18.1` 依赖 |
| `api/src/utils/websocket.ts` | **新建**（381 行）— WebSocket 服务：连接管理、JWT 鉴权、心跳、推送 API |
| `api/src/index.ts` | `app.listen()` → `http.createServer(app)` + `wsServer.init(server)` 挂载 WebSocket |
| `api/src/workers/aiWorker.ts` | 续写/润色/插图任务完成/失败时调用 `wsServer.sendTaskStatus()` |

**Web 前端（7 个文件）**：

| 文件 | 改动说明 |
|------|---------|
| `web/js/ws-client.js` | **新建**（404 行）— 统一 WebSocket 客户端：自动重连、降级轮询、事件分发 |
| `web/write.html` | `pollTaskStatus()` → `StoryTreeWS.watchTask()` + 降级轮询 |
| `web/story.html` | `pollAiChapterTaskStatus()` → `StoryTreeWS.watchTask()` + 降级轮询 |
| `web/payment.html` | `startPaymentPolling()` → `StoryTreeWS.on('payment:status')` + 降级轮询 |
| `web/ai-tasks.html` | 30 秒定时刷新 → `StoryTreeWS.on('task:status')` 实时更新 |
| `web/story-tree.html` | 30 秒自动刷新 → `StoryTreeWS.on('tree:update')` + `task:status` 实时更新 |
| `web/js/system-load-widget.js` | 30 秒轮询 → `StoryTreeWS.on('system:load')` + 60 秒降级轮询 |

**小程序端（3 个文件）**：

| 文件 | 改动说明 |
|------|---------|
| `miniprogram/src/utils/ws-client.ts` | **新建**（322 行）— 小程序 WebSocket 客户端（`uni.connectSocket`） |
| `miniprogram/src/components/ai-panel/index.vue` | `while` 循环轮询 → `waitForTaskResult()` WebSocket + 降级 |
| `miniprogram/src/pages/story/index.vue` | `startPollTask()` → `mpWsClient.watchTask()` + 降级轮询 |

**其他（1 个文件）**：

| 文件 | 改动说明 |
|------|---------|
| `api/src/routes/payment.ts` | 支付回调成功/取消时调用 `wsServer.sendToUser()` 推送 `payment:status` |

#### 6.5.3 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  前端（Web / 小程序）                                            │
│                                                                   │
│  连接: ws://域名/api/ws?token=xxx                                │
│                                                                   │
│  接收事件:                                                        │
│    - task:status    (AI任务状态变更：completed/failed)             │
│    - payment:status (支付状态变更：success/cancelled)             │
│    - tree:update    (故事树新章节发布)                             │
│    - system:load    (系统负载信息，每30秒推送)                     │
│                                                                   │
│  降级: WebSocket 断开时自动回退到短轮询                            │
└───────────────────────────┬───────────────────────────────────────┘
                            │ WebSocket 长连接
┌───────────────────────────▼───────────────────────────────────────┐
│  后端 Express + ws                                                 │
│                                                                     │
│  WebSocketServer 挂载在 /api/ws                                    │
│  连接管理: Map<userId, Set<WebSocket>>（支持同一用户多设备连接）    │
│  鉴权方式: URL 参数 ?token=xxx 或 Authorization 头                 │
│  心跳检测: 每30秒 ping/pong，超时断开                              │
│                                                                     │
│  推送时机:                                                          │
│    - AI Worker 完成/失败任务 → wsServer.sendTaskStatus()            │
│    - 支付回调 → wsServer.sendToUser('payment:status', ...)         │
│    - 新章节发布 → wsServer.sendTreeUpdate()                        │
│    - 定时器(30s) → wsServer.broadcast('system:load', ...)          │
└─────────────────────────────────────────────────────────────────────┘
```

#### 6.5.4 消息协议

所有 WebSocket 消息均为 JSON 格式，统一结构：

```json
{
  "event": "事件名称",
  "data": { /* 事件数据 */ }
}
```

**各事件的 data 结构**：

```typescript
// task:status — AI 任务完成/失败
{
  "event": "task:status",
  "data": {
    "taskId": 123,
    "status": "completed" | "failed",
    "result": { /* 任务结果，如 options 列表 */ },
    "error": "错误信息（仅 failed 时）"
  }
}

// payment:status — 支付状态变更
{
  "event": "payment:status",
  "data": {
    "orderId": "order_xxx",
    "status": "success" | "cancelled",
    "membershipType": "monthly" | "yearly"
  }
}

// tree:update — 故事树更新
{
  "event": "tree:update",
  "data": {
    "storyId": 456,
    "nodeId": 789,
    "action": "published"
  }
}

// system:load — 系统负载（每 30 秒广播）
{
  "event": "system:load",
  "data": {
    "continuation": { "active": 2, "waiting": 1, "max": 3 },
    "polish": { "active": 0, "waiting": 0, "max": 3 },
    "illustration": { "active": 1, "waiting": 0, "max": 2 }
  }
}
```

#### 6.5.5 后端核心实现

**文件**：`api/src/utils/websocket.ts`（381 行）

```typescript
// 核心类：WebSocketService（单例模式）
class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<number, Set<AuthenticatedWebSocket>> = new Map();
  
  // 初始化：挂载到 HTTP Server
  init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/api/ws' });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.startHeartbeat();      // 30秒心跳检测
    this.startSystemLoadBroadcast(); // 30秒系统负载广播
  }
  
  // 连接鉴权：JWT token 验证
  async authenticate(req): Promise<number | null> {
    // 支持两种方式：URL 参数 ?token=xxx 或 Authorization 头
    const token = url.searchParams.get('token') || req.headers.authorization;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  }
  
  // 按用户推送
  sendToUser(userId: number, event: string, data: any) {
    const userConns = this.connections.get(userId);
    if (!userConns) return;
    const message = JSON.stringify({ event, data });
    for (const ws of userConns) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }
  }
  
  // 便捷方法：推送 AI 任务状态
  sendTaskStatus(userId, taskId, status, result?) { ... }
  sendPaymentStatus(userId, orderId, status, data?) { ... }
  sendTreeUpdate(storyId, nodeId, action) { ... }
  
  // 全局广播（如 system:load）
  broadcast(event: string, data: any) { ... }
}

export const wsServer = new WebSocketService(); // 单例导出
```

**挂载方式**（`api/src/index.ts`）：

```typescript
import { createServer } from 'http';
import { wsServer } from './utils/websocket';

const server = createServer(app);  // 替代原来的 app.listen()
wsServer.init(server);             // WebSocket 挂载到同一端口
server.listen(PORT);

// 优雅关闭
process.on('SIGTERM', () => { wsServer.close(); server.close(); });
```

**AI Worker 推送**（`api/src/workers/aiWorker.ts`）：

```typescript
import { wsServer } from '../utils/websocket';

// 续写任务完成时（第 693 行）
wsServer.sendTaskStatus(userId, taskId, 'completed', { options });

// 续写任务失败时（第 710 行）
wsServer.sendTaskStatus(userId, taskId, 'failed', { error: errorMessage });

// 润色完成（第 1097 行）、插图完成（第 1208 行）同理
```

#### 6.5.6 Web 前端客户端

**文件**：`web/js/ws-client.js`（404 行）

核心功能：
- **自动连接**：页面加载时调用 `StoryTreeWS.connect()`，自动获取 token 建立连接
- **自动重连**：断线后指数退避重连（1s → 2s → 4s → ... → 30s），最多 20 次
- **心跳保活**：每 25 秒发送 ping，服务端 30 秒未收到则断开
- **事件系统**：`on(event, callback)` / `off()` / `once()` 订阅/取消/一次性监听
- **任务监听**：`watchTask(taskId, callback)` 便捷方法，自动过滤 taskId
- **降级轮询**：WebSocket 断开时自动启动 HTTP 短轮询，重连后自动停止
- **页面可见性**：页面不可见时暂停心跳，可见时恢复

```javascript
// 各页面使用方式（以 write.html 为例）
StoryTreeWS.connect();

// 提交 AI 任务后
const unwatch = StoryTreeWS.watchTask(taskId, (data) => {
  if (data.status === 'completed') {
    unwatch();
    // 处理结果...
  } else if (data.status === 'failed') {
    unwatch();
    showError(data.error);
  }
});

// 同时启动降级轮询兜底
const pollInterval = StoryTreeWS.isConnected() ? 10000 : 3000;
```

**各页面集成方式**：

| 页面 | WebSocket 事件 | 降级轮询间隔 |
|------|---------------|-------------|
| `write.html` | `watchTask(taskId)` | 连接时 10s，断开时 3s |
| `story.html` | `watchTask(taskId)` | 连接时 10s，断开时 3s |
| `payment.html` | `on('payment:status')` | 连接时 10s，断开时 3s |
| `ai-tasks.html` | `on('task:status')` | 连接时 60s，断开时 15s |
| `story-tree.html` | `on('tree:update')` + `on('task:status')` | 连接时 60s，断开时 15s |
| `system-load-widget.js` | `on('system:load')` | 连接时不轮询，断开时 60s |

#### 6.5.7 小程序端客户端

**文件**：`miniprogram/src/utils/ws-client.ts`（322 行）

与 Web 端功能一致，但使用小程序原生 API：

```typescript
// 使用 uni.connectSocket 替代浏览器原生 WebSocket
socketTask = uni.connectSocket({
  url: wsUrl,  // wss://域名/api/ws?token=xxx
  header: { 'Authorization': `Bearer ${token}` }
});

// 事件监听
socketTask.onMessage((res) => { ... });
socketTask.onClose(() => { scheduleReconnect(); });
```

**小程序特殊处理**：
- 最大重连次数 10 次（小程序后台限制更严格）
- 心跳间隔 30 秒（与服务端一致）
- 导出 `mpWsClient` 单例，各页面/组件共享同一连接

**各组件集成方式**：

| 组件/页面 | WebSocket 事件 | 降级轮询间隔 |
|----------|---------------|-------------|
| `ai-panel/index.vue`（续写/润色/插图） | `mpWsClient.watchTask(taskId)` | 连接时 5s，断开时 2s |
| `story/index.vue`（整章续写） | `mpWsClient.watchTask(taskId)` | 连接时 10s，断开时 5s |

#### 6.5.8 降级策略详解

WebSocket 不是 100% 可靠（网络切换、企业防火墙、旧代理服务器），所有场景均保留降级轮询兜底：

```
┌────────────────────────────────────────────────────────────────┐
│                      连接状态机                                  │
│                                                                  │
│  ┌──────────┐   连接成功   ┌──────────┐   断线    ┌──────────┐ │
│  │ 初始化    │ ──────────→ │ 已连接    │ ───────→ │ 断线重连  │ │
│  │(尝试连接) │             │(实时推送) │          │(降级轮询) │ │
│  └──────────┘             └──────────┘          └──────────┘  │
│       │                        ↑                     │          │
│       │                        │    重连成功          │          │
│       │                        └─────────────────────┘          │
│       │                                                          │
│       │   连接失败              ┌──────────┐                    │
│       └────────────────────→   │ 纯轮询    │                    │
│                                 │(无WS连接) │                    │
│                                 └──────────┘                    │
└────────────────────────────────────────────────────────────────┘
```

**三种状态下的行为**：

| 状态 | WebSocket | 轮询间隔 | 说明 |
|------|:---------:|---------|------|
| **已连接** | ✅ 实时推送 | 5-10 秒（仅兜底） | 正常情况，轮询几乎不会触发 |
| **断线重连** | ❌ 重连中 | 2-5 秒（主力获取结果） | 指数退避重连，同时靠轮询获取结果 |
| **纯轮询** | ❌ 未连接 | 2-3 秒（原始模式） | WebSocket 完全不可用时的兜底 |

#### 6.5.9 效果对比

| 指标 | 改动前（短轮询） | 改动后（WebSocket + 降级） |
|------|:----------------:|:------------------------:|
| AI 任务完成通知延迟 | ~1.5 秒（轮询间隔/2） | **~0 秒**（实时推送） |
| 8 用户等待时的轮询 QPS | 2.67 QPS | **0 QPS**（WebSocket 连接时） |
| 100 用户等待时的轮询 QPS | 33.3 QPS | **0 QPS**（WebSocket 连接时） |
| 每用户连接内存占用 | 0（无状态） | ~50KB（WebSocket 连接） |
| 100 用户总内存占用 | 0 | ~5MB |
| 网络不稳定时 | 轮询正常工作 | 自动降级到轮询，体验不变 |

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
