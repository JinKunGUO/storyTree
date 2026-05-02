# 通知跳转逻辑全面审计报告

生成时间：2026-05-02

## 一、Web 端跳转规则（`web/notifications.html:399-452`）

| 规则 | 匹配条件 | 转换逻辑 | 示例 |
|------|---------|---------|------|
| 1 | `link.startsWith('/user/')` | `/user/:id` → `/profile.html?id=:id` | `/user/123` → `/profile.html?id=123` |
| 2 | `link.startsWith('/nodes/')` | `/nodes/:id` → `/story.html?id=:story_id&node=:id`（需异步查询） | `/nodes/456` → `/story.html?id=1&node=456` |
| 3 | `link.startsWith('/api/ai/tasks/')` | `/api/ai/tasks/:id` → `/ai-tasks.html?id=:id` | `/api/ai/tasks/789` → `/ai-tasks.html?id=789` |
| 4 | `link === '/profile'` | `/profile` → `/profile.html` | `/profile` → `/profile.html` |
| 5 | `link.startsWith('/story?')` | `/story?...` → `/story.html?...` | `/story?id=1` → `/story.html?id=1` |
| 6 | `link.startsWith('/story-settings?')` | `/story-settings?...` → `/story-settings.html?...` | `/story-settings?id=1&tab=requests` → `/story-settings.html?id=1&tab=requests` |
| fallback | 其他 | 原样使用 | `/chapter?id=1` → `/chapter?id=1` |

## 二、小程序端跳转规则（`miniprogram/src/pages/notifications/index.vue:206-217`）

| 路径前缀 | 小程序页面 |
|---------|-----------|
| `/chapter` | `/pages/chapter/index` |
| `/story` | `/pages/story/index` |
| `/story-settings` | `/pages/story/manage` |
| `/profile` | `/pages/profile/index` |
| `/checkin` | `/pages/checkin/index` |
| `/points` | `/pages/points/index` |
| `/membership` | `/pages/membership/index` |
| `/notifications` | `/pages/notifications/index` |
| `/write` | `/pages/write/index` |
| `/create` | `/pages/create/index` |

**特殊处理**：
- `/story.html?id=X&node=Y` → 提取 `node` 参数 → `/pages/chapter/index?id=Y`
- `/chapter?id=X#comment-Y` → 去掉 hash → `/pages/chapter/index?id=X`

## 三、所有通知类型及其 link 值审计

### ✅ 正常工作的通知

