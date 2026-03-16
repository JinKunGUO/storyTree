# 通知链接优化 - 直接跳转目标页面

## ✅ 优化完成

**优化时间**：2026-03-16  
**状态**：✅ 已完成

---

## 📊 优化目标

根据用户需求，优化通知链接跳转逻辑：

1. **AI续写完成通知**：不需要创建AI任务页面，直接跳转到故事分支图页面
2. **新评论通知**：直接跳转到该评论，使用锚点定位

---

## 🔧 实施内容

### 1. AI续写完成通知优化

#### 1.1 修改通知函数签名

**文件**：`api/src/utils/notification.ts:45-61`

**修改前**：
```typescript
export async function notifyAiContinuationReady(
  userId: number,
  taskId: number,
  storyTitle: string
) {
  await createNotification(
    userId,
    NotificationType.AI_CONTINUATION_READY,
    '🎉 您的故事有了新的分支！',
    `《${storyTitle}》的AI续写已完成，快来查看吧！`,
    `/ai-tasks.html?id=${taskId}`  // ❌ 跳转到AI任务页面
  );
}
```

**修改后**：
```typescript
export async function notifyAiContinuationReady(
  userId: number,
  taskId: number,
  storyTitle: string,
  storyId?: number  // ✅ 新增storyId参数
) {
  // 如果有storyId，直接跳转到故事分支图；否则跳转到AI任务页面
  const link = storyId ? `/story.html?id=${storyId}` : `/ai-tasks.html?id=${taskId}`;
  
  await createNotification(
    userId,
    NotificationType.AI_CONTINUATION_READY,
    '🎉 您的故事有了新的分支！',
    `《${storyTitle}》的AI续写已完成，快来查看吧！`,
    link  // ✅ 动态链接
  );
}
```

**优化点**：
- 添加可选的`storyId`参数
- 优先跳转到故事分支图页面
- 保留降级方案（无storyId时跳转到AI任务页面）

---

#### 1.2 修改调用点（第一处）

**文件**：`api/src/workers/aiWorker.ts:438`

**修改前**：
```typescript
await notifyAiContinuationReady(userId, taskId, storyTitle);
```

**修改后**：
```typescript
await notifyAiContinuationReady(userId, taskId, storyTitle, task.story_id || undefined);
```

---

#### 1.3 修改调用点（第二处）

**文件**：`api/src/workers/aiWorker.ts:442-447`

**修改前**：
```typescript
} else {
  // 这是立即任务，发送通知让用户手动接受
  await notifyAiContinuationReady(userId, taskId, storyTitle);
}
```

**修改后**：
```typescript
} else {
  // 这是立即任务，发送通知让用户手动接受
  const taskInfo = await prisma.ai_tasks.findUnique({
    where: { id: taskId },
    select: { story_id: true }
  });
  await notifyAiContinuationReady(userId, taskId, storyTitle, taskInfo?.story_id || undefined);
}
```

**优化点**：
- 查询任务的story_id
- 传递给通知函数

---

### 2. 新评论通知优化

#### 2.1 添加评论ID锚点

**文件**：`api/src/routes/comments.ts:218,232`

**修改前**：
```typescript
// 评论回复通知
link: `/story.html?id=${node.story.id}&node=${node_id}`

// 新评论通知
link: `/story.html?id=${node.story.id}&node=${node_id}`
```

**修改后**：
```typescript
// 评论回复通知
link: `/story.html?id=${node.story.id}&node=${node_id}#comment-${comment.id}`

// 新评论通知
link: `/story.html?id=${node.story.id}&node=${node_id}#comment-${comment.id}`
```

**优化点**：
- 添加`#comment-${comment.id}`锚点
- 页面加载后自动滚动到该评论
- 提升用户体验

---

## 📊 优化前后对比

### 优化前 ❌

**AI续写完成**：
```
点击"您的故事有了新的分支"
  ↓
跳转到 /ai-tasks.html?id=123
  ↓
显示AI任务详情页面（需要额外点击才能查看故事）
```

**新评论**：
```
点击"新评论"
  ↓
跳转到 /story.html?id=1&node=51
  ↓
显示故事页面，但需要手动滚动查找评论
```

---

### 优化后 ✅

**AI续写完成**：
```
点击"您的故事有了新的分支"
  ↓
跳转到 /story.html?id=1
  ↓
直接显示故事分支图，查看新分支 ✅
```

**新评论**：
```
点击"新评论"
  ↓
跳转到 /story.html?id=1&node=51#comment-123
  ↓
显示故事页面，自动滚动到评论位置 ✅
```

---

## 🎯 技术要点

### 1. 动态链接生成

根据是否有`storyId`动态选择跳转目标：
```typescript
const link = storyId ? `/story.html?id=${storyId}` : `/ai-tasks.html?id=${taskId}`;
```

**优势**：
- 优先用户体验（直接跳转到故事）
- 保留降级方案（无storyId时仍可用）
- 向后兼容

