# 故事可见性升级实施计划

## 📋 现状确认

### ✅ 已实现的功能

1. **协作者自动追更** - ✅ 已完整实现
   - 位置：`api/src/routes/collaboration-requests.ts` (3处)
   - 位置：`api/src/routes/stories.ts` (1处)
   - 实现方式：使用 `upsert` 确保幂等性
   - 触发场景：
     - ✅ 协作申请自动批准（更新已存在的申请）- 第137-149行
     - ✅ 协作申请自动批准（创建新申请）- 第244-256行
     - ✅ 协作申请手动批准 - 第429-441行
     - ✅ 主创直接添加协作者 - 第673-685行

2. **退出协作后保留追更关系** - ✅ 已实现
   - 位置：`api/src/routes/stories.ts:780-830`
   - 实现方式：软删除协作者关系（设置 `removed_at`），但不删除 `story_followers` 记录
   - 用户可以手动取消追更（DELETE `/api/stories/:id/follow`）

### 📊 当前可见性系统

**当前三级分类**：
- `public` - 公开（默认）
- `friends` - 关注者可见
- `private` - 私密

**当前权限逻辑**（`api/src/utils/permissions.ts:77-109`）：

```typescript
export async function canViewStory(userId, storyId) {
  // 1. public: 任何人可见
  if (!story.visibility || story.visibility === 'public') return true;
  
  // 2. 未登录用户不能查看非公开故事
  if (!userId) return false;
  
  // 3. 作者始终可见
  if (story.author_id === userId) return true;
  
  // 4. 协作者始终可见（未被移除）
  if (await isCollaborator(userId, storyId)) return true;
  
  // 5. friends模式：故事粉丝 + 作者粉丝可见
  if (story.visibility === 'friends') {
    if (await isStoryFollower(userId, storyId)) return true;
    return await isFollowingAuthor(userId, storyId);
  }
  
  // 6. private: 其他人不可见
  return false;
}
```

**关键发现**：
- ✅ 协作者检查使用 `removed_at: null`，已正确过滤被移除的协作者
- ✅ 退出协作后，如果是 `friends` 模式且保留了追更关系，仍可查看
- ⚠️ `private` 模式下，协作者可见（符合需求）

---

## 🎯 新需求分析

### 需求：四级可见性分类

用户要求将可见性分为四级（主创永远可见）：

1. **私密** - 仅主创可见
2. **仅协作者可见** - 主创 + 协作者可见
3. **协作者和关注的人可见** - 主创 + 协作者 + 故事粉丝 + 作者粉丝可见
4. **公开** - 所有已登录用户可见

### 与当前系统的对比

| 新需求 | 当前系统 | 差异分析 |
|-------|---------|---------|
| 1. 私密（仅主创） | ❌ 不存在 | **新增**：当前 `private` 包含协作者 |
| 2. 仅协作者可见 | ✅ 当前 `private` | **对应**：主创 + 协作者 |
| 3. 协作者和关注者 | ✅ 当前 `friends` | **对应**：主创 + 协作者 + 粉丝 |
| 4. 公开（已登录） | ⚠️ 当前 `public` | **差异**：当前包含未登录用户 |

### 关键变化

1. **新增级别**：`author_only` - 仅主创可见
2. **重命名**：`private` → `collaborators` - 仅协作者可见
3. **重命名**：`friends` → `followers` - 协作者和关注者可见
4. **限制**：`public` - 从"所有人"改为"所有已登录用户"

---

## 🔍 逻辑完善性分析

### ✅ 逻辑合理性检查

#### 1. 权限层级是否合理？

```
主创 > 协作者 > 关注者 > 已登录用户 > 未登录用户
```

**权限矩阵**：

| 用户角色 | author_only | collaborators | followers | public |
|---------|-------------|---------------|-----------|--------|
| 主创 | ✅ | ✅ | ✅ | ✅ |
| 协作者 | ❌ | ✅ | ✅ | ✅ |
| 故事粉丝 | ❌ | ❌ | ✅ | ✅ |
| 作者粉丝 | ❌ | ❌ | ✅ | ✅ |
| 已登录用户 | ❌ | ❌ | ❌ | ✅ |
| 未登录用户 | ❌ | ❌ | ❌ | ❌ |

**结论**：✅ 权限层级清晰，符合逻辑

