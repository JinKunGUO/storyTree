# 通知链接跳转问题修复

## 📊 问题描述

### 问题现象

用户点击通知的"查看详情"按钮时：
- ❌ "新粉丝 - xxx关注了你" → 跳转到主页（而不是用户个人主页）
- ❌ "新评论 - xxx评论了你的章节" → 跳转到主页（而不是章节页面）

### 根本原因

**后端生成的链接格式与前端路由不匹配**：

| 通知类型 | 后端生成的链接 | 实际需要的链接 | 文件 |
|---------|---------------|---------------|------|
| 新粉丝 | `/user/3` | `/profile.html?id=3` | users.ts:109 |
| 新评论 | `/nodes/123` | 需要查询节点所属故事，跳转到故事页面 | comments.ts:232 |

---

## 🔍 详细分析

### 1. 关注通知问题

**后端代码**（`api/src/routes/users.ts:103-109`）：

```typescript
await createNotification(
  targetId,
  'follow',
  '新粉丝',
  `${follower.username} 关注了你`,
  `/user/${userId}`  // ❌ 错误：前端没有/user/:id路由
);
```

**前端路由**：
- 个人主页：`/profile.html?id=3`
- 或者当前用户：`/profile.html`（自动显示当前用户）

**问题**：
- 链接 `/user/3` 不存在
- 浏览器会跳转到主页（默认行为）

### 2. 评论通知问题

**后端代码**（`api/src/routes/comments.ts:225-232`）：

```typescript
await prisma.notifications.create({
  data: {
    user_id: node.author_id,
    type: 'comment',
    title: '新评论',
    content: `${decoded.username || '用户'} 评论了你的章节`,
    link: `/nodes/${node_id}`  // ❌ 错误：前端没有/nodes/:id路由
  }
});
```

**前端路由**：
- 故事页面：`/story.html?id=<story_id>`
- 章节需要在故事页面中查看

**问题**：
- 链接 `/nodes/123` 不存在
- 应该跳转到 `/story.html?id=<story_id>&node=<node_id>`

---

## 🔧 修复方案

### 方案A：修改后端链接格式（推荐）✅

**优点**：
- 一次修复，永久生效
- 所有新通知都会有正确的链接
- 不需要修改前端

**缺点**：
- 需要修改后端代码
- 历史通知链接仍然错误（但可以通过前端兼容处理）

### 方案B：前端智能解析链接

**优点**：
- 可以兼容历史通知
- 不需要修改后端

**缺点**：
- 前端逻辑复杂
- 每次点击都需要解析

### 推荐：**方案A + 方案B结合**

1. 修改后端，生成正确的链接
2. 前端添加兼容逻辑，处理历史通知

---

## 🚀 实施步骤

### 步骤1：修改后端 - 关注通知

**文件**：`api/src/routes/users.ts:103-109`

```typescript
// 修改前
await createNotification(
  targetId,
  'follow',
  '新粉丝',
  `${follower.username} 关注了你`,
  `/user/${userId}`
);

// 修改后
await createNotification(
  targetId,
  'follow',
  '新粉丝',
  `${follower.username} 关注了你`,
  `/profile.html?id=${userId}`
);
```

### 步骤2：修改后端 - 评论通知

**文件**：`api/src/routes/comments.ts:225-232`

```typescript
// 修改前
await prisma.notifications.create({
  data: {
    user_id: node.author_id,
    type: 'comment',
    title: '新评论',
    content: `${decoded.username || '用户'} 评论了你的章节`,
    link: `/nodes/${node_id}`
  }
});

// 修改后
await prisma.notifications.create({
  data: {
    user_id: node.author_id,
    type: 'comment',
    title: '新评论',
    content: `${decoded.username || '用户'} 评论了你的章节`,
    link: `/story.html?id=${node.story.id}&node=${node_id}`
  }
});
```

### 步骤3：修改后端 - 评论回复通知

**文件**：`api/src/routes/comments.ts:215-221`

