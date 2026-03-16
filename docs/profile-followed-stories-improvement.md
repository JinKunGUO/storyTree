# 个人页面"我关注的故事"功能改进方案

## 📊 当前问题

### 问题描述
1. ❌ **显示为空**：前端期望`data.stories`，但API返回`data.follows`
2. ❌ **缺少协作故事**：只显示追更的故事，不包括协作的故事
3. ❌ **无区分度**：无法区分哪些是协作故事，哪些是纯追更故事

### 当前实现

**前端**（`web/profile.html:682-706`）：
```javascript
async function loadFollowedStories(userId) {
  const response = await fetch(`/api/stories/user/${userId}/followed-stories`);
  const data = await response.json();
  displayFollowedStories(data.stories); // ❌ 错误：API返回的是data.follows
}
```

**后端**（`api/src/routes/stories.ts:960-1020`）：
```typescript
// 获取用户关注的故事列表
router.get('/user/:userId/followed-stories', ...)
// 返回: { follows: [...], pagination: {...} }
```

## 💡 改进方案

### 目标
1. ✅ 显示所有追更的故事（story_followers表）
2. ✅ 显示所有协作的故事（story_collaborators表，removed_at=null）
3. ✅ 视觉上区分协作故事和纯追更故事
4. ✅ 合并去重（协作故事也可能在追更列表中）

### 方案设计

#### 数据来源
```
追更故事 = story_followers (user_id = current_user)
协作故事 = story_collaborators (user_id = current_user AND removed_at IS NULL)

显示列表 = 追更故事 ∪ 协作故事（去重）
```

#### 视觉区分
- **协作故事**：
  - 图标：🤝 `fa-users`（协作）
  - 标签：`协作中`徽章
  - 颜色：蓝色主题

- **纯追更故事**：
  - 图标：⭐ `fa-star`（追更）
  - 标签：`追更中`徽章
  - 颜色：黄色主题

## 🔧 实施方案

### 方案A：前端修复（快速）⭐ 推荐

**优点**：
- 工作量小
- 不影响API
- 向后兼容

**实施步骤**：
1. 修复前端数据解析（`data.follows` → 提取story）
2. 额外请求协作故事列表
3. 合并去重
4. 添加视觉区分

### 方案B：后端新API（完整）

**优点**：
- 性能更好（一次请求）
- 逻辑更清晰
- 数据更完整

**实施步骤**：
1. 创建新API `/api/users/:id/followed-and-collaborated-stories`
2. 后端合并追更和协作故事
3. 返回统一格式，包含角色标识
4. 前端调用新API

### 方案C：修改现有API（兼容性差）

**缺点**：
- 破坏现有API
- 需要修改其他调用方
- 不推荐

## 🎯 推荐实施：方案A（前端修复）

### 步骤1：修复数据解析

