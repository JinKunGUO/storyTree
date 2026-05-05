# StoryTree 完整存储方案详解

> 文档更新时间：2026-05-05

## 一、存储架构总览

StoryTree 采用 **分层存储架构**，不同类型的数据存储在不同的存储系统中：

| 存储系统 | 存储内容 | 环境 |
|---------|---------|------|
| **MySQL 数据库** | 故事内容、章节文本、用户信息、评论、积分等 | 生产/开发 |
| **阿里云 OSS** | 图片文件（头像、封面、插图） | 生产环境 |
| **本地磁盘** | 图片文件（开发环境备用） | 开发环境 |
| **Redis 缓存** | 热点数据、会话、任务队列 | 生产环境 |
| **内存缓存** | 热点数据（Redis 降级方案） | 开发/降级 |
| **JSON 种子文件** | 公版书批量导入数据源 | 初始化 |

### 1.1 完整架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         StoryTree 完整存储架构                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐           │
│   │   小程序端    │         │    Web 端    │         │   管理后台    │           │
│   │  (UniApp)    │         │   (Vue.js)   │         │              │           │
│   └──────┬───────┘         └──────┬───────┘         └──────┬───────┘           │
│          │                        │                        │                   │
│          └────────────────────────┼────────────────────────┘                   │
│                                   │                                             │
│                                   ▼                                             │
│                        ┌──────────────────┐                                    │
│                        │   API 服务器      │                                    │
│                        │  (Express.js)    │                                    │
│                        │  120.26.182.140  │                                    │
│                        └────────┬─────────┘                                    │
│                                 │                                               │
│     ┌───────────────┬───────────┼───────────┬───────────────┐                  │
│     │               │           │           │               │                  │
│     ▼               ▼           ▼           ▼               ▼                  │
│ ┌─────────┐   ┌─────────┐  ┌─────────┐  ┌─────────┐   ┌─────────────┐         │
│ │  MySQL  │   │  Redis  │  │阿里云OSS│  │本地磁盘 │   │ JSON种子    │         │
│ │ 数据库  │   │  缓存   │  │(生产)   │  │(开发)   │   │ 数据文件    │         │
│ ├─────────┤   ├─────────┤  ├─────────┤  ├─────────┤   ├─────────────┤         │
│ │• 故事   │   │• 热点   │  │• 头像   │  │• 头像   │   │• 公版书     │         │
│ │• 章节   │   │• 会话   │  │• 封面   │  │• 封面   │   │• 经典文学   │         │
│ │• 用户   │   │• 队列   │  │• 插图   │  │• 插图   │   │• 472个JSON  │         │
│ │• 评论   │   │• 限流   │  │         │  │         │   │             │         │
│ │• 积分   │   │         │  │         │  │         │   │             │         │
│ │• 订单   │   │         │  │         │  │         │   │             │         │
│ └─────────┘   └─────────┘  └─────────┘  └─────────┘   └─────────────┘         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 二、数据库存储（MySQL）

### 2.1 核心内容存储

**用户创作的故事、章节内容、公版书都存储在 MySQL 数据库中**，以纯文本格式保存。

| 数据表 | 存储内容 | 内容格式 | 说明 |
|--------|---------|---------|------|
| `stories` | 故事/书籍元信息 | 纯文本 | 标题、简介、标签等 |
| `nodes` | 章节/节点内容 | **纯文本** | 章节标题和正文内容 |
| `comments` | 用户评论 | 纯文本 | 评论内容 |

### 2.2 数据库表结构概览

#### 核心内容表

```
stories 表（故事/书籍）
├── id              # 故事ID
├── title           # 标题
├── description     # 简介
├── cover_image     # 封面图片URL（存储在OSS）
├── tags            # 标签
├── author_id       # 作者ID
├── visibility      # 可见性（public/private/password）
├── allow_branch    # 是否允许分支
└── allow_comment   # 是否允许评论

nodes 表（章节/节点）
├── id              # 节点ID
├── story_id        # 所属故事
├── parent_id       # 父节点（树形结构）
├── author_id       # 作者ID
├── title           # 章节标题
├── content         # 【章节正文内容 - 纯文本】
├── image           # 章节插图URL（存储在OSS）
├── path            # 路径（如 "1.2.3"）
├── is_published    # 是否发布
├── review_status   # 审核状态
└── ai_generated    # 是否AI生成
```

#### 用户相关表

| 表名 | 用途 |
|-----|------|
| `users` | 用户信息（头像URL存储在OSS） |
| `follows` | 用户关注关系 |
| `story_followers` | 故事追更 |
| `bookmarks` | 故事收藏 |
| `node_bookmarks` | 章节书签 |

#### 协作与互动表