| type | link 格式 | Web 跳转 | 小程序跳转 | 触发场景 | 文件:行号 |
|------|----------|---------|-----------|---------|----------|
| `milestone` | `/profile.html` | ✅ 直接使用 | ✅ `/pages/profile/index` | 码字里程碑 | milestone-checker.ts:14 |
| `ai_chapter_draft` | `/story?id=X` | ✅ 规则5 → `/story.html?id=X` | ✅ `/pages/story/index?id=X` | AI章节草稿完成 | aiWorker.ts:820 |
| `ai_chapter_created` | `/chapter?id=X` | ✅ fallback（需后端改为 `/chapter.html?id=X`） | ✅ `/pages/chapter/index?id=X` | AI章节发布 | aiWorker.ts:947 |
| `ai_task_delay` | `/ai-tasks?taskId=X` | ⚠️ fallback（需后端改为 `/ai-tasks.html?id=X`） | ❌ 无映射 | AI任务延迟 | aiWorker.ts:1525 |
| `bookmark` | `/story?id=X` 或 `/chapter?id=X` | ✅ 规则5/fallback | ✅ `/pages/story/index` 或 `/pages/chapter/index` | 收藏故事/章节 | bookmarks.ts:106,247 |
| `checkin_milestone` | `/profile` | ✅ 规则4 → `/profile.html` | ✅ `/pages/profile/index` | 签到里程碑 | checkin.ts:179,439 |
| `makeup_chance` | `/profile` | ✅ 规则4 | ✅ `/pages/profile/index` | 获得补签机会 | checkin.ts:201 |
| `invitation_success` | `/profile` | ✅ 规则4 | ✅ `/pages/profile/index` | 邀请注册成功 | auth.ts:178,724 |
| `COLLABORATION_INVITE` | `/story?id=X` | ✅ 规则5 | ✅ `/pages/story/index?id=X` | 被邀请为协作者 | stories.ts:974 |
| `COLLABORATION_APPROVED` | `/story?id=X` | ✅ 规则5 | ✅ `/pages/story/index?id=X` | 协作申请通过 | collaboration-requests.ts:152,259,444 |
| `COLLABORATION_REQUEST` | `/story-settings?id=X&tab=requests` | ✅ 规则6 + 自动滚动 | ✅ `/pages/story/manage?id=X&tab=requests` | 新协作申请 | collaboration-requests.ts:169,276 |
| `COLLABORATION_REJECTED` | `/story?id=X` | ✅ 规则5 | ✅ `/pages/story/index?id=X` | 协作申请被拒 | collaboration-requests.ts:510 |
| `STORY_UPDATE` | `/chapter?id=X` | ✅ fallback | ✅ `/pages/chapter/index?id=X` | 故事更新 | nodes.ts:140,255,499,1057 |
| `withdrawal_submitted` | `/profile?tab=withdrawals` | ✅ fallback | ✅ `/pages/profile/index?tab=withdrawals` | 提现申请提交 | withdrawals.ts:88 |
| `withdrawal_cancelled` | `/profile?tab=earnings` | ✅ fallback | ✅ `/pages/profile/index?tab=earnings` | 提现申请取消 | withdrawals.ts:155 |
| `withdrawal_approved` | `/profile?tab=withdrawals` | ✅ fallback | ✅ `/pages/profile/index?tab=withdrawals` | 提现审核通过 | withdrawals.ts:404 |
| `withdrawal_rejected` | `/profile?tab=withdrawals` | ✅ fallback | ✅ `/pages/profile/index?tab=withdrawals` | 提现审核拒绝 | withdrawals.ts:404 |
| `tip_received` | `/story?id=X` 或 `/profile` | ✅ 规则5/规则4 | ✅ `/pages/story/index` 或 `/pages/profile/index` | 收到打赏 | points-features.ts:206 |
| `comment_pinned` | `/story?id=X#comment-Y` | ✅ 规则5（hash会保留） | ⚠️ hash被去掉，无法定位到评论 | 评论被置顶 | points-features.ts:370 |
| `comment_reply` | `/story.html?id=X&node=Y#comment-Z` | ✅ 直接使用（hash保留） | ⚠️ 小程序会提取node参数跳转到章节页，但hash被去掉 | 评论被回复 | comments.ts:232 |
| `comment` | `/story.html?id=X&node=Y#comment-Z` | ✅ 直接使用 | ⚠️ 同上 | 收到新评论 | comments.ts:246 |
| `ai_continuation_ready` | `/story.html?id=X` 或 `/ai-tasks.html?id=X` | ✅ 直接使用 | ✅ `/pages/story/index` 或 ❌ 无 `/ai-tasks` 映射 | AI续写完成 | notification.ts:52 |
| `ai_polish_ready` | `/ai-tasks.html?id=X` | ✅ 直接使用 | ❌ 无映射 | AI润色完成 | notification.ts:70 |
| `ai_illustration_ready` | `/ai-tasks.html?id=X` | ✅ 直接使用 | ❌ 无映射 | AI插图完成 | notification.ts:85 |
| `level_up` | `/profile.html` | ✅ 直接使用 | ✅ `/pages/profile/index` | 等级升级 | notification.ts:100 |
| `points_earned` | `/profile.html` | ✅ 直接使用 | ✅ `/pages/profile/index` | 获得积分 | notification.ts:115 |

## 四、问题汇总

### 🔴 严重问题（无法跳转）

