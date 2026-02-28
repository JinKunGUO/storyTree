# 🔧 续写章节功能修复说明

**修复时间**: 2026-02-28  
**问题状态**: ✅ 已修复

---

## ❌ 问题描述

在故事详情页点击"续写章节"按钮，撰写完毕点击"发布章节"时会报错：

```
该故事已有第一章，请使用分支功能添加新章节
```

---

## 🔍 问题原因

### 根本原因

**写作页面没有正确处理续写场景**：

1. **API要求**：
   - 创建第一章：`POST /api/nodes`，`parentId: null`
   - 续写章节：`POST /api/nodes/:parentId/branches`，需要指定父节点ID

2. **前端问题**：
   - 写作页面 (`web/write.html`) 总是发送 `parentId: null`
   - API检测到故事已有第一章，拒绝创建

### 错误链

```
用户点击"续写章节" 
  ↓
进入写作页面
  ↓
撰写内容并点击"发布章节"
  ↓
前端发送: POST /api/nodes { parentId: null }
  ↓
API检查: 故事已有第一章
  ↓
返回错误: "该故事已有第一章，请使用分支功能添加新章节"
```

---

## ✅ 解决方案

### 修改思路

让写作页面能够：
1. **自动检测**故事是否已有章节
2. **找到最后一章**作为父节点
3. **根据情况**选择正确的API接口

### 具体修改

#### 1. 加载故事时获取章节信息

**文件**: `web/write.html`

**修改前**:
```javascript
async function loadStoryInfo() {
    // ...
    const data = await response.json();
    story = data.story || data;
    // 没有获取章节信息
}
```

**修改后**:
```javascript
async function loadStoryInfo() {
    // ...
    const data = await response.json();
    story = data.story || data;
    const nodes = data.nodes || [];  // ✅ 获取章节列表
    
    if (nodes.length > 0) {
        // ✅ 找到最后一章
        const sortedNodes = nodes.sort((a, b) => {
            // 按path排序
        });
        const lastNode = sortedNodes[sortedNodes.length - 1];
        
        // ✅ 保存最后一章的ID
        window.lastNodeId = lastNode.id;
        
        // ✅ 更新提示文字
        const nextChapterNum = nodes.length + 1;
        chapterHint = `续写第${nextChapterNum}章`;
    }
}
```

#### 2. 保存时根据情况选择API

**修改前**:
```javascript
async function saveChapter(publish = false) {
    // 总是创建第一章
    const response = await fetch('/api/nodes', {
        method: 'POST',
        body: JSON.stringify({
            storyId: parseInt(storyId),
            title,
            content: textContent,
            parentId: null,  // ❌ 总是null
            path: '1'
        })
    });
}
```

**修改后**:
```javascript
async function saveChapter(publish = false) {
    // ✅ 判断是第一章还是续写
    const isFirstChapter = !window.lastNodeId;
    
    let requestBody, apiUrl;
    
    if (isFirstChapter) {
        // ✅ 创建第一章
        apiUrl = '/api/nodes';
        requestBody = {
            storyId: parseInt(storyId),
            title,
            content: textContent,
            parentId: null,
            path: '1'
        };
    } else {
        // ✅ 续写章节
        apiUrl = `/api/nodes/${window.lastNodeId}/branches`;
        requestBody = {
            title,
            content: textContent
            // 不需要storyId和parentId，API会自动处理
        };
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(requestBody)
    });
}
```

#### 3. 成功后跳转到新章节页面

**修改前**:
```javascript
if (response.ok) {
    showSuccess('章节发布成功！');
    // 跳转到故事详情页
    window.location.href = `/story?id=${storyId}`;
}
```

**修改后**:
```javascript
if (response.ok) {
    const chapterNum = isFirstChapter ? '第一章' : '新章节';
    showSuccess(`${chapterNum}发布成功！`);
    
    // ✅ 跳转到新创建的章节页面
    if (data.node && data.node.id) {
        window.location.href = `/chapter?id=${data.node.id}`;
    } else {
        window.location.href = `/story?id=${storyId}`;
    }
}
```

---

## 📊 修改对比

### API调用对比

#### 创建第一章

**API**: `POST /api/nodes`

**请求**:
```json
{
  "storyId": 7,
  "title": "第一章 - 开端",
  "content": "很久很久以前...",
  "parentId": null,
  "path": "1"
}
```

#### 续写第二章

**API**: `POST /api/nodes/123/branches` （123是第一章的ID）

**请求**:
```json
{
  "title": "第二章 - 冒险开始",
  "content": "主人公踏上了旅程..."
}
```

### 用户体验对比

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| 创建第一章 | ✅ 成功 | ✅ 成功 |
| 续写第二章 | ❌ 报错 | ✅ 成功 |
| 提示文字 | "撰写第一章" | "续写第N章" |
| 发布后跳转 | 故事详情页 | 新章节页面 |

---

## 🎯 完整流程

### 创建第一章