```typescript
// 修改前
await prisma.notifications.create({
  data: {
    user_id: parentComment.user_id,
    type: 'comment_reply',
    title: '评论回复',
    content: `${decoded.username || '用户'} 回复了你的评论`,
    link: `/nodes/${node_id}`
  }
});

// 修改后
// 需要先获取node信息
const nodeForReply = await prisma.nodes.findUnique({
  where: { id: parseInt(node_id) },
  select: { story_id: true }
});

await prisma.notifications.create({
  data: {
    user_id: parentComment.user_id,
    type: 'comment_reply',
    title: '评论回复',
    content: `${decoded.username || '用户'} 回复了你的评论`,
    link: `/story.html?id=${nodeForReply.story_id}&node=${node_id}`
  }
});
```

### 步骤4：前端添加兼容逻辑（可选）

**文件**：`web/notifications.html`

在 `handleNotificationClick` 函数中添加链接转换：

```javascript
// 处理通知点击
async function handleNotificationClick(id, link) {
    await markAsRead(id);
    if (link) {
        // 兼容旧格式的链接
        let finalLink = link;
        
        // 转换 /user/:id → /profile.html?id=:id
        if (link.startsWith('/user/')) {
            const userId = link.replace('/user/', '');
            finalLink = `/profile.html?id=${userId}`;
        }
        
        // 转换 /nodes/:id → /story.html?id=:story_id&node=:id
        // 注意：这需要额外的API调用来获取story_id
        if (link.startsWith('/nodes/')) {
            const nodeId = link.replace('/nodes/', '');
            // 需要调用API获取节点信息
            try {
                const response = await fetch(`/api/nodes/${nodeId}`);
                const data = await response.json();
                finalLink = `/story.html?id=${data.node.story_id}&node=${nodeId}`;
            } catch (error) {
                console.error('获取节点信息失败:', error);
                finalLink = '/'; // 失败时跳转到首页
            }
        }
        
        window.location.href = finalLink;
    }
}
```

---

## 📝 其他需要检查的通知类型

### 已检查的通知类型

| 通知类型 | 链接格式 | 是否正确 | 位置 |
|---------|---------|---------|------|
| `follow` | `/user/:id` | ❌ 需要修复 | users.ts:109 |
| `comment` | `/nodes/:id` | ❌ 需要修复 | comments.ts:232 |
| `comment_reply` | `/nodes/:id` | ❌ 需要修复 | comments.ts:220 |
| `COLLABORATION_REQUEST` | `/story-settings.html?id=:id` | ✅ 正确 | collaboration-requests.ts |
| `COLLABORATION_APPROVED` | `/story?id=:id` | ⚠️ 应该是 `/story.html?id=:id` | collaboration-requests.ts |
| `COLLABORATION_INVITE` | `/story?id=:id` | ⚠️ 应该是 `/story.html?id=:id` | stories.ts |
| `STORY_UPDATE` | 需要检查 | ❓ | - |

### 需要统一的链接格式

1. **故事页面**：`/story.html?id=:id`
2. **用户主页**：`/profile.html?id=:id`
3. **故事设置**：`/story-settings.html?id=:id`
4. **章节（在故事中）**：`/story.html?id=:story_id&node=:node_id`

---

## ✅ 测试清单

### 关注通知测试

1. [ ] 用户A关注用户B
2. [ ] 用户B收到通知
3. [ ] 点击"查看详情"
4. [ ] 跳转到用户A的个人主页 `/profile.html?id=A`

### 评论通知测试

1. [ ] 用户A评论用户B的章节
2. [ ] 用户B收到通知
3. [ ] 点击"查看详情"
4. [ ] 跳转到故事页面，定位到该章节

### 评论回复通知测试

1. [ ] 用户A回复用户B的评论
2. [ ] 用户B收到通知
3. [ ] 点击"查看详情"
4. [ ] 跳转到故事页面，定位到该章节

---

## 🎯 总结

**问题根源**：后端生成的通知链接格式与前端路由不匹配

**解决方案**：
1. 修改后端，生成正确的链接格式
2. 前端添加兼容逻辑，处理历史通知

**影响范围**：
- `api/src/routes/users.ts` - 关注通知
- `api/src/routes/comments.ts` - 评论和回复通知
- `web/notifications.html` - 前端兼容逻辑（可选）

**预期效果**：
- ✅ 点击"新粉丝"通知，跳转到粉丝的个人主页
- ✅ 点击"新评论"通知，跳转到被评论的章节
- ✅ 点击"评论回复"通知，跳转到被回复的评论

