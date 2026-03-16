# 通知链接全面修复方案

## 📊 问题总结

### 问题1：后端修改没有生效

**现象**：
- 点击"新粉丝"仍然跳转到 `http://localhost:3001/user/3`
- 点击"新评论"仍然跳转到 `http://localhost:3001/nodes/51`

**原因**：
1. 后端服务可能没有重启
2. 这些是数据库中的**历史通知**，使用旧格式链接

**解决方案**：
- 重启后端服务（新通知将使用正确格式）
- 添加前端兼容逻辑，处理历史通知

---

### 问题2：AI相关通知链接错误

**现象**：
- "您的故事有了新的分支" → `{"error":"API not found"}`
- "文字润色完成！" → `{"error":"API not found"}`
- "精美插图已生成！" → `{"error":"API not found"}`

**原因**：
AI通知链接指向API端点，不是页面：
```typescript
// ❌ 错误
link: `/api/ai/tasks/${taskId}`
```

**应该跳转到**：
- AI任务页面：`/ai-tasks.html?id=${taskId}`
- 或者直接跳转到故事页面

---

## 🔧 需要修复的通知类型

| 通知类型 | 当前链接 | 正确链接 | 文件位置 |
|---------|---------|---------|---------|
| AI续写完成 | `/api/ai/tasks/${taskId}` ❌ | `/ai-tasks.html?id=${taskId}` ✅ | notification.ts:56 |
| AI润色完成 | `/api/ai/tasks/${taskId}` ❌ | `/ai-tasks.html?id=${taskId}` ✅ | notification.ts:70 |
| AI插图完成 | `/api/ai/tasks/${taskId}` ❌ | `/ai-tasks.html?id=${taskId}` ✅ | notification.ts:84 |
| 等级升级 | `/profile` ⚠️ | `/profile.html` ✅ | notification.ts:100 |
| 积分奖励 | `/profile` ⚠️ | `/profile.html` ✅ | notification.ts:114 |
| 协作申请 | `/story-settings?id=1&tab=requests` ⚠️ | `/story-settings.html?id=1&tab=requests` ✅ | collaboration-requests.ts |
| 协作通过 | `/story?id=1` ⚠️ | `/story.html?id=1` ✅ | collaboration-requests.ts |

---

## 🚀 修复步骤

### 步骤1：修复AI通知链接

**文件**：`api/src/utils/notification.ts`

#### 1.1 AI续写完成

```typescript
// 修复前
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
    `/api/ai/tasks/${taskId}`  // ❌ 错误
  );
}

// 修复后
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
    `/ai-tasks.html?id=${taskId}`  // ✅ 正确
  );
}
```

#### 1.2 AI润色完成

```typescript
// 修复前
export async function notifyAiPolishReady(
  userId: number,
  taskId: number
) {
  await createNotification(
    userId,
    NotificationType.AI_POLISH_READY,
    '✨ 文字润色完成！',
    `您的文字已经过AI精心润色，效果更佳！`,
    `/api/ai/tasks/${taskId}`  // ❌ 错误
  );
}

// 修复后
export async function notifyAiPolishReady(
  userId: number,
  taskId: number
) {
  await createNotification(
    userId,
    NotificationType.AI_POLISH_READY,
    '✨ 文字润色完成！',
    `您的文字已经过AI精心润色，效果更佳！`,
    `/ai-tasks.html?id=${taskId}`  // ✅ 正确
  );
}
```

#### 1.3 AI插图完成

```typescript
// 修复前
export async function notifyAiIllustrationReady(
  userId: number,
  taskId: number,
  chapterTitle: string
) {
  await createNotification(
    userId,
    NotificationType.AI_ILLUSTRATION_READY,
    '🎨 精美插图已生成！',
    `《${chapterTitle}》的AI插图已完成，快来欣赏吧！`,
    `/api/ai/tasks/${taskId}`  // ❌ 错误
  );
}

// 修复后
export async function notifyAiIllustrationReady(
  userId: number,
  taskId: number,
  chapterTitle: string
) {
  await createNotification(
    userId,
    NotificationType.AI_ILLUSTRATION_READY,
    '🎨 精美插图已生成！',
    `《${chapterTitle}》的AI插图已完成，快来欣赏吧！`,
    `/ai-tasks.html?id=${taskId}`  // ✅ 正确
  );
}
```

#### 1.4 等级升级

```typescript
// 修复前
export async function notifyLevelUp(
  userId: number,
  newLevel: number,
  levelName: string
) {
  await createNotification(
    userId,
    NotificationType.LEVEL_UP,
    '🎊 恭喜升级！',
    `您已升级至 Lv${newLevel} ${levelName}，解锁更多AI功能！`,
    '/profile'  // ⚠️ 缺少.html
  );
}

// 修复后
export async function notifyLevelUp(
  userId: number,
  newLevel: number,
  levelName: string
) {
  await createNotification(
    userId,
    NotificationType.LEVEL_UP,
    '🎊 恭喜升级！',
    `您已升级至 Lv${newLevel} ${levelName}，解锁更多AI功能！`,
    '/profile.html'  // ✅ 正确
  );
}
```

#### 1.5 积分奖励

