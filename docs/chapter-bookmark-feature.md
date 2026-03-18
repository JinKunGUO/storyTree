# 章节收藏功能实现文档

## 📋 功能概述

将章节页面工具栏的"书签"按钮改造为**收藏当前章节**功能，用户点击后可以收藏章节，并为章节作者发放积分奖励。

---

## ✨ 功能特性

### 1. **前端交互**
- ✅ 点击书签按钮收藏/取消收藏章节
- ✅ 按钮图标状态切换（空心/实心）
- ✅ 实时反馈消息提示
- ✅ 防止重复点击

### 2. **后端逻辑**
- ✅ 切换收藏状态（已收藏→取消，未收藏→收藏）
- ✅ 为章节作者发放积分奖励（2积分）
- ✅ 发送通知给章节作者
- ✅ 防刷分机制（自己不能给自己积分）

### 3. **积分奖励**
- **奖励对象：** 章节作者
- **奖励积分：** 2积分/收藏
- **触发条件：** 其他用户收藏章节（非作者本人）
- **取消收藏：** 不扣除积分

---

## 🔧 技术实现

### 前端修改（web/chapter.html）

#### 1. 添加事件监听器
```javascript
// 书签按钮（收藏当前章节）
document.getElementById('bookmarkBtn')?.addEventListener('click', toggleBookmark);
```

#### 2. 实现toggleBookmark函数
```javascript
async function toggleBookmark() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
        showError('请先登录');
        setTimeout(() => {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
        }, 1500);
        return;
    }

    if (!currentChapter) {
        showError('章节信息加载中，请稍后重试');
        return;
    }

    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const icon = bookmarkBtn.querySelector('i');
    
    try {
        bookmarkBtn.disabled = true;

        const response = await fetch(`/api/bookmarks/node/${currentChapter.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '操作失败');
        }

        const data = await response.json();

        // 更新按钮状态
        if (data.bookmarked) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            showSuccess(data.message || '收藏成功！');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            showSuccess(data.message || '已取消收藏');
        }

    } catch (error) {
        showError(error.message || '操作失败，请稍后重试');
    } finally {
        bookmarkBtn.disabled = false;
    }
}
```

---

### 后端修改（api/src/routes/bookmarks.ts）

#### 新增路由：POST /api/bookmarks/node/:nodeId

```typescript
// 切换收藏章节状态（收藏/取消收藏）
router.post('/node/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }

    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      select: { 
        id: true, 
        title: true, 
        author_id: true,
        story_id: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查是否已经收藏
    const existingBookmark = await prisma.node_bookmarks.findUnique({
      where: {
        user_id_node_id: {
          user_id: decoded.userId,
          node_id: parseInt(nodeId)
        }
      }
    });

    if (existingBookmark) {
      // 已收藏，执行取消收藏
      await prisma.node_bookmarks.delete({
        where: {
          user_id_node_id: {
            user_id: decoded.userId,
            node_id: parseInt(nodeId)
          }
        }
      });

      return res.json({ 
        message: '已取消收藏',
        bookmarked: false
      });
    }

    // 未收藏，执行收藏操作
    const bookmark = await prisma.node_bookmarks.create({
      data: {
        user_id: decoded.userId,
        node_id: parseInt(nodeId)
      }
    });

    // 🎁 触发积分奖励：给章节作者发放收藏积分（2积分）
    if (node.author_id !== decoded.userId) {
      try {
        await addPoints(
          node.author_id,
          2,
          'get_node_bookmark',
          `章节《${node.title}》获得收藏`,
          node.id
        );
        console.log(`✅ 章节收藏积分奖励已发放: 用户 ${node.author_id} 获得 2 积分`);
      } catch (error) {
        console.error('❌ 发放章节收藏积分失败:', error);
      }
    }

    // 发送通知给章节作者
    if (node.author_id !== decoded.userId) {
      await prisma.notifications.create({
        data: {
          user_id: node.author_id,
          type: 'bookmark',
          title: '新收藏',
          content: `${decoded.username || '用户'} 收藏了你的章节《${node.title}》`,
          link: `/chapter?id=${nodeId}`
        }
      });
    }

    res.json({ 
      message: '收藏成功',
      bookmarked: true,
      bookmark,
      pointsEarned: node.author_id !== decoded.userId ? 2 : 0
    });
  } catch (error) {
    console.error('收藏章节错误:', error);
    res.status(500).json({ error: '操作失败' });
  }
});
```

---

## 📊 积分规则

| 操作 | 获得者 | 积分 | 触发条件 |
|------|--------|------|----------|
| **收藏故事** | 故事作者 | +5 | 其他用户收藏（非自己） |
| **收藏章节** | 章节作者 | +2 | 其他用户收藏（非自己） |
| **评论章节** | 章节作者 | +2 | 其他用户评论（≥10字，非回复） |

---

## 🛡️ 防刷分机制

### 1. 自己不能给自己积分
```typescript
if (node.author_id !== decoded.userId) {
  await addPoints(...);
}
```

### 2. 取消收藏不扣除积分
- 只有收藏时发放积分
- 取消收藏不影响已获得的积分

### 3. 数据库唯一约束
```sql
UNIQUE (user_id, node_id)
```
- 同一用户不能重复收藏同一章节
- 通过数据库层面保证数据一致性

---

## 🧪 测试步骤

### 测试1：收藏章节

#### 准备工作
1. 创建两个测试账号：
   - **用户A**（章节作者）
   - **用户B**（普通用户）

2. 用户A创建一个章节
   - 记录章节ID（例如：`13`）
   - 记录用户A的当前积分

#### 测试场景1.1：正常收藏
1. 用户B登录
2. 访问章节页面：`/chapter?id=13`
3. 点击工具栏的书签按钮（<i class="far fa-bookmark"></i>）

**预期结果：**
- ✅ 按钮图标变为实心（<i class="fas fa-bookmark"></i>）
- ✅ 显示成功消息："收藏成功！"
- ✅ 用户A的积分增加2分
- ✅ 用户A收到通知："用户B 收藏了你的章节《xxx》"
- ✅ 控制台输出：`✅ 章节收藏积分奖励已发放: 用户 X 获得 2 积分`

#### 测试场景1.2：取消收藏
1. 用户B再次点击书签按钮

**预期结果：**
- ✅ 按钮图标变为空心（<i class="far fa-bookmark"></i>）
- ✅ 显示成功消息："已取消收藏"
- ✅ 用户A的积分**不变**（不扣除积分）

#### 测试场景1.3：自己收藏自己的章节
1. 用户A登录
2. 访问自己的章节页面
3. 点击书签按钮

**预期结果：**
- ✅ 收藏成功，按钮图标变为实心
- ✅ 用户A的积分**不变**（不给自己积分）
- ✅ 控制台没有积分奖励相关日志

#### 测试场景1.4：未登录用户
1. 退出登录
2. 访问章节页面
3. 点击书签按钮

**预期结果：**
- ✅ 显示错误消息："请先登录"
- ✅ 1.5秒后自动跳转到登录页面

---

### 测试2：API测试

#### 收藏章节
```bash
curl -X POST http://localhost:3001/api/bookmarks/node/13 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**预期响应（首次收藏）：**
```json
{
  "message": "收藏成功",
  "bookmarked": true,
  "bookmark": {
    "id": 1,
    "user_id": 2,
    "node_id": 13,
    "created_at": "2026-03-18T12:30:00Z"
  },
  "pointsEarned": 2
}
```

