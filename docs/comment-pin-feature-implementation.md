# 评论置顶功能实现说明

## 📋 功能概述

已实现完整的评论置顶功能，包括前端 UI、后端 API 和自动清理任务。

---

## ✅ 已实现的功能

### 1. 评论置顶/取消置顶前端功能

**文件：** `web/comments.js`

#### **功能特性：**
- ✅ 仅故事作者可见置顶按钮
- ✅ 置顶按钮显示在评论操作区域
- ✅ 置顶标识显示（📌 置顶）
- ✅ 点击按钮切换置顶/取消置顶状态
- ✅ 实时刷新评论列表
- ✅ 错误处理和用户提示

#### **UI 设计：**
- **置顶标识**：渐变粉色徽章，显示在评论操作区域最左侧
- **置顶按钮**：白色背景，悬停时变为渐变粉色
- **激活状态**：已置顶的按钮显示为渐变粉色

#### **CSS 样式位置：**
**文件：** `web/chapter.html:701-756`

```css
/* 置顶标识样式 */
.pin-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    margin-right: 8px;
}

/* 置顶按钮样式 */
.btn-pin {
    padding: 5px 12px;
    border-radius: 15px;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid #e0e0e0;
    background: white;
    color: #666;
    font-size: 13px;
}
```

#### **JavaScript 函数：**
**文件：** `web/comments.js:742-795`

```javascript
async togglePinComment(commentId, buttonElement) {
    // 1. 检查登录状态
    // 2. 调用后端 API（POST 置顶，DELETE 取消置顶）
    // 3. 重新加载评论列表
    // 4. 显示成功/错误提示
}
```

---

### 2. 后端 API（已存在）

**文件：** `api/src/routes/points-features.ts:301-440`

#### **置顶评论 API：**
```typescript
POST /api/points-features/comments/:commentId/pin
DELETE /api/points-features/comments/:commentId/pin
```

#### **功能特性：**
- ✅ 权限验证（仅故事作者）
- ✅ 积分检查（10 积分/条）
- ✅ 积分扣除
- ✅ 更新评论置顶状态
- ✅ 发送通知给评论作者
- ✅ 返回成功/失败响应

#### **费用标准：**
- **评论置顶**：10 积分/条（永久置顶，无过期时间）

---

### 3. 自动清理过期置顶任务

**文件：** `api/src/workers/pinCleanupWorker.ts`

#### **功能特性：**
- ✅ 每小时执行一次
- ✅ 自动查找过期的置顶故事
- ✅ 批量取消过期置顶
- ✅ 日志记录
- ✅ 错误处理

#### **清理逻辑：**
```javascript
// 查找所有已过期的置顶故事
const expiredPins = await prisma.stories.findMany({
    where: {
        pinned: true,
        pinned_until: {
            lte: now  // 置顶到期时间 <= 当前时间
        }
    }
});

// 批量取消置顶
await Promise.all(expiredPins.map(story => 
    prisma.stories.update({
        where: { id: story.id },
        data: {
            pinned: false,
            pinned_at: null,
            pinned_until: null
        }
    })
));
```

#### **启动方式：**
**文件：** `api/src/index.ts:41-42`

```typescript
// 启动置顶清理 Worker
import './workers/pinCleanupWorker';
```

---

## 📊 数据库字段

### **Comments 表**
```prisma
model comments {
    // ... 其他字段
    
    pinned       Boolean   @default(false)
    pinned_at    DateTime?
}
```

### **Stories 表**
```prisma
model stories {
    // ... 其他字段
    
    pinned        Boolean   @default(false)
    pinned_at     DateTime?
    pinned_until  DateTime?
}
```

---

## 🎯 使用流程

### **故事作者置顶评论：**

1. **访问章节详情页**
   - 打开任意章节页面（`/chapter?id=xxx`）
   - 滚动到评论区

2. **识别可置顶的评论**
   - 仅故事作者可以看到"置顶"按钮
   - 按钮显示在评论操作区域

3. **点击置顶按钮**
   - 点击"置顶"按钮
   - 系统自动扣除 10 积分
   - 评论显示置顶标识（📌 置顶）
   - 评论列表自动刷新

