# 故事可见性逻辑分析与改进方案

## 📊 当前实现分析

### 1. 可见性分类

当前系统定义了三种可见性级别：
- `public` - 公开（默认）
- `friends` - 关注者可见
- `private` - 私密

### 2. 用户角色分类

- **故事主创** (Story Author) - 故事的创建者
- **协作者** (Collaborator) - 被邀请或申请通过的共创者
- **故事粉丝** (Story Follower) - 关注了该故事的用户
- **作者粉丝** (Author Follower) - 关注了故事作者的用户
- **普通用户** (Normal User) - 未登录或未关注的用户

### 3. 当前权限矩阵

| 用户角色 | public | friends | private |
|---------|--------|---------|---------|
| 故事主创 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| 协作者 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| 故事粉丝 | ✅ 可见 | ✅ 可见 | ❌ 不可见 |
| 作者粉丝 | ✅ 可见 | ✅ 可见 | ❌ 不可见 |
| 普通用户 | ✅ 可见 | ❌ 不可见 | ❌ 不可见 |
| 未登录 | ✅ 可见 | ❌ 不可见 | ❌ 不可见 |

## 🔍 逻辑问题分析

### 问题1：命名歧义 ⚠️

**问题**：`friends` 这个命名容易产生误解

```typescript
// 当前代码
visibility: "friends"  // 实际含义是"关注者可见"
```

**歧义点**：
- "friends"在社交网络中通常指双向好友关系
- 但当前实现是**单向关注**关系（粉丝关系）
- 包括两种关注：关注故事 + 关注作者

**建议命名**：
- `followers_only` - 仅关注者可见（更准确）
- `protected` - 受保护的（常见于Twitter等平台）
- `limited` - 限制可见

### 问题2：协作者的特殊地位 ✅

**当前逻辑**：
```typescript
// 协作者始终可见（即使是private）
if (await isCollaborator(userId, storyId)) return true;
```

**分析**：
- ✅ **合理性**：协作者需要查看故事才能续写，这是必要的
- ✅ **一致性**：协作者在成为协作者时自动追更，所以也是"粉丝"
- ⚠️ **潜在问题**：如果协作者被移除（removed_at不为空），是否应该立即失去访问权限？

**当前行为**：
- 协作者退出后，追更关系保持 → 仍可见（如果是friends模式）
- 协作者被移除后，追更关系保持 → 仍可见（如果是friends模式）

### 问题3：两种"关注者"的重叠 🤔

**当前逻辑**：
```typescript
if (story.visibility === 'friends') {
  // 检查是否是故事粉丝
  if (await isStoryFollower(userId, storyId)) return true;
  // 检查是否关注了作者
  return await isFollowingAuthor(userId, storyId);
}
```

**问题**：
- 关注作者 ≠ 关注故事
- 一个作者可能有多个故事
- 关注作者的用户可以看到该作者的**所有** `friends` 级别故事

**场景问题**：
```
用户A关注了作者B
作者B有10个故事，其中5个设置为friends
→ 用户A可以看到这5个故事（即使没有单独关注这些故事）
```

**是否合理？**
- ✅ **支持**：关注作者意味着信任和兴趣，应该能看到作者的非公开作品
- ❌ **反对**：作者可能希望某些作品只对特定粉丝可见（故事粉丝）

### 问题4：缺少"仅协作者可见"选项 ⚠️

**当前限制**：
- `private` = 主创 + 协作者可见
- 没有"仅主创可见"的选项

**场景需求**：
1. 作者想要私人创作，不希望协作者看到（草稿阶段）
2. 作者想要测试功能，不希望任何人看到

### 问题5：密码保护功能未实现 ⚠️

**Schema中存在**：
```typescript
password: String? // 密码保护（可选）
```

**但在权限检查中未使用**：
```typescript
// permissions.ts 中没有检查password字段
```

**潜在用途**：
- 付费内容（需要购买密码）
- 特殊访问（分享给特定人群）
- 临时访问（限时密码）

## 💡 改进方案

### 方案A：优化现有三级分类（推荐）

#### 1. 重命名 `friends` → `followers`

```typescript
// Schema更新
visibility: String @default("public") 
// 可选值: "public", "followers", "private"
```

#### 2. 细化 `followers` 的含义

**选项1：仅故事粉丝**
```typescript
if (story.visibility === 'followers') {
  // 只检查是否是故事粉丝（不包括作者粉丝）
  return await isStoryFollower(userId, storyId);
}
```

**选项2：保持现状（故事粉丝 + 作者粉丝）**
```typescript
if (story.visibility === 'followers') {
  if (await isStoryFollower(userId, storyId)) return true;
  return await isFollowingAuthor(userId, storyId);
}
```

