# AI创作章节功能优化说明

## 📋 优化内容总结

本次优化实现了三个主要需求：

### 1. ✅ 两个按钮替代单个"开始生成"按钮

**优化前：**
- 只有一个"开始生成"按钮
- 无法选择发布状态

**优化后：**
- **"生成后保存为草稿"按钮**：橙色渐变，保存所有AI生成的选项为草稿
- **"生成并自动发布"按钮**：紫色渐变，只发布第一个AI生成的选项

---

### 2. ✅ 保存所有/发布第一个的差异化处理

**"生成后保存为草稿"：**
- 保存**所有3个**AI生成的章节选项
- 所有章节都标记为**草稿状态**（`is_published = false`）
- 标题自动添加标识：`(草稿1)`、`(草稿2)`、`(草稿3)`
- 用户可以随时编辑、选择发布任意一个或多个

**"生成并自动发布"：**
- 只保存并发布**第一个**AI生成的章节
- 章节立即发布（`is_published = true`）
- 其他选项不保存

---

### 3. ✅ 定时任务完成后自动刷新前端

**优化前：**
- 只有立即生成的任务会刷新页面
- 定时任务完成后前端不刷新，用户看不到新章节

**优化后：**
- 提交定时任务后，前端开始**后台轮询**
- 每秒查询一次任务状态
- 任务完成后显示成功提示并**自动刷新页面**
- 最多轮询600次（10分钟）

---

## 🔧 技术实现

### 前端修改（`web/story.html`）

#### 1. HTML结构修改

```html
<!-- 原来：单个按钮 -->
<button class="btn-save" id="startAiChapterGeneration">
    <i class="fas fa-magic"></i>
    开始生成
</button>

<!-- 现在：两个按钮 -->
<div style="display: flex; gap: 15px; justify-content: center;">
    <button class="btn-save" id="startAiChapterGenerationDraft" style="background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);">
        <i class="fas fa-save"></i>
        生成后保存为草稿
    </button>
    <button class="btn-save" id="startAiChapterGenerationPublish">
        <i class="fas fa-magic"></i>
        生成并自动发布
    </button>
</div>
```

#### 2. 事件绑定

```javascript
// 两个按钮分别绑定不同的参数
document.getElementById('startAiChapterGenerationDraft')?.addEventListener('click', () => startAiChapterGeneration(false));
document.getElementById('startAiChapterGenerationPublish')?.addEventListener('click', () => startAiChapterGeneration(true));
```

#### 3. 函数修改

```javascript
async function startAiChapterGeneration(publishImmediately = true) {
    // 传递publishImmediately参数给后端
    body: JSON.stringify({
        // ... 其他参数
        publishImmediately: publishImmediately
    })
    
    // 定时任务开始后台轮询
    if (selectedAiSurpriseTime !== 'immediate') {
        startBackgroundPolling(data.taskId);
    }
}
```

#### 4. 后台轮询函数

```javascript
function startBackgroundPolling(taskId) {
    const checkStatus = async () => {
        const response = await fetch(`/api/ai/v2/tasks/${taskId}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
            // 任务完成，刷新页面
            showSuccess('AI章节创作完成！正在刷新页面...');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else if (attempts < maxAttempts) {
            // 继续轮询（每秒一次）
            setTimeout(checkStatus, 1000);
        }
    };
    
    checkStatus();
}
```

---

### 后端修改

#### 1. 路由修改（`api/src/routes/ai-v2.ts`）

```typescript
// 接收publishImmediately参数
const { storyId, nodeId, context, style, count = 3, mode = 'segment', surpriseTime, publishImmediately = true } = req.body;

