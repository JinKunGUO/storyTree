# Schema 命名问题修复说明

## 问题原因

你的 `schema.prisma` 文件中：
- 表名和大部分字段使用**下划线命名**（如 `user_id`, `story_id`, `created_at`）
- 只有 `users` 表的部分字段使用了 `@map` 映射到驼峰命名
- Prisma Client 生成的类型使用数据库的实际字段名（下划线）

这导致 TypeScript 代码中使用驼峰命名（如 `authorId`, `createdAt`）时出现类型错误。

## 解决方案

### 方案1：统一使用下划线命名（推荐）

**优点**：
- 简单直接，与数据库保持一致
- 不需要修改 schema
- 只需修改 TypeScript 代码

**缺点**：
- TypeScript 代码不符合驼峰命名惯例

### 方案2：统一使用驼峰命名 + @map

**优点**：
- TypeScript 代码符合驼峰命名惯例
- 代码更易读

**缺点**：
- 需要为所有字段添加 `@map`
- 工作量大（约150+个字段）

## 当前状态

你已经修改了：
- ✅ 所有 `prisma.story` → `prisma.stories`
- ✅ 所有 `prisma.node` → `prisma.nodes`
- ✅ 所有 `prisma.user` → `prisma.users`
- ✅ 其他模型名称

但还需要修改字段名。

## 快速修复（方案1）

由于你的代码量很大，我建议使用 **方案1**：将所有 TypeScript 代码中的字段名改为下划线命名。

### 需要修改的常见字段：

| 驼峰命名 | 下划线命名 |
|---------|-----------|
| `authorId` | `author_id` |
| `storyId` | `story_id` |
| `nodeId` | `node_id` |
| `userId` | `user_id` |
| `parentId` | `parent_id` |
| `rootNodeId` | `root_node_id` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `coverImage` | `cover_image` |
| `ratingAvg` | `rating_avg` |
| `ratingCount` | `rating_count` |
| `readCount` | `read_count` |
| `reviewStatus` | `review_status` |
| `aiGenerated` | `ai_generated` |
| `reportCount` | `report_count` |
| `reportReasons` | `report_reasons` |
| `reviewedBy` | `reviewed_by` |
| `reviewedAt` | `reviewed_at` |
| `reviewNote` | `review_note` |
| `isRead` | `is_read` |
| `isAdmin` | `isAdmin` (已有 @map) |
| `emailVerified` | `emailVerified` (已有 @map) |

### 自动化修改脚本

```bash
cd /Users/jinkun/storytree/api/src/routes

# 批量替换（示例）
sed -i '' 's/authorId/author_id/g' *.ts
sed -i '' 's/storyId/story_id/g' *.ts
sed -i '' 's/nodeId/node_id/g' *.ts
# ... 更多替换
```

## 完整修复（方案2）

如果你想保持驼峰命名，需要在 `schema.prisma` 中为所有字段添加 `@map`：

```prisma
model stories {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  coverImage  String?  @map("cover_image")
  authorId    Int      @map("author_id")
  rootNodeId  Int?     @map("root_node_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @map("updated_at")
  
  bookmarks   bookmarks[]
  nodes       nodes[]
  author      users    @relation(fields: [authorId], references: [id])
}
```

然后重新生成 Prisma Client：

```bash
cd api
npx prisma generate
```

## 建议

由于你的项目已经有大量代码，我建议：

1. **短期**：使用方案1（改为下划线命名），快速让服务器跑起来
2. **长期**：如果有时间，可以逐步迁移到方案2（驼峰 + @map）

## 下一步

请告诉我你选择哪个方案，我会帮你完成修复。