**推荐**：选项2（保持现状），因为：
- 关注作者表示对作者的信任
- 用户体验更好（不需要逐个关注故事）
- 符合大多数平台的逻辑（如Twitter、微博）

#### 3. 添加配置选项：是否包含作者粉丝

```prisma
model stories {
  // ... 现有字段
  visibility                 String  @default("public")
  followers_include_author_fans Boolean @default(true) // followers模式是否包含作者粉丝
}
```

```typescript
if (story.visibility === 'followers') {
  // 故事粉丝始终可见
  if (await isStoryFollower(userId, storyId)) return true;
  
  // 根据设置决定是否包含作者粉丝
  if (story.followers_include_author_fans) {
    return await isFollowingAuthor(userId, storyId);
  }
  return false;
}
```

### 方案B：扩展为五级分类

```typescript
visibility: String @default("public")
// 可选值:
// - "public"           公开（所有人）
// - "followers"        关注者可见（故事粉丝 + 作者粉丝）
// - "story_followers"  仅故事粉丝可见
// - "collaborators"    仅协作者可见（不包括粉丝）
// - "private"          仅主创可见
```

**权限矩阵**：

| 角色 | public | followers | story_followers | collaborators | private |
|-----|--------|-----------|-----------------|---------------|---------|
| 主创 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 协作者 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 故事粉丝 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 作者粉丝 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 普通用户 | ✅ | ❌ | ❌ | ❌ | ❌ |

**优点**：
- 更细粒度的控制
- 满足更多场景需求
- 清晰明确

**缺点**：
- 选项过多，用户可能困惑
- UI设计更复杂
- 增加维护成本

### 方案C：实现密码保护功能

```typescript
export async function canViewStory(
  userId: number | null, 
  storyId: number,
  providedPassword?: string // 新增参数
): Promise<boolean> {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { 
      visibility: true, 
      author_id: true,
      password: true // 查询密码
    }
  });
  
  if (!story) return false;
  
  // 如果设置了密码保护
  if (story.password) {
    // 主创和协作者无需密码
    if (userId) {
      if (story.author_id === userId) return true;
      if (await isCollaborator(userId, storyId)) return true;
    }
    
    // 其他用户需要提供正确的密码
    if (providedPassword !== story.password) {
      return false;
    }
  }
  
  // 继续原有的可见性检查...
}
```

**使用场景**：
- 付费内容（购买后获得密码）
- 特殊活动（活动密码）
- 测试版本（测试密码）

## 📋 推荐实施方案

### 阶段1：立即优化（低成本，高收益）

1. **重命名** `friends` → `followers`
   ```typescript
   // 数据库迁移
   UPDATE stories SET visibility = 'followers' WHERE visibility = 'friends';
   ```

2. **更新文档和UI文案**
   - "关注者可见" 而不是 "好友可见"
   - 说明包含：故事粉丝 + 作者粉丝

3. **添加说明文字**
   ```html
   <select id="visibility">
     <option value="public">公开 - 所有人可见</option>
     <option value="followers">关注者可见 - 关注了你或这个故事的用户可见</option>
     <option value="private">私密 - 仅你和协作者可见</option>
   </select>
   ```

### 阶段2：功能增强（中期规划）

1. **添加配置选项**：`followers_include_author_fans`
   - 让作者选择"关注者可见"是否包含作者粉丝
   - 默认为true（保持现有行为）

2. **实现密码保护**
   - 添加密码输入界面
   - 记住已输入的密码（session）
   - 支持密码修改和移除

### 阶段3：高级功能（长期规划）

1. **白名单/黑名单**
   ```prisma
   model story_access_control {
     id         Int     @id @default(autoincrement())
     story_id   Int
     user_id    Int
     access_type String // "allow" 或 "deny"
     created_at DateTime @default(now())
   }
   ```

2. **时间限制访问**
   ```prisma
   model stories {
     // ...
     public_after DateTime? // 定时公开
     private_after DateTime? // 定时私密
   }
   ```

3. **付费访问**
   ```prisma
   model stories {
     // ...
     price Int? // 积分价格
     purchased_users story_purchases[]
   }
   ```

## 🎯 具体代码修改建议

### 1. 更新Schema

```prisma
model stories {
  id                         Int      @id @default(autoincrement())
  title                      String
  description                String?
  cover_image                String?
  author_id                  Int
  root_node_id               Int?
  
  // 可见性设置
  visibility                 String   @default("public") // public, followers, private
  password                   String?  // 密码保护（可选）
  followers_include_author_fans Boolean @default(true) // followers模式是否包含作者粉丝
  
  // 协作设置
  allow_branch               Boolean  @default(true)
  allow_comment              Boolean  @default(true)
  require_collaborator_review Boolean @default(false)
  auto_approve_collaborators Boolean  @default(false)
  
  tags                       String?
  created_at                 DateTime @default(now())
  updated_at                 DateTime
  
  // ... 关系
}
```

