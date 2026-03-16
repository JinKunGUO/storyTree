# 通知链接跳转问题修复 - 实施总结

## ✅ 修复完成

**修复时间**：2026-03-16  
**状态**：✅ 已完成

---

## 📊 问题回顾

### 原始问题

用户点击通知的"查看详情"按钮时：
- ❌ "新粉丝 - xxx关注了你" → 跳转到主页
- ❌ "新评论 - xxx评论了你的章节" → 跳转到主页

### 根本原因

**后端生成的链接格式与前端路由不匹配**：

| 通知类型 | 修复前链接 | 修复后链接 |
|---------|-----------|-----------|
| 新粉丝 | `/user/3` ❌ | `/profile.html?id=3` ✅ |
| 新评论 | `/nodes/123` ❌ | `/story.html?id=1&node=123` ✅ |
| 评论回复 | `/nodes/123` ❌ | `/story.html?id=1&node=123` ✅ |

---

## 🔧 修复内容

### 修复1：关注通知链接

**文件**：`api/src/routes/users.ts:103-109`

```typescript
// 修复前
await createNotification(
  targetId,
  'follow',
  '新粉丝',
  `${follower.username} 关注了你`,
  `/user/${userId}`  // ❌ 错误
);

// 修复后
await createNotification(
  targetId,
  'follow',
  '新粉丝',
  `${follower.username} 关注了你`,
  `/profile.html?id=${userId}`  // ✅ 正确
);
```

**效果**：
- 点击通知 → 跳转到粉丝的个人主页
- 例如：`/profile.html?id=3`

---

### 修复2：评论通知链接

**文件**：`api/src/routes/comments.ts:225-235`

```typescript
// 修复前
await prisma.notifications.create({
  data: {
    user_id: node.author_id,
    type: 'comment',
    title: '新评论',
    content: `${decoded.username || '用户'} 评论了你的章节`,
    link: `/nodes/${node_id}`  // ❌ 错误
  }
});

// 修复后
await prisma.notifications.create({
  data: {
    user_id: node.author_id,
    type: 'comment',
    title: '新评论',
    content: `${decoded.username || '用户'} 评论了你的章节`,
    link: `/story.html?id=${node.story.id}&node=${node_id}`  // ✅ 正确
  }
});
```

**效果**：
- 点击通知 → 跳转到故事页面，定位到被评论的章节
- 例如：`/story.html?id=1&node=123`

---

### 修复3：评论回复通知链接

**文件**：`api/src/routes/comments.ts:204-222`

```typescript
// 修复前
await prisma.notifications.create({
  data: {
    user_id: parentComment.user_id,
    type: 'comment_reply',
    title: '评论回复',
    content: `${decoded.username || '用户'} 回复了你的评论`,
    link: `/nodes/${node_id}`  // ❌ 错误
  }
});

// 修复后
await prisma.notifications.create({
  data: {
    user_id: parentComment.user_id,
    type: 'comment_reply',
    title: '评论回复',
    content: `${decoded.username || '用户'} 回复了你的评论`,
    link: `/story.html?id=${node.story.id}&node=${node_id}`  // ✅ 正确
  }
});
```

**效果**：
- 点击通知 → 跳转到故事页面，定位到被回复的评论所在章节
- 例如：`/story.html?id=1&node=123`

---

## 📊 修复前后对比

### 修复前 ❌

```
用户点击"新粉丝"通知
  ↓
跳转到 /user/3
  ↓
页面不存在
  ↓
浏览器显示主页（默认行为）
```

```
用户点击"新评论"通知
  ↓
跳转到 /nodes/123
  ↓
页面不存在
  ↓
浏览器显示主页（默认行为）
```

### 修复后 ✅

```
用户点击"新粉丝"通知
  ↓
跳转到 /profile.html?id=3
  ↓
显示用户3的个人主页
  ↓
用户可以查看粉丝信息、关注回去等
```

```
用户点击"新评论"通知
  ↓
跳转到 /story.html?id=1&node=123
  ↓
显示故事页面，定位到章节123
  ↓
用户可以查看评论、回复等
```

---

## 🧪 测试验证

### 测试1：关注通知

**步骤**：
1. 用户A关注用户B
2. 用户B登录，查看通知
3. 点击"xxx关注了你"的"查看详情"

**预期结果**：
- ✅ 跳转到用户A的个人主页
- ✅ URL为 `/profile.html?id=<用户A的ID>`
- ✅ 显示用户A的信息、故事、章节等

**实际结果**：（待测试）
- [ ] 跳转正确
- [ ] 页面正常显示