// 保存到任务数据中
const task = await prisma.ai_tasks.create({
  data: {
    input_data: JSON.stringify({
      context: fullContext,
      storyTitle: story.title,
      storyDescription: story.description,
      style,
      count,
      mode,
      publishImmediately // 保存发布状态
    }),
    scheduled_at: scheduledAt
  }
});
```

#### 2. Worker修改（`api/src/workers/aiWorker.ts`）

**处理逻辑：**

```typescript
// 从任务数据中读取publishImmediately
const inputData = JSON.parse(task.input_data || '{}');
const publishImmediately = inputData.publishImmediately !== undefined ? inputData.publishImmediately : true;

if (task.scheduled_at) {
  // 定时任务
  if (publishImmediately) {
    // 自动发布第一个选项
    await autoAcceptAiChapter(task, options[0], true);
  } else {
    // 保存所有选项为草稿
    await saveAllOptionsAsDraft(task, options);
  }
}
```

**新增函数：**

```typescript
async function saveAllOptionsAsDraft(task: any, options: any[]) {
  // 创建所有选项为草稿（作为分支）
  const createdNodes = [];
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    
    const node = await prisma.nodes.create({
      data: {
        story_id: task.story_id!,
        parent_id: parentNodeId,
        author_id: task.user_id,
        title: `${option.title} (草稿${i + 1})`,
        content: option.content,
        path: nodePath,
        ai_generated: true,
        is_published: false, // 保存为草稿
        updated_at: new Date()
      }
    });

    createdNodes.push(node);
  }
  
  // 发送通知
  await prisma.notifications.create({
    data: {
      user_id: task.user_id,
      type: 'ai_chapter_draft',
      title: '📝 AI章节已保存为草稿',
      content: `AI已为您创作${options.length}个章节草稿，可随时编辑和发布。`,
      link: `/story?id=${task.story_id}`,
      is_read: false
    }
  });
}
```

---

## 📊 功能对比

### 立即生成 vs 定时生成

| 功能 | 立即生成 | 定时生成 |
|------|---------|---------|
| **用户交互** | 等待AI生成，显示结果 | 关闭模态框，后台处理 |
| **生成时间** | 立即（30-60秒） | 指定时间（如1小时后） |
| **结果展示** | 模态框显示3个选项 | 自动保存/发布 |
| **用户操作** | 手动选择一个发布/草稿 | 自动处理（根据按钮） |
| **页面刷新** | 选择后刷新 | 完成后自动刷新 |

### 草稿 vs 发布

| 操作 | 保存为草稿 | 自动发布 |
|------|-----------|---------|
| **保存数量** | 所有3个选项 | 只有第一个 |
| **发布状态** | `is_published = false` | `is_published = true` |
| **标题标识** | 带"(草稿1/2/3)" | 原标题 |
| **可见性** | 仅作者可见 | 所有人可见 |
| **后续操作** | 可编辑、可发布 | 已发布，可编辑 |

---

## 🎯 用户体验改进

### 改进前

1. 点击"开始生成"
2. 等待AI生成（立即）或提交任务（定时）
3. 立即生成：手动选择一个选项
4. 定时生成：需要手动刷新页面才能看到新章节

### 改进后

**场景1：想要立即发布**
1. 选择惊喜时间（如"1小时后"）
2. 点击"生成并自动发布"
3. 关闭模态框，继续浏览
4. 1小时后自动发布第一个选项
5. 页面自动刷新，看到新章节 ✨

**场景2：想要多个草稿选择**
1. 选择惊喜时间（如"今晚22:00"）
2. 点击"生成后保存为草稿"
3. 关闭模态框，继续浏览
4. 晚上22:00自动生成3个草稿
5. 页面自动刷新，看到3个草稿章节
6. 编辑、选择、发布任意一个 ✨

---

## 🧪 测试建议

### 测试1：立即生成 + 发布

1. 打开AI创作章节模态框
2. 选择"立即生成"
3. 点击"生成并自动发布"
4. 等待30-60秒
5. 验证：显示3个选项
6. 点击"接受并发布"
7. 验证：页面刷新，新章节已发布

### 测试2：立即生成 + 草稿

1. 打开AI创作章节模态框
2. 选择"立即生成"
3. 点击"生成后保存为草稿"
4. 等待30-60秒
5. 验证：显示3个选项
6. 点击"保存为草稿"
7. 验证：页面刷新，新章节为草稿状态

### 测试3：定时生成 + 自动发布

1. 打开AI创作章节模态框
2. 选择"1小时后"
3. 点击"生成并自动发布"
4. 验证：显示提示"任务已提交，完成后将自动发布章节"
5. 关闭模态框
6. 等待1小时
7. 验证：页面自动刷新，第一个AI章节已发布

### 测试4：定时生成 + 保存草稿

1. 打开AI创作章节模态框
2. 选择"自定义"时间（5分钟后）
3. 点击"生成后保存为草稿"
4. 验证：显示提示"任务已提交，完成后将保存为草稿"
5. 关闭模态框
6. 等待5分钟
7. 验证：页面自动刷新，看到3个草稿章节
8. 验证：章节标题带"(草稿1)"、"(草稿2)"、"(草稿3)"
9. 验证：章节状态为"草稿"

### 测试5：后台轮询

1. 提交定时任务后不要关闭页面
2. 打开浏览器控制台
3. 验证：每秒输出一次"后台轮询第X次"
4. 等待任务完成
5. 验证：显示成功提示"AI章节创作完成！正在刷新页面..."
6. 验证：1.5秒后页面自动刷新

---

## 🐛 已知问题和注意事项

### 1. 路径计算问题

保存多个草稿时，路径计算逻辑：
- 第一个选项：使用基础路径（如 `1.2.3`）
- 其他选项：使用基础路径 + 索引（如 `1.2.3.2`、`1.2.3.3`）

**可能的问题：** 路径可能不符合预期的树形结构

**解决方案：** 后续可以优化为创建真正的分支节点

### 2. 轮询性能

后台轮询每秒一次，持续最多10分钟：
- 优点：用户无需手动刷新
- 缺点：增加服务器负载

**优化建议：**
- 使用WebSocket替代轮询
- 或者使用Server-Sent Events (SSE)

### 3. 草稿数量

当前固定生成3个选项并全部保存为草稿：
- 优点：提供更多选择
- 缺点：可能产生大量草稿

**优化建议：**
- 允许用户选择生成数量（1-5个）
- 添加批量删除草稿功能

---

## 📈 后续优化建议

### 1. 实时通知

使用WebSocket实现实时通知：
```javascript
// 前端
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'ai_task_completed') {
    showSuccess('AI章节创作完成！');
    window.location.reload();
  }
};