| 表名 | 用途 |
|-----|------|
| `story_collaborators` | 故事协作者 |
| `collaboration_requests` | 协作申请 |
| `ratings` | 章节评分 |
| `comment_votes` | 评论投票 |
| `reports` | 举报记录 |

#### 积分与会员表

| 表名 | 用途 |
|-----|------|
| `point_transactions` | 积分交易记录 |
| `checkin_records` | 签到记录 |
| `invitation_codes` | 邀请码 |
| `user_subscriptions` | 会员订阅 |
| `orders` | 订单记录 |

### 2.3 公版书存储方式

**公版书与用户创作内容使用相同的存储方式**，都存储在 `stories` 和 `nodes` 表中。

#### 导入流程

```
┌─────────────────┐      批量导入脚本      ┌─────────────────┐
│  JSON 种子文件   │ ──────────────────► │   MySQL 数据库   │
│  (472个文件)    │                       │  stories + nodes │
└─────────────────┘                       └─────────────────┘
```

#### 种子数据位置

```
api/scripts/seed-data/
├── 谈艺录.json
├── 管锥编.json
├── 傅雷家书.json
├── 胡适留学日记.json
├── 沉沦.json
├── ... (共472个JSON文件)
```

#### JSON 数据格式

```json
{
  "title": "傅雷家书",
  "description": "傅雷写给儿子傅聪的家信集...",
  "tags": "书信,家庭教育,艺术",
  "chapters": [
    {
      "title": "一九五四年一月十八日",
      "content": "亲爱的孩子，你走后第二天..."
    },
    {
      "title": "一九五四年一月十九日",
      "content": "早预算新年中必可接到你的信..."
    }
  ]
}
```

#### 导入脚本

```bash
# 批量导入公版书
cd api
npx ts-node scripts/batch-import-stories.ts
```

### 2.4 内容格式说明

**重要：项目不使用富文本或 Markdown 格式**

| 格式类型 | 是否支持 | 说明 |
|---------|---------|------|
| 纯文本 | ✅ 支持 | 所有内容都是纯文本 |
| Markdown | ❌ 不支持 | 无 Markdown 解析器 |
| 富文本 HTML | ❌ 不支持 | 无富文本编辑器 |
| 音频/视频 | ❌ 不支持 | 仅支持图片 |

段落分隔使用换行符 `\n`，前端渲染时保留换行。

---

## 三、文件存储模式切换

系统通过 `STORAGE_MODE` 环境变量自动选择**图片文件**的存储方式：

| 环境变量值 | 存储位置 | 适用场景 |
|-----------|---------|---------|
| `local` | 服务器本地磁盘 `/uploads/` | 开发环境、测试 |
| `oss` | 阿里云 OSS | **生产环境（推荐）** |

### 配置示例

```bash
# 开发环境 (.env.development)
STORAGE_MODE=local

# 生产环境 (.env.production)
STORAGE_MODE=oss
```

## 四、OSS 图片存储详情

### 4.1 Bucket 信息

| 配置项 | 值 |
|--------|-----|
| Bucket 名称 | `storytree-uploads` |
| 地域 | 华东1（杭州）`oss-cn-hangzhou` |
| 存储类型 | 标准存储 |
| 读写权限 | 公共读（Public Read） |
| 访问域名 | `https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com` |

### 4.2 目录结构

```
storytree-uploads/
├── avatars/           # 用户头像
│   └── {uuid}.{ext}   # 例：a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
├── covers/            # 故事封面
│   └── {uuid}.{ext}   # 例：b2c3d4e5-f6a7-8901-bcde-f12345678901.png
└── content/           # 内容图片（章节插图等）
    └── {uuid}.{ext}   # 例：c3d4e5f6-a7b8-9012-cdef-123456789012.webp
```

### 4.3 环境变量配置

```bash
# OSS 配置（添加到服务器 .env 文件）
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=您的AccessKeyID
OSS_ACCESS_KEY_SECRET=您的AccessKeySecret
OSS_BUCKET=storytree-uploads
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

# 存储模式
STORAGE_MODE=oss
```

### 4.4 上传流程

```
┌─────────┐    ①选择图片    ┌─────────┐    ②上传请求    ┌─────────┐
│  用户   │ ──────────────► │  小程序  │ ──────────────► │   API   │
└─────────┘                 └─────────┘                 └────┬────┘
                                                             │
                                                    ③存储到 OSS
                                                             │
                                                             ▼
┌─────────┐    ⑤显示图片    ┌─────────┐    ④返回 URL    ┌─────────┐
│  用户   │ ◄────────────── │  小程序  │ ◄────────────── │   OSS   │
└─────────┘                 └─────────┘                 └─────────┘
```

### 4.5 API 接口

