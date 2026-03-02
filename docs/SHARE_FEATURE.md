# 故事分享功能实现文档

**日期**: 2026-03-01  
**版本**: v1.1.0  
**状态**: ✅ 已完成

---

## 📋 功能概述

实现了完整的故事和章节分享功能，包括：

1. ✅ **复制链接** - 一键复制分享链接到剪贴板
2. ✅ **社交媒体分享** - 支持微信、微博、QQ、QQ空间等平台
3. ✅ **分享统计** - 记录分享次数和来源平台
4. ✅ **多页面支持** - 在故事详情页和章节页都可以分享

---

## 🗄️ 数据库设计

### 新增表：`shares`

```prisma
model shares {
  id          Int      @id @default(autoincrement())
  story_id    Int      // 故事ID
  node_id     Int?     // 章节ID（可选）
  user_id     Int?     // 用户ID（可选，未登录也可分享）
  platform    String   // 分享平台：copy/wechat/weibo/qq/qzone/twitter/facebook
  created_at  DateTime @default(now())
  
  // 关系
  story       stories  @relation(fields: [story_id], references: [id], onDelete: Cascade)
  node        nodes?   @relation(fields: [node_id], references: [id], onDelete: Cascade)
  user        users?   @relation(fields: [user_id], references: [id], onDelete: SetNull)

  // 索引
  @@index([story_id])
  @@index([node_id])
  @@index([user_id])
  @@index([platform])
  @@index([created_at])
}
```

### 字段说明

- `story_id`: 必填，标识分享的故事
- `node_id`: 可选，如果分享的是章节则填写章节ID
- `user_id`: 可选，记录分享用户（未登录用户为null）
- `platform`: 分享平台类型
- `created_at`: 分享时间

---

## 🔌 后端API

### 文件：`api/src/routes/shares.ts`

#### 1. 记录分享

**端点**: `POST /api/shares`

**请求体**:
```json
{
  "story_id": 1,
  "node_id": 2,  // 可选
  "platform": "wechat"
}
```

**响应**:
```json
{
  "success": true,
  "share": {
    "id": 1,
    "story_id": 1,
    "node_id": 2,
    "user_id": 1,
    "platform": "wechat",
    "created_at": "2026-03-01T08:00:00.000Z"
  }
}
```

**支持的平台**:
- `copy` - 复制链接
- `wechat` - 微信
- `weibo` - 微博
- `qq` - QQ
- `qzone` - QQ空间
- `twitter` - Twitter
- `facebook` - Facebook

#### 2. 获取故事分享统计

**端点**: `GET /api/shares/stats/:story_id`

**响应**:
```json
{
  "total_shares": 156,
  "by_platform": {
    "copy": 45,
    "wechat": 67,
    "weibo": 23,
    "qq": 12,
    "qzone": 9
  },
  "recent_shares": [
    {
      "id": 156,
      "platform": "wechat",
      "created_at": "2026-03-01T08:00:00.000Z",
      "user": {
        "id": 1,
        "username": "张三",
        "avatar": "/uploads/avatar1.jpg"
      }
    }
  ]
}
```

#### 3. 获取章节分享统计

**端点**: `GET /api/shares/stats/node/:node_id`

**响应**:
```json
{
  "total_shares": 45,
  "by_platform": {
    "copy": 15,
    "wechat": 20,
    "weibo": 10
  }
}
```

---

## 🎨 前端组件

### 文件：`web/share.js`

#### ShareManager 类

完整的分享管理器，提供以下功能：

##### 1. 显示分享面板

```javascript
shareManager.showSharePanel({
    storyId: 1,
    nodeId: 2,  // 可选
    title: '故事标题',
    description: '故事简介',
    image: '/uploads/cover.jpg'  // 可选
});
```

##### 2. 分享到指定平台

```javascript
shareManager.shareTo(platform, storyId, nodeId, title, description, shareUrl);
```

##### 3. 复制链接

```javascript
shareManager.copyLink(url, storyId, nodeId);
```

##### 4. 记录分享统计

```javascript
await shareManager.recordShare(storyId, nodeId, platform);
```

##### 5. 生成分享链接