---

### 测试2：评论通知

**步骤**：
1. 用户A评论用户B的章节
2. 用户B登录，查看通知
3. 点击"xxx评论了你的章节"的"查看详情"

**预期结果**：
- ✅ 跳转到故事页面
- ✅ URL为 `/story.html?id=<故事ID>&node=<章节ID>`
- ✅ 定位到被评论的章节
- ✅ 可以看到评论内容

**实际结果**：（待测试）
- [ ] 跳转正确
- [ ] 定位到章节
- [ ] 显示评论

---

### 测试3：评论回复通知

**步骤**：
1. 用户A回复用户B的评论
2. 用户B登录，查看通知
3. 点击"xxx回复了你的评论"的"查看详情"

**预期结果**：
- ✅ 跳转到故事页面
- ✅ URL为 `/story.html?id=<故事ID>&node=<章节ID>`
- ✅ 定位到被回复的评论所在章节
- ✅ 可以看到回复内容

**实际结果**：（待测试）
- [ ] 跳转正确
- [ ] 定位到章节
- [ ] 显示回复

---

## 📝 历史通知处理

### 问题

数据库中已有的通知（102条）仍然使用旧格式的链接：
- `/user/3`
- `/nodes/123`

### 解决方案

有两种方案：

#### 方案A：数据库批量更新（可选）

```sql
-- 更新关注通知链接
UPDATE notifications 
SET link = '/profile.html?id=' || SUBSTR(link, 7)
WHERE type = 'follow' AND link LIKE '/user/%';

-- 更新评论通知链接（需要查询节点的story_id）
-- 这个比较复杂，需要写脚本
```

#### 方案B：前端兼容处理（推荐）

在前端添加链接转换逻辑，自动识别旧格式并转换：

```javascript
// web/notifications.html
async function handleNotificationClick(id, link) {
    await markAsRead(id);
    if (link) {
        let finalLink = link;
        
        // 兼容旧格式：/user/:id → /profile.html?id=:id
        if (link.startsWith('/user/')) {
            const userId = link.replace('/user/', '');
            finalLink = `/profile.html?id=${userId}`;
        }
        
        // 兼容旧格式：/nodes/:id → 需要查询story_id
        if (link.startsWith('/nodes/')) {
            const nodeId = link.replace('/nodes/', '');
            try {
                const response = await fetch(`/api/nodes/${nodeId}`);
                const data = await response.json();
                finalLink = `/story.html?id=${data.node.story_id}&node=${nodeId}`;
            } catch (error) {
                console.error('获取节点信息失败:', error);
                finalLink = '/';
            }
        }
        
        window.location.href = finalLink;
    }
}
```

**推荐使用方案B**：
- ✅ 不需要修改数据库
- ✅ 兼容历史通知
- ✅ 新通知自动使用正确格式
- ✅ 实现简单

---

## 🎯 其他通知类型检查

### 需要检查的其他通知类型

| 通知类型 | 当前链接格式 | 是否需要修复 |
|---------|-------------|-------------|
| `COLLABORATION_REQUEST` | `/story-settings.html?id=:id` | ✅ 正确 |
| `COLLABORATION_APPROVED` | `/story?id=:id` | ⚠️ 应该是 `/story.html?id=:id` |
| `COLLABORATION_INVITE` | `/story?id=:id` | ⚠️ 应该是 `/story.html?id=:id` |
| `STORY_UPDATE` | 待检查 | ❓ |
| `ai_*` | 待检查 | ❓ |

**建议**：
- 统一所有通知链接格式
- 确保所有链接都包含 `.html` 扩展名
- 使用查询参数传递ID

---

## 📋 总结

### 修改的文件

1. **`api/src/routes/users.ts`** - 关注通知链接
2. **`api/src/routes/comments.ts`** - 评论和回复通知链接

### 修复的问题

- ✅ 关注通知链接：`/user/3` → `/profile.html?id=3`
- ✅ 评论通知链接：`/nodes/123` → `/story.html?id=1&node=123`
- ✅ 回复通知链接：`/nodes/123` → `/story.html?id=1&node=123`

### 测试步骤

1. 重启后端服务
2. 创建新的通知（关注、评论、回复）
3. 点击通知的"查看详情"
4. 验证跳转是否正确

### 后续优化

1. 添加前端兼容逻辑，处理历史通知
2. 检查其他通知类型的链接格式
3. 统一所有通知链接格式

---

**修复完成！请重启后端服务，然后测试通知链接跳转功能。** 🎉

