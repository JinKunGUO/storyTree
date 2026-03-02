# 章节编辑功能修复报告

**日期**: 2026-03-01  
**问题**: 保存章节内容时报错 404  
**状态**: ✅ 已修复

---

## 🐛 问题描述

用户在章节页面点击保存按钮时遇到以下错误：

```
Failed to load resource: the server responded with a status of 404 (Not Found)
chapter?id=2:1050  保存失败: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**错误位置**: `http://localhost:3001/chapter?id=2`

---

## 🔍 问题原因

前端代码尝试调用 `PUT /api/nodes/:id` 端点来更新章节内容，但后端 `nodes.ts` 路由中**没有实现这个端点**，导致返回 404 错误。

### 前端代码（chapter.html 第1024行）

```javascript
const response = await fetch(`/api/nodes/${currentChapter.id}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        title,
        content
    })
});
```

### 后端缺失的端点

在 `api/src/routes/nodes.ts` 中，只有以下路由：

- ✅ `POST /` - 创建节点
- ✅ `GET /:id` - 获取节点详情
- ✅ `POST /:id/branches` - 创建分支
- ✅ `POST /:id/rate` - 评分
- ✅ `POST /:id/report` - 举报
- ❌ **缺少 `PUT /:id` - 更新节点**

---

## 🔧 修复内容

在 `api/src/routes/nodes.ts` 中添加了 `PUT /:id` 路由，用于更新章节内容。

### 新增代码（第141-207行）

```typescript
// Update node (章节编辑)
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 检查节点是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 检查是否是作者
    if (node.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this node' });
    }

    // 检查用户已发布节点数
    const userNodeCount = await prisma.nodes.count({
      where: { author_id: userId }
    });

    // 审核检查
    const reviewCheck = needsReview(content, userNodeCount);

    // 更新节点
    const updatedNode = await prisma.nodes.update({
      where: { id: parseInt(id) },
      data: {
        title,
        content,
        updated_at: new Date(),
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({
      node: updatedNode,
      reviewStatus: reviewCheck.needReview ? 'pending' : 'approved',
      message: reviewCheck.needReview ? `内容需要审核：${reviewCheck.reason}` : '更新成功'
    });
  } catch (error) {
    console.error('更新节点错误:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});
```

---

## ✅ 功能特性

新增的章节编辑端点包含以下功能：

### 1. 身份验证
- ✅ 使用 `authenticateToken` 中间件验证用户登录状态
- ✅ 检查用户是否是章节作者（只有作者可以编辑自己的章节）

### 2. 数据验证
- ✅ 验证 `title` 和 `content` 必填字段
- ✅ 检查章节是否存在（404处理）
- ✅ 权限检查（403处理）

### 3. 内容审核
- ✅ 使用 `needsReview()` 函数检查内容是否包含敏感词
- ✅ 根据用户发布节点数量决定审核策略
- ✅ 如果需要审核，将 `review_status` 设置为 `PENDING`
- ✅ 返回审核状态和原因

### 4. 数据更新
- ✅ 更新章节标题和内容
- ✅ 自动更新 `updated_at` 时间戳
- ✅ 更新审核状态
- ✅ 返回完整的节点信息（包括作者和故事信息）

---

## 🧪 测试验证

### 测试步骤

1. **启动服务器**
   ```bash
   cd api && npm run dev
   ```

2. **登录作者账号**
   - 访问 `http://localhost:3001`
   - 使用章节作者账号登录

3. **访问章节页面**
   - 访问 `http://localhost:3001/chapter?id=2`
   - 确认看到编辑按钮（铅笔图标）

4. **编辑章节**
   - 点击编辑按钮
   - 修改标题和内容
   - 点击"保存修改"按钮

5. **验证结果**
   - ✅ 保存成功提示
   - ✅ 页面自动刷新显示新内容
   - ✅ 如果包含敏感词，显示审核提示

### 预期API响应

**成功响应（200）**：
```json
{
  "node": {
    "id": 2,
    "title": "更新后的标题",
    "content": "更新后的内容",
    "author_id": 1,
    "story_id": 1,
    "updated_at": "2026-03-01T15:47:00.000Z",
    "review_status": "APPROVED",
    "author": {
      "id": 1,
      "username": "作者名"
    },
    "story": {
      "id": 1,
      "title": "故事标题"
    }
  },
  "reviewStatus": "approved",
  "message": "更新成功"
}
```

**需要审核响应（200）**：
```json
{
  "node": {...},
  "reviewStatus": "pending",
  "message": "内容需要审核：包含敏感词"
}
```

**错误响应**：
- `401 Unauthorized` - 未登录
- `403 Forbidden` - 不是作者，无权编辑
- `404 Not Found` - 章节不存在
- `400 Bad Request` - 缺少必填字段
- `500 Internal Server Error` - 服务器错误

---

## 📝 相关文件

### 修改的文件

- ✅ `api/src/routes/nodes.ts` - 添加 PUT 路由（+67行）

### 相关文件（无需修改）

- `web/chapter.html` - 前端章节页面（已包含编辑功能）
- `api/src/utils/sensitiveWords.ts` - 敏感词检测
- `api/src/utils/middleware.ts` - 认证中间件

---

## 🎯 功能流程

```
用户点击编辑按钮
    ↓
打开编辑模态框（填充当前内容）
    ↓
用户修改标题和内容
    ↓
点击"保存修改"按钮
    ↓
前端发送 PUT /api/nodes/:id 请求
    ↓
后端验证：登录状态 → 作者权限 → 数据完整性
    ↓
内容审核检查（敏感词检测）
    ↓
更新数据库（title, content, updated_at, review_status）
    ↓
返回更新后的节点数据
    ↓
前端更新页面显示
    ↓
显示成功提示（或审核提示）
```

---

## 📌 注意事项

### 1. 审核机制

编辑章节时会重新进行内容审核：
- 新用户（发布节点数 < 5）：所有内容都需要审核
- 老用户：只有包含敏感词的内容需要审核

### 2. 权限控制

- 只有章节作者可以编辑自己的章节
- 管理员目前无法编辑他人章节（可根据需求添加）

### 3. 数据一致性

- 每次编辑都会更新 `updated_at` 时间戳
- 审核状态会根据内容重新评估

### 4. 前端交互

- 编辑成功后，页面会自动刷新显示新内容
- 如果需要审核，会显示提示信息
- 模态框会自动关闭

---

## 🚀 后续优化建议

1. **版本历史**：保存章节的编辑历史，支持版本回退
2. **草稿功能**：支持保存草稿，不立即发布
3. **协作编辑**：支持多人协作编辑（需要冲突检测）
4. **自动保存**：定时自动保存草稿，防止内容丢失
5. **编辑锁定**：编辑时锁定章节，防止并发编辑冲突
6. **管理员权限**：允许管理员编辑任何章节

---

## 📊 总结

- **问题**: 缺少章节更新端点，导致保存失败（404）
- **修复**: 在 `nodes.ts` 中添加 `PUT /:id` 路由
- **功能**: 支持章节编辑、权限验证、内容审核
- **代码量**: +67行
- **测试**: ✅ 服务器正常启动，端点可用

修复完成后，用户现在可以正常编辑和保存章节内容了！🎉

