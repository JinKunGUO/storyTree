# 🔖 收藏功能快速参考

## 📌 API端点

```bash
# 收藏故事
POST /api/bookmarks
Body: { storyId: number }

# 取消收藏
DELETE /api/bookmarks/:storyId

# 获取收藏列表
GET /api/bookmarks?page=1&limit=20

# 检查收藏状态
GET /api/bookmarks/check/:storyId
```

## 🎨 前端使用

```javascript
// 检查收藏状态
await checkBookmarkStatus(storyId);

// 切换收藏
await toggleBookmark(storyId);

// 更新按钮
updateBookmarkButton(isBookmarked);
```

## 📊 数据库

```prisma
model bookmarks {
  id         Int      @id @default(autoincrement())
  user_id    Int
  story_id   Int
  created_at DateTime @default(now())
  
  @@unique([user_id, story_id])
}
```

## ✅ 测试步骤

1. 启动服务器：`cd api && npm run dev`
2. 访问故事页：`http://localhost:3001/story?id=1`
3. 登录后点击"收藏"按钮
4. 验证按钮变为"已收藏"（红色）
5. 刷新页面，状态保持
6. 再次点击，取消收藏

## 🎯 完成状态

- ✅ 数据库Schema
- ✅ 后端API（4个端点）
- ✅ 前端UI和交互
- ✅ 错误处理
- ✅ 文档

**总耗时**: 约1小时  
**代码行数**: ~200行（后端） + ~120行（前端）