```typescript
// 修复前
export async function notifyPointsEarned(
  userId: number,
  points: number,
  reason: string
) {
  await createNotification(
    userId,
    NotificationType.POINTS_EARNED,
    '💰 获得积分奖励',
    `${reason}，获得 ${points} 积分！`,
    '/profile'  // ⚠️ 缺少.html
  );
}

// 修复后
export async function notifyPointsEarned(
  userId: number,
  points: number,
  reason: string
) {
  await createNotification(
    userId,
    NotificationType.POINTS_EARNED,
    '💰 获得积分奖励',
    `${reason}，获得 ${points} 积分！`,
    '/profile.html'  // ✅ 正确
  );
}
```

---

### 步骤2：检查并修复协作相关通知

需要搜索 `collaboration-requests.ts` 和 `stories.ts` 中的通知创建代码，确保：
- `/story?id=` → `/story.html?id=`
- `/story-settings?id=` → `/story-settings.html?id=`

---

### 步骤3：添加前端兼容逻辑（处理历史通知）

**文件**：`web/notifications.html`

在 `handleNotificationClick` 函数中添加：

```javascript
// 处理通知点击
async function handleNotificationClick(id, link) {
    await markAsRead(id);
    if (link) {
        let finalLink = link;
        
        // === 兼容旧格式链接 ===
        
        // 1. /user/:id → /profile.html?id=:id
        if (link.startsWith('/user/')) {
            const userId = link.replace('/user/', '');
            finalLink = `/profile.html?id=${userId}`;
            console.log(`🔄 转换链接: ${link} → ${finalLink}`);
        }
        
        // 2. /nodes/:id → /story.html?id=:story_id&node=:id
        else if (link.startsWith('/nodes/')) {
            const nodeId = link.replace('/nodes/', '');
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${nodeId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                finalLink = `/story.html?id=${data.node.story_id}&node=${nodeId}`;
                console.log(`🔄 转换链接: ${link} → ${finalLink}`);
            } catch (error) {
                console.error('获取节点信息失败:', error);
                showMessage('无法打开链接', 'error');
                return;
            }
        }
        
        // 3. /api/ai/tasks/:id → /ai-tasks.html?id=:id
        else if (link.startsWith('/api/ai/tasks/')) {
            const taskId = link.replace('/api/ai/tasks/', '');
            finalLink = `/ai-tasks.html?id=${taskId}`;
            console.log(`🔄 转换链接: ${link} → ${finalLink}`);
        }
        
        // 4. /profile → /profile.html
        else if (link === '/profile') {
            finalLink = '/profile.html';
            console.log(`🔄 转换链接: ${link} → ${finalLink}`);
        }
        
        // 5. /story?id= → /story.html?id=
        else if (link.startsWith('/story?')) {
            finalLink = link.replace('/story?', '/story.html?');
            console.log(`🔄 转换链接: ${link} → ${finalLink}`);
        }
        
        // 6. /story-settings?id= → /story-settings.html?id=
        else if (link.startsWith('/story-settings?')) {
            finalLink = link.replace('/story-settings?', '/story-settings.html?');
            console.log(`🔄 转换链接: ${link} → ${finalLink}`);
        }
        
        window.location.href = finalLink;
    }
}
```

---

## 📋 完整的通知链接格式规范

### 标准格式

所有通知链接都应该遵循以下格式：

1. **用户主页**：`/profile.html?id=<user_id>`
2. **故事页面**：`/story.html?id=<story_id>`
3. **故事设置**：`/story-settings.html?id=<story_id>&tab=<tab_name>`
4. **章节（在故事中）**：`/story.html?id=<story_id>&node=<node_id>`
5. **AI任务页面**：`/ai-tasks.html?id=<task_id>`
6. **个人中心**：`/profile.html`

### 注意事项

- ✅ 所有HTML文件都要加 `.html` 扩展名
- ✅ 使用查询参数传递ID（`?id=xxx`）
- ✅ 不要使用API端点作为链接
- ✅ 确保链接指向实际存在的页面

---

## 🧪 测试清单

### 测试1：AI通知

1. [ ] 创建AI续写任务
2. [ ] 等待任务完成
3. [ ] 查看"您的故事有了新的分支"通知
4. [ ] 点击"查看详情"
5. [ ] **预期**：跳转到 `/ai-tasks.html?id=xxx`，显示任务详情

### 测试2：历史通知兼容

1. [ ] 查看数据库中的旧通知
2. [ ] 点击"查看详情"
3. [ ] **预期**：前端自动转换链接，正确跳转

### 测试3：新通知

1. [ ] 创建新的关注、评论等操作
2. [ ] 查看新通知
3. [ ] 点击"查看详情"
4. [ ] **预期**：直接使用正确格式，正确跳转

---

## 📊 总结

### 需要修复的文件

1. **`api/src/utils/notification.ts`** - AI通知链接（5处）
2. **`api/src/routes/collaboration-requests.ts`** - 协作通知链接（需要检查）
3. **`api/src/routes/stories.ts`** - 故事通知链接（需要检查）
4. **`web/notifications.html`** - 前端兼容逻辑

### 修复优先级

1. **高优先级**：修复AI通知链接（导致API错误）
2. **中优先级**：添加前端兼容逻辑（处理历史通知）
3. **低优先级**：检查其他通知类型

### 立即行动

1. 修复 `api/src/utils/notification.ts` 中的5个函数
2. 重启后端服务
3. 添加前端兼容逻辑
4. 测试所有通知类型