### 2. 更新权限检查逻辑

```typescript
export async function canViewStory(
  userId: number | null, 
  storyId: number,
  providedPassword?: string
): Promise<boolean> {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { 
      visibility: true, 
      author_id: true,
      password: true,
      followers_include_author_fans: true
    }
  });
  
  if (!story) return false;
  
  // 1. 密码保护检查（优先级最高）
  if (story.password) {
    // 主创和协作者无需密码
    if (userId && (
      story.author_id === userId || 
      await isCollaborator(userId, storyId)
    )) {
      // 继续检查可见性
    } else {
      // 其他用户必须提供正确密码
      if (providedPassword !== story.password) {
        return false;
      }
    }
  }
  
  // 2. 可见性检查
  // 公开故事，任何人可见
  if (!story.visibility || story.visibility === 'public') {
    return true;
  }
  
  // 未登录用户不能查看非公开故事
  if (!userId) return false;
  
  // 主创始终可见
  if (story.author_id === userId) return true;
  
  // 协作者始终可见
  if (await isCollaborator(userId, storyId)) return true;
  
  // followers模式
  if (story.visibility === 'followers') {
    // 故事粉丝可见
    if (await isStoryFollower(userId, storyId)) return true;
    
    // 根据设置决定是否包含作者粉丝
    if (story.followers_include_author_fans) {
      return await isFollowingAuthor(userId, storyId);
    }
    return false;
  }
  
  // private模式，其他人不可见
  return false;
}
```

### 3. 数据库迁移脚本

```sql
-- 迁移1: 重命名friends为followers
UPDATE stories 
SET visibility = 'followers' 
WHERE visibility = 'friends';

-- 迁移2: 添加新字段
ALTER TABLE stories 
ADD COLUMN followers_include_author_fans BOOLEAN DEFAULT 1;
```

### 4. 前端UI更新

```html
<!-- story-settings.html -->
<div class="form-group">
  <label for="visibility">可见性</label>
  <select id="visibility" class="form-control">
    <option value="public">🌍 公开 - 所有人可见</option>
    <option value="followers">👥 关注者可见 - 关注了你或这个故事的用户可见</option>
    <option value="private">🔒 私密 - 仅你和协作者可见</option>
  </select>
  <small class="form-text text-muted">
    选择谁可以查看你的故事
  </small>
</div>

<!-- 关注者可见的详细设置 -->
<div id="followersOptions" style="display: none;">
  <div class="form-check">
    <input type="checkbox" id="followersIncludeAuthorFans" class="form-check-input" checked>
    <label for="followersIncludeAuthorFans" class="form-check-label">
      包含关注我的用户（推荐）
    </label>
    <small class="form-text text-muted">
      如果取消勾选，只有关注了这个故事的用户可见
    </small>
  </div>
</div>

<!-- 密码保护 -->
<div class="form-group">
  <label for="storyPassword">密码保护（可选）</label>
  <input type="password" id="storyPassword" class="form-control" 
         placeholder="留空表示不使用密码保护">
  <small class="form-text text-muted">
    设置密码后，即使可见性为"公开"，用户也需要输入密码才能查看
  </small>
</div>

<script>
// 显示/隐藏关注者选项
document.getElementById('visibility').addEventListener('change', function() {
  const followersOptions = document.getElementById('followersOptions');
  followersOptions.style.display = this.value === 'followers' ? 'block' : 'none';
});
</script>
```

## 📊 对比总结

| 方案 | 优点 | 缺点 | 实施难度 | 推荐度 |
|-----|------|------|---------|--------|
| A: 优化现有 | 改动小，兼容性好 | 灵活性有限 | ⭐ 低 | ⭐⭐⭐⭐⭐ |
| B: 五级分类 | 功能强大，灵活 | UI复杂，用户困惑 | ⭐⭐⭐ 中 | ⭐⭐⭐ |
| C: 密码保护 | 满足特殊需求 | 增加复杂度 | ⭐⭐ 中低 | ⭐⭐⭐⭐ |

## 🎯 最终推荐

**立即实施**：方案A（优化现有）
- 重命名 friends → followers
- 添加 followers_include_author_fans 配置
- 更新UI文案和说明

**短期规划**：方案C（密码保护）
- 实现密码保护功能
- 支持付费/特殊访问场景

**长期规划**：根据用户反馈决定是否需要方案B

## ⚠️ 注意事项

1. **向后兼容**：迁移时保留旧数据，friends自动转为followers
2. **用户通知**：更新后通知用户可见性设置的变化
3. **文档更新**：更新所有相关文档和帮助说明
4. **测试覆盖**：确保所有权限组合都经过测试
5. **性能优化**：权限检查涉及多次数据库查询，考虑缓存策略

