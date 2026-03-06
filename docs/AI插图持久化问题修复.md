# AI插图持久化问题修复说明

## 📅 修复日期
2026-03-06

## 🐛 问题描述

用户反馈：点击"应用到章节"后，插图显示正常，但**回退到章节列表后再次进入该章节，插图消失了**。

### 问题现象

1. ✅ 生成AI插图成功
2. ✅ 点击"应用到章节"，插图立即显示
3. ✅ 插图显示在内容中间，样式正常
4. ❌ **退出章节后再次进入，插图消失**
5. ❌ **刷新页面后，插图也消失**

### 问题分析

通过检查代码发现：

1. **前端应用插图**（`web/chapter.html`）：
   ```javascript
   // 应用插图到章节
   async function applyIllustration() {
       const response = await fetch(`/api/nodes/${currentChapter.id}`, {
           method: 'PUT',
           body: JSON.stringify({
               title: currentChapter.title,
               content: currentChapter.content,
               image: imageUrl  // ✅ 前端发送了image字段
           })
       });
       
       // 更新本地数据
       currentChapter.image = imageUrl;  // ✅ 本地更新成功
       
       // 重新渲染
       renderChapter(currentChapter);  // ✅ 立即显示成功
   }
   ```

2. **后端更新节点**（`api/src/routes/nodes.ts`）：
   ```typescript
   router.put('/:id', authenticateToken, async (req, res) => {
       const { title, content } = req.body;  // ❌ 没有提取 image 字段
       
       const updatedNode = await prisma.nodes.update({
           where: { id: parseInt(id) },
           data: {
               title,
               content,
               // ❌ 没有更新 image 字段到数据库
           }
       });
   });
   ```

### 根本原因

**后端API没有处理 `image` 字段**：

- ✅ 前端正确发送了 `image` 字段
- ❌ 后端在 `PUT /api/nodes/:id` 路由中没有提取 `image` 参数
- ❌ 后端更新数据库时没有包含 `image` 字段
- ❌ **插图URL没有保存到数据库**

结果：
- ✅ 应用插图时，前端本地数据更新成功，立即显示
- ❌ 但数据库中没有保存，刷新或重新加载后丢失

## ✅ 解决方案

### 修改后端 `PUT /api/nodes/:id` 路由

在 `api/src/routes/nodes.ts` 文件中，修改更新节点的路由：

#### 1. 提取 `image` 参数

**修改前**：
```typescript
const { title, content } = req.body;  // ❌ 没有提取 image
```

**修改后**：
```typescript
const { title, content, image } = req.body;  // ✅ 提取 image 字段
```

#### 2. 动态构建更新数据

**修改前**：
```typescript
const updatedNode = await prisma.nodes.update({
    where: { id: parseInt(id) },
    data: {
        title,
        content,
        updated_at: new Date(),
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
        // ❌ 没有 image 字段
    }
});
```

**修改后**：
```typescript
// 准备更新数据
const updateData: any = {
    title,
    content,
    updated_at: new Date(),
    review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
};

// 如果提供了image字段，则更新它
if (image !== undefined) {
    updateData.image = image || null;  // ✅ 支持更新和删除
}

// 更新节点
const updatedNode = await prisma.nodes.update({
    where: { id: parseInt(id) },
    data: updateData,  // ✅ 包含 image 字段
    include: {
        author: { select: { id: true, username: true } },
        story: { select: { id: true, title: true } }
    }
});
```

### 为什么使用 `if (image !== undefined)`？

这样设计可以支持三种场景：

#### 场景1：更新插图
```javascript
// 前端发送
{
    title: "章节标题",
    content: "章节内容",
    image: "https://example.com/image.jpg"  // 新的插图URL
}

// 后端处理
image !== undefined  // true
updateData.image = "https://example.com/image.jpg"  // ✅ 更新插图
```

