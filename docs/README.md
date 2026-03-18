# 积分系统优化与防刷分机制

## 📋 版本信息

**版本：** v1.3.0  
**日期：** 2026-03-18  
**分支：** feature/m3-user-auth

---

## 🎯 本次更新概述

本次更新对积分奖励系统进行了全面优化，主要包括：

1. **新增章节收藏功能**（替代故事收藏）
2. **追更功能添加积分奖励**
3. **删除故事收藏功能**（与追更功能重复）
4. **实现防刷分机制**（章节收藏和追更都只在首次操作时发放积分）
5. **评论积分奖励优化**

---

## ✅ 核心功能

### **1. 章节收藏功能**

**文件位置：**
- 后端API：`api/src/routes/bookmarks.ts`
- 前端页面：`web/chapter.html`
- 数据库表：`node_bookmarks`

**功能特性：**
- ✅ 用户可以收藏喜欢的章节
- ✅ 章节收藏按钮显示在章节工具栏
- ✅ 首次收藏给作者发放2积分奖励
- ✅ 防刷分机制：反复收藏-取消收藏不会重复发放积分
- ✅ 作者自己收藏不发放积分

**API接口：**
```
POST /api/bookmarks/node/:nodeId
```

**详细文档：**
- `docs/chapter-bookmark-feature.md` - 章节收藏功能完整说明
- `docs/node-bookmark-anti-farming.md` - 防刷分机制详解

---

### **2. 追更功能添加积分奖励**

**文件位置：**
- 后端API：`api/src/routes/stories.ts`
- 数据库表：`story_followers`

**功能特性：**
- ✅ 用户追更故事时，故事作者获得5积分奖励
- ✅ 只有首次追更才发放积分
- ✅ 作者自己追更不发放积分
- ✅ 数据库字段 `points_awarded` 防止重复发放

**API接口：**
```
POST /api/stories/:id/follow
```

**详细文档：**
- `docs/remove-bookmark-add-follow-points.md` - 追更积分奖励说明

---

### **3. 删除故事收藏功能**

**原因：**
- 故事收藏与追更功能高度重合
- 简化用户操作，避免混淆
- 统一使用"追更"功能表达对故事的关注

**删除的API：**
```
❌ POST   /api/bookmarks/:storyId       # 收藏故事
❌ DELETE /api/bookmarks/:storyId       # 取消收藏故事
❌ GET    /api/bookmarks                # 获取收藏列表
❌ GET    /api/bookmarks/check/:storyId # 检查收藏状态
❌ GET    /api/bookmarks/count/:storyId # 获取收藏数
```

**保留的API：**
```
✅ POST /api/bookmarks/node/:nodeId  # 收藏章节
```

**前端改动：**
- 删除个人页面关注列表的收藏按钮
- 修改显示为"追更数"而非"收藏数"

**详细文档：**
- `docs/remove-bookmark-add-follow-points.md`

---

### **4. 防刷分机制**

**问题：**
用户可以通过反复"收藏-取消收藏-再次收藏"来刷积分。

**解决方案：**

#### **章节收藏防刷分**
- 查询 `point_transactions` 表，检查是否曾经发放过积分
- 只有首次收藏才发放积分
- 数据库字段 `node_bookmarks.points_awarded` 标记状态

#### **追更防刷分**
- 数据库唯一约束 `@@unique([story_id, user_id])` 防止重复追更
- 数据库字段 `story_followers.points_awarded` 标记是否已发放积分
- 只有首次追更才发放积分

**详细文档：**
- `docs/node-bookmark-anti-farming.md` - 章节收藏防刷分详解

---

### **5. 评论积分奖励**

**功能特性：**
- ✅ 用户评论章节时，章节作者获得1积分奖励
- ✅ 作者自己评论不发放积分
- ✅ 每次评论都发放积分（无防刷分限制）

**文件位置：**
- 后端API：`api/src/routes/comments.ts`

---

## 📊 完整积分奖励体系

| 操作 | 奖励对象 | 积分 | 触发条件 | 防刷分 |
|------|---------|------|---------|--------|
| **追更故事** | 故事作者 | +5 | 首次追更（非作者本人） | ✅ 数据库约束 + `points_awarded` |
| **收藏章节** | 章节作者 | +2 | 首次收藏（非作者本人） | ✅ 查询 `point_transactions` |
| **评论章节** | 章节作者 | +1 | 每次评论（非作者本人） | ❌ 无限制 |
| **收藏故事** | - | - | - | ❌ 已删除 |

---

## 🗂️ 数据库变更

### **新增表**

#### **node_bookmarks（章节收藏表）**
```prisma
model node_bookmarks {
  id             Int      @id @default(autoincrement())
  user_id        Int
  node_id        Int
  points_awarded Boolean  @default(false) // 是否已发放收藏积分奖励
  created_at     DateTime @default(now())
  node           nodes    @relation(fields: [node_id], references: [id], onDelete: Cascade)
  user           users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, node_id])
  @@index([user_id])
  @@index([node_id])
}
```

