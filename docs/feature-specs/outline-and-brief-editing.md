# 立项书与故事大纲编辑功能说明

## 功能概述

本次更新为 Web 端和小程序端的撰写页面新增了**立项书编辑**和**故事大纲编辑/版本管理**功能，同时增强了 AI 创作流程的多轮对话能力和结果可编辑性。

---

## 一、立项书编辑

### 1.1 功能说明

- **查看立项书**：主创和协作者可在撰写页面侧边栏（Web）或大纲面板（小程序）中查看立项书内容
- **编辑立项书**：仅主创可编辑立项书，点击编辑按钮后进入编辑模式，所有字段变为可编辑状态，点击 ✓ 保存

### 1.2 权限控制

| 操作 | 主创 | 协作者 | 其他登录用户 | 未登录用户 |
|------|------|--------|-------------|-----------|
| 查看立项书 | ✅ | ✅ | ✅（仅公开故事） | ❌ |
| 编辑立项书 | ✅ | ❌ | ❌ | ❌ |

**后端 API**：
- `GET /api/ai/creation/stories/:id/project-brief` — 使用 `canViewStory()` 权限
- `PUT /api/ai/creation/stories/:id/project-brief` — 使用 `isStoryAuthor()` 权限

### 1.3 可编辑字段

- 故事标题
- 故事梗概
- 核心创意
- 目标读者
- 类型标签
- 期望文风

---

## 二、故事大纲编辑

### 2.1 功能说明

- **查看大纲**：主创和协作者可查看当前激活版本的大纲
- **编辑大纲**：点击编辑按钮进入编辑模式，可修改所有大纲字段
- **新建版本**：输入版本说明后进入编辑模式，修改内容后保存为新版本
- **版本切换**：通过下拉选择器切换不同版本的大纲

### 2.2 权限控制

| 操作 | 主创 | 协作者 | 其他登录用户 | 未登录用户 |
|------|------|--------|-------------|-----------|
| 查看大纲 | ✅ | ✅ | ❌ | ❌ |
| 编辑当前版本 | ✅ | ✅ | ❌ | ❌ |
| 新建大纲版本 | ✅ | ✅ | ❌ | ❌ |
| 切换激活版本 | ✅ | ✅ | ❌ | ❌ |

**后端 API**：
- `GET /api/ai/creation/stories/:id/outlines` — `isAuthor || isCollaborator`
- `GET /api/ai/creation/stories/:id/outlines/active` — `isAuthor || isCollaborator`
- `POST /api/ai/creation/stories/:id/outlines` — `isAuthor || isCollaborator`
- `PUT /api/ai/creation/stories/:id/outlines/:version` — `isAuthor || isCollaborator`
- `POST /api/ai/creation/stories/:id/outlines/:version/activate` — `isAuthor || isCollaborator`

### 2.3 可编辑字段

- 世界观设定
- 主要角色（名称、角色类型、描述）
- 故事结构（第一幕/第二幕/第三幕）
- 章节大纲（每章标题和摘要）

### 2.4 新建版本流程

```
用户点击"新建版本" → 输入版本说明 → 进入编辑模式（内容基于当前版本） → 用户修改内容 → 点击 ✓ 保存 → POST 创建新版本
```

与旧逻辑的区别：旧逻辑是直接 POST 创建一个与当前版本内容完全一样的新版本，新逻辑允许用户在保存前先修改内容。

---

## 三、分支大纲（后端支持）

### 3.1 数据库变更

`story_outlines` 表新增 `root_node_id` 字段：

```prisma
model story_outlines {
  id           Int      @id @default(autoincrement())
  story_id     Int
  root_node_id Int?     // 关联的分支根节点ID，null表示故事全局大纲
  version      Int
  outline      String
  is_active    Boolean  @default(false)
  change_note  String?
  created_by   Int
  created_at   DateTime @default(now())
  story        stories  @relation(fields: [story_id], references: [id], onDelete: Cascade)

  @@index([story_id])
  @@index([story_id, is_active])
  @@index([story_id, root_node_id])
  @@index([story_id, root_node_id, is_active])
}
```

### 3.2 API 支持

所有大纲 API 现已支持 `rootNodeId` 查询参数：
- `GET /outlines?rootNodeId=X` — 获取指定分支的大纲列表
- `GET /outlines/active?rootNodeId=X` — 获取指定分支的激活大纲
- `POST /outlines` body 中支持 `rootNodeId` — 创建分支大纲
- `POST /outlines/branch` — 专门的分支大纲创建接口

### 3.3 新增 API

- `PUT /api/ai/creation/stories/:id/outlines/:version` — 编辑现有大纲版本内容
- `POST /api/ai/creation/stories/:id/outlines/branch` — 从某节点创建分支大纲

---

## 四、AI 创作增强

### 4.1 多轮对话历史