| 接口路径 | 方法 | 用途 | 字段名 |
|---------|------|------|--------|
| `/api/upload/image` | POST | 通用图片上传 | `image` |
| `/api/upload/avatar` | POST | 用户头像上传 | `avatar` |
| `/api/upload/story/:storyId/cover` | POST | 故事封面上传 | `cover` |

### 4.6 上传限制

| 限制项 | 值 |
|--------|-----|
| 最大文件大小 | 5 MB |
| 支持格式 | JPG, PNG, GIF, WebP |
| 认证方式 | JWT Token（必须登录） |

### 4.7 小程序端上传示例

```typescript
// 选择并上传图片
uni.chooseImage({
  count: 1,
  sizeType: ['compressed'],
  sourceType: ['album', 'camera'],
  success: async (res) => {
    const tempPath = res.tempFilePaths[0]
    
    uni.showLoading({ title: '上传中...' })
    
    try {
      // 调用上传接口
      const uploadRes = await http.upload({
        url: '/api/upload/image',
        filePath: tempPath,
        name: 'image'
      })
      
      // uploadRes.url 即为 OSS 图片地址
      console.log('图片地址:', uploadRes.url)
      // 输出: https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com/content/xxx.jpg
      
    } catch (error) {
      uni.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  }
})
```

## 五、核心代码文件

| 文件路径 | 说明 |
|---------|------|
| `api/src/utils/oss.ts` | OSS 存储核心模块 |
| `api/src/utils/storage.ts` | 统一存储抽象层（自动切换 local/oss） |
| `api/src/utils/upload.ts` | 本地存储模块（开发环境） |
| `api/src/routes/upload.ts` | 上传 API 路由 |
| `miniprogram/src/utils/request.ts` | 小程序 HTTP 请求封装（含上传方法） |

## 六、OSS 模块功能

`api/src/utils/oss.ts` 提供以下功能：

```typescript
// 上传文件到 OSS
uploadToOSS(buffer: Buffer, originalName: string, type: 'avatar' | 'cover' | 'content'): Promise<string>

// 从 OSS 删除文件
deleteFromOSS(url: string): Promise<void>

// 生成签名 URL（用于私有 Bucket）
getSignedUrl(objectKey: string, expires?: number): Promise<string>

// 检查文件是否存在
fileExists(objectKey: string): Promise<boolean>

// 验证图片类型
isValidImageType(mimetype: string): boolean

// 验证文件大小
isValidFileSize(size: number, maxSizeMB?: number): boolean
```

## 七、安全配置

### 7.1 RAM 子账号权限

为安全起见，使用 RAM 子账号而非主账号 AccessKey：

- 账号名：`storytree-oss`
- 权限：`AliyunOSSFullAccess`（仅 OSS 完全访问权限）

### 7.2 跨域配置（CORS）

在 OSS 控制台配置跨域规则：

| 配置项 | 值 |
|--------|-----|
| 来源 (AllowedOrigin) | `*` |
| 允许 Methods | GET, POST, PUT, DELETE, HEAD |
| 允许 Headers | `*` |
| 暴露 Headers | ETag, x-oss-request-id |
| 缓存时间 | 600 秒 |

## 八、图片访问

### 8.1 访问地址格式

```
https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com/{type}/{filename}
```

示例：
- 头像：`https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com/avatars/a1b2c3d4.jpg`
- 封面：`https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com/covers/b2c3d4e5.png`
- 内容：`https://storytree-uploads.oss-cn-hangzhou.aliyuncs.com/content/c3d4e5f6.webp`

### 8.2 图片处理（可选）

OSS 支持图片处理参数，可在 URL 后添加：

```
# 缩放到 200x200
?x-oss-process=image/resize,w_200,h_200

# 生成缩略图
?x-oss-process=image/resize,m_fill,w_100,h_100

# 转换格式
?x-oss-process=image/format,webp
```

## 九、费用估算

### 9.1 OSS 计费项

| 计费项 | 单价（杭州地域） |
|--------|-----------------|
| 存储费用 | ¥0.12/GB/月 |
| 外网流出流量 | ¥0.50/GB |
| PUT/POST 请求 | ¥0.01/万次 |
| GET 请求 | ¥0.01/万次 |

### 9.2 预估费用（小规模应用）

假设：
- 存储 1GB 图片
- 每月 10GB 流量
- 每月 10 万次请求

**月费用 ≈ ¥0.12 + ¥5 + ¥0.02 = ¥5.14**

## 十、本地开发指南

### 10.1 使用本地存储开发

```bash
# api/.env.development
STORAGE_MODE=local
```

上传的文件会保存到 `api/uploads/` 目录。

### 10.2 测试 OSS 存储

```bash
# api/.env.development
STORAGE_MODE=oss
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your-key-id
OSS_ACCESS_KEY_SECRET=your-key-secret
OSS_BUCKET=storytree-uploads
```