```
1. 访问故事详情页（故事还没有章节）
   ↓
2. 点击"续写章节"
   ↓
3. 写作页面显示："撰写第一章"
   ↓
4. 撰写内容并点击"发布章节"
   ↓
5. 前端检测: window.lastNodeId = undefined
   ↓
6. 调用: POST /api/nodes { parentId: null }
   ↓
7. 成功创建第一章
   ↓
8. 跳转到第一章阅读页
```

### 续写第二章

```
1. 访问故事详情页（故事已有第一章）
   ↓
2. 点击"续写章节"
   ↓
3. 写作页面加载:
   - 获取章节列表
   - 找到第一章（ID: 123）
   - 保存: window.lastNodeId = 123
   - 显示: "续写第2章"
   ↓
4. 撰写内容并点击"发布章节"
   ↓
5. 前端检测: window.lastNodeId = 123
   ↓
6. 调用: POST /api/nodes/123/branches
   ↓
7. 成功创建第二章（父节点是第一章）
   ↓
8. 跳转到第二章阅读页
```

### 续写第三章

```
1. 访问故事详情页（故事已有两章）
   ↓
2. 点击"续写章节"
   ↓
3. 写作页面加载:
   - 获取章节列表
   - 按path排序，找到第二章（ID: 456）
   - 保存: window.lastNodeId = 456
   - 显示: "续写第3章"
   ↓
4. 撰写内容并点击"发布章节"
   ↓
5. 前端检测: window.lastNodeId = 456
   ↓
6. 调用: POST /api/nodes/456/branches
   ↓
7. 成功创建第三章（父节点是第二章）
   ↓
8. 跳转到第三章阅读页
```

---

## 🧪 测试验证

### 测试场景1: 创建第一章

1. **创建新故事**（还没有任何章节）
2. **点击"续写章节"**
3. **撰写内容**:
   ```
   标题: 第一章 - 开端
   内容: 很久很久以前，在一个遥远的王国里...（至少50字）
   ```
4. **点击"发布章节"**
5. **预期结果**:
   - ✅ 显示"第一章发布成功！"
   - ✅ 跳转到第一章阅读页
   - ✅ 在故事详情页可以看到第一章

### 测试场景2: 续写第二章

1. **访问已有第一章的故事**
2. **点击"续写章节"**
3. **确认提示**: 应该显示"续写第2章"
4. **撰写内容**:
   ```
   标题: 第二章 - 冒险开始
   内容: 主人公踏上了旅程，前方充满了未知...（至少50字）
   ```
5. **点击"发布章节"**
6. **预期结果**:
   - ✅ 显示"新章节发布成功！"
   - ✅ 跳转到第二章阅读页
   - ✅ 在故事详情页可以看到第二章
   - ✅ 第二章的父节点是第一章

### 测试场景3: 续写第三章

1. **访问已有两章的故事**
2. **点击"续写章节"**
3. **确认提示**: 应该显示"续写第3章"
4. **撰写内容并发布**
5. **预期结果**:
   - ✅ 成功创建第三章
   - ✅ 第三章的父节点是第二章

---

## 🐛 常见问题

### Q1: 为什么续写章节需要指定父节点？

**答案**：
StoryTree是一个**树状结构**的故事系统，每个章节可以有多个分支。

```
故事
 └─ 第一章
     ├─ 第二章 A（作者A的续写）
     │   └─ 第三章 A1
     └─ 第二章 B（作者B的续写）
         └─ 第三章 B1
```

所以需要指定父节点来构建树状结构。

### Q2: 如何确定哪一章是"最后一章"？

**答案**：
按照 `path` 字段排序，取最后一个。

例如：
- 第一章: path = "1"
- 第二章: path = "1.1"
- 第三章: path = "1.1.1"

排序后取最后一个，就是最新的章节。

### Q3: 如果我想从第一章分支怎么办？

**答案**：
在第一章的阅读页，会有"添加分支"按钮。

目前的"续写章节"功能是**线性续写**，总是接着最后一章写。

### Q4: 发布后为什么跳转到章节页而不是故事详情页？

**答案**：
这样用户可以：
1. 立即看到发布的章节效果
2. 检查内容是否正确
3. 如果需要修改，可以直接点击编辑按钮

如果想回到故事详情页，点击导航栏的故事标题即可。

---

## 📚 相关文档

- **续写新章节指南**: `docs/HOW_TO_WRITE_NEW_CHAPTER.md`
- **快速参考**: `docs/WRITE_CHAPTER_QUICK.md`
- **编辑故事指南**: `docs/HOW_TO_EDIT_STORY.md`

---

## 🎊 总结

### 问题
- ❌ 续写第二章时报错："该故事已有第一章，请使用分支功能添加新章节"

### 原因
- 写作页面总是发送 `parentId: null`
- API认为是创建第一章，但故事已有第一章

### 解决
- ✅ 自动检测故事是否已有章节
- ✅ 找到最后一章作为父节点
- ✅ 根据情况选择正确的API接口
- ✅ 更新提示文字（"续写第N章"）
- ✅ 发布后跳转到新章节页面

### 结果
- ✅ 可以正常续写第二章、第三章...
- ✅ 用户体验更好
- ✅ 符合树状结构的设计

---

**最后更新**: 2026-02-28  
**维护者**: StoryTree Team  
**状态**: ✅ 已修复并测试通过

