# 保存草稿 vs 发布章节功能说明

**更新时间**: 2026-03-03 16:09  
**修改文件**: `web/write.html`  
**状态**: ✅ 已完成

---

## 📋 功能需求

用户需要区分"保存草稿"和"发布章节"两个按钮的行为：
- **保存草稿**: 保存内容，但留在当前页面继续编辑
- **发布章节**: 保存内容后自动跳转到章节详情页

---

## ✅ 实现方案

### 1. 修改保存逻辑

#### 原有问题
```javascript
// 两个按钮都调用相同的函数，行为完全一致
async function saveChapter(publish = false) {
    // ... 保存逻辑
    showSuccess('发布成功！');
    // 总是跳转页面
    window.location.href = `/chapter?id=${nodeId}`;
}
```

#### 修复后
```javascript
async function saveChapter(shouldPublishAndRedirect = false) {
    // ... 保存逻辑
    
    if (shouldPublishAndRedirect) {
        // 发布模式：显示成功消息并跳转
        showSuccess('发布成功！即将跳转...');
        hasUnsavedChanges = false;
        
        setTimeout(() => {
            window.location.href = `/chapter?id=${nodeId}`;
        }, 1500);
    } else {
        // 草稿模式：显示成功消息，留在当前页面
        showSuccess('草稿保存成功！');
        hasUnsavedChanges = false;
        
        // 重新启用按钮，允许继续编辑
        publishBtn.disabled = false;
        saveDraftBtn.disabled = false;
        
        // 移除加载状态
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}
```

### 2. 优化未保存提示

#### 添加内容变更追踪
```javascript
let hasUnsavedChanges = false;

// 监听内容变化
quill.on('text-change', function() {
    hasUnsavedChanges = true;
});

// 监听标题变化
document.getElementById('chapterTitle').addEventListener('input', function() {
    hasUnsavedChanges = true;
});

// 离开页面时提示
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '你有未保存的内容，确定要离开吗？';
    }
});
```

#### 保存后清除标记
```javascript
// 保存成功后清除未保存标记
hasUnsavedChanges = false;
```

---

## 🎯 功能对比

| 特性 | 保存草稿 | 发布章节 |
|------|---------|---------|
| **保存内容** | ✅ 是 | ✅ 是 |
| **留在当前页面** | ✅ 是 | ❌ 否 |
| **自动跳转** | ❌ 否 | ✅ 是（1.5秒后） |
| **重新启用按钮** | ✅ 是 | ❌ 否（即将跳转） |
| **成功提示** | "草稿保存成功！" | "发布成功！即将跳转..." |
| **清除未保存标记** | ✅ 是 | ✅ 是 |
| **保存节点ID** | ✅ 是 | ✅ 是 |

---

## 💡 使用场景

### 使用"保存草稿"的场景
1. **频繁保存**: 写作过程中定期保存，防止内容丢失
2. **暂时离开**: 需要暂时离开，但稍后还要继续编辑
3. **使用AI**: 保存草稿后使用AI续写功能
4. **反复修改**: 需要多次修改和调整内容

### 使用"发布章节"的场景
1. **完成写作**: 章节内容已经完成，准备发布
2. **查看效果**: 想要在阅读页面查看发布效果
3. **分享给读者**: 完成后立即跳转到章节页面分享
4. **继续下一章**: 发布当前章节后开始写下一章

---

## 🔄 用户体验流程

### 保存草稿流程
```
用户写作 
  ↓
点击"保存草稿"
  ↓
显示加载动画
  ↓
保存到数据库
  ↓
显示"草稿保存成功！"
  ↓
清除未保存标记
  ↓
重新启用按钮
  ↓
用户继续编辑 ✍️
```

### 发布章节流程
```
用户写作
  ↓
点击"发布章节"
  ↓
显示加载动画
  ↓
保存到数据库
  ↓
显示"发布成功！即将跳转..."
  ↓
清除未保存标记
  ↓
等待1.5秒
  ↓
跳转到章节详情页 📖
```

---

## 🛡️ 安全保护

### 防止内容丢失
1. **实时追踪**: 监听内容和标题的任何变化
2. **离开提示**: 有未保存内容时离开页面会弹出确认
3. **保存后清除**: 保存成功后清除未保存标记，避免误报