#### 2. 协作者退出后的权限是否合理？

**场景分析**：

| 可见性级别 | 退出前 | 退出后（保留追更） | 是否合理？ |
|-----------|-------|------------------|----------|
| author_only | ✅ 可见 | ❌ 不可见 | ✅ 合理：仅主创可见 |
| collaborators | ✅ 可见 | ❌ 不可见 | ✅ 合理：不再是协作者 |
| followers | ✅ 可见 | ✅ 可见 | ✅ 合理：保留了追更身份 |
| public | ✅ 可见 | ✅ 可见 | ✅ 合理：公开可见 |

**结论**：✅ 退出协作后的权限变化合理

#### 3. 关注者的定义是否清晰？

**当前实现**：`followers` 包含两类
- 故事粉丝（`story_followers`）
- 作者粉丝（`follows`）

**问题**：是否应该区分？

**分析**：
- ✅ **保持现状**：关注作者表示信任，应该能看到作者的所有 `followers` 级别故事
- ❌ **分开处理**：会增加复杂度，用户需要逐个关注故事

**建议**：✅ 保持现状，`followers` 包含故事粉丝和作者粉丝

#### 4. 协作者自动追更的逻辑是否合理？

**当前逻辑**：
- 成为协作者 → 自动追更
- 退出协作 → 保留追更关系

**场景验证**：

| 场景 | 行为 | 是否合理？ |
|-----|------|----------|
| 用户A成为协作者 | 自动追更 | ✅ 需要了解故事动态 |
| 用户A退出协作 | 保留追更 | ✅ 可能仍感兴趣 |
| 用户A被移除协作 | 保留追更 | ✅ 可能仍感兴趣 |
| 用户A手动取消追更 | 取消追更 | ✅ 尊重用户选择 |
| 用户A再次成为协作者 | 自动追更（upsert） | ✅ 恢复追更关系 |

**结论**：✅ 协作者自动追更逻辑合理

---

## ⚠️ 潜在冲突分析

### 冲突1：public 限制登录后的影响

**问题**：如果 `public` 改为"仅已登录用户"，未登录用户将无法查看任何故事

**影响**：
- ❌ SEO受影响：搜索引擎爬虫无法索引
- ❌ 分享链接：未登录用户点击分享链接看不到内容
- ❌ 新用户体验：无法预览内容，降低注册转化率

**解决方案**：

**方案A**：保持 `public` 为"所有人可见"（推荐）
```typescript
visibility: 'public' // 所有人（包括未登录用户）
```

**方案B**：添加第五级 `public_anonymous`
```typescript
visibility: 'author_only' | 'collaborators' | 'followers' | 'public' | 'public_anonymous'
// public: 已登录用户
// public_anonymous: 所有人（包括未登录）
```

**方案C**：使用布尔标志
```typescript
visibility: 'public' // 已登录用户
allow_anonymous: boolean // 是否允许未登录用户查看
```

**推荐**：✅ 方案A - 保持 `public` 为所有人可见
- 简单清晰
- 符合大多数用户预期
- 有利于内容传播

### 冲突2：密码保护功能的优先级

**Schema中存在**：
```prisma
password: String? // 密码保护（可选）
```

**当前未实现**，与可见性的关系？

**优先级判断**：
```
密码保护 > 可见性设置
```

**示例**：
- 可见性 = `public`，有密码 → 需要密码
- 可见性 = `private`，有密码 → 主创和协作者无需密码，其他人需要

**建议**：暂不实现密码保护，避免复杂度

### 冲突3：协作者被移除后的内容访问

**场景**：
- 用户A是协作者，创建了10个章节
- 主创移除用户A
- 故事设置为 `collaborators` 级别

**问题**：用户A能否查看自己创作的章节？

**当前逻辑**：❌ 不能（因为不再是协作者）

**是否合理**？
- ✅ **合理**：主创有权控制故事的可见性
- ❌ **不合理**：用户A创作的内容，应该有查看权

**建议**：✅ 保持现状
- 章节属于故事，不属于个人
- 主创有最终控制权
- 如果需要保留访问权，可以保留协作者身份或调整可见性

---

## 📝 数据库变更

### Schema 修改