修改了 AI Worker 中的多轮修订逻辑，现在 `revise-project-brief` 和 `revise-outline` 接口会将完整对话历史（`generations` 数组）传递给 AI，而非仅最后一轮结果。这使 AI 能更准确地理解用户的系列修改意图。

### 4.2 新增 `updateSessionGeneration` 函数

`ai-creation.ts` 中新增了 `updateSessionGeneration`，由 Worker 在 AI 生成完成后调用，将结果追加到会话的 `generations` 数组中。

### 4.3 AI 生成结果可编辑（Web 端 + 小程序端）

- `create-ai.html` / `create-ai.vue`：AI 生成结果从纯文本展示改为可编辑表单
- 立项书生成结果现在包含大纲字段（世界观、角色、三幕结构、章节大纲）
- 用户可在确认前编辑所有字段
- 创建故事时，立项书和大纲会一起保存

### 4.4 AI 生成 Token 和超时优化

- 立项书生成 `max_tokens` 从 2000 提升到 4000（因新增了大纲内容）
- 超时策略优化：连接超时（TTFB）和流式传输空闲超时分离

### 4.5 安全 JSON 解析

新增 `safeParseAIJson` 函数，处理 AI 返回的包含未转义控制字符的 JSON，避免 JSON.parse 失败。

---

## 五、故事创建 API 增强

`POST /api/stories` 新增字段：
- `project_brief` — 创建故事时同时保存立项书
- `ai_assisted_created` — 标记是否由 AI 辅助创建
- `ai_creation_method` — AI 创作方式（project/outline/pastiche/template）

小程序端 `createStory` API 类型也相应更新。

---

## 六、Web 端撰写页面增强

### 6.1 侧边栏重构

**write.html** 和 **write.js** 的侧边栏改动：
- 立项书面板支持编辑模式（主创专属）
- 大纲面板支持编辑模式（主创 + 协作者）
- 大纲面板新增版本选择器、编辑按钮、新建版本按钮
- 大纲编辑模式下版本切换被禁止（防误操作）
- 新建版本时下拉栏即时显示"新版本"选项

### 6.2 导航栏增强

write.html 导航栏新增：
- 会员中心入口
- 积分商城入口
- 登录/注册/退出按钮（根据登录状态切换）

### 6.3 CSS 新增

write.css 新增：
- `.panel-header-actions` — 侧边栏头部按钮组样式
- `.edit-brief-input` / `.edit-brief-textarea` — 立项书编辑字段样式
- `.version-selector` 布局优化

---

## 七、小程序端增强

### 7.1 撰写页面（editor.vue）

- **立项书面板**：新增查看和编辑功能（主创可编辑）
- **大纲面板增强**：
  - 版本选择器 — 支持切换历史版本
  - 编辑模式 — 支持编辑世界观、角色（名称/类型/描述）、故事结构（三幕）、章节大纲
  - 新建版本 — 先进入编辑模式修改内容，保存时创建新版本
  - 权限控制 — 编辑和新版本按钮仅对主创显示
- **参数兼容**：`id` 参数兼容为 `storyId`（create-ai.vue 跳转使用）
- **自动创建第一章**：AI 创建故事后自动创建第一章节点并跳转

### 7.2 AI 创建页面（create-ai.vue）

- 生成结果从纯文本展示改为可编辑表单
- 立项书结果新增：目标读者、类型标签、期望文风、作品亮点编辑
- 大纲结果新增：世界观、角色设定、故事结构、章节大纲编辑
- 仿写/模板结果新增：仿写立项书和大纲的完整编辑
- 创建故事时同时创建大纲记录和第一章节点
- 聊天修改区域增加标题和说明

---

## 八、涉及文件清单

| 文件 | 改动内容 |
|------|---------|
| `VERSION.json` | 构建版本号更新 |
| `api/prisma/schema.prisma` | story_outlines 表新增 root_node_id 和索引 |
| `api/src/routes/ai-creation.ts` | 权限统一、分支大纲 API、大纲版本编辑 API、updateSessionGeneration |
| `api/src/routes/stories.ts` | POST /api/stories 新增 project_brief/ai 字段 |
| `api/src/workers/aiWorker.ts` | safeParseAIJson、多轮对话历史、Token/超时优化 |
| `web/js/pages/write.js` | 立项书/大纲编辑、版本管理、权限控制 |
| `web/js/pages/create-ai.js` | AI 生成结果可编辑、大纲数据归一化 |
| `web/write.html` | 侧边栏 HTML 结构增强、导航栏 |
| `web/create-ai.html` | 可编辑字段 CSS |
| `web/css/pages/write.css` | 侧边栏编辑模式样式 |
| `miniprogram/src/api/stories.ts` | createStory API 类型更新 |
| `miniprogram/src/pkgStory/pages/story/create-ai.vue` | AI 结果可编辑、大纲/立项书归一化、自动创建第一章 |
| `miniprogram/src/pkgWrite/pages/write/editor.vue` | 立项书面板、大纲编辑/版本管理、权限控制 |
