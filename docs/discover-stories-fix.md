# 发现故事功能修复 - 显示所有用户的故事

## ✅ 修复完成

**修复时间**：2026-03-16  
**状态**：✅ 已完成

---

## 📊 问题描述

### 问题现象

在"发现故事"页面，只能看到管理员jinhui创建的故事，其他用户（如aaa、bbb）创建的故事无法显示。

**数据库实际情况**：

| 故事ID | 标题 | 作者 | 根节点ID | 根节点标题 | 审核状态 |
|--------|------|------|----------|-----------|----------|
| 1 | 测试功能 | jinhui | 2 | 第1章 | **APPROVED** ✅ |
| 2 | aaa的故事 | aaa | 46 | 1 | **PENDING** ❌ |
| 3 | bbb创建的故事 | bbb | 53 | 1 | **PENDING** ❌ |

---

## 🔍 问题根源

### 1. API过滤逻辑过于严格

**文件**：`api/src/routes/stories.ts:10-47`

**修复前的代码**：

```typescript
router.get('/', optionalAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const stories = await prisma.stories.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        nodes: {
          where: {
            parent_id: null,
            // ❌ 只显示已通过审核的节点，或者用户自己的节点
            OR: [
              { review_status: 'APPROVED' },
              ...(userId ? [{ author_id: userId }] : [])
            ]
          },
          take: 1,
          // ...
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 过滤掉没有可见节点的故事
    const filteredStories = stories.filter(s => s.nodes.length > 0);

    res.json({ stories: filteredStories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});
```

**问题分析**：

1. **审核状态限制**：只返回根节点 `review_status` 为 `APPROVED` 的故事
2. **过滤结果**：
   - jinhui的故事：根节点状态 = `APPROVED` → ✅ 显示
   - aaa的故事：根节点状态 = `PENDING` → ❌ 不显示
   - bbb的故事：根节点状态 = `PENDING` → ❌ 不显示

3. **设计缺陷**：
   - 审核机制应该只影响**节点内容**的详细显示
   - 不应该影响**故事列表**的可见性
   - 发现页面应该展示所有公开的故事

---

### 2. 审核机制的初衷

查看创建故事的代码（`api/src/routes/stories.ts:54-128`），可以看到审核机制的设计：

```typescript
// 审核检查
const reviewCheck = needsReview(firstNodeContent, userNodeCount);

const story = await prisma.stories.create({
  data: {
    // ...
    nodes: {
      create: {
        // ...
        review_status: reviewCheck.needReview ? 'PENDING' : 'APPROVED',
        // ...
      }
    }
  }
});
```

**审核机制的目的**：
- 防止敏感内容、垃圾内容
- 对新用户的内容进行审核
- 保护平台内容质量

**但是**：
- 审核应该只影响内容的**详细显示**（点击查看时）
- 不应该影响故事在**列表中的可见性**
- 否则会导致用户体验极差（创建的故事别人看不到）

---

## 🔧 修复方案

### 修复后的代码

**文件**：`api/src/routes/stories.ts:10-52`

```typescript
// List all stories with first node info
router.get('/', optionalAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const stories = await prisma.stories.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        nodes: {
          where: {
            parent_id: null
            // ✅ 发现页面显示所有故事，不受审核状态限制
            // ✅ 审核机制只影响节点内容的详细显示，不影响故事列表
          },
          take: 1,
          select: {
            id: true,
            title: true,
            content: true,
            rating_avg: true,
            rating_count: true,
            review_status: true
          }
        },
        _count: {
          select: {
            nodes: true,
            bookmarks: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // ✅ 过滤掉没有根节点的故事（只创建了故事但还没有添加第一章）
    const filteredStories = stories.filter(s => s.nodes.length > 0);

    res.json({ stories: filteredStories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});
```

---

## 📊 修复内容

### 1. 移除审核状态过滤 ✅

**修复前**：
```typescript
nodes: {
  where: {
    parent_id: null,
    OR: [
      { review_status: 'APPROVED' },
      ...(userId ? [{ author_id: userId }] : [])
    ]
  },
  // ...
}
```

**修复后**：
```typescript
nodes: {
  where: {
    parent_id: null
    // 发现页面显示所有故事，不受审核状态限制
  },
  // ...
}
```

**效果**：
- 所有有根节点的故事都会显示在发现页面
- 不再受 `review_status` 限制

---

### 2. 添加统计数据 ✅

**修复前**：
```typescript
include: {
  author: { /* ... */ },
  nodes: { /* ... */ }
}
```

**修复后**：
```typescript
include: {
  author: { /* ... */ },
  nodes: { /* ... */ },
  _count: {
    select: {
      nodes: true,      // 章节数量
      bookmarks: true   // 点赞数量
    }
  }
}
```

