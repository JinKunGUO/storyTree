# 分享功能500错误修复报告

**日期**: 2026-03-02  
**错误**: POST /api/shares 500 (Internal Server Error)  
**状态**: ✅ 已解决

---

## 🐛 问题描述

用户在点击分享按钮时，浏览器控制台显示以下错误：

```
POST http://localhost:3001/api/shares 500 (Internal Server Error)
记录分享失败: 500
```

**错误位置**: 
- `share.js:300` - recordShare函数
- 触发页面: `story?id=9`

---

## 🔍 问题原因

**服务器未重启导致新路由未加载**

虽然代码已经添加了分享路由（`api/src/routes/shares.ts`）并在主文件中注册（`api/src/index.ts`），但是正在运行的服务器进程仍然是旧版本，**没有包含新的分享路由**。

### 为什么会出现这个问题？

1. **开发环境特点**: 使用 `ts-node` 直接运行TypeScript代码
2. **进程持续运行**: 服务器进程一直在后台运行
3. **代码未重新加载**: 修改代码后，旧进程不会自动重启
4. **路由未注册**: 旧进程中不存在 `/api/shares` 路由，返回500错误

### 正常的开发流程

在开发环境中，有两种方式确保代码更新：

1. **使用nodemon** (推荐): 自动监听文件变化并重启
   ```bash
   npm run dev  # 使用nodemon
   ```

2. **手动重启**: 修改代码后手动停止并重启服务器
   ```bash
   pkill -f "ts-node.*index.ts"  # 停止
   npx ts-node src/index.ts       # 启动
   ```

---

## 🔧 解决方案

### 步骤1: 停止旧服务器

```bash
pkill -f "ts-node.*index.ts"
```

### 步骤2: 重新启动服务器

```bash
cd /Users/jinkun/storytree/api
npx ts-node src/index.ts > /tmp/server_new.log 2>&1 &
```

### 步骤3: 验证服务器启动

```bash
tail -20 /tmp/server_new.log
```

**预期输出**:
```
🚀 StoryTree API running on port 3001
📦 Version: http://localhost:3001/api/version
```

### 步骤4: 测试分享API

```bash
# 测试基本分享
curl -X POST http://localhost:3001/api/shares \
  -H "Content-Type: application/json" \
  -d '{"story_id": 1, "platform": "copy"}'

# 测试带章节的分享
curl -X POST http://localhost:3001/api/shares \
  -H "Content-Type: application/json" \
  -d '{"story_id": 9, "node_id": 2, "platform": "wechat"}'

# 测试分享统计
curl http://localhost:3001/api/shares/stats/1
```

---

## ✅ 验证结果

### 1. 分享API正常工作

**请求**:
```bash
curl -X POST http://localhost:3001/api/shares \
  -H "Content-Type: application/json" \
  -d '{"story_id": 1, "platform": "copy"}'
```

**响应**:
```json
{
  "success": true,
  "share": {
    "id": 6,
    "story_id": 1,
    "node_id": null,
    "user_id": null,
    "platform": "copy",
    "created_at": "2026-03-02T02:26:48.394Z"
  }
}
```

### 2. 带章节ID的分享正常

**请求**:
```bash
curl -X POST http://localhost:3001/api/shares \
  -H "Content-Type: application/json" \
  -d '{"story_id": 9, "node_id": 2, "platform": "wechat"}'
```

**响应**:
```json
{
  "success": true,
  "share": {
    "id": 7,
    "story_id": 9,
    "node_id": 2,
    "user_id": null,
    "platform": "wechat",
    "created_at": "2026-03-02T02:26:55.122Z"
  }
}
```

### 3. 分享统计API正常

**请求**:
```bash
curl http://localhost:3001/api/shares/stats/1
```

**响应**:
```json
{
  "total_shares": 6,
  "by_platform": {
    "copy": 6
  },
  "recent_shares": [
    {
      "id": 6,
      "story_id": 1,
      "node_id": null,
      "user_id": null,
      "platform": "copy",
      "created_at": "2026-03-02T02:26:48.394Z",
      "user": null
    }
    // ... 更多记录
  ]
}
```