**预期响应（再次点击，取消收藏）：**
```json
{
  "message": "已取消收藏",
  "bookmarked": false
}
```

---

## 📈 数据库验证

### 检查收藏记录
```sql
-- 查看章节13的收藏记录
SELECT * FROM node_bookmarks 
WHERE node_id = 13;
```

### 检查积分交易记录
```sql
-- 查看用户A的积分交易记录
SELECT * FROM point_transactions 
WHERE user_id = <用户A的ID> 
AND type = 'get_node_bookmark'
ORDER BY created_at DESC 
LIMIT 10;
```

### 检查通知记录
```sql
-- 查看用户A的通知
SELECT * FROM notifications 
WHERE user_id = <用户A的ID> 
AND type = 'bookmark'
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🎯 与故事收藏的区别

| 特性 | 故事收藏 | 章节收藏 |
|------|----------|----------|
| **API路径** | `/api/bookmarks/:storyId` | `/api/bookmarks/node/:nodeId` |
| **数据表** | `bookmarks` | `node_bookmarks` |
| **积分奖励** | 5积分 | 2积分 |
| **按钮位置** | 故事详情页 | 章节阅读页工具栏 |
| **图标** | ❤️ 心形 | 🔖 书签 |

---

## 📝 注意事项

1. **数据库表结构**
   - 需要确保 `node_bookmarks` 表存在
   - 需要有唯一约束：`UNIQUE(user_id, node_id)`

2. **积分类型**
   - 新增积分类型：`get_node_bookmark`
   - 描述：章节获得收藏

3. **通知类型**
   - 使用现有的 `bookmark` 类型
   - 通知内容区分故事收藏和章节收藏

4. **前端状态管理**
   - 按钮状态基于API响应动态更新
   - 不依赖本地状态，避免状态不一致

---

## 🚀 后续优化建议

1. **页面加载时显示收藏状态**
   - 在 `loadChapter()` 函数中检查当前用户是否已收藏
   - 初始化按钮图标状态

2. **收藏列表页面**
   - 创建用户的章节收藏列表页面
   - 支持按时间、按故事筛选

3. **收藏数统计**
   - 在章节详情中显示收藏数
   - 支持查看收藏该章节的用户列表

4. **批量操作**
   - 支持批量收藏/取消收藏
   - 支持一键收藏整个故事的所有章节

---

**功能已完成，可以开始测试！** 🎉