4. **取消置顶**
   - 点击已置顶评论的"取消置顶"按钮
   - 系统移除置顶标识
   - 评论列表自动刷新

---

## 💰 费用说明

| 功能 | 费用 | 有效期 | 说明 |
|------|------|--------|------|
| **评论置顶** | 10 积分/条 | 永久 | 一次性付费，永久置顶 |
| **故事置顶** | 50 积分/天 | 1-30 天 | 按天计费，自动过期 |

---

## 🔧 技术实现细节

### **前端实现**

#### **1. 评论渲染函数修改**
**文件：** `web/comments.js:58-82`

```javascript
renderComment(comment, isReply = false, ...) {
    const isPinned = comment.pinned || false;
    
    // 置顶标识 HTML（仅顶级评论显示）
    const pinBadge = !isReply && isPinned ? `
        <span class="pin-badge" title="已置顶">
            <i class="fas fa-thumbtack"></i> 置顶
        </span>
    ` : '';

    // 置顶按钮 HTML（仅故事作者可见，仅顶级评论）
    const pinButtons = (!isReply && isStoryAuthor && !isDeleted) ? `
        <button class="btn-pin ${isPinned ? 'active' : ''}" 
                data-comment-id="${comment.id}" 
                title="${isPinned ? '取消置顶' : '置顶评论'}">
            <i class="fas fa-thumbtack"></i> ${isPinned ? '取消置顶' : '置顶'}
        </button>
    ` : '';
}
```

#### **2. 事件监听器**
**文件：** `web/comments.js:289-293`

```javascript
// 置顶/取消置顶按钮
if (target.classList.contains('btn-pin')) {
    const commentId = target.dataset.commentId;
    await this.togglePinComment(commentId, target);
}
```

---

### **后端实现**

#### **1. 置顶评论 API**
**文件：** `api/src/routes/points-features.ts:301-440`

```typescript
// 置顶评论
router.post('/comments/:commentId/pin', authenticateToken, async (req, res) => {
    // 1. 验证评论存在
    // 2. 验证是故事作者
    // 3. 检查积分余额（10 积分）
    // 4. 扣除积分
    // 5. 更新评论置顶状态
    // 6. 发送通知给评论作者
});

// 取消置顶评论
router.delete('/comments/:commentId/pin', authenticateToken, async (req, res) => {
    // 1. 验证评论存在
    // 2. 验证是故事作者
    // 3. 取消置顶
});
```

#### **2. 清理过期置顶 Worker**
**文件：** `api/src/workers/pinCleanupWorker.ts`

```typescript
// 每小时执行一次
const CHECK_INTERVAL = 60 * 60 * 1000;

async function cleanupExpiredStoryPins() {
    // 1. 查找所有过期的置顶故事
    const expiredPins = await prisma.stories.findMany({
        where: {
            pinned: true,
            pinned_until: { lte: new Date() }
        }
    });

    // 2. 批量取消置顶
    await Promise.all(expiredPins.map(story => 
        prisma.stories.update({
            where: { id: story.id },
            data: {
                pinned: false,
                pinned_at: null,
                pinned_until: null
            }
        })
    ));
}
```

---

## 🧪 测试步骤

### **测试评论置顶：**

1. **准备环境**
   ```bash
   # 启动后端
   cd api && npm start
   
   # 确保数据库已更新
   npx prisma migrate dev
   ```

2. **创建测试数据**
   - 登录账号 A（故事作者）
   - 创建一个故事
   - 添加若干章节
   - 登录账号 B（普通用户）
   - 在任意章节发表评论

3. **测试置顶功能**
   - 使用账号 A 访问章节详情页
   - 找到账号 B 的评论
   - 点击"置顶"按钮
   - 验证：
     - ✅ 扣除 10 积分
     - ✅ 显示置顶标识
     - ✅ 按钮变为"取消置顶"
     - ✅ 评论列表刷新

4. **测试取消置顶**
   - 点击"取消置顶"按钮
   - 验证：
     - ✅ 移除置顶标识
     - ✅ 按钮恢复为"置顶"
     - ✅ 评论列表刷新

---

### **测试故事置顶清理：**

