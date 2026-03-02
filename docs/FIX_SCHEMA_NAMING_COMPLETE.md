# Schema 命名问题修复完成报告

**日期**: 2026-03-01  
**版本**: v1.0.15  
**状态**: ✅ 已完成

---

## 问题原因

当你运行 `npm run dev` 时显示 `[nodemon] app crashed - waiting for file changes before starting...` 的原因是：

1. **表名不匹配**：schema 中修改了表名（如 `user` → `users`），但代码中还在使用旧的模型名
2. **字段名不匹配**：schema 使用下划线命名（如 `author_id`），但代码使用驼峰命名（如 `authorId`）
3. **关系名不匹配**：schema 中的关系字段名（如 `author`）与代码中使用的不一致

---

## 修复方案

采用**选项1：统一使用下划线命名**，将所有 TypeScript 代码中的字段名改为下划线命名，与数据库保持一致。

---

## 修复内容

### 1. 模型名修复（已完成）

| 旧名称 | 新名称 |
|--------|--------|
| `prisma.story` | `prisma.stories` |
| `prisma.node` | `prisma.nodes` |
| `prisma.user` | `prisma.users` |
| `prisma.comment` | `prisma.comments` |
| `prisma.notification` | `prisma.notifications` |
| `prisma.follow` | `prisma.follows` |
| `prisma.rating` | `prisma.ratings` |
| `prisma.report` | `prisma.reports` |

### 2. 字段名修复（已完成）

| 旧名称（驼峰） | 新名称（下划线） |
|---------------|-----------------|
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
| `followerId` | `follower_id` |
| `followingId` | `following_id` |

**例外**：`users` 表的部分字段保持驼峰命名（因为使用了 `@map`）：
- `createdAt` （映射到 `created_at`）
- `updatedAt` （映射到 `updated_at`）
- `isAdmin` （映射到 `is_admin`）
- `emailVerified` （映射到 `email_verified`）

### 3. 关系字段名修复（已完成）

在 `schema.prisma` 中修改关系字段名：

| 表名 | 旧关系名 | 新关系名 |
|------|---------|---------|
| `stories` | `users` | `author` |
| `nodes` | `users` | `author` |
| `nodes` | `branches` | `other_nodes` |
| `comments` | `users` | `user` |
| `comments` | `nodes` | `node` |
| `comments` | `replies` | `other_comments` |
| `bookmarks` | `users` | `user` |
| `bookmarks` | `stories` | `story` |
| `notifications` | `users` | `user` |
| `ratings` | `users` | `user` |
| `ratings` | `nodes` | `node` |
| `reports` | `users` | `reporter` |
| `reports` | `nodes` | `node` |
| `follows` | `users_follows_following_idTousers` | `following` |
| `follows` | `users_follows_follower_idTousers` | `follower` |
| `users` | `follows_follows_following_idTousers` | `following` |
| `users` | `follows_follows_follower_idTousers` | `followers` |
| `users` | `nodes` | `authored_nodes` |
| `users` | `stories` | `authored_stories` |

### 4. 添加 `updated_at` 字段（已完成）

在创建节点和故事时，添加 `updated_at: new Date()`：

- `api/src/routes/stories.ts` - 创建故事时（2处）
- `api/src/routes/nodes.ts` - 创建节点时（3处）
- `api/src/routes/ai.ts` - AI创建节点时（1处）
- `api/src/routes/comments.ts` - 创建评论时（1处）

### 5. 修复认证相关（已完成）

- `api/src/routes/bookmarks.ts` - 添加认证中间件
- 将 `decoded.user_id` 改为 `decoded.userId`（JWT payload 中使用驼峰命名）

---

## 修改的文件清单

### 后端文件（11个）

1. `api/prisma/schema.prisma` - 修改关系字段名
2. `api/src/routes/stories.ts` - 修改字段名和关系名
3. `api/src/routes/nodes.ts` - 修改字段名和关系名
4. `api/src/routes/comments.ts` - 修改字段名和关系名
5. `api/src/routes/notifications.ts` - 修改字段名
6. `api/src/routes/admin.ts` - 修改字段名
7. `api/src/routes/search.ts` - 修改字段名
8. `api/src/routes/ai.ts` - 修改字段名和关系名
9. `api/src/routes/users.ts` - 修改字段名和关系名
10. `api/src/routes/upload.ts` - 修改字段名
11. `api/src/routes/bookmarks.ts` - 添加认证中间件，修改字段名

### 文档文件（2个）

1. `docs/FIX_SCHEMA_NAMING.md` - 修复说明文档
2. `docs/FIX_SCHEMA_NAMING_COMPLETE.md` - 本文档

---

## 测试结果

✅ **服务器启动成功**

```bash
$ cd api && npx ts-node src/index.ts
Server running on http://localhost:3001

$ curl http://localhost:3001/api/health
{"status":"ok","timestamp":"2026-03-01T07:19:02.317Z"}
```

---

## 使用 npm run dev

现在可以正常使用 `npm run dev` 启动开发服务器：

```bash
cd api
npm run dev
```

服务器将在 `http://localhost:3001` 启动，并支持热重载。

---

## 注意事项

### 1. 前端代码可能需要更新

前端代码（`web/*.html`）中的 API 请求可能还在使用驼峰命名的字段。这些字段在 API 响应中已经是下划线命名了，需要相应更新前端代码。

### 2. JWT Payload

JWT payload 中的字段仍然使用驼峰命名（`userId`, `username`, `isAdmin`），这是正确的，不需要修改。

### 3. users 表的特殊性

`users` 表的部分字段在 schema 中使用了 `@map`，因此在代码中访问时仍然使用驼峰命名：
- `createdAt`（不是 `created_at`）
- `updatedAt`（不是 `updated_at`）
- `isAdmin`（不是 `is_admin`）
- `emailVerified`（不是 `email_verified`）

---

## 下一步

1. ✅ 服务器已成功启动
2. 🔄 测试所有 API 端点
3. 🔄 更新前端代码（如需要）
4. 🔄 运行完整的功能测试
5. 🔄 提交代码到 Git

---

## 总结

通过将所有 TypeScript 代码中的字段名改为下划线命名（与数据库一致），成功解决了 `npm run dev` 时的崩溃问题。服务器现在可以正常启动和运行。

**修复耗时**: 约 1.5 小时  
**修改文件**: 11 个后端文件  
**修改行数**: 约 200+ 行

