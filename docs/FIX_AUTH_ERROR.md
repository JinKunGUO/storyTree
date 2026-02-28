# 🔧 续写章节认证错误修复说明

**修复时间**: 2026-02-28  
**问题状态**: ✅ 已修复

---

## ❌ 问题描述

在续写第二章时，点击"发布章节"按钮会报错：

```
write?storyId=9:868  保存章节错误: Error: Not authenticated
    at saveChapter (write?storyId=9:865:27)
    at async HTMLButtonElement.<anonymous> (write?storyId=9:759:13)
```

---

## 🔍 问题原因

### 根本原因

**API端缺少认证中间件**：

1. **前端代码**（`web/write.html`）：
   ```javascript
   // ✅ 正确获取和发送token
   const token = localStorage.getItem('token') || sessionStorage.getItem('token');
   
   const response = await fetch(`/api/nodes/${window.lastNodeId}/branches`, {
       method: 'POST',
       headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`  // ✅ 正确发送
       },
       body: JSON.stringify({ title, content })
   });
   ```

2. **API代码**（`api/src/routes/nodes.ts`）：
   ```typescript
   // ❌ 缺少 authenticateToken 中间件
   router.post('/:id/branches', async (req, res) => {
       const userId = getUserId(req);  // ❌ 没有中间件，getUserId返回undefined
       if (!userId) {
           return res.status(401).json({ error: 'Not authenticated' });
       }
       // ...
   });
   ```

### 错误链

```
用户点击"发布章节"
  ↓
前端发送: POST /api/nodes/123/branches
Header: Authorization: Bearer <token>
  ↓
API接收请求
  ↓
❌ 没有 authenticateToken 中间件
  ↓
getUserId(req) 返回 undefined
  ↓
检查: !userId → true
  ↓
返回错误: { error: 'Not authenticated' }
  ↓
前端报错: Error: Not authenticated
```

### 对比其他API

#### ✅ 正确的API（创建第一章）

```typescript
// ✅ 有 authenticateToken 中间件
router.post('/', authenticateToken, async (req, res) => {
    const userId = getUserId(req);  // ✅ 可以获取到userId
    // ...
});
```

#### ❌ 错误的API（创建分支）

```typescript
// ❌ 缺少 authenticateToken 中间件
router.post('/:id/branches', async (req, res) => {
    const userId = getUserId(req);  // ❌ 无法获取userId
    // ...
});
```

---

## ✅ 解决方案

### 修改内容

**文件**: `api/src/routes/nodes.ts`  
**位置**: 第212行

**修改前**:
```typescript
// Create branch
router.post('/:id/branches', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // ...
});
```

**修改后**:
```typescript
// Create branch
router.post('/:id/branches', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // ...
});
```

**关键变化**:
- ✅ 添加了 `authenticateToken` 中间件
- ✅ 中间件会验证JWT token并将用户信息注入到 `req.user`
- ✅ `getUserId(req)` 现在可以正确获取用户ID

---

## 🔄 认证流程

### 修复前（❌ 失败）

```
1. 前端发送请求:
   POST /api/nodes/123/branches
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

2. API接收请求:
   ❌ 没有 authenticateToken 中间件
   ❌ req.user = undefined

3. getUserId(req):
   ❌ 返回 undefined

4. 检查认证:
   if (!userId) → true
   ❌ 返回 401: Not authenticated
```

### 修复后（✅ 成功）

```
1. 前端发送请求:
   POST /api/nodes/123/branches
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

2. authenticateToken 中间件:
   ✅ 验证JWT token
   ✅ 解析用户信息
   ✅ req.user = { id: 6, username: 'jinhui', ... }

3. getUserId(req):
   ✅ 返回 6

4. 检查认证:
   if (!userId) → false
   ✅ 继续执行，创建章节