---

### **修改表**

#### **story_followers（追更表）**
```prisma
model story_followers {
  id             Int      @id @default(autoincrement())
  story_id       Int
  user_id        Int
  points_awarded Boolean  @default(false) // 是否已发放追更积分奖励
  created_at     DateTime @default(now())
  story          stories  @relation(fields: [story_id], references: [id], onDelete: Cascade)
  user           users    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([story_id, user_id])
  @@index([user_id])
  @@index([story_id])
}
```

---

### **数据库迁移文件**

| 迁移文件 | 说明 |
|---------|------|
| `20260318_add_node_bookmarks/migration.sql` | 创建章节收藏表 |
| `20260318_add_points_to_story_followers/migration.sql` | 追更表添加 `points_awarded` 字段 |
| `20260318_add_points_awarded_to_node_bookmarks/migration.sql` | 章节收藏表添加 `points_awarded` 字段 |

---

## 📁 文件变更清单

### **后端文件**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `api/src/routes/bookmarks.ts` | 新建 | 章节收藏API（删除故事收藏API） |
| `api/src/routes/stories.ts` | 修改 | 追更API添加积分奖励 |
| `api/src/routes/comments.ts` | 修改 | 评论API添加积分奖励 |
| `api/prisma/schema.prisma` | 修改 | 添加 `node_bookmarks` 表，修改 `story_followers` 表 |
| `api/src/index.ts` | 修改 | 注册 `bookmarks` 路由 |

---

### **前端文件**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `web/chapter.html` | 修改 | 添加章节收藏按钮和功能 |
| `web/profile.html` | 修改 | 删除关注列表的收藏按钮，显示追更数 |

---

### **文档文件**

| 文件 | 说明 |
|------|------|
| `docs/chapter-bookmark-feature.md` | 章节收藏功能完整说明 |
| `docs/remove-bookmark-add-follow-points.md` | 删除故事收藏、追更添加积分 |
| `docs/node-bookmark-anti-farming.md` | 章节收藏防刷分机制 |
| `docs/README.md` | 本文档（总览） |

---

## 🧪 测试要点

### **1. 章节收藏测试**

- [ ] 首次收藏章节，作者获得2积分
- [ ] 取消收藏，作者积分不变
- [ ] 再次收藏，作者积分不变（防刷分）
- [ ] 作者自己收藏，不发放积分
- [ ] 不同用户收藏同一章节，都发放积分

---

### **2. 追更测试**

- [ ] 首次追更故事，作者获得5积分
- [ ] 重复追更，返回错误（数据库约束）
- [ ] 作者自己追更，不发放积分

---

### **3. 评论测试**

- [ ] 评论章节，作者获得1积分
- [ ] 作者自己评论，不发放积分
- [ ] 每次评论都发放积分

---

### **4. 防刷分测试**

- [ ] 反复收藏-取消收藏章节10次，只发放1次积分
- [ ] 查看 `point_transactions` 表，确认只有1条记录

---

## 🚀 部署说明

### **1. 数据库迁移**

```bash
cd api
npx prisma migrate deploy
npx prisma generate
```

---

### **2. 重启服务**

```bash
# 重启API服务
cd api
npm run dev

# 前端无需重启（静态文件）
```

---

### **3. 验证部署**

1. 访问章节页面，检查收藏按钮是否显示
2. 测试收藏功能是否正常
3. 检查积分是否正确发放
4. 测试防刷分机制是否生效

---

## 💡 设计亮点

### **1. 防刷分机制**

- **章节收藏：** 查询 `point_transactions` 表，即使取消收藏后再次收藏也不会重复发放
- **追更：** 数据库唯一约束 + `points_awarded` 字段双重保障

---

### **2. 用户体验优化**

- **简化功能：** 删除故事收藏，统一使用追更
- **即时反馈：** 收藏成功后立即显示积分奖励
- **防误操作：** 收藏按钮状态实时更新

---

### **3. 代码质量**

- **错误容错：** 积分发放失败不影响主功能
- **日志记录：** 详细的控制台日志便于调试
- **类型安全：** TypeScript类型定义完善

---

## 📝 后续优化建议

### **1. 性能优化**

为 `point_transactions` 表添加复合索引：

```sql
CREATE INDEX idx_point_transactions_lookup 
ON point_transactions(user_id, type, reference_id);
```

---

### **2. 评论防刷分**

考虑为评论添加防刷分机制：
- 同一用户对同一章节的评论，只有前N条发放积分
- 或者限制每日评论积分上限

---

### **3. 积分回收机制**

考虑在特殊情况下回收积分：
- 恶意刷分行为
- 违规内容被删除

---

## 🎉 总结

本次更新完成了积分系统的全面优化：

- ✅ 新增章节收藏功能，替代故事收藏
- ✅ 追更功能添加积分奖励
- ✅ 实现完善的防刷分机制
- ✅ 简化用户操作，提升体验
- ✅ 积分系统更公平、更合理

**积分系统现在更能反映真实的内容质量和用户参与度！**

