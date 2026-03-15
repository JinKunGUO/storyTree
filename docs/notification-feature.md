# 消息通知功能说明

## 功能概述

用户现在可以接收消息提醒。系统会在以下情况发送通知：

1. **关注作者更新**：如果你关注了某位作者，该作者发布新章节时会收到通知
2. **关注作品更新**：如果你关注了某本作品，该作品有新章节发布时会收到通知
3. **协作者自动追更**：成为协作者后会自动追更该故事，接收更新通知

## 协作者与追更关系

### 自动追更机制

当用户成为故事的协作者时（无论是通过申请批准还是主创直接添加），系统会自动将其添加为故事的追更者（粉丝）。

**触发场景：**
- ✅ 协作申请被批准（手动批准）
- ✅ 协作申请自动通过（auto_approve_collaborators = true）
- ✅ 主创直接添加协作者

**实现逻辑：**
```typescript
// 自动将协作者添加为故事粉丝（追更）
await prisma.story_followers.upsert({
  where: {
    story_id_user_id: {
      story_id: story_id,
      user_id: user_id
    }
  },
  create: {
    story_id: story_id,
    user_id: user_id
  },
  update: {} // 如果已存在则不做修改
});
```

**设计理由：**
1. **协作者需要了解故事动态**：协作者需要知道其他作者的续写内容，避免情节冲突
2. **更好的协作体验**：及时收到更新通知，保持团队同步
3. **简化操作**：无需用户手动点击"追更"按钮

**注意事项：**
- 如果用户在成为协作者之前已经追更，不会重复创建记录（使用upsert）
- 协作者退出协作后，追更关系不会自动取消（用户可手动取消）
- 协作者被移除后，追更关系保持不变（用户可手动取消）

## 技术实现

### 后端实现

#### 1. 通知触发点（api/src/routes/nodes.ts）

在以下四个场景中会触发通知：

- **创建第一章**（POST /api/nodes）
- **创建分支章节**（POST /api/nodes with parentId）
- **发布草稿章节**（POST /api/nodes/:id/publish）
- **创建分支**（POST /api/nodes/:id/branches）

#### 2. 通知逻辑

```typescript
// 获取故事关注者
const storyFollowers = await prisma.story_followers.findMany({
  where: { story_id: storyId },
  select: { user_id: true }
});

// 获取作者关注者
const authorFollowers = await prisma.follows.findMany({
  where: { following_id: authorId },
  select: { follower_id: true }
});

// 合并并去重（避免重复通知）
const notifyUserIds = new Set<number>();
storyFollowers.forEach(f => notifyUserIds.add(f.user_id));
authorFollowers.forEach(f => notifyUserIds.add(f.follower_id));

// 排除作者自己
notifyUserIds.delete(authorId);

// 批量创建通知
await prisma.notifications.createMany({
  data: Array.from(notifyUserIds).map(user_id => ({
    user_id,
    type: 'STORY_UPDATE',
    title: '故事更新',
    content: `《${storyTitle}》发布了新章节：${chapterTitle}`,
    link: `/chapter?id=${chapterId}`
  }))
});
```

#### 3. 通知API（api/src/routes/notifications.ts）

- `GET /api/notifications` - 获取用户通知列表及未读数量
- `PUT /api/notifications/:id/read` - 标记单个通知为已读
- `PUT /api/notifications/read-all` - 标记所有通知为已读
- `DELETE /api/notifications/:id` - 删除单个通知

### 前端实现

#### 1. 通知中心页面（web/notifications.html）

功能特性：
- 显示所有通知列表
- 未读通知高亮显示（蓝色背景 + 左侧蓝色条）
- 支持筛选：全部/未读
- 单个标记已读/删除
- 全部标记已读
- 点击通知跳转到对应章节
- 相对时间显示（刚刚、X分钟前、X小时前、X天前）

#### 2. 导航栏通知图标

在所有页面的导航栏添加了：
- 铃铛图标
- 未读数量徽章（红色圆点）
- 点击跳转到通知中心

## 测试步骤

### 准备工作

1. 启动后端服务：
```bash
cd api
npm run dev
```

2. 确保数据库已初始化（包含notifications表）

### 测试场景

#### 场景1：关注作者后收到更新通知

1. 用户A登录系统
2. 访问用户B的个人主页
3. 点击"关注"按钮关注用户B
4. 切换到用户B的账号
5. 创建新故事并发布第一章
6. 切换回用户A的账号
7. 点击导航栏的铃铛图标
8. **预期结果**：看到用户B发布新章节的通知