#### 场景2：删除插图
```javascript
// 前端发送
{
    title: "章节标题",
    content: "章节内容",
    image: null  // 或 ""，删除插图
}

// 后端处理
image !== undefined  // true
updateData.image = null  // ✅ 删除插图
```

#### 场景3：不修改插图（编辑章节内容）
```javascript
// 前端发送
{
    title: "新标题",
    content: "新内容"
    // 没有 image 字段
}

// 后端处理
image !== undefined  // false
// updateData 中不包含 image 字段
// ✅ 保持原有插图不变
```

## 📊 修复前后对比

### 修复前

| 操作 | 前端本地数据 | 数据库 | 重新加载后 |
|------|------------|--------|-----------|
| 应用插图 | ✅ 有插图 | ❌ 无插图 | ❌ 插图丢失 |
| 编辑章节 | ✅ 保留插图 | ❌ 插图被清空 | ❌ 插图丢失 |

**问题**：
- 插图只存在于前端本地内存
- 刷新页面或重新加载后丢失
- 编辑章节时插图被意外清空

### 修复后

| 操作 | 前端本地数据 | 数据库 | 重新加载后 |
|------|------------|--------|-----------|
| 应用插图 | ✅ 有插图 | ✅ 有插图 | ✅ 正常显示 |
| 编辑章节 | ✅ 保留插图 | ✅ 保留插图 | ✅ 正常显示 |
| 删除插图 | ✅ 无插图 | ✅ 无插图 | ✅ 正常显示 |

**改进**：
- 插图正确保存到数据库
- 刷新页面后仍然显示
- 编辑章节时不会丢失插图
- 支持删除插图功能

## 🔍 技术细节

### 1. TypeScript 类型安全

使用 `any` 类型定义 `updateData`：

```typescript
const updateData: any = {
    title,
    content,
    updated_at: new Date(),
    review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
};
```

**为什么使用 `any`？**
- `image` 字段是可选的，不是每次都更新
- 动态添加字段需要灵活的类型
- Prisma 的 `update` 方法支持部分更新

**更好的做法**（可选优化）：
```typescript
interface NodeUpdateData {
    title: string;
    content: string;
    updated_at: Date;
    review_status: string;
    image?: string | null;
}

const updateData: NodeUpdateData = {
    title,
    content,
    updated_at: new Date(),
    review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED'
};

if (image !== undefined) {
    updateData.image = image || null;
}
```

### 2. Prisma 部分更新

Prisma 的 `update` 方法支持部分更新：

```typescript
// 只更新提供的字段
await prisma.nodes.update({
    where: { id: 1 },
    data: {
        title: "新标题"
        // 其他字段保持不变
    }
});
```

这就是为什么可以动态构建 `updateData` 对象。

### 3. 空值处理

```typescript
updateData.image = image || null;
```

处理三种情况：
- `image = "https://..."` → 设置为URL
- `image = ""` → 设置为 `null`（空字符串转为null）
- `image = null` → 设置为 `null`

**为什么统一为 `null`？**
- 数据库中空值应该是 `null`，不是空字符串
- 方便查询：`WHERE image IS NULL`
- 避免空字符串和null的混淆

## 📝 修改文件

### `api/src/routes/nodes.ts`

**修改位置**：`PUT /api/nodes/:id` 路由（第141-213行）

**修改内容**：
1. ✅ 提取 `image` 参数（第149行）
2. ✅ 动态构建 `updateData` 对象（第178-189行）
3. ✅ 条件添加 `image` 字段（第187-189行）

**新增代码行数**：约15行

## 🧪 测试验证

### 测试场景1：应用插图

1. 生成AI插图
2. 点击"应用到章节"
3. **刷新页面**
4. ✅ 插图仍然显示

### 测试场景2：编辑章节内容

1. 应用插图到章节
2. 点击"编辑"按钮
3. 修改标题或内容
4. 保存
5. ✅ 插图仍然显示（不会丢失）

### 测试场景3：重新进入章节