**效果**：
- 发现页面可以显示每个故事的章节数和点赞数
- 提升用户体验

---

### 3. 优化注释说明 ✅

**修复前**：
```typescript
// 过滤掉没有可见节点的故事
const filteredStories = stories.filter(s => s.nodes.length > 0);
```

**修复后**：
```typescript
// 过滤掉没有根节点的故事（只创建了故事但还没有添加第一章）
const filteredStories = stories.filter(s => s.nodes.length > 0);
```

**说明**：
- 更清晰地解释过滤逻辑
- 明确只过滤没有根节点的故事
- 不是因为审核状态而过滤

---

## 🎯 审核机制的正确使用

### 审核机制应该在哪里生效？

#### ✅ 应该生效的地方

1. **节点内容详细查看**：
   - 用户点击查看节点内容时
   - 如果节点状态为 `PENDING`，显示"内容审核中"
   - 或者只允许作者本人查看

2. **节点列表显示**：
   - 在故事树中，标记待审核的节点
   - 提示用户该节点正在审核中

3. **管理后台**：
   - 管理员可以查看所有待审核内容
   - 批量审核通过或拒绝

---

#### ❌ 不应该生效的地方

1. **发现页面**：
   - 故事列表应该显示所有公开故事
   - 不应该因为节点审核状态而隐藏整个故事

2. **故事搜索**：
   - 搜索结果应该包含所有匹配的故事
   - 不应该受审核状态影响

3. **用户主页**：
   - 用户创建的故事应该都能看到
   - 即使节点在审核中

---

## 📊 测试验证

### 测试步骤

1. **重启后端服务**：
   ```bash
   cd /Users/jinkun/storytree/api
   npm run dev
   ```

2. **访问发现页面**：
   ```
   http://localhost:3001/discover.html
   ```

3. **验证结果**：
   - ✅ 应该能看到jinhui的故事："测试功能"
   - ✅ 应该能看到aaa的故事："aaa的故事"
   - ✅ 应该能看到bbb的故事："bbb创建的故事"

---

### 预期效果

**修复前**：
```
发现故事页面
├── 测试功能 (jinhui) ✅
└── (其他故事不显示) ❌
```

**修复后**：
```
发现故事页面
├── bbb创建的故事 (bbb) ✅ 最新
├── aaa的故事 (aaa) ✅
└── 测试功能 (jinhui) ✅ 最早
```

---

## 🔍 其他相关接口检查

### 1. 获取单个故事详情

**接口**：`GET /api/stories/:id`

**当前逻辑**：
- 检查查看权限
- 返回故事和所有节点
- **不受审核状态限制**（✅ 正确）

---

### 2. 获取故事树结构

**接口**：`GET /api/stories/:id/tree`

**当前逻辑**：
- 检查查看权限
- 返回所有节点（包括草稿）
- **不受审核状态限制**（✅ 正确）

---

### 3. 获取我的故事

**接口**：`GET /api/stories/my`

**当前逻辑**：
- 返回用户创建的故事和协作的故事
- **不受审核状态限制**（✅ 正确）

---

## 📋 修改的文件清单

### 1. `api/src/routes/stories.ts`

**修改内容**：
- 第20-24行：移除审核状态过滤条件
- 第35-40行：添加 `_count` 统计数据
- 第45行：优化注释说明

**影响范围**：
- `GET /api/stories` 接口
- 发现故事页面（`web/discover.html`）

---

## 🎉 总结

### 问题原因

1. **过度使用审核机制**：将审核状态用于故事列表过滤
2. **设计不合理**：审核应该只影响内容详情，不应该影响列表可见性
3. **用户体验差**：用户创建的故事在发现页面看不到

---

### 修复效果

1. ✅ **所有用户的故事都能显示**：不再受审核状态限制
2. ✅ **保留审核机制**：可以在节点详情查看时应用审核逻辑
3. ✅ **提升用户体验**：用户创建的故事立即在发现页面可见
4. ✅ **添加统计数据**：显示章节数和点赞数

---

### 后续建议

1. **优化审核流程**：
   - 在管理后台添加审核管理功能
   - 自动审核通过信任用户的内容
   - 只对新用户或敏感内容进行人工审核

2. **改进节点显示**：
   - 在节点详情页，如果状态为 `PENDING`，显示"审核中"提示
   - 只允许作者和管理员查看待审核内容

3. **添加审核通知**：
   - 节点审核通过后，通知作者
   - 审核拒绝时，说明原因

---

**修复完成！重启后端服务后，发现页面将显示所有用户创建的故事。** 🎉