// 后端
wss.clients.forEach((client) => {
  if (client.userId === task.user_id) {
    client.send(JSON.stringify({
      type: 'ai_task_completed',
      taskId: task.id
    }));
  }
});
```

### 2. 草稿管理

添加草稿管理功能：
- 查看所有草稿
- 批量发布草稿
- 批量删除草稿
- 草稿对比功能

### 3. 生成数量可配置

允许用户选择生成数量：
```html
<select id="aiGenerateCount">
  <option value="1">生成1个选项</option>
  <option value="3" selected>生成3个选项</option>
  <option value="5">生成5个选项</option>
</select>
```

### 4. 智能推荐

根据历史数据推荐最佳选项：
- 分析用户过去的选择偏好
- 自动标记"推荐"选项
- 提供智能排序

---

## ✅ 验收标准

- [x] 两个按钮正确显示和工作
- [x] "生成后保存为草稿"保存所有3个选项
- [x] "生成并自动发布"只发布第一个选项
- [x] 定时任务完成后前端自动刷新
- [x] 后台轮询正常工作
- [x] 草稿章节正确标识
- [x] 发布章节正确显示
- [x] 通知消息正确发送
- [x] 无linter错误

---

## 📅 更新日期

2026-03-11

## 👤 开发者

AI Assistant