```prisma
model stories {
  id                         Int      @id @default(autoincrement())
  title                      String
  description                String?
  cover_image                String?
  author_id                  Int
  root_node_id               Int?
  
  // 可见性设置（修改）
  visibility                 String   @default("public") 
  // 可选值: "author_only", "collaborators", "followers", "public"
  // 注释说明：
  // - author_only: 仅主创可见
  // - collaborators: 主创和协作者可见
  // - followers: 主创、协作者、故事粉丝、作者粉丝可见
  // - public: 所有人可见（包括未登录用户）
  
  password                   String?  // 密码保护（可选，暂不实现）
  
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

### 数据迁移脚本

```sql
-- 迁移1: 重命名 friends → followers
UPDATE stories 
SET visibility = 'followers' 
WHERE visibility = 'friends';

-- 迁移2: 重命名 private → collaborators
UPDATE stories 
SET visibility = 'collaborators' 
WHERE visibility = 'private';

-- 迁移3: 确保所有故事都有visibility值
UPDATE stories 
SET visibility = 'public' 
WHERE visibility IS NULL OR visibility = '';

-- 验证迁移结果
SELECT visibility, COUNT(*) as count 
FROM stories 
GROUP BY visibility;
-- 预期结果：只有 author_only, collaborators, followers, public
```

---

## 🔧 代码修改清单

### 1. Schema 文件

**文件**：`api/prisma/schema.prisma`

**修改**：
- 更新 `stories.visibility` 的注释
- 说明四个可选值及其含义

### 2. 权限检查逻辑

**文件**：`api/src/utils/permissions.ts`

**修改**：`canViewStory` 函数

```typescript
export async function canViewStory(
  userId: number | null, 
  storyId: number
): Promise<boolean> {
  const story = await prisma.stories.findUnique({
    where: { id: storyId },
    select: { visibility: true, author_id: true }
  });
  
  if (!story) return false;
  
  // 1. 主创始终可见
  if (userId && story.author_id === userId) return true;
  
  // 2. 根据可见性级别判断
  switch (story.visibility) {
    case 'author_only':
      // 仅主创可见（已在步骤1处理）
      return false;
    
    case 'collaborators':
      // 主创 + 协作者可见
      if (!userId) return false;
      return await isCollaborator(userId, storyId);
    
    case 'followers':
      // 主创 + 协作者 + 故事粉丝 + 作者粉丝可见
      if (!userId) return false;
      
      // 协作者可见
      if (await isCollaborator(userId, storyId)) return true;
      
      // 故事粉丝可见
      if (await isStoryFollower(userId, storyId)) return true;
      
      // 作者粉丝可见
      return await isFollowingAuthor(userId, storyId);
    
    case 'public':
    default:
      // 所有人可见（包括未登录用户）
      return true;
  }
}
```

### 3. 前端UI更新

**文件**：`web/story-settings.html`（假设存在）

**修改**：可见性选择器

```html
<div class="form-group">
  <label for="visibility">故事可见性</label>
  <select id="visibility" class="form-control">
    <option value="public">🌍 公开 - 所有人可见</option>
    <option value="followers">👥 关注者可见 - 关注了你或这个故事的用户可见</option>
    <option value="collaborators">🤝 仅协作者 - 仅你和协作者可见</option>
    <option value="author_only">🔒 私密 - 仅你自己可见</option>
  </select>
  <small class="form-text text-muted">
    选择谁可以查看你的故事。你作为主创始终可以查看和编辑。
  </small>
