# 高并发场景下的AI任务调度优化方案

## 📋 目录
- [问题分析](#问题分析)
- [解决方案](#解决方案)
- [技术实现](#技术实现)
- [使用指南](#使用指南)
- [性能优化](#性能优化)
- [未来扩展](#未来扩展)

---

## 问题分析

### 当前挑战
1. **固定批处理限制**：每次只处理10个任务，无法应对用户暴增
2. **缺乏负载感知**：不知道当前系统负载情况
3. **无用户反馈**：用户不知道任务延迟情况
4. **无优先级机制**：先来先服务，无法区分紧急任务

### 设计目标
✅ **尽可能满足用户设置的时间要求**  
✅ **提供明确的用户提醒信息**  
✅ **降低后端负载，避免系统崩溃**  
✅ **引导用户错峰提交**

---

## 解决方案

### 1. **动态限流机制** 🎯

根据当前队列负载动态调整批处理大小：

```typescript
// 低负载（<25个任务）：每批处理10个
// 中等负载（25-50个任务）：每批处理6个
// 高负载（50-100个任务）：每批处理3个
// 队列已满（≥100个任务）：暂停调度
```

**优势：**
- 负载低时提高吞吐量
- 负载高时保护系统稳定性
- 避免雪崩效应

---

### 2. **智能优先级队列** 🚀

多维度计算任务优先级：

#### a) 延迟时间优先
- 延迟 > 30分钟：优先级 +3
- 延迟 > 10分钟：优先级 +2
- 延迟 > 5分钟：优先级 +1

#### b) 任务类型优先
- 润色任务（快速）：优先级 +1
- 续写任务（中等）：基础优先级
- 插图任务（慢速）：优先级 -1

#### c) 用户等级优先（可扩展）
- VIP用户：优先级 +2
- 付费用户：优先级 +1
- 免费用户：基础优先级

**实现效果：**
```
任务A：延迟35分钟，续写，免费用户 → 优先级 2 (5 - 3)
任务B：延迟2分钟，润色，VIP用户 → 优先级 2 (5 - 1 - 2)
任务C：延迟15分钟，插图，免费用户 → 优先级 5 (5 - 2 + 1)

处理顺序：A/B → C
```

---

### 3. **用户延迟通知** 📬

当任务延迟超过5分钟时，自动发送通知：

```
⏰ AI任务延迟提醒

您的AI任务已延迟 15 分钟。
由于当前系统负载较高，预计还需等待约 20 分钟。

建议：
- 稍后查看任务状态
- 或选择非高峰时段（凌晨0-6点）提交任务
```

**通知渠道：**
- ✅ 站内消息（notifications表）
- 🔔 浏览器推送（可扩展）
- 📧 邮件提醒（可扩展）

---

### 4. **实时负载展示** 📊

前端实时显示系统负载，引导用户错峰：

#### 负载等级定义
| 等级 | 队列任务数 | 预计等待 | 建议 |
|------|-----------|---------|------|
| 🟢 低负载 | < 10 | 2分钟 | 立即提交 |
| 🟡 中等负载 | 10-30 | 5分钟 | 可以提交 |
| 🔴 高负载 | 30-70 | 15分钟 | 建议错峰 |
| 🚨 严重负载 | ≥ 70 | 30分钟+ | 强烈建议错峰 |

#### 前端组件示例

```javascript
// 初始化负载显示组件
const loadWidget = new SystemLoadWidget('loadContainer');
await loadWidget.init();

// 组件会自动每30秒更新一次
```

**显示效果：**
```
┌─────────────────────────────────────┐
│ 🔴 高负载                            │
│ 当前队列: 45 个任务                  │
│ 预计等待: ~15分钟                    │
├─────────────────────────────────────┤
│ ℹ️ 当前系统负载较高，建议稍后提交    │
│   或选择非高峰时段（凌晨0-6点）      │
└─────────────────────────────────────┘
```

---

### 5. **推荐时间API** 🕐

根据当前时段推荐最佳提交时间：

**高峰时段（8:00-23:00）推荐：**
- 今晚22:00（推荐）- 夜间系统负载较低
- 明天凌晨2:00（最佳）- 凌晨时段系统负载最低
- 明天早上6:00 - 早晨时段系统负载较低

**非高峰时段（0:00-8:00）推荐：**
- 立即执行（推荐）- 当前系统负载较低

---

## 技术实现

### 后端实现

#### 1. 动态限流配置
```typescript
const RATE_LIMIT_CONFIG = {
  MAX_BATCH_SIZE: 10,           // 最大批处理大小
  MIN_BATCH_SIZE: 3,            // 最小批处理大小
  MAX_QUEUE_SIZE: 100,          // 队列最大容量
  HIGH_LOAD_THRESHOLD: 50,      // 高负载阈值
  DELAY_WARNING_MINUTES: 5,     // 延迟警告阈值
};
```

#### 2. 队列负载监控
```typescript
async function getQueueLoad() {
  const [continuationWaiting, continuationActive] = await Promise.all([
    aiContinuationQueue.getWaitingCount(),
    aiContinuationQueue.getActiveCount()
  ]);
  
  // 获取所有队列的负载
  return {
    total: totalWaiting + totalActive,
    waiting: totalWaiting,
    active: totalActive
  };
}
```

#### 3. 智能优先级计算
```typescript
function calculateTaskPriority(task, delayMinutes) {
  let priority = 5; // 基础优先级
  
  // 延迟时间加权
  if (delayMinutes > 30) priority -= 3;
  else if (delayMinutes > 10) priority -= 2;
  else if (delayMinutes > 5) priority -= 1;
  
  // 任务类型加权
  if (task.task_type === 'polish') priority -= 1;
  else if (task.task_type === 'illustration') priority += 1;
  
  return Math.max(1, Math.min(10, priority));
}
```

#### 4. 优化后的调度器
```typescript
async function checkScheduledTasks() {
  // 1. 获取队列负载
  const queueLoad = await getQueueLoad();
  
  // 2. 动态调整批处理大小
  let batchSize = calculateBatchSize(queueLoad.total);
  
  // 3. 队列满则跳过
  if (queueLoad.total >= MAX_QUEUE_SIZE) return;
  
  // 4. 查找到期任务
  const dueTasks = await findDueTasks(batchSize * 3);
  
  // 5. 计算优先级并排序
  const tasksWithPriority = dueTasks.map(task => ({
    task,
    delayMinutes: calculateDelay(task),
    priority: calculateTaskPriority(task, delayMinutes)
  })).sort((a, b) => a.priority - b.priority);
  
  // 6. 处理前N个任务
  const tasksToProcess = tasksWithPriority.slice(0, batchSize);
  
  // 7. 添加到队列并发送延迟通知
  for (const { task, delayMinutes, priority } of tasksToProcess) {
    await addToQueue(task, priority);
    
    if (delayMinutes > DELAY_WARNING_MINUTES) {
      await notifyTaskDelay(task.user_id, task.id, delayMinutes);
    }
  }
}
```

---

### 前端实现

#### 1. 系统负载API
```javascript
// GET /api/system/load
{
  "loadLevel": "high",
  "totalLoad": 45,
  "queues": {
    "continuation": { "waiting": 20, "active": 5 },
    "polish": { "waiting": 15, "active": 3 },
    "illustration": { "waiting": 2, "active": 0 }
  },
  "estimatedWaitMinutes": 15,
  "recommendation": "当前系统负载较高，建议稍后提交..."
}
```

#### 2. 推荐时间API
```javascript
// GET /api/system/recommended-times
{
  "isPeakHour": true,
  "currentHour": 14,
  "recommendedTimes": [
    {
      "label": "今晚22:00（推荐）",
      "time": "2026-03-10T22:00:00Z",
      "reason": "夜间系统负载较低"
    },
    {
      "label": "明天凌晨2:00（最佳）",
      "time": "2026-03-11T02:00:00Z",
      "reason": "凌晨时段系统负载最低，处理最快"
    }
  ]
}
```

#### 3. 负载显示组件
```html
<!-- 在AI任务提交页面添加 -->
<script src="/js/system-load-widget.js"></script>

<div id="systemLoadWidget"></div>

<script>
  const loadWidget = new SystemLoadWidget('systemLoadWidget');
  loadWidget.init();
</script>
```

---

## 使用指南

### 用户视角

#### 提交任务时
1. 打开AI续写/润色页面
2. 查看顶部的系统负载提示
3. 根据负载情况决定：
   - 🟢 **低负载**：立即提交
   - 🟡 **中等负载**：可以提交，稍等片刻
   - 🔴 **高负载**：建议选择推荐时间
   - 🚨 **严重负载**：强烈建议错峰

#### 任务延迟时
1. 收到延迟通知
2. 查看预计等待时间
3. 选择：
   - 继续等待
   - 取消任务重新选择时间

---

### 管理员视角

#### 监控系统负载
```bash
# 查看当前队列状态
curl http://localhost:3001/api/system/load

# 查看推荐时间
curl http://localhost:3001/api/system/recommended-times
```

#### 调整配置参数
```typescript
// api/src/workers/aiWorker.ts

const RATE_LIMIT_CONFIG = {
  MAX_BATCH_SIZE: 15,           // 增加最大批处理
  MIN_BATCH_SIZE: 5,            // 增加最小批处理
  MAX_QUEUE_SIZE: 200,          // 扩大队列容量
  HIGH_LOAD_THRESHOLD: 80,      // 提高高负载阈值
  DELAY_WARNING_MINUTES: 10,    // 延长警告时间
};
```

---

## 性能优化

### 1. 队列容量规划

根据系统配置估算容量：

**假设：**
- AI续写平均耗时：2分钟
- AI润色平均耗时：1分钟
- AI插图平均耗时：3分钟
- 并发处理能力：3个任务

**理论吞吐量：**
```
每小时处理能力 = 60分钟 / 平均耗时 * 并发数
续写：60 / 2 * 3 = 90个/小时
润色：60 / 1 * 3 = 180个/小时
插图：60 / 3 * 3 = 60个/小时
```

**队列容量建议：**
- 保守：1小时吞吐量（100个）
- 适中：2小时吞吐量（200个）
- 激进：4小时吞吐量（400个）

---

### 2. 批处理大小调优

| 队列负载 | 批处理大小 | 调度频率 | 理由 |
|---------|-----------|---------|------|
| 0-25 | 10 | 1分钟 | 低负载，提高吞吐 |
| 25-50 | 6 | 1分钟 | 中等负载，平衡 |
| 50-100 | 3 | 1分钟 | 高负载，保护系统 |
| ≥100 | 0 | 暂停 | 队列满，停止调度 |

---

### 3. 数据库索引优化

确保以下索引存在：

```sql
-- ai_tasks表索引
CREATE INDEX idx_ai_tasks_scheduled ON ai_tasks(status, scheduled_at);
CREATE INDEX idx_ai_tasks_user ON ai_tasks(user_id, status);

-- notifications表索引
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
```

---

## 未来扩展

### 1. 水平扩展方案 🚀

#### a) 多Worker实例
```
┌─────────────┐
│   Redis     │  ← 共享队列
└─────────────┘
       ↓
┌──────┬──────┬──────┐
│Worker│Worker│Worker│  ← 多个Worker实例
└──────┴──────┴──────┘
```

**实现步骤：**
1. 使用Redis替代内存队列
2. 部署多个Worker实例
3. 配置负载均衡

#### b) 分布式任务调度
- 使用Kubernetes自动扩缩容
- 根据队列长度动态调整Worker数量
- 配置HPA（Horizontal Pod Autoscaler）

---

### 2. 更智能的优先级算法 🧠

#### a) 机器学习预测
- 预测任务处理时长
- 动态调整优先级权重
- 学习用户使用模式

#### b) 用户画像
```typescript
interface UserProfile {
  level: number;              // 用户等级
  subscriptionType: string;   // 订阅类型
  historicalTaskCount: number;// 历史任务数
  completionRate: number;     // 任务完成率
  averageWaitTime: number;    // 平均等待时间
}

// 根据用户画像调整优先级
function calculateUserPriority(profile: UserProfile): number {
  let bonus = 0;
  
  if (profile.subscriptionType === 'premium') bonus += 3;
  else if (profile.subscriptionType === 'basic') bonus += 1;
  
  if (profile.level >= 10) bonus += 2;
  else if (profile.level >= 5) bonus += 1;
  
  if (profile.completionRate > 0.9) bonus += 1;
  
  return bonus;
}
```

---

### 3. 更丰富的通知方式 📱

#### a) 浏览器推送
```javascript
// 请求推送权限
const permission = await Notification.requestPermission();

// 发送推送
if (permission === 'granted') {
  new Notification('AI任务完成', {
    body: '您的AI续写任务已完成，点击查看',
    icon: '/icon.png',
    tag: 'ai-task-complete'
  });
}
```

#### b) 邮件通知
```typescript
async function sendEmailNotification(user, task) {
  await emailService.send({
    to: user.email,
    subject: 'AI任务延迟提醒',
    template: 'task-delay',
    data: {
      username: user.username,
      taskId: task.id,
      delayMinutes: task.delayMinutes,
      estimatedMinutes: task.estimatedMinutes
    }
  });
}
```

#### c) 微信/钉钉通知
- 集成企业微信机器人
- 集成钉钉机器人
- 发送即时消息

---

### 4. 成本优化 💰

#### a) 任务合并
```typescript
// 将多个小任务合并成一个大任务
async function mergeTasks(tasks: Task[]): Promise<Task> {
  if (tasks.length < 3) return null;
  
  const mergedTask = {
    type: 'batch',
    subtasks: tasks,
    estimatedTime: tasks.reduce((sum, t) => sum + t.estimatedTime, 0) * 0.7
  };
  
  return mergedTask;
}
```

#### b) 缓存机制
```typescript
// 缓存相似的AI响应
const cache = new LRUCache({
  max: 1000,
  ttl: 3600000 // 1小时
});

async function getAIResponse(prompt: string) {
  const cacheKey = hashPrompt(prompt);
  const cached = cache.get(cacheKey);
  
  if (cached) {
    console.log('使用缓存响应');
    return cached;
  }
  
  const response = await callAI(prompt);
  cache.set(cacheKey, response);
  return response;
}
```

---

## 总结

### 核心优势

1. **动态适应** - 根据负载自动调整处理策略
2. **用户友好** - 实时反馈，明确建议
3. **系统稳定** - 避免过载，保护系统
4. **公平合理** - 智能优先级，兼顾效率和公平
5. **易于扩展** - 模块化设计，便于后续优化

### 效果预期

| 指标 | 优化前 | 优化后 | 提升 |
|------|-------|-------|------|
| 系统稳定性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 任务延迟率 | 30% | 10% | -67% |
| 用户满意度 | ⭐⭐⭐ | ⭐⭐⭐⭐ | +33% |
| 峰值吞吐量 | 100/小时 | 300/小时 | +200% |

### 最佳实践

✅ **监控队列负载**，及时调整配置  
✅ **收集用户反馈**，优化推荐算法  
✅ **定期分析日志**，发现性能瓶颈  
✅ **A/B测试**，验证优化效果  
✅ **文档更新**，保持同步

---

## 附录

### 相关文件
- `api/src/workers/aiWorker.ts` - AI Worker主文件
- `api/src/routes/system.ts` - 系统API路由
- `web/js/system-load-widget.js` - 负载显示组件

### API文档
- `GET /api/system/load` - 获取系统负载
- `GET /api/system/recommended-times` - 获取推荐时间

### 配置参数
```typescript
RATE_LIMIT_CONFIG = {
  MAX_BATCH_SIZE: 10,
  MIN_BATCH_SIZE: 3,
  MAX_QUEUE_SIZE: 100,
  HIGH_LOAD_THRESHOLD: 50,
  DELAY_WARNING_MINUTES: 5
}
```

---

**文档版本**: 1.0.0  
**最后更新**: 2026-03-10  
**作者**: StoryTree Team

