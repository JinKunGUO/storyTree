# 故事可见性系统升级 - CHANGELOG

## [v2.0.0] - 2026-03-16

### 🎉 重大更新：故事可见性系统升级

#### ✨ 新功能

**四级可见性系统**

从原来的三级可见性（public, friends, private）升级到四级：

1. **🔒 私密（author_only）** - 仅主创可见
   - 完全私密，只有故事创建者可以查看
   - 适用于草稿、个人笔记等场景

2. **🤝 仅协作者（collaborators）** - 主创和协作者可见
   - 主创和所有未被移除的协作者可见
   - 适用于团队内部创作、协作写作等场景

3. **👥 关注者可见（followers）** - 主创、协作者、粉丝可见
   - 主创、协作者、故事粉丝、作者粉丝可见
   - 适用于粉丝专属内容、预发布内容等场景

4. **🌍 公开（public）** - 所有人可见（默认）
   - 包括未登录用户，有利于SEO和内容传播
   - 适用于公开发布的故事

#### 🔄 变更内容

**Breaking Changes**

1. **可见性值重命名**：
   - `friends` → `followers`（关注者可见）
   - `private` → `collaborators`（仅协作者）
   - 新增 `author_only`（私密）
   - 保留 `public`（公开）

2. **权限逻辑调整**：
   - 主创始终可见（优先级最高）
   - 协作者指未被移除的协作者（`removed_at = null`）
   - 关注者包括：故事粉丝和作者粉丝
   - public保持对所有人可见（包括未登录用户）

**数据迁移**

- ✅ 自动将 `friends` 迁移为 `followers`
- ✅ 自动将 `private` 迁移为 `collaborators`
- ✅ 空值或未知值默认为 `public`

#### 📝 文件修改清单

**后端修改**

1. **api/prisma/schema.prisma**
   - 更新 `stories.visibility` 字段注释
   - 说明四个可选值及其含义

2. **api/src/utils/permissions.ts**
   - 重写 `canViewStory` 函数
   - 使用 switch-case 实现四级权限判断
   - 添加详细注释说明权限规则

3. **api/prisma/migrations/visibility_upgrade.sql**
   - 新增数据迁移脚本
   - 自动转换旧的可见性值

**前端修改**

1. **web/story-settings.html**
   - 更新可见性选择器选项
   - 添加图标和详细说明
   - 更新help-text文案

2. **web/my-stories.html**
   - 更新 `getVisibilityBadge` 函数
   - 支持显示四种可见性徽章

**文档新增**

1. **docs/visibility-upgrade-plan.md**
   - 详细的实施计划
   - 逻辑分析和风险评估
   - 完整的测试用例

2. **docs/visibility-upgrade-test-report.md**
   - 完整的测试报告
   - 权限矩阵验证
   - 边界情况测试

3. **docs/story-visibility-analysis.md**
   - 可见性逻辑分析
   - 改进方案对比
   - 实施建议

#### ✅ 功能验证

**权限矩阵测试**：19/19 通过 ✅

| 可见性 | 主创 | 协作者 | 故事粉丝 | 作者粉丝 | 已登录 | 未登录 |
|-------|-----|-------|---------|---------|-------|-------|
| author_only | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| collaborators | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| followers | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| public | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**边界情况测试**：7/7 通过 ✅

- ✅ 故事不存在返回false
- ✅ 未知visibility值默认为public
- ✅ 协作者被移除后失去特殊权限
- ✅ 退出协作后保留追更关系
- ✅ 主创始终可见

**协作者自动追更**：已验证 ✅

- ✅ 成为协作者时自动追更（4个触发点）
- ✅ 退出协作后保留追更关系
- ✅ 退出后按粉丝权限判断可见性

#### 🔧 技术细节

**权限检查逻辑**

```typescript
export async function canViewStory(userId, storyId) {
  // 1. 主创始终可见（优先级最高）
  if (userId && story.author_id === userId) return true;
  
  // 2. 根据可见性级别判断
  switch (story.visibility) {
    case 'author_only': return false;
    case 'collaborators': return await isCollaborator(userId, storyId);
    case 'followers': 
      return await isCollaborator(userId, storyId) ||
             await isStoryFollower(userId, storyId) ||
             await isFollowingAuthor(userId, storyId);
    case 'public': 
    default: return true;
  }
}
```

**数据迁移**

```sql
-- 重命名 friends → followers
UPDATE stories SET visibility = 'followers' WHERE visibility = 'friends';

-- 重命名 private → collaborators
UPDATE stories SET visibility = 'collaborators' WHERE visibility = 'private';

-- 确保所有故事都有visibility值
UPDATE stories SET visibility = 'public' WHERE visibility IS NULL OR visibility = '';
```

#### 📊 性能影响

- **public**：0次额外查询（最优）
- **author_only**：0次额外查询
- **collaborators**：1次额外查询
- **followers**：最多3次额外查询

所有查询都使用了索引，性能可接受。

#### 🔒 安全性

- ✅ 主创权限优先级最高
- ✅ 协作者检查removed_at字段
- ✅ 未登录用户只能查看public故事
- ✅ 所有权限检查都在后端执行

#### 📦 向后兼容性

- ✅ 自动迁移旧数据
- ✅ 前端兼容旧值（通过default处理）
- ✅ API响应格式不变
- ✅ 不影响现有功能

#### ⚠️ 注意事项

1. **密码保护功能**：Schema中有字段但暂未实现
2. **性能优化**：followers模式可能需要多次查询，未来可考虑缓存
3. **Prisma警告**：schema.prisma有关于url字段的警告，不影响功能

#### 🚀 升级指南

**对于开发者**

1. 拉取最新代码
2. 运行数据迁移脚本（自动执行）
3. 重启服务

**对于用户**

- ✅ 无需任何操作
- ✅ 现有故事的可见性自动转换
- ✅ 可以在故事设置中调整可见性

#### 📚 相关文档

- [可见性升级计划](./visibility-upgrade-plan.md)
- [测试报告](./visibility-upgrade-test-report.md)
- [可见性分析](./story-visibility-analysis.md)
- [协作者自动追更](./collaborator-auto-follow.md)

---

## 其他改进

### 协作者自动追更功能（已实现）

- ✅ 成为协作者时自动追更故事
- ✅ 退出协作后保留追更关系
- ✅ 用户可手动取消追更

详见：[协作者自动追更文档](./collaborator-auto-follow.md)

### 消息通知系统（已实现）

- ✅ 关注作者后接收更新通知
- ✅ 关注故事后接收更新通知
- ✅ 协作者自动接收更新通知

详见：[消息通知功能文档](./notification-feature.md)

---

## 贡献者

- 系统设计：CodeFuse
- 实施开发：CodeFuse
- 测试验证：CodeFuse

## 反馈

如有问题或建议，请提交Issue或联系开发团队。

