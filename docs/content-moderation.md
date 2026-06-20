# StoryTree 内容审核机制详细说明

## 一、架构概览

```
用户发布内容 → 敏感词扫描(DFA) → 审核状态判定 → 可见性控制
                                        ↓
AI生成内容 → 流式输出完成 → 后置扫描+脱敏 → 返回前端
                                        ↓
用户举报 → 阈值判断 → 自动送审/下架
                                        ↓
管理员后台 → AI预审标签 → 单条/批量审核 → 通知用户
```

## 二、内容状态流转

| 状态 | 含义 | 可见性 |
|------|------|--------|
| `PENDING` | 待审核 | **仅作者本人、故事作者、管理员可见** |
| `APPROVED` | 已通过 | 所有人可见 |
| `REJECTED` | 已驳回 | 仅作者本人可见 |
| `HIDDEN` | 已下架 | 仅作者本人可见 |

**状态流转规则：**
- 发布时 → 触发 `needsReview()` → 返回 `PENDING` 或 `APPROVED`
- 被举报 3 次 → 从 `APPROVED` 转为 `PENDING`（进入审核队列）
- 被举报 5 次 → 自动转为 `HIDDEN`（下架）
- 管理员审核 → 可设为 `APPROVED` / `REJECTED` / `HIDDEN`

## 三、敏感词扫描系统

### 3.1 算法：DFA Trie 树

- **时间复杂度**：O(n)，n 为文本长度
- **构建方式**：模块加载时构建单例 Trie 树，后续查询无需重建
- **变体检测**：跳过中间的空格、零宽字符、特殊符号（如 `毒 品`、`毒·品`、`赌---博` 均可命中）

### 3.2 词库分类（共 120+ 词）

| 分类 | 关键词数 | 严重程度 | 示例 |
|------|---------|----------|------|
| `illegal` (违法犯罪) | ~50 | high | 毒品、赌博、枪支、传销 |
| `porn` (色情低俗) | ~35 | high | 色情、裸体、嫖娼 |
| `violence` (暴力血腥) | ~25 | medium | 杀人、自杀、虐杀 |
| `spam` (垃圾广告) | ~30 | low | 加微信、刷单、免费送 |
| `political` (政治敏感) | ~12 | high | 颠覆政权、邪教 |

### 3.3 严重程度 (severity)

- **high**：命中 `illegal` / `porn` / `political` 分类
- **medium**：命中 `violence` 分类
- **low**：命中 `spam` 分类
- **none**：未命中任何敏感词

### 3.4 自动驳回 (autoReject)

当 `severity === 'high'` 且命中敏感词数量 >= 3 时，`autoReject = true`，建议系统自动驳回。

### 3.5 脱敏处理

`maskSensitiveWords(text)` 将命中的敏感词替换为等长度的 `*`，如：`毒品` → `**`，`加微信` → `***`。

## 四、审核触发规则 (`needsReview`)

```typescript
needsReview(text, nodeCount, options?) → { needReview, reason, severity, autoReject }
```

### 判断逻辑（按优先级）：

1. **新用户强制审核**：`nodeCount < 3` → 强制审核
   - 例外：年度/企业会员且 `nodeCount >= 1` 可跳过
2. **敏感词命中**：`scanSensitiveWords(text).found === true` → 强制审核
3. **无命中**：直接通过，状态为 `APPROVED`

### 会员豁免规则（P3）

| 会员等级 | 是否跳过新用户审核 | 是否跳过敏感词审核 |
|---------|-------------------|-------------------|
| free | 否 | 否 |
| trial | 否 | 否 |
| monthly | 否 | 否 |
| annual | **是**（需 nodeCount >= 1） | 否 |
| enterprise | **是**（需 nodeCount >= 1） | 否 |

> 会员豁免仅适用于"新用户首发"规则，敏感词审核对所有用户一视同仁。

## 五、AI 生成内容审核

### 触发时机

AI 流式输出（`qwen-stream.ts`）完成后，在发送 `done` 事件前执行后置扫描。

### 处理流程

```
流式生成完成 → fullText 组装
→ scanSensitiveWords(fullText)
→ 如果命中：
   - maskSensitiveWords(fullText) → safeText
   - 附加 contentWarning: { found: true, category, masked: true }
→ 返回 safeText 给前端
```

### 前端收到的数据