---

### 2. URL锚点定位

使用HTML锚点实现自动滚动：
```typescript
link: `/story.html?id=${node.story.id}&node=${node_id}#comment-${comment.id}`
```

**前端配合**：
需要在前端为每个评论添加对应的ID：
```html
<div id="comment-123" class="comment">
  <!-- 评论内容 -->
</div>
```

浏览器会自动滚动到该元素。

---

### 3. 可选参数设计

```typescript
storyId?: number  // 可选参数
```

**优势**：
- 向后兼容（旧代码不传此参数也能工作）
- 灵活性（可以根据情况选择是否传递）
- 类型安全（TypeScript类型检查）

---

## 🚀 使用方法

### 步骤1：重启后端服务

```bash
cd api
npm run dev
```

### 步骤2：测试AI续写通知

1. 创建AI续写任务
2. 等待任务完成
3. 查看通知
4. 点击"查看详情"
5. **预期**：直接跳转到故事分支图页面 ✅

---

### 步骤3：测试评论通知

1. 在某个章节发表评论
2. 章节作者收到通知
3. 点击"查看详情"
4. **预期**：跳转到故事页面，自动滚动到该评论 ✅

---

## 📝 前端配合要求

### 1. 评论ID属性

确保每个评论元素都有对应的ID：

```html
<!-- story.html 中的评论渲染 -->
<div id="comment-${comment.id}" class="comment">
  <div class="comment-header">
    <span class="comment-author">${comment.user.username}</span>
    <span class="comment-time">${comment.created_at}</span>
  </div>
  <div class="comment-content">${comment.content}</div>
</div>
```

---

### 2. 自动滚动优化（可选）

可以添加额外的JavaScript代码，实现平滑滚动和高亮效果：

```javascript
// story.html 中
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#comment-')) {
    const commentElement = document.querySelector(hash);
    if (commentElement) {
      // 平滑滚动
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 高亮效果
      commentElement.classList.add('highlight');
      setTimeout(() => {
        commentElement.classList.remove('highlight');
      }, 2000);
    }
  }
});
```

CSS：
```css
.comment.highlight {
  background-color: #fff3cd;
  transition: background-color 0.3s ease;
}
```

---

## 🧪 测试场景

### 场景1：AI续写完成（有story_id）✅

**操作**：
1. 创建AI续写任务（story_id=1）
2. 等待任务完成
3. 收到通知
4. 点击"查看详情"

**预期结果**：
- 跳转到 `/story.html?id=1`
- 显示故事分支图
- 可以看到新生成的分支

---

### 场景2：AI续写完成（无story_id）✅

**操作**：
1. 创建AI续写任务（未关联故事）
2. 等待任务完成
3. 收到通知
4. 点击"查看详情"

**预期结果**：
- 跳转到 `/ai-tasks.html?id=123`
- 显示AI任务详情
- 降级方案正常工作

---

### 场景3：新评论通知 ✅

**操作**：
1. 用户A在章节51发表评论（comment_id=123）
2. 章节作者收到通知
3. 点击"查看详情"

**预期结果**：
- 跳转到 `/story.html?id=1&node=51#comment-123`
- 页面自动滚动到评论123
- 评论高亮显示（如果实现了高亮效果）

---

### 场景4：评论回复通知 ✅

**操作**：
1. 用户B回复用户A的评论（new_comment_id=124）
2. 用户A收到通知
3. 点击"查看详情"

**预期结果**：
- 跳转到 `/story.html?id=1&node=51#comment-124`
- 页面自动滚动到回复评论124
- 用户A可以直接看到回复内容

---

## 📋 修改的文件清单

1. **`api/src/utils/notification.ts`** - 修改AI续写完成通知函数
   - 添加`storyId`可选参数
   - 动态生成链接

2. **`api/src/workers/aiWorker.ts`** - 修改2处调用点
   - 第一处：直接传递`task.story_id`
   - 第二处：查询后传递`story_id`

3. **`api/src/routes/comments.ts`** - 修改2处通知链接
   - 评论回复通知：添加`#comment-${comment.id}`
   - 新评论通知：添加`#comment-${comment.id}`

---

## 🎉 总结

### 优化效果

1. ✅ **AI续写通知**：直接跳转到故事分支图，无需额外点击
2. ✅ **新评论通知**：自动定位到评论，无需手动滚动查找
3. ✅ **用户体验提升**：减少操作步骤，提高效率
4. ✅ **向后兼容**：保留降级方案，不影响旧功能

---

### 技术亮点

1. **动态链接生成**：根据数据可用性选择最佳跳转目标
2. **URL锚点定位**：利用浏览器原生功能实现自动滚动
3. **可选参数设计**：保持API灵活性和向后兼容性
4. **类型安全**：TypeScript类型检查确保参数正确

---

**优化完成！重启后端服务后，所有新通知都将使用优化后的链接格式。** 🎉