## 十一、故障排查

### 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 上传失败 403 | AccessKey 无权限 | 检查 RAM 权限配置 |
| 上传失败 CORS | 跨域未配置 | 配置 OSS CORS 规则 |
| 图片无法访问 | Bucket 权限私有 | 设置为公共读 |
| NoSuchKey 错误 | 文件不存在 | 正常现象（路径下无文件） |

### 检查 OSS 配置

```bash
# 登录服务器检查环境变量
ssh root@120.26.182.140
cd /var/www/storytree/api
cat .env | grep OSS
```

## 十二、总结

### 12.1 存储方案对照表

| 数据类型 | 存储位置 | 格式 | 环境 |
|---------|---------|------|------|
| **故事/章节文本内容** | MySQL 数据库 | 纯文本 | 生产/开发 |
| **公版书/经典文学** | MySQL 数据库 | 纯文本 | 生产/开发 |
| **用户创作内容** | MySQL 数据库 | 纯文本 | 生产/开发 |
| **评论/互动数据** | MySQL 数据库 | 纯文本 | 生产/开发 |
| **用户头像** | 阿里云 OSS / 本地 | 图片 | 生产/开发 |
| **故事封面** | 阿里云 OSS / 本地 | 图片 | 生产/开发 |
| **章节插图** | 阿里云 OSS / 本地 | 图片 | 生产/开发 |
| **热点数据缓存** | Redis / 内存 | JSON | 生产/开发 |
| **AI 任务队列** | Redis | JSON | 生产环境 |

### 12.2 开发环境 vs 生产环境

| 组件 | 开发环境 | 生产环境 |
|------|---------|---------|
| 数据库 | SQLite / MySQL | MySQL |
| 图片存储 | 本地磁盘 `/uploads/` | 阿里云 OSS |
| 缓存 | 内存缓存（Map） | Redis |
| 任务队列 | 同步执行 | Bull + Redis |

### 12.3 关键配置汇总

```bash
# ========== 生产环境 .env ==========

# 数据库
DATABASE_URL="mysql://user:password@localhost:3306/storytree"

# 图片存储
STORAGE_MODE=oss
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=您的AccessKeyID
OSS_ACCESS_KEY_SECRET=您的AccessKeySecret
OSS_BUCKET=storytree-uploads
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

# 缓存
REDIS_URL="redis://:password@localhost:6379"

# ========== 开发环境 .env ==========

# 数据库
DATABASE_URL="file:./dev.db"  # SQLite

# 图片存储
STORAGE_MODE=local

# 缓存（可选，不配置则使用内存缓存）
# REDIS_URL=
```

### 12.4 核心文件路径

| 文件 | 说明 |
|-----|------|
| `api/prisma/schema.prisma` | 数据库表结构定义 |
| `api/src/utils/storage.ts` | 统一存储抽象层 |
| `api/src/utils/oss.ts` | OSS 存储模块 |
| `api/src/utils/upload.ts` | 本地存储模块 |
| `api/src/utils/cache.ts` | 缓存模块 |
| `api/src/utils/queue.ts` | 任务队列模块 |
| `api/src/routes/upload.ts` | 上传 API 路由 |
| `api/scripts/seed-data/` | 公版书 JSON 数据 |
| `api/scripts/batch-import-stories.ts` | 批量导入脚本 |

---

## 附录：Redis 缓存存储（生产环境）

### A.1 缓存配置

```bash
# .env
REDIS_URL="redis://:password@localhost:6379"
```

### A.2 缓存键设计

| 缓存键模式 | 用途 | TTL |
|-----------|------|-----|
| `node:{nodeId}` | 章节数据 | 1小时 |
| `node:content:{nodeId}` | 章节内容 | 1小时 |
| `story:{storyId}` | 故事数据 | 1小时 |
| `story:nodes:{storyId}` | 故事节点树 | 1小时 |
| `user:{userId}` | 用户数据 | 1小时 |
| `user:profile:{userId}` | 用户资料 | 1小时 |
| `hot:stories` | 热门故事列表 | 1小时 |
| `hot:nodes` | 热门章节列表 | 1小时 |
| `stats:platform` | 平台统计数据 | 1小时 |
| `rate:{action}:{ip}` | 频率限制 | 动态 |

### A.3 AI 任务队列

基于 Bull + Redis 实现异步任务处理：

| 队列名称 | 用途 |
|---------|------|
| `ai-continuation` | AI 续写任务 |
| `ai-polish` | AI 润色任务 |
| `ai-illustration` | AI 插图生成任务 |

### A.4 降级方案

当 Redis 不可用时，系统自动降级为内存缓存（Map），确保服务可用性。

```typescript
// api/src/utils/cache.ts
// 自动检测 Redis 连接状态，失败时使用内存缓存
```