```json
{
  "event": "done",
  "data": {
    "fullText": "这是脱敏后的文本***内容",
    "usage": { "input": 100, "output": 500 },
    "contentWarning": { "found": true, "category": "illegal", "masked": true }
  }
}
```

## 六、举报系统

### 用户举报

- **频率限制**：每人每天最多 10 次举报（内存 Map 实现）
- **去重**：同一用户对同一节点只能举报一次
- **举报原因**：前端提交 reason + description

### 自动处理阈值

| 累计举报次数 | 动作 | 说明 |
|-------------|------|------|
| 1-2 次 | 无自动动作 | 仅记录 |
| 3 次 | `APPROVED` → `PENDING` | 进入审核队列，管理员复核 |
| 5 次 | → `HIDDEN` | 自动下架，立即不可见 |

> 已经是 PENDING 状态的内容不会重复送审。

## 七、管理员审核后台

### 7.1 审核队列

`GET /api/admin/review-queue`

返回所有 `PENDING` 状态的节点，按创建时间排序。

### 7.2 单条审核

`POST /api/admin/review/:id`

```json
{ "action": "approve" | "reject" | "hide", "note": "审核备注" }
```

### 7.3 批量审核（P2 新增）

`POST /api/admin/review-batch`

```json
{
  "nodeIds": [1, 2, 3],
  "action": "approve" | "reject" | "hide",
  "note": "批量操作备注"
}
```

- 单次最多 50 条
- 批量更新状态并记录审核人、审核时间
- 逐条发送审核结果通知给作者

### 7.4 AI 预审标签（P2 新增）

`GET /api/admin/review-queue/labels`

对审核队列中的内容自动扫描，生成优先级标签：

| 标签 | 优先级 | 触发条件 |
|------|--------|----------|
| 疑似严重违规 | 2 (紧急) | severity = high |
| 疑似暴力内容 | 1 (优先) | severity = medium |
| 疑似广告/垃圾 | 1 (优先) | severity = low |
| 用户举报(N次) | 1-2 | report_count > 0 |
| 新用户首发 | 0 (普通) | 无敏感词、无举报 |

返回格式：
```json
{
  "items": [
    {
      "id": 1,
      "title": "...",
      "label": "疑似严重违规",
      "priority": 2,
      "sensitiveWords": ["毒品"],
      "categories": ["illegal"],
      "reportCount": 0
    }
  ],
  "stats": { "total": 20, "urgent": 3, "priority": 8, "normal": 9 }
}
```

## 八、可见性控制实现

### 节点详情页 (`GET /nodes/:id`)

- `PENDING` / `REJECTED` / `HIDDEN` 状态的节点：仅节点作者、故事作者、管理员可访问
- 其他用户访问返回 403

### 分支列表 (`GET /nodes/:id/branches`)

```sql
WHERE review_status = 'APPROVED'
   OR (author_id = :currentUserId AND review_status = 'PENDING')
```

### 同级分支 (`GET /nodes/:id/siblings`)

同上逻辑，需 `optionalAuth` 中间件获取当前用户。

### 故事节点列表 (`stories.ts`)

```sql
WHERE review_status = 'APPROVED'
   OR (author_id = :currentUserId AND review_status = 'PENDING')
   OR (author_id = :currentUserId AND review_status IN ('REJECTED', 'HIDDEN'))
```

## 九、涉及文件清单

| 文件 | 职责 |
|------|------|
| `api/src/utils/sensitiveWords.ts` | DFA Trie 核心算法、词库、扫描/脱敏/审核判定 |
| `api/src/utils/qwen-stream.ts` | AI 输出后置扫描 |
| `api/src/routes/nodes.ts` | 发布审核、可见性控制、举报阈值、会员豁免 |
| `api/src/routes/stories.ts` | 故事节点列表可见性、会员豁免 |
| `api/src/routes/admin.ts` | 审核队列、单条/批量审核、AI 预审标签 |
| `api/src/utils/__tests__/sensitiveWords.test.ts` | 39 个单元测试 |

## 十、测试覆盖

39 个单元测试覆盖：
- 基础扫描（空文本、干净文本、各分类命中）
- DFA 变体检测（空格、特殊字符、多噪声字符、误报排除）
- 脱敏替换（单次、多次、嵌入上下文、不同长度）
- severity 分类（high/medium/low/none、混合分类取最高）
- autoReject（高严重+3词触发、不满足条件不触发）
- 会员豁免（annual/enterprise 跳过新用户审核、monthly 不跳过、敏感词不豁免、nodeCount=0 不豁免）