---

## 📝 前端代码改进

用户已经对 `web/share.js` 做了一些改进：

### 改进1: 避免重复记录

```javascript
// 在copyLink函数中
async copyLink(url, storyId, nodeId) {
    try {
        await navigator.clipboard.writeText(url);
        this.showToast('链接已复制到剪贴板', 'success');
        
        // 注意：不在这里记录，因为shareTo函数已经记录过了
        // await this.recordShare(storyId, nodeId, 'copy');  // 已删除
    } catch (error) {
        // ...
    }
}
```

**原因**: `shareTo` 函数已经调用了 `recordShare`，避免重复记录。

### 改进2: 更好的错误处理

```javascript
async recordShare(storyId, nodeId, platform) {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
        
        const response = await fetch('/api/shares', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                story_id: parseInt(storyId),
                node_id: nodeId ? parseInt(nodeId) : null,
                platform
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('记录分享失败:', response.status, errorData);
        } else {
            const data = await response.json();
            console.log('分享记录成功:', data);
        }
    } catch (error) {
        console.error('记录分享错误:', error);
    }
}
```

**改进点**:
1. ✅ 条件性添加 Authorization 头（未登录时不添加）
2. ✅ 确保ID为整数类型
3. ✅ 更详细的错误日志
4. ✅ 成功时也输出日志

---

## 🎯 最佳实践

### 1. 开发环境使用nodemon

在 `package.json` 中配置：

```json
{
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    "start": "ts-node src/index.ts"
  }
}
```

**优点**:
- ✅ 自动监听文件变化
- ✅ 自动重启服务器
- ✅ 提高开发效率
- ✅ 避免忘记重启导致的问题

### 2. 添加健康检查端点

```typescript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    routes: {
      shares: 'enabled'  // 标记新功能已启用
    }
  });
});
```

### 3. 添加启动日志

```typescript
app.listen(PORT, () => {
  console.log(`🚀 StoryTree API running on port ${PORT}`);
  console.log(`📦 Version: http://localhost:${PORT}/api/version`);
  console.log(`📊 Routes loaded: ${app._router.stack.filter(r => r.route).length}`);
});
```

### 4. 使用环境变量

```typescript
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'development') {
  console.log('🔧 Development mode - Hot reload enabled');
}
```

---

## 🧪 测试清单

重启服务器后，应该测试以下功能：

- [x] **分享API**: POST /api/shares
  - [x] 基本分享（只有story_id）
  - [x] 章节分享（包含node_id）
  - [x] 登录用户分享（包含Authorization）
  - [x] 匿名用户分享（无Authorization）

- [x] **统计API**: GET /api/shares/stats/:story_id
  - [x] 总分享数
  - [x] 按平台统计
  - [x] 最近分享记录

- [x] **前端功能**:
  - [x] 复制链接
  - [x] 社交媒体分享
  - [x] Toast提示
  - [x] 分享面板显示/隐藏

---

## 📚 相关文档

- **功能文档**: `docs/SHARE_FEATURE.md`
- **API文档**: `api/src/routes/shares.ts`
- **前端组件**: `web/share.js`

---

## 💡 总结

### 问题本质

**服务器进程未重启，新代码未加载**

### 解决方法

**重启服务器进程**

### 预防措施

1. ✅ 使用 `nodemon` 自动重启
2. ✅ 修改代码后检查服务器日志
3. ✅ 添加版本号或时间戳验证服务器版本
4. ✅ 使用健康检查端点确认功能已启用

### 经验教训

在开发环境中，修改后端代码后**必须重启服务器**才能生效。使用自动重启工具（如nodemon）可以避免这类问题。

---

**问题已解决！** 🎉 

分享功能现在完全正常工作，用户可以：
- ✅ 在故事详情页分享故事
- ✅ 在章节页分享章节
- ✅ 复制链接到剪贴板
- ✅ 分享到社交媒体平台
- ✅ 系统自动记录分享统计