</div>
```

### 4. API响应更新

**文件**：多个API端点

**修改**：错误消息更清晰

```typescript
// 在 canViewStory 返回 false 时
if (!hasPermission) {
  const errorMessages = {
    'author_only': '此故事为私密状态，仅作者可见',
    'collaborators': '此故事仅协作者可见',
    'followers': '此故事仅关注者可见，请先关注作者或故事',
    'public': '无权限查看此故事'
  };
  
  return res.status(403).json({ 
    error: errorMessages[story.visibility] || '无权限查看此故事'
  });
}
```

---

## 🧪 测试用例

### 测试矩阵

| 测试ID | 用户角色 | 可见性 | 预期结果 | 测试数据 |
|-------|---------|-------|---------|---------|
| T1 | 主创 | author_only | ✅ 可见 | storyId=1, userId=1(author) |
| T2 | 协作者 | author_only | ❌ 不可见 | storyId=1, userId=2(collaborator) |
| T3 | 故事粉丝 | author_only | ❌ 不可见 | storyId=1, userId=3(follower) |
| T4 | 未登录 | author_only | ❌ 不可见 | storyId=1, userId=null |
| T5 | 主创 | collaborators | ✅ 可见 | storyId=2, userId=1(author) |
| T6 | 协作者 | collaborators | ✅ 可见 | storyId=2, userId=2(collaborator) |
| T7 | 故事粉丝 | collaborators | ❌ 不可见 | storyId=2, userId=3(follower) |
| T8 | 已退出协作者 | collaborators | ❌ 不可见 | storyId=2, userId=4(removed) |
| T9 | 主创 | followers | ✅ 可见 | storyId=3, userId=1(author) |
| T10 | 协作者 | followers | ✅ 可见 | storyId=3, userId=2(collaborator) |
| T11 | 故事粉丝 | followers | ✅ 可见 | storyId=3, userId=3(story_follower) |
| T12 | 作者粉丝 | followers | ✅ 可见 | storyId=3, userId=4(author_follower) |
| T13 | 已退出协作者（保留追更） | followers | ✅ 可见 | storyId=3, userId=5(removed+follower) |
| T14 | 普通已登录用户 | followers | ❌ 不可见 | storyId=3, userId=6(normal) |
| T15 | 未登录 | followers | ❌ 不可见 | storyId=3, userId=null |
| T16 | 主创 | public | ✅ 可见 | storyId=4, userId=1(author) |
| T17 | 协作者 | public | ✅ 可见 | storyId=4, userId=2(collaborator) |
| T18 | 已登录用户 | public | ✅ 可见 | storyId=4, userId=3(normal) |
| T19 | 未登录 | public | ✅ 可见 | storyId=4, userId=null |

### 边界情况测试

| 测试ID | 场景 | 预期行为 |
|-------|------|---------|
| E1 | 故事不存在 | 返回404 |
| E2 | visibility字段为空 | 默认为public |
| E3 | visibility为未知值 | 默认为public |
| E4 | 用户同时是协作者和粉丝 | 按协作者权限（更高） |
| E5 | 协作者被移除但保留追更 | 按粉丝权限 |
| E6 | 用户关注了作者和故事 | 只需满足一个条件即可 |
| E7 | 作者自己查看 | 始终可见（任何级别） |

---

## 📊 实施步骤

### 阶段1：准备工作（预计30分钟）

1. **备份数据库**
   ```bash
   cp api/prisma/dev.db api/prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/visibility-upgrade
   ```

3. **审查当前代码**
   - ✅ 确认协作者自动追更已实现
   - ✅ 确认退出协作保留追更已实现
   - ✅ 确认权限检查逻辑位置

### 阶段2：Schema更新（预计15分钟）

1. **更新 `api/prisma/schema.prisma`**
   - 更新 `stories.visibility` 注释
   - 说明四个可选值

2. **创建数据迁移SQL**
   - 文件：`api/prisma/migrations/visibility_upgrade.sql`
   - 内容：见上文"数据迁移脚本"

3. **执行迁移**
   ```bash
   cd api
   # 先在测试数据库验证
   sqlite3 prisma/dev.db < prisma/migrations/visibility_upgrade.sql
   # 验证结果
   sqlite3 prisma/dev.db "SELECT visibility, COUNT(*) FROM stories GROUP BY visibility;"
   ```

### 阶段3：后端代码修改（预计45分钟）

1. **修改 `api/src/utils/permissions.ts`**
   - 更新 `canViewStory` 函数
   - 使用 switch-case 处理四个级别
   - 添加详细注释

2. **更新错误消息**
   - 在各个API端点添加清晰的错误提示
   - 根据可见性级别返回不同消息

3. **添加单元测试**
   - 测试所有权限组合
   - 测试边界情况

### 阶段4：前端UI更新（预计30分钟）

1. **查找故事设置页面**
   ```bash
   grep -r "visibility" web/*.html
   ```

2. **更新可见性选择器**
   - 更新选项文本
   - 更新说明文字
   - 添加图标

3. **更新创建故事页面**
   - 同步更新可见性选项

### 阶段5：测试验证（预计60分钟）

1. **手动测试**
   - 创建测试故事（4种可见性）
   - 创建测试用户（主创、协作者、粉丝、普通用户）
   - 逐一验证权限矩阵

2. **边界情况测试**
   - 测试协作者退出后的权限
   - 测试未登录用户访问
   - 测试不存在的故事

3. **回归测试**
   - 确认现有功能不受影响
   - 确认协作者自动追更仍正常
   - 确认退出协作保留追更仍正常

### 阶段6：文档更新（预计20分钟）

1. **更新API文档**
   - 说明新的可见性级别
   - 更新权限规则说明

2. **更新用户文档**
   - 说明四种可见性的区别
   - 提供使用建议

3. **更新CHANGELOG**
   - 记录breaking changes
   - 说明迁移方式

### 阶段7：部署上线（预计30分钟）

1. **代码审查**
   - 检查所有修改
   - 确认没有遗漏

2. **合并代码**
   ```bash
   git add .
   git commit -m "feat: 升级故事可见性为四级系统"
   git push origin feature/visibility-upgrade
   ```

3. **生产环境迁移**
   - 备份生产数据库
   - 执行迁移脚本
   - 验证迁移结果

---

## ⚠️ 风险评估

### 高风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 数据迁移失败 | 所有故事可见性错误 | 1. 充分测试迁移脚本<br>2. 备份数据库<br>3. 准备回滚方案 |
| 权限检查逻辑错误 | 用户看到不该看的内容 | 1. 完整测试矩阵<br>2. 代码审查<br>3. 灰度发布 |

### 中风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 前端UI未同步更新 | 用户困惑 | 1. 检查所有相关页面<br>2. 搜索所有visibility引用 |
| 现有故事可见性变化 | 用户投诉 | 1. 合理的默认值映射<br>2. 通知用户检查设置 |

### 低风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 性能影响 | 查询变慢 | 1. 添加数据库索引<br>2. 缓存权限检查结果 |
| 文档不完整 | 用户疑问 | 1. 详细的文档<br>2. FAQ |

---

## 📋 检查清单

### 开发前检查

- [ ] 已阅读并理解需求
- [ ] 已分析逻辑完善性
- [ ] 已识别潜在冲突
- [ ] 已准备测试数据
- [ ] 已备份数据库

### 开发中检查

- [ ] Schema已更新
- [ ] 数据迁移脚本已准备
- [ ] 权限检查逻辑已修改
- [ ] 错误消息已更新
- [ ] 前端UI已更新
- [ ] 单元测试已添加

### 测试检查

- [ ] 所有测试用例通过
- [ ] 边界情况已测试
- [ ] 回归测试通过
- [ ] 性能测试通过

### 上线前检查

- [ ] 代码已审查
- [ ] 文档已更新
- [ ] 迁移脚本已验证
- [ ] 回滚方案已准备
- [ ] 监控已配置

---

## 🎯 总结

### ✅ 逻辑完善性

1. **权限层级清晰**：author_only < collaborators < followers < public
2. **协作者退出逻辑合理**：退出后按追更身份判断权限
3. **关注者定义明确**：包含故事粉丝和作者粉丝
4. **自动追更逻辑合理**：成为协作者自动追更，退出保留

### ✅ 无逻辑冲突

1. **public保持所有人可见**：避免SEO和分享问题
2. **密码保护暂不实现**：避免复杂度
3. **协作者被移除后失去特殊权限**：主创有最终控制权

### ✅ 实施可行性

1. **数据迁移简单**：只需更新visibility字段
2. **代码改动集中**：主要在permissions.ts
3. **向后兼容**：旧数据自动映射到新系统
4. **测试覆盖完整**：19个基础用例 + 7个边界用例

### 🚀 建议开始实施

所有分析已完成，逻辑完善，无冲突，可以开始实施！

---

## 📞 需要确认的问题

在开始实施前，请确认以下问题：

1. **public的范围**：是否保持"所有人可见"（包括未登录）？
   - ✅ 推荐：保持所有人可见
   - ❌ 备选：改为仅已登录用户

2. **密码保护功能**：是否在本次实施？
   - ✅ 推荐：暂不实施
   - ❌ 备选：一起实施

3. **迁移通知**：是否需要通知用户检查可见性设置？
   - ✅ 推荐：发送站内通知
   - ❌ 备选：不通知

请确认以上问题后，我将开始实施！