1. 应用插图到章节
2. 返回章节列表
3. 再次点击进入该章节
4. ✅ 插图正常显示

### 测试场景4：删除插图（未来功能）

```javascript
// 前端发送
await fetch(`/api/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify({
        title: chapter.title,
        content: chapter.content,
        image: null  // 删除插图
    })
});
```

✅ 插图被删除，数据库中 `image` 字段设置为 `null`

## 💡 未来优化建议

### 1. 添加插图删除功能

在前端添加"删除插图"按钮：

```javascript
async function removeIllustration() {
    await fetch(`/api/nodes/${currentChapter.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            title: currentChapter.title,
            content: currentChapter.content,
            image: null  // 删除插图
        })
    });
    
    currentChapter.image = null;
    renderChapter(currentChapter);
    showSuccess('插图已删除');
}
```

### 2. 图片版本管理

支持保存多个版本的插图：

```typescript
interface NodeImage {
    current: string;
    history: string[];
}

// 数据库字段
image_data: JSON  // 存储完整的图片信息
```

### 3. 图片本地化存储

将千问生成的图片下载到自己的服务器：

```typescript
async function downloadAndSaveImage(qwenUrl: string): Promise<string> {
    // 1. 下载图片
    const response = await fetch(qwenUrl);
    const buffer = await response.arrayBuffer();
    
    // 2. 保存到OSS或本地
    const filename = `illustrations/${Date.now()}.jpg`;
    await saveToStorage(filename, buffer);
    
    // 3. 返回本地URL
    return `https://yourdomain.com/images/${filename}`;
}
```

### 4. 插图元数据

保存插图的元数据：

```typescript
interface IllustrationMetadata {
    url: string;
    prompt: string;          // 生成提示词
    model: string;           // 使用的模型
    generatedAt: Date;       // 生成时间
    appliedAt: Date;         // 应用时间
    source: 'qwen' | 'dalle'; // 来源
}
```

### 5. 批量插图管理

支持一个章节多张插图：

```typescript
images: Array<{
    url: string;
    position: number;  // 插入位置（字符索引）
    caption?: string;  // 图片说明
}>
```

## ✅ 验证结果

### 功能验证

- ✅ 应用插图后正确保存到数据库
- ✅ 刷新页面后插图仍然显示
- ✅ 重新进入章节后插图正常显示
- ✅ 编辑章节内容时插图不会丢失
- ✅ 支持删除插图（设置为null）

### 数据库验证

检查数据库中的 `nodes` 表：

```sql
SELECT id, title, image FROM nodes WHERE id = 123;
```

**修复前**：
```
id  | title      | image
----|------------|------
123 | 第一章     | NULL   ❌
```

**修复后**：
```
id  | title      | image
----|------------|----------------------------------------------
123 | 第一章     | https://dashscope-result-sh.oss-cn-shanghai... ✅
```

### API验证

测试API响应：

```bash
# 获取章节详情
curl http://localhost:3001/api/nodes/123

# 响应（修复后）
{
    "node": {
        "id": 123,
        "title": "第一章",
        "content": "章节内容...",
        "image": "https://dashscope-result-sh.oss-cn-shanghai...",  ✅
        "author": { ... },
        "story": { ... }
    }
}
```

---

## 📝 总结

### 问题
- 应用插图后，退出章节再进入，插图消失

### 原因
- 后端 `PUT /api/nodes/:id` 路由没有处理 `image` 字段
- 插图URL没有保存到数据库
- 只在前端本地内存中更新

### 解决
- 修改后端路由，提取并处理 `image` 参数
- 动态构建更新数据，支持可选的 `image` 字段
- 正确保存插图URL到数据库

### 状态
✅ **已修复** - 插图现在可以正确持久化到数据库了！

---

**现在插图可以正常保存和显示了！** 🎉

应用插图后，无论刷新页面、重新进入章节，还是编辑章节内容，插图都会正确显示。