```javascript
// 故事链接
const storyUrl = shareManager.generateShareUrl(storyId, null);
// 结果: http://localhost:3001/story?id=1

// 章节链接
const chapterUrl = shareManager.generateShareUrl(storyId, nodeId);
// 结果: http://localhost:3001/chapter?id=2
```

---

## 🎯 功能特性

### 1. 复制链接

- ✅ 使用 `navigator.clipboard` API
- ✅ 降级方案：使用 `document.execCommand('copy')`
- ✅ 自动记录分享统计
- ✅ 显示成功提示

### 2. 社交媒体分享

#### 微信分享
- 显示二维码（占位符实现）
- 提供链接供用户在微信中打开

#### 微博分享
- 打开微博分享窗口
- 自动填充标题和链接
- 新窗口打开（600x400）

#### QQ/QQ空间分享
- 打开对应的分享窗口
- 传递标题、描述和链接
- 新窗口打开

#### Twitter/Facebook分享
- 国际化支持
- 标准的分享API调用

### 3. 分享统计

- ✅ 自动记录每次分享
- ✅ 区分分享来源（平台）
- ✅ 关联用户（登录用户）
- ✅ 支持匿名分享（未登录）

### 4. 用户体验

- ✅ 美观的模态框UI
- ✅ 平台图标和颜色
- ✅ 响应式设计
- ✅ 点击外部关闭
- ✅ Toast提示消息
- ✅ 动画效果

---

## 📱 页面集成

### 1. 故事详情页 (`story.html`)

**位置**: 第756行，故事操作按钮区域

```html
<button class="btn btn-secondary" id="shareBtn">
    <i class="fas fa-share-alt"></i>
    分享
</button>
```

**初始化** (第873行):
```javascript
document.getElementById('shareBtn')?.addEventListener('click', function() {
    if (window.currentStory) {
        shareManager.showSharePanel({
            storyId: window.currentStory.id,
            title: window.currentStory.title,
            description: window.currentStory.description,
            image: window.currentStory.coverImage
        });
    }
});
```

### 2. 章节阅读页 (`chapter.html`)

**位置**: 第692行，工具栏右侧

```html
<button class="toolbar-btn" id="shareChapterBtn" title="分享章节">
    <i class="fas fa-share-alt"></i>
</button>
```

**初始化** (第850行):
```javascript
document.getElementById('shareChapterBtn')?.addEventListener('click', function() {
    if (currentChapter && storyId) {
        shareManager.showSharePanel({
            storyId: storyId,
            nodeId: currentChapter.id,
            title: currentChapter.title,
            description: currentChapter.content?.substring(0, 100) + '...'
        });
    }
});
```

---

## 🎨 UI设计

### 分享模态框

```
┌─────────────────────────────────────┐
│  分享到                          ×  │
├─────────────────────────────────────┤
│  [封面图片]                         │
│  故事标题                           │
│  故事简介...                        │
│                                     │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐   │
│  │复制│ │微信│ │微博│ │ QQ│ │空间│   │
│  └───┘ └───┘ └───┘ └───┘ └───┘   │
│                                     │
│  ┌─────────────────────┐ ┌──────┐ │
│  │ http://...          │ │复制链接│ │
│  └─────────────────────┘ └──────┘ │
└─────────────────────────────────────┘
```

### 样式特点

- **模态框**: 圆角、阴影、居中显示
- **平台按钮**: 网格布局、图标+文字、悬停效果
- **链接输入框**: 只读、灰色背景、易于选择
- **Toast提示**: 顶部居中、渐入渐出动画
- **响应式**: 移动端适配（3列网格）

---

## 🧪 测试场景

### 测试1：故事详情页分享

1. 访问 `http://localhost:3001/story?id=1`
2. 点击"分享"按钮
3. 验证分享面板显示
4. 点击"复制链接"
5. 验证链接已复制到剪贴板
6. 验证数据库中记录了分享（platform='copy'）

### 测试2：章节页分享

1. 访问 `http://localhost:3001/chapter?id=2`
2. 点击工具栏的分享图标
3. 验证分享面板显示章节信息
4. 点击"微博"按钮
5. 验证打开微博分享窗口
6. 验证数据库中记录了分享（platform='weibo'）

### 测试3：未登录用户分享

1. 退出登录
2. 访问任意故事页面
3. 点击分享按钮
4. 验证分享功能正常工作
5. 验证数据库中 `user_id` 为 null