#### 场景2：关注作品后收到更新通知

1. 用户A登录系统
2. 访问某个故事详情页
3. 点击"追更"按钮关注该故事
4. 切换到该故事作者的账号
5. 为该故事添加新章节
6. 切换回用户A的账号
7. 点击导航栏的铃铛图标
8. **预期结果**：看到该故事更新的通知

#### 场景3：同时关注作者和作品（去重测试）

1. 用户A同时关注了用户B和用户B的某个故事
2. 用户B为该故事发布新章节
3. 用户A查看通知
4. **预期结果**：只收到一条通知（已去重）

#### 场景4：通知管理

1. 用户登录后查看通知中心
2. 测试筛选功能：切换"全部"和"未读"
3. 点击"标为已读"按钮
4. **预期结果**：通知变为已读状态，未读徽章数量减少
5. 点击"全部标为已读"
6. **预期结果**：所有未读通知变为已读，徽章消失
7. 删除某条通知
8. **预期结果**：通知从列表中移除

#### 场景5：通知跳转

1. 用户点击通知中的"查看详情"按钮
2. **预期结果**：
   - 通知自动标记为已读
   - 跳转到对应的章节页面

#### 场景6：未读计数显示

1. 用户有多条未读通知
2. 查看导航栏的铃铛图标
3. **预期结果**：显示红色徽章，数字为未读数量
4. 如果未读数超过99，显示"99+"

#### 场景7：协作者自动追更

1. 用户A申请成为故事B的协作者
2. 申请被批准（或自动通过）
3. 检查用户A的"我追更的故事"列表
4. **预期结果**：故事B自动出现在追更列表中
5. 故事B有更新时，用户A会收到通知
6. 用户A退出协作后，追更关系保持（可手动取消）

### 边界情况测试

1. **作者自己发布章节**：作者不会收到自己的更新通知
2. **未登录用户**：通知图标不显示
3. **没有通知**：显示"暂无通知"的空状态
4. **草稿章节**：保存为草稿时不触发通知，只有发布时才触发
5. **协作者已追更**：成为协作者前已追更的用户，不会重复创建记录
6. **退出协作后**：追更关系保持，用户可手动取消

## 数据库表结构

```sql
-- notifications表
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,           -- 通知类型：STORY_UPDATE等
  title TEXT NOT NULL,          -- 通知标题
  content TEXT NOT NULL,        -- 通知内容
  link TEXT,                    -- 跳转链接（可选）
  is_read BOOLEAN DEFAULT 0,    -- 是否已读
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

## UI设计

### 通知图标
- 位置：导航栏右侧，个人中心图标左侧
- 样式：铃铛图标 + 红色徽章（有未读时显示）
- 交互：点击跳转到通知中心

### 通知中心页面
- 页面标题：消息通知
- 操作按钮：全部标为已读、全部/未读筛选
- 通知项：
  - 未读：浅蓝色背景 + 左侧蓝色条
  - 已读：白色背景
  - 显示内容：标题、内容、时间
  - 操作：查看详情、标为已读、删除

### 响应式设计
- 移动端适配
- 通知项堆叠显示
- 按钮自适应布局

## 性能优化

1. **批量创建通知**：使用`createMany`一次性创建多条通知
2. **去重逻辑**：使用Set避免重复通知
3. **索引优化**：在user_id和is_read字段上建立索引
4. **分页加载**：通知列表限制返回最近50条（可扩展为分页）

## 后续扩展

可以考虑添加的功能：
1. 通知类型扩展（评论通知、点赞通知、系统通知等）
2. 通知设置（允许用户选择接收哪些类型的通知）
3. 实时推送（使用WebSocket或Server-Sent Events）
4. 邮件通知（重要通知发送邮件提醒）
5. 通知分页加载（当通知很多时）
6. 通知音效（收到新通知时播放提示音）

## 注意事项

1. 只有已发布的章节才会触发通知（草稿不触发）
2. 审核未通过的内容不会触发通知
3. 作者不会收到自己发布内容的通知
4. 同时关注作者和作品的用户只会收到一条通知（已去重）
5. 通知链接使用相对路径，确保在不同环境下都能正确跳转
6. **协作者会自动成为故事的追更者**，无需手动点击追更按钮
7. 协作者退出协作或被移除后，追更关系保持不变（用户可手动取消）
8. 使用`upsert`操作确保不会重复创建追更记录

