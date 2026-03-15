# 协作者自动追更功能

## 功能说明

当用户成为故事的协作者时，系统会自动将其添加为该故事的追更者（粉丝），确保协作者能及时收到故事的更新通知。

## 实现位置

### 1. 协作申请批准（`api/src/routes/collaboration-requests.ts`）

#### 场景1：自动批准（更新已存在的申请）
**位置**：第136-149行

```typescript
// 自动将协作者添加为故事粉丝（追更）
await prisma.story_followers.upsert({
  where: {
    story_id_user_id: {
      story_id: story_id,
      user_id: userId
    }
  },
  create: {
    story_id: story_id,
    user_id: userId
  },
  update: {} // 如果已存在则不做修改
});
```

#### 场景2：自动批准（创建新申请）
**位置**：第243-256行

同样的逻辑，确保新申请自动批准时也会添加追更关系。

#### 场景3：手动批准
**位置**：第428-441行

主创手动批准协作申请时，同样会自动添加追更关系。

### 2. 主创直接添加协作者（`api/src/routes/stories.ts`）

**位置**：第672-685行

当主创通过故事设置直接添加协作者时，也会自动添加追更关系。

```typescript
// 自动将协作者添加为故事粉丝（追更）
await prisma.story_followers.upsert({
  where: {
    story_id_user_id: {
      story_id: parseInt(id),
      user_id: user_id
    }
  },
  create: {
    story_id: parseInt(id),
    user_id: user_id
  },
  update: {} // 如果已存在则不做修改
});
```

## 设计考虑

### 为什么要自动追更？

1. **协作需求**：协作者需要了解故事的最新动态，包括其他作者的续写内容
2. **避免冲突**：及时知道故事发展，避免情节冲突和重复创作
3. **用户体验**：简化操作流程，无需用户手动点击"追更"按钮
4. **团队协作**：保持创作团队的信息同步

### 为什么使用 `upsert`？

使用 `upsert` 操作而不是简单的 `create` 有以下优点：

1. **幂等性**：多次执行不会出错
2. **避免重复**：如果用户已经追更，不会创建重复记录
3. **容错性**：即使数据库中已存在记录，操作也能成功完成

### 退出协作后的处理

**设计决策**：协作者退出协作或被移除后，追更关系保持不变。

**理由**：
- 用户可能仍然对故事感兴趣，希望继续关注
- 给用户更多控制权，由用户自己决定是否取消追更
- 避免强制取消可能导致的用户不满

**实现**：
- 退出协作只更新 `story_collaborators` 表（设置 `removed_at`）
- 不修改 `story_followers` 表
- 用户可以手动点击"取消追更"按钮

## 数据流程

```
用户成为协作者
    ↓
添加到 story_collaborators 表
    ↓
自动添加到 story_followers 表 (upsert)
    ↓
用户可以收到故事更新通知
    ↓
[可选] 用户退出协作
    ↓
从 story_collaborators 移除（软删除）
    ↓
story_followers 关系保持
    ↓
[可选] 用户手动取消追更
```

## 测试场景

### 场景1：新用户成为协作者

1. 用户A申请成为故事B的协作者
2. 申请被批准
3. **验证**：
   - `story_collaborators` 表有记录
   - `story_followers` 表有记录
   - 故事B更新时，用户A收到通知

### 场景2：已追更用户成为协作者

1. 用户A已经追更了故事B
2. 用户A申请成为协作者
3. 申请被批准
4. **验证**：
   - `story_followers` 表只有一条记录（不重复）
   - 故事B更新时，用户A收到通知

### 场景3：协作者退出

1. 用户A是故事B的协作者
2. 用户A退出协作
3. **验证**：
   - `story_collaborators` 表记录被软删除（`removed_at` 不为空）
   - `story_followers` 表记录仍然存在
   - 故事B更新时，用户A仍然收到通知
   - 用户A可以手动取消追更

### 场景4：主创直接添加

1. 主创直接添加用户A为协作者
2. **验证**：
   - `story_collaborators` 表有记录
   - `story_followers` 表有记录
   - 用户A收到协作邀请通知
   - 故事更新时用户A收到通知

## SQL 查询验证

### 验证协作者是否自动追更

```sql
-- 查询某个用户的协作关系和追更关系
SELECT 
  sc.story_id,
  sc.user_id,
  sc.removed_at AS collaborator_removed_at,
  sf.created_at AS follower_created_at
FROM story_collaborators sc
LEFT JOIN story_followers sf 
  ON sc.story_id = sf.story_id 
  AND sc.user_id = sf.user_id
WHERE sc.user_id = ?;
```

### 查询未追更的协作者（异常情况）

```sql
-- 理论上应该为空，如果有结果说明存在bug
SELECT 
  sc.story_id,
  sc.user_id,
  s.title
FROM story_collaborators sc
LEFT JOIN story_followers sf 
  ON sc.story_id = sf.story_id 
  AND sc.user_id = sf.user_id
JOIN stories s ON sc.story_id = s.id
WHERE sc.removed_at IS NULL
  AND sf.user_id IS NULL;
```

## 相关文件

- `api/src/routes/collaboration-requests.ts` - 协作申请处理
- `api/src/routes/stories.ts` - 故事管理，包括添加协作者
- `api/src/routes/nodes.ts` - 章节创建，触发通知
- `api/src/routes/notifications.ts` - 通知管理
- `docs/notification-feature.md` - 通知功能完整文档

## 注意事项

1. ✅ 使用 `upsert` 确保幂等性
2. ✅ 在所有成为协作者的路径都添加了自动追更逻辑
3. ✅ 退出协作不会自动取消追更
4. ✅ 不会创建重复的追更记录
5. ⚠️ 如果数据库约束失败，整个事务会回滚
6. ⚠️ 确保 `story_followers` 表有正确的唯一约束：`@@unique([story_id, user_id])`

## 后续优化建议

1. **批量操作**：如果需要批量添加协作者，考虑使用 `createMany` 优化性能
2. **事务处理**：考虑将添加协作者和追更操作放在同一事务中
3. **通知优化**：可以在通知中明确说明"你已自动追更此故事"
4. **设置选项**：未来可以考虑添加用户设置，允许用户选择是否自动追更
5. **统计数据**：可以添加统计，追踪有多少协作者是通过自动追更获得的

## 版本历史

- **2026-03-15**: 初始实现，在所有成为协作者的路径添加自动追更逻辑
- **2026-03-15**: 修复前端bug：修正追更按钮的判断逻辑（`web/story.html:2303`）
  - 问题：判断逻辑检查"已关注"，但按钮显示的是"已追更"
  - 修复：将 `includes('已关注')` 改为 `includes('已追更')`
  - 影响：协作者现在可以正常点击"已追更"按钮取消追更