### 测试4：分享统计API

```bash
# 获取故事分享统计
curl http://localhost:3001/api/shares/stats/1

# 获取章节分享统计
curl http://localhost:3001/api/shares/stats/node/2
```

### 测试5：社交媒体分享

- **微信**: 显示二维码提示
- **微博**: 打开 `service.weibo.com` 分享窗口
- **QQ**: 打开 `connect.qq.com` 分享窗口
- **QQ空间**: 打开 `sns.qzone.qq.com` 分享窗口

---

## 📊 数据统计示例

### SQL查询：最受欢迎的分享平台

```sql
SELECT platform, COUNT(*) as count
FROM shares
GROUP BY platform
ORDER BY count DESC;
```

### SQL查询：某故事的分享趋势

```sql
SELECT DATE(created_at) as date, COUNT(*) as shares
FROM shares
WHERE story_id = 1
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

### SQL查询：分享最多的故事

```sql
SELECT story_id, COUNT(*) as share_count
FROM shares
GROUP BY story_id
ORDER BY share_count DESC
LIMIT 10;
```

---

## 🔧 技术实现

### 1. 后端技术

- **框架**: Express.js + TypeScript
- **ORM**: Prisma
- **数据库**: SQLite
- **路由**: RESTful API

### 2. 前端技术

- **原生JavaScript**: 无依赖
- **Clipboard API**: 现代浏览器支持
- **CSS3**: 动画和过渡效果
- **Font Awesome**: 图标库

### 3. 安全性

- ✅ 参数验证（story_id, platform）
- ✅ 平台白名单验证
- ✅ SQL注入防护（Prisma ORM）
- ✅ XSS防护（数据转义）

---

## 🚀 后续优化建议

### 1. 二维码生成

集成 `qrcode.js` 库，为微信分享生成真实的二维码：

```javascript
import QRCode from 'qrcode';

QRCode.toCanvas(document.getElementById('qrcodeContainer'), shareUrl, {
    width: 200,
    margin: 2
});
```

### 2. 分享数据分析

创建管理后台页面，展示：
- 分享趋势图表
- 平台占比饼图
- 热门故事排行
- 用户分享排行

### 3. 分享奖励

实现分享激励机制：
- 分享获得积分
- 积分兑换特权
- 排行榜展示

### 4. 短链接服务

集成短链接服务，生成更简洁的分享链接：
- `https://storytree.com/s/abc123`
- 便于记忆和传播
- 统计点击数据

### 5. Open Graph标签

在HTML头部添加OG标签，优化社交媒体预览：

```html
<meta property="og:title" content="故事标题">
<meta property="og:description" content="故事简介">
<meta property="og:image" content="封面图片URL">
<meta property="og:url" content="故事链接">
```

### 6. 分享图片生成

生成精美的分享卡片图片：
- 包含故事封面、标题、二维码
- 适合保存到相册后分享
- 使用 Canvas API 或服务端生成

---

## 📝 修改文件清单

### 后端文件

1. ✅ `api/prisma/schema.prisma` - 添加shares表
2. ✅ `api/src/routes/shares.ts` - 分享路由（新建）
3. ✅ `api/src/index.ts` - 注册分享路由

### 前端文件

4. ✅ `web/share.js` - 分享组件（新建）
5. ✅ `web/story.html` - 集成分享按钮
6. ✅ `web/chapter.html` - 集成分享按钮

### 数据库

7. ✅ 运行 `npx prisma generate` - 生成Prisma Client

---

## 📌 总结

### 实现内容

- ✅ 完整的分享功能（7个平台）
- ✅ 分享统计记录和查询
- ✅ 美观的UI界面
- ✅ 响应式设计
- ✅ 多页面集成

### 代码量

- **后端**: ~160行（shares.ts）
- **前端**: ~670行（share.js）
- **集成**: ~30行（story.html + chapter.html）
- **数据库**: 1个新表，3个关系

### 功能完整性

- ✅ 需求1: 复制链接
- ✅ 需求2: 社交媒体分享
- ✅ 需求3: 故事详情页分享
- ✅ 需求4: 章节页分享
- ✅ 需求5: 分享统计记录

---

**功能已完成！** 🎉 用户现在可以轻松分享故事和章节到各个平台，系统会自动记录分享数据用于统计分析。