1. **小程序缺少 `/ai-tasks` 路由映射**
   - 影响通知：`ai_task_delay`、`ai_continuation_ready`（部分）、`ai_polish_ready`、`ai_illustration_ready`
   - 建议：添加 `/ai-tasks` → `/pages/ai-tasks/index` 映射（如果小程序有该页面）

### 🟡 中等问题（跳转但体验不佳）

2. **后端 link 格式不统一**
   - `/chapter?id=X` vs `/chapter.html?id=X`
   - `/ai-tasks?taskId=X` vs `/ai-tasks.html?id=X`（参数名也不一致）
   - 建议：统一使用不带 `.html` 的格式（如 `/chapter?id=X`），由前端转换规则处理

3. **评论通知的 hash 锚点在小程序中丢失**
   - 影响通知：`comment_pinned`、`comment_reply`、`comment`
   - 小程序不支持 hash 定位，用户无法直接跳转到具体评论
   - 建议：小程序端在跳转后通过 `onLoad` 参数传递 `commentId`，页面加载后滚动到对应评论

4. **Web 端部分通知无自动滚动到目标区域**
   - 已修复：`/story-settings?id=X&tab=requests` → 自动滚动到协作申请区域
   - 待检查：`/profile?tab=withdrawals`、`/profile?tab=earnings` 是否自动切换到对应 tab

### 🟢 轻微问题（可优化）

5. **Web 端规则 2（`/nodes/:id`）需要异步查询**
   - 当前实现：前端点击通知时异步调用 `/api/nodes/:id` 获取 `story_id`
   - 建议：后端创建通知时直接使用 `/chapter?id=X` 或 `/story.html?id=X&node=Y`，避免前端额外请求

## 五、修复建议优先级

### P0（立即修复）

1. **小程序添加 `/ai-tasks` 路由映射**
   ```typescript
   '/ai-tasks': '/pages/ai-tasks/index',  // 如果小程序有该页面
   ```

### P1（重要）

2. **统一后端 link 格式**
   - `aiWorker.ts:1525`：`/ai-tasks?taskId=X` → `/ai-tasks?id=X`
   - `aiWorker.ts:947`：`/chapter?id=X` → 保持（已正确）
   - `comments.ts:232,246`：已使用 `/story.html?id=X&node=Y#comment-Z`（正确）

3. **Web 端 profile.html 检查 tab 参数自动切换**
   - 检查 `/profile.html?tab=withdrawals` 是否自动切换到提现记录 tab
   - 检查 `/profile.html?tab=earnings` 是否自动切换到收益 tab

### P2（优化）

4. **小程序评论通知优化**
   - 修改 `convertLinkToMiniUrl` 提取 hash 中的 `commentId`
   - 章节页面 `onLoad` 接收 `commentId` 参数并滚动到对应评论

5. **后端避免使用 `/nodes/:id` 格式**
   - 创建通知时直接使用 `/chapter?id=X` 或 `/story.html?id=X&node=Y`

## 六、自动滚动功能检查清单

| 页面 | URL 参数 | 是否支持自动滚动/切换 | 文件位置 |
|------|---------|---------------------|---------|
| `story-settings.html` | `tab=requests` | ✅ 已实现（本次修复） | web/story-settings.html:853-861 |
| `profile.html` | `tab=withdrawals` | ❓ 待检查 | web/profile.html |
| `profile.html` | `tab=earnings` | ❓ 待检查 | web/profile.html |
| `chapter.html` | `#comment-123` | ❓ 待检查（hash锚点） | web/chapter.html |
| `story.html` | `#comment-123` | ❓ 待检查（hash锚点） | web/story.html |

---

**审计结论**：
- Web 端跳转规则基本完善，主要问题是后端 link 格式不统一
- 小程序端缺少 `/ai-tasks` 映射，导致 AI 相关通知无法跳转
- 评论通知的 hash 锚点在小程序中无法使用，需要改用参数传递
- 需要检查 `profile.html` 是否支持 `tab` 参数自动切换