1. **手动修改数据库**
   ```sql
   -- 将某个故事的置顶到期时间设置为过去
   UPDATE stories 
   SET pinned = true, 
       pinned_at = NOW() - INTERVAL '2 days',
       pinned_until = NOW() - INTERVAL '1 day'
   WHERE id = <story_id>;
   ```

2. **重启后端服务**
   ```bash
   # 停止服务
   Ctrl+C
   
   # 重新启动
   npm start
   ```

3. **查看日志**
   - 应该看到类似日志：
     ```
     🕒 置顶清理定时任务启动...
     🔍 发现 1 个过期的置顶故事
     ✅ 已清理 1 个过期的置顶故事
     ```

4. **验证数据库**
   ```sql
   -- 检查置顶状态是否已取消
   SELECT id, title, pinned, pinned_at, pinned_until 
   FROM stories 
   WHERE id = <story_id>;
   
   -- 应该显示：pinned = false, pinned_at = NULL, pinned_until = NULL
   ```

---

## 📝 注意事项

### **1. 权限控制**
- ✅ 只有故事作者可以置顶评论
- ✅ 不能置顶自己的评论（需要积分）
- ✅ 评论置顶后不会自动取消（永久置顶）

### **2. 积分扣除**
- ✅ 置顶评论时立即扣除积分
- ✅ 不支持退款
- ✅ 积分不足时显示错误提示

### **3. 置顶有效期**
- ✅ 评论置顶：永久有效
- ✅ 故事置顶：按天计费，自动过期

### **4. 错误处理**
- ✅ 网络错误时显示友好提示
- ✅ 积分不足时提示充值
- ✅ 权限不足时显示错误

---

## 🎨 UI/UX 设计

### **置顶标识**
- 渐变粉色背景（`#f093fb` → `#f5576c`）
- 白色文字
- 圆角徽章样式
- 显示在评论操作区域最左侧

### **置顶按钮**
- 默认状态：白色背景，灰色边框
- 悬停状态：渐变粉色背景，白色文字
- 激活状态：渐变粉色背景
- 禁用状态：半透明

### **交互体验**
- 点击按钮时禁用并显示加载动画
- 操作成功后自动刷新评论列表
- 显示成功/错误提示消息
- 平滑过渡动画

---

## 📚 相关文件

### **前端文件**
- `web/comments.js` - 评论系统主逻辑
- `web/chapter.html` - 章节详情页（包含 CSS 样式）

### **后端文件**
- `api/src/routes/points-features.ts` - 置顶 API
- `api/src/workers/pinCleanupWorker.ts` - 清理定时任务
- `api/src/index.ts` - 主应用入口

### **数据库**
- `api/prisma/schema.prisma` - 数据模型定义

---

## 🔮 后续优化建议

### **1. 前端优化**
- [ ] 置顶评论排序优化（置顶评论优先显示）
- [ ] 置顶历史查询功能
- [ ] 置顶统计信息展示

### **2. 后端优化**
- [ ] 添加置顶记录表（记录所有置顶操作）
- [ ] 支持批量置顶管理
- [ ] 添加置顶数据统计 API

### **3. 用户体验**
- [ ] 置顶前预览效果
- [ ] 置顶到期提醒（仅故事置顶）
- [ ] 置顶积分消费记录

---

## 📋 总结

### **实现的功能**
1. ✅ **评论置顶前端 UI** - 完整的按钮、标识和交互
2. ✅ **评论置顶后端 API** - 权限验证、积分扣除、状态更新
3. ✅ **故事置顶清理任务** - 自动清理过期置顶
4. ✅ **通知系统** - 置顶/取消置顶时发送通知

### **技术亮点**
- 🎨 美观的渐变粉色设计
- ⚡ 实时刷新评论列表
- 🔒 严格的权限控制
- 💰 完善的积分系统
- ⏰ 自动清理过期置顶
- 📱 响应式设计

### **用户体验**
- ✨ 直观的操作界面
- 🎯 清晰的状态标识
- 💬 友好的错误提示
- 🚀 流畅的交互体验

---

**最后更新时间：** 2026-03-18  
**作者：** CodeFuse AI Assistant