```javascript
async function loadFollowedStories(userId) {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    // 1. 获取追更故事
    const followedResponse = await fetch(`/api/stories/user/${userId}/followed-stories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!followedResponse.ok) {
      throw new Error('加载关注的故事失败');
    }
    
    const followedData = await followedResponse.json();
    
    // 2. 获取协作故事
    const collaboratedResponse = await fetch(`/api/users/${userId}/collaborated-stories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let collaboratedStories = [];
    if (collaboratedResponse.ok) {
      const collaboratedData = await collaboratedResponse.json();
      collaboratedStories = collaboratedData.stories || [];
    }
    
    // 3. 合并和标记
    const followedStories = followedData.follows.map(f => ({
      ...f.story,
      is_collaborated: false,
      is_followed: true
    }));
    
    // 标记协作故事
    const storyMap = new Map();
    followedStories.forEach(story => {
      storyMap.set(story.id, story);
    });
    
    collaboratedStories.forEach(story => {
      if (storyMap.has(story.id)) {
        // 已存在，标记为协作
        storyMap.get(story.id).is_collaborated = true;
      } else {
        // 新增协作故事
        storyMap.set(story.id, {
          ...story,
          is_collaborated: true,
          is_followed: false
        });
      }
    });
    
    // 4. 转换为数组并排序
    const allStories = Array.from(storyMap.values());
    allStories.sort((a, b) => {
      // 协作故事优先
      if (a.is_collaborated && !b.is_collaborated) return -1;
      if (!a.is_collaborated && b.is_collaborated) return 1;
      // 按更新时间排序
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    
    displayFollowedStories(allStories);
  } catch (error) {
    console.error('加载关注的故事错误:', error);
    showEmptyFollowedStories();
  }
}
```

### 步骤2：更新显示函数

```javascript
function displayFollowedStories(stories) {
  const list = document.getElementById('followedStoriesList');
  
  if (!stories || stories.length === 0) {
    showEmptyFollowedStories();
    return;
  }

  const storiesHTML = stories.map(story => {
    const nodeCount = story._count?.nodes || 0;
    const likeCount = story._count?.bookmarks || 0;
    const viewCount = story.views || 0;
    const authorName = story.author?.username || '未知作者';
    
    // 确定图标和标签
    let icon, badge, badgeClass;
    if (story.is_collaborated) {
      icon = 'fa-users';
      badge = '协作中';
      badgeClass = 'badge-collaborated';
    } else {
      icon = 'fa-star';
      badge = '追更中';
      badgeClass = 'badge-followed';
    }
    
    return `
      <div class="story-item" onclick="window.location.href='/story?id=${story.id}'">
        <div class="story-icon ${story.is_collaborated ? 'icon-collaborated' : 'icon-followed'}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="story-details">
          <div class="story-title">
            ${escapeHtml(story.title)}
            <span class="story-badge ${badgeClass}">${badge}</span>
          </div>
          <div class="story-meta">
            <span><i class="fas fa-user"></i> ${escapeHtml(authorName)}</span>
            <span><i class="fas fa-file-alt"></i> ${nodeCount} 章节</span>
            <span><i class="fas fa-heart"></i> ${likeCount} 点赞</span>
            <span><i class="fas fa-eye"></i> ${viewCount} 浏览</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = storiesHTML;
}
```

### 步骤3：添加CSS样式

```css
/* 协作故事图标 */
.icon-collaborated {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 追更故事图标 */
.icon-followed {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

/* 故事标签 */
.story-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 12px;
  margin-left: 8px;
  font-weight: 500;
}

.badge-collaborated {
  background: #667eea;
  color: white;
}

.badge-followed {
  background: #f5576c;
  color: white;
}
```

### 步骤4：检查协作故事API

需要确认是否存在获取用户协作故事的API，如果不存在需要创建。

## 📝 后端API检查

### 需要的API

1. **获取追更故事** - ✅ 已存在
   ```
   GET /api/stories/user/:userId/followed-stories
   返回: { follows: [...], pagination: {...} }
   ```

2. **获取协作故事** - ❓ 需要确认
   ```
   GET /api/users/:userId/collaborated-stories
   返回: { stories: [...], pagination: {...} }
   ```

### 如果协作故事API不存在

需要创建新API：

```typescript
// 获取用户协作的故事列表
router.get('/users/:userId/collaborated-stories', optionalAuth, async (req, res) => {
  const currentUserId = getUserId(req);
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 100; // 默认100条

  try {
    // 获取协作故事（未被移除）
    const collaborations = await prisma.story_collaborators.findMany({
      where: {
        user_id: parseInt(userId),
        removed_at: null // 仅未被移除的
      },
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true, avatar: true }
            },
            _count: {
              select: {
                nodes: true,
                bookmarks: true,
                followers: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 过滤掉当前用户无权查看的故事
    const visibleStories = [];
    for (const collab of collaborations) {
      const hasPermission = await canViewStory(currentUserId, collab.story_id);
      if (hasPermission) {
        visibleStories.push(collab.story);
      }
    }

    res.json({
      stories: visibleStories,
      total: collaborations.length
    });
  } catch (error) {
    console.error('Get collaborated stories error:', error);
    res.status(500).json({ error: 'Failed to fetch collaborated stories' });
  }
});
```

## 📊 视觉效果对比

### 改进前
```
⭐ 故事标题
   作者 | 章节 | 点赞 | 浏览
```

### 改进后
```
🤝 故事标题 [协作中]
   作者 | 章节 | 点赞 | 浏览

⭐ 故事标题 [追更中]
   作者 | 章节 | 点赞 | 浏览
```

## ✅ 实施检查清单

- [ ] 检查协作故事API是否存在
- [ ] 如不存在，创建协作故事API
- [ ] 修改前端loadFollowedStories函数
- [ ] 修改前端displayFollowedStories函数
- [ ] 添加CSS样式
- [ ] 测试显示效果
- [ ] 测试去重逻辑
- [ ] 测试排序逻辑

## 🧪 测试用例

1. **仅追更故事**：用户只追更了故事，没有协作
2. **仅协作故事**：用户只协作了故事，没有追更
3. **既协作又追更**：用户协作的故事也在追更列表中
4. **空列表**：用户既没有追更也没有协作
5. **退出协作**：用户退出协作后，故事仍在追更列表中

## 🚀 预期效果

- ✅ 显示所有追更的故事
- ✅ 显示所有协作的故事
- ✅ 协作故事显示蓝色图标和"协作中"标签
- ✅ 纯追更故事显示粉色图标和"追更中"标签
- ✅ 协作故事排在前面
- ✅ 合并去重，不重复显示
- ✅ 空列表时显示友好提示

## 📚 相关文档

- [协作者自动追更](./collaborator-auto-follow.md)
- [故事可见性系统](./visibility-upgrade-plan.md)