```

---

## 📊 修改对比

### API路由对比

| API路由 | 修改前 | 修改后 |
|---------|--------|--------|
| **POST /api/nodes** | ✅ `authenticateToken` | ✅ `authenticateToken` |
| **POST /api/nodes/:id/branches** | ❌ 无中间件 | ✅ `authenticateToken` ⭐ |
| **POST /api/nodes/:id/rate** | ✅ `authenticateToken` | ✅ `authenticateToken` |
| **POST /api/nodes/:id/report** | ✅ `authenticateToken` | ✅ `authenticateToken` |

### 用户体验对比

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| **创建第一章** | ✅ 成功 | ✅ 成功 |
| **续写第二章** | ❌ 401错误 | ✅ 成功 ⭐ |
| **续写第三章** | ❌ 401错误 | ✅ 成功 ⭐ |
| **错误提示** | "Not authenticated" | 正常发布 |

---

## 🧪 测试验证

### 前置条件

1. **确保已登录**
   ```javascript
   // 在浏览器控制台执行
   const token = localStorage.getItem('token') || sessionStorage.getItem('token');
   console.log('Token:', token ? '存在' : '不存在');
   ```

2. **确认API服务器运行**
   ```bash
   curl http://localhost:3001/api/health
   # 预期: {"status":"ok","timestamp":"..."}
   ```

### 测试步骤

#### 步骤1: 访问故事详情页

```
http://localhost:3001/story?id=9
```

#### 步骤2: 点击"续写章节"

应该自动跳转到：
```
http://localhost:3001/write?storyId=9
```

#### 步骤3: 撰写内容

```
标题: 第二章 - 测试认证修复
内容: 这是测试认证修复的第二章。
现在API端已经添加了authenticateToken中间件，
应该可以正常识别用户身份并创建章节了。
让我们继续这个精彩的故事...
（继续写，确保超过50字）
```

#### 步骤4: 点击"发布章节"

**预期结果**:
- ✅ 显示"新章节发布成功！"
- ✅ 自动跳转到新章节的阅读页
- ✅ **不再出现 "Not authenticated" 错误**

#### 步骤5: 验证结果

1. **在章节阅读页**：
   - 应该看到刚发布的第二章
   - 作者应该是你的用户名

2. **返回故事详情页**：
   - 第二章出现在章节列表中

3. **检查数据库**（可选）：
   ```javascript
   // 在浏览器控制台
   fetch('/api/stories/9')
     .then(r => r.json())
     .then(d => console.log('故事章节:', d.nodes));
   ```

### 测试场景

#### 场景1: 已登录用户续写

```
1. 确认已登录
2. 点击"续写章节"
3. 撰写并发布
4. 预期: ✅ 成功
```

#### 场景2: 未登录用户续写

```
1. 清除token: localStorage.clear()
2. 点击"续写章节"
3. 撰写并发布
4. 预期: ❌ 提示"未登录或登录已过期，请重新登录"
```

#### 场景3: Token过期

```
1. 使用过期的token
2. 点击"续写章节"
3. 撰写并发布
4. 预期: ❌ 提示"未登录或登录已过期，请重新登录"
```

---

## 🐛 为什么之前没发现这个问题？

### 原因分析

1. **创建第一章时不会触发**：
   - 创建第一章使用的是 `POST /api/nodes`
   - 这个API有 `authenticateToken` 中间件
   - 所以一直正常工作

2. **续写章节才会触发**：
   - 续写章节使用的是 `POST /api/nodes/:id/branches`
   - 这个API缺少 `authenticateToken` 中间件
   - 所以续写时才会报错

3. **测试覆盖不全**：
   - 之前可能只测试了创建第一章
   - 没有测试续写第二章、第三章

### 相似问题排查

检查了其他API路由，确认都有正确的认证中间件：

| API | 认证中间件 | 状态 |
|-----|-----------|------|
| POST /api/stories | ✅ | 正常 |
| PUT /api/stories/:id | ✅ | 正常 |
| POST /api/nodes | ✅ | 正常 |
| POST /api/nodes/:id/branches | ✅ 已修复 | 修复 |
| POST /api/nodes/:id/rate | ✅ | 正常 |
| POST /api/nodes/:id/report | ✅ | 正常 |
| PUT /api/nodes/:id | ✅ | 正常 |

---

## 💡 技术细节

### authenticateToken 中间件的作用

**文件**: `api/src/utils/middleware.ts`

```typescript
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
    // 1. 从请求头获取token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // 2. 验证JWT token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        // 3. 将用户信息注入到req对象
        req.user = user;
        next();
    });
}
```

### getUserId 函数的实现

```typescript
export function getUserId(req: Request): number | null {
    // 从req.user中获取用户ID
    // 如果没有authenticateToken中间件，req.user是undefined
    return req.user?.id || null;
}
```

### 为什么需要两者配合

```typescript
// ❌ 错误：只有getUserId，没有中间件
router.post('/api', async (req, res) => {
    const userId = getUserId(req);  // undefined
    // userId 为 null，无法识别用户
});

// ✅ 正确：先用中间件验证，再获取ID
router.post('/api', authenticateToken, async (req, res) => {
    const userId = getUserId(req);  // 6
    // userId 有值，可以正常工作
});
```

---

## 🎊 总结

### 问题
- ❌ 续写第二章时报错："Not authenticated"

### 原因
- API端的 `POST /api/nodes/:id/branches` 路由缺少 `authenticateToken` 中间件
- 导致无法识别用户身份

### 解决
- ✅ 为 `POST /api/nodes/:id/branches` 添加 `authenticateToken` 中间件
- ✅ 重新编译并重启API服务器

### 结果
- ✅ 可以正常续写第二章、第三章...
- ✅ 认证流程正常工作
- ✅ 用户体验改善

### 经验教训

1. **所有需要认证的API都要加中间件**
2. **测试要覆盖完整流程**（不仅是第一章，还要测试续写）
3. **代码审查时注意一致性**（同类API应该有相同的中间件）

---

## 📚 相关文档

- **续写功能修复**: `docs/FIX_WRITE_CHAPTER_PARENT.md`
- **续写新章节指南**: `docs/HOW_TO_WRITE_NEW_CHAPTER.md`
- **快速参考**: `docs/WRITE_CHAPTER_QUICK.md`

---

**最后更新**: 2026-02-28  
**维护者**: StoryTree Team  
**状态**: ✅ 已修复并测试通过