### 示例代码
```javascript
// 用户修改内容
quill.on('text-change', function() {
    hasUnsavedChanges = true; // 标记为未保存
});

// 用户尝试离开
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        // 弹出确认对话框
        e.preventDefault();
        e.returnValue = '你有未保存的内容，确定要离开吗？';
    }
});

// 保存成功
hasUnsavedChanges = false; // 清除标记，允许正常离开
```

---

## 🎨 UI/UX 改进

### 按钮状态
- **正常状态**: 两个按钮都可点击
- **保存中**: 两个按钮都禁用，显示加载动画
- **草稿保存成功**: 重新启用两个按钮
- **发布成功**: 保持禁用状态（即将跳转）

### 提示信息
- **草稿**: "草稿保存成功！" （绿色提示，3秒后消失）
- **发布**: "发布成功！即将跳转..." （绿色提示，1.5秒后跳转）
- **错误**: "保存失败，请重试" （红色提示，3秒后消失）

---

## 🐛 潜在问题和解决方案

### 问题1: 保存草稿后nodeId丢失
**现象**: 第一次保存草稿后，再次保存时创建了新章节而不是更新  
**原因**: 没有保存返回的nodeId  
**解决**: 
```javascript
// 保存返回的节点ID
if (data.node && data.node.id) {
    window.lastNodeId = data.node.id;
    console.log('草稿已保存，节点ID:', data.node.id);
}
```

### 问题2: 保存后仍提示未保存
**现象**: 保存成功后离开页面仍弹出确认  
**原因**: 没有清除未保存标记  
**解决**:
```javascript
// 保存成功后清除标记
hasUnsavedChanges = false;
```

### 问题3: 加载状态未移除
**现象**: 保存草稿后加载动画一直显示  
**原因**: 草稿模式下没有移除加载状态  
**解决**:
```javascript
// 草稿模式下手动移除加载状态
document.getElementById('loadingOverlay').classList.remove('active');
```

---

## 📊 测试清单

### 功能测试
- [ ] 保存草稿后留在当前页面
- [ ] 发布章节后跳转到章节页
- [ ] 草稿保存后可以继续编辑
- [ ] 发布后nodeId正确保存
- [ ] 多次保存草稿不会创建重复章节

### 交互测试
- [ ] 修改内容后离开提示"未保存"
- [ ] 保存后离开不再提示
- [ ] 按钮在保存时正确禁用
- [ ] 草稿保存后按钮重新启用
- [ ] 成功/失败提示正确显示

### 边界测试
- [ ] 第一章保存草稿
- [ ] 第一章发布
- [ ] 续写章节保存草稿
- [ ] 续写章节发布
- [ ] 网络错误时的处理

---

## 🚀 后续优化建议

### 1. 自动保存草稿
```javascript
// 每30秒自动保存草稿
setInterval(() => {
    if (hasUnsavedChanges) {
        saveChapter(false); // 静默保存草稿
    }
}, 30000);
```

### 2. 保存历史版本
```javascript
// 记录每次保存的版本
const versions = [];
versions.push({
    timestamp: Date.now(),
    content: quill.getText(),
    title: document.getElementById('chapterTitle').value
});
```

### 3. 离线保存
```javascript
// 使用LocalStorage保存草稿
localStorage.setItem('draft_' + storyId, JSON.stringify({
    title: title,
    content: content,
    timestamp: Date.now()
}));
```

### 4. 快捷键支持
```javascript
// Ctrl+S / Cmd+S 保存草稿
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChapter(false); // 保存草稿
    }
});
```

---

## 📝 总结

### ✅ 已实现
1. 保存草稿留在当前页面
2. 发布章节自动跳转
3. 内容变更追踪
4. 未保存提示
5. 按钮状态管理
6. 节点ID保存

### 🎯 用户价值
- **提高效率**: 无需频繁跳转页面
- **防止丢失**: 实时追踪未保存内容
- **灵活编辑**: 可以多次保存和修改
- **清晰反馈**: 明确的成功/失败提示

### 💪 技术亮点
- 清晰的函数命名和参数
- 完善的状态管理
- 友好的用户提示
- 详细的日志输出

---

**修改完成！现在"保存草稿"和"发布章节"有了明确的区别。** ✅

