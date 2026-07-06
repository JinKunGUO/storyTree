# 新手引导系统问题总结 — 第二轮全量审查（修正版）

> 审查日期：2026-07-06
> 审查方法：对 6 个引导相关文件做逐文件全量逐行审查 + 跨文件交互分析
> 审查文件：`onboarding-manager.js`、`tour.js`、`welcome-modal.js`、`page-guide-bridge.js`、`story-concept-bridge.js`、`concept-guide.js`
> 与第一轮的区别：第一轮用"线索追踪"方法（从用户报告的 bug 出发沿调用链追根因），本轮用"逐文件全量审查"方法，覆盖了链路之外的控制流、错误路径、跨文件竞态、死代码等问题
>
> **修正说明**：本文件基于 `docs/onboarding-issues-round2.md`，经与源代码逐行交叉验证后做以下增量修正：
> 1. **删除 P0-3**（`st_celebration_shown` 未在用户切换时清除 — 经验证，第 107-109 行和第 134-137 行两处都已正确清除，原报告误报）
> 2. **P0-1 降级为 P1-18**（场景 3 缺少 `return` — 虽会导致后续逻辑继续执行，但场景 3 的条件与后续场景互斥，实际不会命中后续分支，属于代码清晰度问题而非功能性破坏。保留原描述"场景 3 缺少 return"）
> 3. **P1-8 降级为 P3-10**（`?guide=create-ai` 在 `guideConfigs` 中不存在 — 实际可由 `onboarding-manager` scenario 4 接管，且 create-ai 页有完整 tour 步骤，影响有限）
> 4. **P2-28 合并入 P1-7**（欢迎弹窗"跳过"按钮、点击遮罩、ESC 关闭三个路径共享同一根因——不调用 `markTourSeen()`，统一在 P1-7 中描述）
> 5. **新增 P1-18**（`markTourComplete()` 与 `markTourSeen()` 双重 `has_seen_tour` 更新路径 — tour.js:730-777 和 onboarding-manager.js:513-534 都调用 `/api/auth/tour-complete`，可能产生竞态）
> 6. **新增 P2-34**（`decideOnboarding()` 场景 3 不检查 `has_seen_tour` — 已完成 tour 的老用户访问 story 页仍会看到概念引导）
> 7. 所有统计数字、分类表格、优先级建议已同步更新

---

## P0：严重问题（影响核心功能）

### P0-1：story 页场景 3 缺少 `return`，导致概念引导后继续执行后续逻辑

> **降级说明**：原 P0-1 保留编号为 P0-1，但降级为 P1-18。详见 P1-18。

~~### P0-1~~ → 见 P1-18

### ~~P0-3：用户切换时未清除 `st_celebration_shown`（第二处遗漏）~~

> **删除说明**：经源代码交叉验证，`fetchUserState()` 第 107-109 行（读取缓存时检测用户不匹配）和第 134-137 行（API 返回后检测用户切换）两处都已正确清除 `st_celebration_shown`。原报告对第 130-139 行的描述有误——该处确实清除了 `st_celebration_shown`。此为误报，予以删除。

---

### P0-2：`fetchUserState` API 失败时构造 `{ has_seen_tour: false }`，已登录用户被误判为新用户

**文件**：`onboarding-manager.js` `fetchUserState()` 第 121-125 行 和 第 152-156 行

**问题**：当 `/api/auth/me` 请求失败（网络错误或非 200 响应）时，代码构造了 `{ has_seen_tour: false, onboarding_progress: null, _ts: Date.now() }` 作为 fallback。这会导致已登录的老用户在网络波动时被误判为新用户。

```javascript
// 第 121-125 行：response.ok 为 false 时
if (!response.ok) {
  this.userState = { has_seen_tour: false, onboarding_progress: null, _ts: Date.now() };
  return;
}

// 第 152-156 行：catch 网络错误时
} catch (error) {
  console.error('[OnboardingManager] 获取用户状态失败:', error);
  this.userState = { has_seen_tour: false, onboarding_progress: null, _ts: Date.now() };
}
```

**影响**：
- 老用户网络波动时 `has_seen_tour` 被设为 false → `decideOnboarding()` 场景 1 命中 → 在首页弹出欢迎弹窗
- `onboarding_progress` 被设为 null → 丢失服务器端的任务进度（虽然 localStorage 可能还有缓存，但 `getProgress()` 在 `serverProgress` 为 null 时会 fallback 到 `localProgress`，可能使用过期的本地数据）
- 这个 fallback 状态会被写入 `localStorage('st_user_state')` 吗？不会——因为第 123 行和第 155 行只设置了 `this.userState`，没有调用 `localStorage.setItem`。但 `decideOnboarding()` 会直接使用 `this.userState`，所以影响仍然存在

**修复方案**：
- response 非 200 时，不应构造默认状态，而是尝试使用 localStorage 缓存。缓存不存在时才返回 null（即未登录状态）
- 网络错误时同理
- 仅在 token 不存在时才应该返回 null（不触发引导），API 失败时不应假设用户是新用户

```javascript
if (!response.ok) {
  // API 失败时尝试使用缓存，而非假设为新用户
  const cached = localStorage.getItem('st_user_state');
  if (cached) {
    try { this.userState = JSON.parse(cached); } catch (e) {}
  }
  return; // userState 可能为 null，decideOnboarding 会跳过引导
}
```

---

### P0-4：create-ai tour 完成后无跳转，用户停留在原页面不知道下一步

**文件**：`tour.js` `getCreateAiSteps()` 第 308-313 行

**问题**：create-ai 页 tour 的最后一步（第 5 步"故事模板"）的 `onNextClick` 调用 `markTourComplete()` + `driver.destroy()`，但没有跳转到下一步页面（write 页）。

```javascript
onNextClick: async () => {
  await this.markTourComplete();
  this.driver.destroy();
  // ← 没有跳转到 write.html
}
```

对比 `getIndexSteps()` 最后一步的 `onNextClick`（第 144-148 行）会调用 `navigateToNextPage('discover', 1)` 继续引导流程。

**影响**：用户在 create-ai 页完成 tour 后，引导突然消失，用户不知道应该去 write 页开始写作。Tour 流程在 create-ai 页断裂。

**修复方案**：在 `driver.destroy()` 后添加跳转到 write 页的逻辑。但需要注意：create-ai 页的 tour 有两种触发方式：
1. 从 index → discover → concept → create-ai 的完整 tour 流程（应跳转到 write 页续接）
2. 从 welcome-modal 任务清单直接跳转 `?guide=create-ai`（不应自动跳转）

可以通过检查 URL 中是否有 `?tour=` 参数来判断：

```javascript
onNextClick: async () => {
  await this.markTourComplete();
  this.driver.destroy();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tour')) {
    this.navigateToNextPage('write', 4);
  }
}
```

**注意**：这与 P1-5 相关——如果 `markTourComplete` 不再无条件设置 `writeGuideSeen = true`，那么跳转到 write 页后场景 4b 会正确触发写作引导。

---

## P1：重要问题（影响用户体验或代码可维护性）

### P1-5：`markTourComplete` 无条件设置 `writeGuideSeen = true`，导致场景 4b 变成死代码

**文件**：`tour.js` `markTourComplete()` 第 758 行

**问题**：上一轮修复 A1 时在 `markTourComplete()` 中添加了 `progress.writeGuideSeen = true`，目的是防止 write 页 tour 重复触发。但场景 4b 的条件是 `completedTour && !writeGuideSeen`——`markTourComplete` 在 create-ai 页也会被调用，设置 `writeGuideSeen = true` 后，用户到达 write 页时场景 4b 条件永远为 false。

```javascript
// tour.js markTourComplete() 第 755-758 行
progress.tasks.completedTour = true;
progress.tourCompleted = true;
progress.writeGuideSeen = true; // ← 在 create-ai 页也会设置！
```

```javascript
// onboarding-manager.js decideOnboarding() 第 196 行
if (this.currentPage === 'write' && tasks.completedTour && !writeGuideSeen) {
  // ← writeGuideSeen 已被 markTourComplete 设为 true，此条件永远为 false
}
```

**影响**：
- 场景 4b（写作页功能引导）完全失效——用户从 create-ai 完成 tour 跳转到 write 页后，不会看到写作功能引导
- 这是第一轮修复 A1 时引入的回归

**修复方案**：`markTourComplete` 不应无条件设置 `writeGuideSeen`。应区分调用来源：
- 在 write 页调用 `markTourComplete` 时设置 `writeGuideSeen = true`（确实已经看过写作引导）
- 在 create-ai 页调用 `markTourComplete` 时不设置 `writeGuideSeen`（用户还没看过写作引导）

```javascript
async markTourComplete() {
  // ...
  progress.tasks.completedTour = true;
  progress.tourCompleted = true;
  // 仅在 write 页调用时设置 writeGuideSeen
  if (this.currentPage === 'write') {
    progress.writeGuideSeen = true;
  }
  // ...
}
```

同时，`getWriteSteps()` 最后一步的 `onNextClick`（第 409-416 行）已有逻辑判断 `!progress.tasks.completedTour` 时才调用 `markTourComplete`——这确保了 write 页独立引导不会重复标记 `completedTour`，但不影响 `writeGuideSeen` 的设置。

---

### P1-6：`getProgressWithFixup()` 定义但从未被调用

**文件**：`onboarding-manager.js` 第 575-583 行

**问题**：上一轮将 `getProgress()` 拆分为纯读版（`getProgress`）和带修复版（`getProgressWithFixup`），但 `decideOnboarding()` 和所有其他调用点仍使用 `getProgress()`，`getProgressWithFixup()` 从未被调用。

```javascript
getProgressWithFixup() {
  const result = this.getProgress();
  const fixed = this.ensurePrerequisiteTasks(result);
  if (fixed) {
    this.saveLocalProgress(result);
    this.syncProgress(result, { fireAndForget: true });
  }
  return result;
}
```

**影响**：`ensurePrerequisiteTasks` 的修复逻辑只在 `tryCelebrate` 中被调用（第 812 行），在 `decideOnboarding` 等决策路径中不会被触发。如果用户进度数据存在不一致（如 `publishedChapter = true` 但 `createdStory = false`），`decideOnboarding` 不会自动修复，可能导致任务清单显示异常。

**修复方案**：在 `decideOnboarding()` 的第 166 行，将 `getProgress()` 替换为 `getProgressWithFixup()`，确保决策时使用经过依赖修复的进度数据。

---

### P1-7：欢迎弹窗所有关闭路径均不调用 `markTourSeen()`，用户每次进首页都看到弹窗

**文件**：`welcome-modal.js` 第 174-178 行（跳过按钮）、第 210-213 行（遮罩点击）、第 218-223 行（ESC 键）

**问题**：上一轮将 `markTourSeen()` 从 `show()` 移到"开始体验引导"按钮的 click 事件中。但欢迎弹窗有**三个关闭路径**，全部只调用 `this.hide()` 而不调用 `markTourSeen()`：

1. **"跳过"按钮**（第 174-178 行）：
```javascript
const skipBtn = this.overlay.querySelector('#stWelcomeSkip');
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    this.hide();
    // ← 没有调用 markTourSeen()
  });
}
```

2. **点击遮罩关闭**（第 210-213 行）：
```javascript
this.overlay.addEventListener('click', (e) => {
  if (e.target === this.overlay) {
    this.hide();
    // ← 没有调用 markTourSeen()
  }
});
```

3. **ESC 键关闭**（第 218-223 行）：
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && this.isVisible) {
    this.hide();
    // ← 没有调用 markTourSeen()
  }
});
```

> **注**：原 P2-28（遮罩点击和 ESC 关闭不标记 `markTourSeen`）与 P1-7（跳过按钮不标记）是同一根因，已合并到此条目。

**影响**：用户通过任意方式关闭欢迎弹窗后，`has_seen_tour` 仍为 false。下次访问首页时 `decideOnboarding()` 场景 1（`!has_seen_tour && currentPage === 'index'`）再次命中，欢迎弹窗反复弹出。

**修复方案**：在所有关闭路径中统一调用 `markTourSeen()`。推荐方案：在 `hide()` 方法内部根据上下文决定是否标记，或在所有调用 `hide()` 的路径前添加 `markTourSeen()`：

```javascript
// "跳过"按钮
skipBtn.addEventListener('click', () => {
  this.hide();
  if (window.onboardingManager) {
    window.onboardingManager.markTourSeen();
  }
});

// 遮罩点击
this.overlay.addEventListener('click', (e) => {
  if (e.target === this.overlay) {
    this.hide();
    if (window.onboardingManager) {
      window.onboardingManager.markTourSeen();
    }
  }
});

// ESC 键
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && this.isVisible) {
    this.hide();
    if (window.onboardingManager) {
      window.onboardingManager.markTourSeen();
    }
  }
});
```

---

### ~~P1-8：欢迎弹窗任务清单 `createdStory` 的 href `?guide=create-ai` 在 `guideConfigs` 中不存在~~

> **降级说明**：本条降级为 P3-10。`?guide=create-ai` 流程可由 `onboarding-manager` scenario 4（tour 路径）接管，且 create-ai 页有完整 tour 步骤定义，影响有限。详见 P3-10。

---

### P1-9：`conceptGuide.hide` 被两个文件各自 patch，`highlightTreeChart` 可能被调用两次

**文件**：`onboarding-manager.js` 第 247-262 行 + `story-concept-bridge.js` 第 196-207 行

**问题**：两个文件都 patch 了 `window.conceptGuide.hide`：

1. `onboarding-manager.js` `_patchConceptGuideHideForStory()`（第 247-262 行）：在 `hide` 后调用 `StoryConceptBridge.highlightTreeChart()`
2. `story-concept-bridge.js` `patchConceptGuideHide()`（第 196-207 行）：在 `hide` 后直接调用 `highlightTreeChart()`

两者都有防重复 patch 的检查（`_patchedByManager` 和覆盖 `originalHide`），但如果两个 patch 都生效，`hide` 调用链会变成：

```
patched_hide_2 (story-concept-bridge)
  → originalHide = patched_hide_1 (onboarding-manager)
    → originalHide = original_hide (concept-guide.js)
      → original_hide() 执行
      → onboardingManager._patchConceptGuideHideForStory 的逻辑: highlightTreeChart()
    → 回到 patched_hide_2: highlightTreeChart() 再次调用
```

**影响**：`highlightTreeChart()` 被调用两次，可能创建两个 Driver.js 实例和两个 toast 提示。

**实际情况分析**：
- `story-concept-bridge.js` 只在 `?guide=concept` 路径下执行（第 13 行 `if (hasGuideParam !== 'concept') return;`）
- `onboarding-manager.js` 的 `_patchConceptGuideHideForStory` 只在 `decideOnboarding()` 场景 3 中调用
- 两者不太可能同时执行——但如果 `?guide=concept` 路径执行了 `patchConceptGuideHide`，然后 `decideOnboarding()` 又执行了 `_patchConceptGuideHideForStory`，就会叠加

**修复方案**：统一 patch 逻辑为单一入口。`onboarding-manager.js` 的 `_patchConceptGuideHideForStory` 应检查 `StoryConceptBridge.patchConceptGuideHide` 是否已经 patch 过，或者直接使用 `StoryConceptBridge` 的版本：

```javascript
_patchConceptGuideHideForStory() {
  if (!window.conceptGuide || !window.StoryConceptBridge) return;
  // 如果 story-concept-bridge.js 已经 patch 过，不再重复 patch
  if (window.conceptGuide._patchedByBridge) return;
  window.conceptGuide._patchedByManager = true;
  // ... 原有逻辑
}
```

或者更好的方案：`onboarding-manager.js` 不做 patch，统一由 `story-concept-bridge.js` 处理。`decideOnboarding()` 场景 3 直接调用 `StoryConceptBridge` 暴露的方法。

---

### P1-10：导航栏帮助按钮在所有任务完成后仍显示任务清单

**文件**：`onboarding-manager.js` 第 277-298 行

**问题**：`showNavHelpButton` 在 `allDone` 时将图标改为 `fa-question-circle`（帮助图标），但 click 事件仍调用 `window.welcomeModal.show()`，显示的是欢迎弹窗（含任务清单）。任务全部完成后，用户点击"帮助"按钮看到的仍然是任务清单（全部打勾），而不是实际的帮助内容。

```javascript
btn.addEventListener('click', () => {
  if (window.welcomeModal) {
    window.welcomeModal.show(); // ← 无论 allDone 与否，都显示欢迎弹窗
  }
});
```

**影响**：用户完成所有任务后点击"帮助"按钮，看到一个全部打勾的任务清单，体验不佳。

**修复方案**：`allDone` 时 click 事件应展示帮助内容或引导重置入口，而非任务清单：

```javascript
btn.addEventListener('click', () => {
  if (allDone) {
    // 显示帮助内容或提供重新查看教程的选项
    if (window.storyTreeTour) {
      window.storyTreeTour.startTour(this.currentPage);
    }
  } else if (window.welcomeModal) {
    window.welcomeModal.show();
  }
});
```

---

### P1-11：`markConceptGuideSeen` 在两个文件中重复定义

**文件**：`onboarding-manager.js` 第 482-495 行 + `story-concept-bridge.js` 第 165-191 行 + `concept-guide.js` 第 69-72 行

**问题**：`markConceptGuideSeen` 有三个调用路径：

1. `concept-guide.js` `hide()` 第 70-72 行：调用 `window.onboardingManager.markConceptGuideSeen()`
2. `onboarding-manager.js` 第 482-495 行：设置 `conceptGuideSeen = true` + `viewedStoryTree = true` + `syncProgress` + `tryCelebrate`
3. `story-concept-bridge.js` 第 165-191 行：自己的 `markConceptGuideSeen()` 函数，做相同的事情但实现略有不同

当 `?guide=concept` 路径执行时：
- `story-concept-bridge.js` 的 `patchConceptGuideHide` 覆盖了 `conceptGuide.hide`
- `conceptGuide.hide` 原始版本会调用 `onboardingManager.markConceptGuideSeen()`
- `story-concept-bridge.js` 的 `highlightTreeChart` 的 `onDestroyed` 回调也会调用 `markConceptGuideSeen()`（自己的版本）

**影响**：`markConceptGuideSeen` 可能被调用两次——一次通过 `conceptGuide.hide` 原始逻辑，一次通过 `story-concept-bridge.js` 的 `onDestroyed` 回调。虽然两次调用做相同的事情（幂等），但会产生两次 `syncProgress` 网络请求。

**修复方案**：
- `story-concept-bridge.js` 的 `markConceptGuideSeen` 应委托给 `onboardingManager.markConceptGuideSeen()`
- 或者 `concept-guide.js` 的 `hide()` 不应直接调用 `markConceptGuideSeen`（让 patch 者决定后续行为）

---

### P1-12：`concept-guide.js` `hide()` 无条件调用 `markConceptGuideSeen`，即使用户只看了第一步

**文件**：`concept-guide.js` 第 57-73 行

**问题**：`hide()` 方法在第 69-72 行无条件调用 `markConceptGuideSeen()`。用户可能在第一步就关闭了概念引导（点击关闭按钮或按 ESC），但 `conceptGuideSeen` 和 `viewedStoryTree` 仍被标记为 true。

```javascript
hide() {
  if (!this.isVisible) return;
  this.isVisible = false;
  // ... 移除 DOM
  // 标记已看过
  if (window.onboardingManager) {
    window.onboardingManager.markConceptGuideSeen();
  }
}
```

**影响**：用户在第一步就关闭概念引导，但被标记为"已看过故事树概念"和"已了解故事树概念"（通过 `ensurePrerequisiteTasks` 的 `viewedStoryTree → browsedDiscover` 传递依赖）。任务清单中"了解故事树概念"被错误地标记为完成。

**修复方案**：只有在用户看到最后一步（或至少看完一定比例的步骤）时才标记：

```javascript
hide() {
  if (!this.isVisible) return;
  this.isVisible = false;
  // ... 移除 DOM
  // 仅在用户看到最后一步时标记为已看过
  if (this.currentStep >= this.totalSteps - 1 && window.onboardingManager) {
    window.onboardingManager.markConceptGuideSeen();
  }
}
```

或者改为在"开始探索"按钮（最后一步的完成按钮）的 click 事件中调用 `markConceptGuideSeen`，而非在 `hide()` 中无条件调用。

---

### P1-13：`page-guide-bridge.js` 的 `passiveDiscoverMark` timer 在已触发后仍会被 `visibilitychange` 扣减

**文件**：`page-guide-bridge.js` 第 224-251 行

**问题**：上一轮修复了 `visibilitychange` 的 `{ once: true }` 问题，改为 `remaining` 时间追踪模式。但存在一个边界 bug：当 timer 已触发（`updateProgress` 已执行）但页面尚未切换到后台时，如果此后用户切走再切回，`visibilitychange` 的 `hidden` 分支会执行 `remaining -= (Date.now() - startTime)`，此时 `remaining` 可能已为 0 或负数，但 timer 已触发过，`clearTimeout(timer)` 不会有任何效果，`remaining` 的扣减无意义。

```javascript
let remaining = 8000;
let startTime = Date.now();
let timer = setTimeout(() => {
  updateProgress('browsedDiscover');
}, remaining);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(timer);
    remaining -= (Date.now() - startTime);
    // ← 如果 timer 已触发，这里仍在扣减 remaining，虽然不会造成实际问题
  } else if (remaining > 0) {
    startTime = Date.now();
    timer = setTimeout(() => {
      updateProgress('browsedDiscover');
    }, remaining);
  }
});
```

**影响**：实际影响较小——如果 timer 已触发，`updateProgress` 中的 `if (progress.tasks.browsedDiscover) return` 会跳过重复标记。但代码逻辑不够健壮。

**修复方案**：添加一个 `fired` 标志：

```javascript
let remaining = 8000;
let startTime = Date.now();
let fired = false;
let timer = setTimeout(() => {
  fired = true;
  updateProgress('browsedDiscover');
}, remaining);

document.addEventListener('visibilitychange', () => {
  if (fired) return;
  if (document.hidden) {
    clearTimeout(timer);
    remaining -= (Date.now() - startTime);
  } else if (remaining > 0) {
    startTime = Date.now();
    timer = setTimeout(() => {
      fired = true;
      updateProgress('browsedDiscover');
    }, remaining);
  }
});
```

---

### P1-14：`getCreateSteps` 和 `getStoryTreeSteps` 是死代码

**文件**：`tour.js` 第 193-253 行（`getCreateSteps`）、第 428-470 行（`getStoryTreeSteps`）

**问题**：这两个方法在 `getStepsForPage` 的 `stepsMap` 中有映射（`create: this.getCreateSteps`），但 `create` 这个页面名从未被任何地方调用：
- `startTour('create-ai')` → 使用 `getCreateAiSteps`
- `startTour('write')` → 使用 `getWriteSteps`
- `navigateToNextPage('create', 1)` → 跳转到 `/create-ai.html?tour=1`，在 create-ai 页 `startTour('create-ai')`

`getStoryTreeSteps` 更明显——没有任何地方调用 `startTour('story')` 或 `startTour('story-tree')`。

**影响**：约 80 行死代码，增加维护负担和阅读成本。

**修复方案**：删除这两个方法，并从 `stepsMap` 中移除 `create` 和 `'story-tree'`（如果有的话）的映射。

---

### P1-15：`getWriteSteps` 最后一步 `onNextClick` 逻辑不正确

**文件**：`tour.js` `getWriteSteps()` 第 409-416 行

**问题**：最后一步"发布章节"的 `onNextClick` 逻辑检查 `!progress.tasks.completedTour`：

```javascript
onNextClick: async () => {
  const progressStr = localStorage.getItem('st_onboarding_progress');
  const progress = progressStr ? JSON.parse(progressStr) : {};
  if (!progress.tasks || !progress.tasks.completedTour) {
    await this.markTourComplete();
  }
  this.driver.destroy();
}
```

这段代码的注释说"仅在主 tour 流程中标记完成，独立写作引导不重复标记"。但问题是：
1. 如果是主 tour 流程走到 write 页（场景 4），此时 `completedTour` 应该已经在 create-ai 页的 `markTourComplete` 中被设置为 true → 此处不会再次调用 `markTourComplete` → 但 `writeGuideSeen` 也不会被设置
2. 如果是独立写作引导（场景 4b），`completedTour` 已为 true → 此处不会调用 `markTourComplete` → `writeGuideSeen` 不会被设置 → 下次进 write 页场景 4b 仍然命中 → **写作引导无限重复**

**影响**：场景 4b 的写作引导可能无限重复触发，因为 `writeGuideSeen` 从未被设置（`markTourComplete` 不被调用，场景 4b 自己设置的 `writeGuideSeen` 在第 201-203 行，但那是在 `startTour('write')` 之前设置的，而 `getWriteSteps` 的 `onNextClick` 中不设置）。

**修复方案**：无论是否调用 `markTourComplete`，都应设置 `writeGuideSeen = true`：

```javascript
onNextClick: async () => {
  const progressStr = localStorage.getItem('st_onboarding_progress');
  const progress = progressStr ? JSON.parse(progressStr) : {};
  if (!progress.tasks) progress.tasks = {};
  if (!progress.tasks.completedTour) {
    await this.markTourComplete();
  }
  // 无论是否调用了 markTourComplete，都标记写作引导已看过
  progress.writeGuideSeen = true;
  localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
  if (window.onboardingManager) {
    window.onboardingManager.syncProgress(progress, { fireAndForget: true });
  }
  this.driver.destroy();
}
```

---

### P1-16：`onPopoverRender` 每次渲染都创建新的"跳过引导"按钮

**文件**：`tour.js` `onPopoverRender` 第 40-47 行

**问题**：`onPopoverRender` 回调中，每次 popover 渲染都创建一个新的"跳过引导"按钮并 append 到 `popover.footerButtons`。Driver.js 在步骤切换时会重新渲染 popover，但 `footerButtons` 容器可能不会被清空，导致按钮累积。

```javascript
onPopoverRender: (popover, { config }) => {
  // ... 插图部分有 existingIll 检查 ✓
  
  const skipBtn = document.createElement('button');
  skipBtn.className = 'st-tour-skip-btn';
  skipBtn.textContent = '跳过引导';
  skipBtn.addEventListener('click', async () => {
    await self.markTourComplete();
    self.driver.destroy();
  });
  popover.footerButtons.appendChild(skipBtn); // ← 每次渲染都 append
}
```

对比插图部分有 `existingIll` 检查（第 33 行），但跳过按钮没有类似检查。

**影响**：如果 Driver.js 不清空 `footerButtons`，每步切换后按钮会累积。实际是否累积取决于 Driver.js 的实现——如果它每次都重建 popover DOM，则不会累积。

**修复方案**：添加存在性检查，与插图部分的模式一致：

```javascript
const existingSkip = popover.footerButtons.querySelector('.st-tour-skip-btn');
if (!existingSkip) {
  const skipBtn = document.createElement('button');
  // ...
  popover.footerButtons.appendChild(skipBtn);
}
```

---

### P1-17：`syncProgressToServer` 是死代码

**文件**：`onboarding-manager.js` 第 663-665 行

**问题**：上一轮已将所有调用点改为 `syncProgress()`，但 `syncProgressToServer` 作为向后兼容的别名仍然保留。经过本轮全量检查确认，没有任何文件调用 `syncProgressToServer`。

```javascript
async syncProgressToServer(progress) {
  return this.syncProgress(progress);
}
```

**影响**：死代码，增加阅读成本。

**修复方案**：直接删除。

---

### P1-18：`decideOnboarding()` 场景 3 缺少 `return`，导致概念引导后继续执行后续逻辑

> **来源**：原 P0-1 降级。场景 3 的条件与后续场景互斥（`currentPage === 'story'` vs 其他页面检查），实际不会命中后续分支，属于代码清晰度问题而非功能性破坏。保留原描述。

**文件**：`onboarding-manager.js` `decideOnboarding()` 第 218-240 行

**问题**：场景 3（story 页概念引导）的 `if` 块内没有 `return` 语句。当 `currentPage === 'story'` 且 `!progress.conceptGuideSeen` 时，会设置定时器显示概念引导，但代码不会在此终止——而是继续执行到第 234 行的 `st_celebration_pending` 检查和第 240 行的 `enhanceEmptyStates()`。

```javascript
// 第 218-228 行：场景 3
if (this.currentPage === 'story') {
  if (!progress || !progress.conceptGuideSeen) {
    setTimeout(() => {
      if (window.conceptGuide) {
        this._patchConceptGuideHideForStory();
        window.conceptGuide.show();
      }
    }, 1500);
  }
  // ← 缺少 return！继续执行下面的代码
}

// 第 234-240 行：继续执行
if (localStorage.getItem('st_celebration_pending')) {
  localStorage.removeItem('st_celebration_pending');
  this.checkAndCelebrate();
}
this.enhanceEmptyStates();
```

**影响**：
- 概念引导定时器（1.5s 延迟）和 `enhanceEmptyStates`（2s 延迟）可能同时触发，在 story 页产生意外的 UI 干扰
- 如果 `st_celebration_pending` 存在，会在概念引导即将显示的同时触发庆典检查，造成 UI 叠加
- 对比场景 1（第 177 行 `return`）、场景 4（第 189 行 `return`）、场景 4b（第 206 行 `return`）、场景 2（第 213 行 `return`），场景 3 是唯一缺少 `return` 的分支

**修复方案**：在场景 3 的 `if` 块末尾添加 `return`。如果 `conceptGuideSeen` 已为 true（不需要概念引导），则可以继续执行后续逻辑，但应显式处理：

```javascript
if (this.currentPage === 'story') {
  if (!progress || !progress.conceptGuideSeen) {
    setTimeout(() => {
      if (window.conceptGuide) {
        this._patchConceptGuideHideForStory();
        window.conceptGuide.show();
      }
    }, 1500);
    return; // 概念引导即将显示，不执行后续逻辑
  }
}
```

---

### P1-19：`markTourComplete()` 与 `markTourSeen()` 双重 `has_seen_tour` 更新路径

**文件**：`tour.js` `markTourComplete()` 第 730-777 行 + `onboarding-manager.js` `markTourSeen()` 第 513-534 行

**问题**：两个函数都调用 `/api/auth/tour-complete` 设置 `has_seen_tour = true`：

1. `tour.js` `markTourComplete()`（第 730-777 行）：在 tour 正常完成时调用，发送 `/api/auth/tour-complete` 请求
2. `onboarding-manager.js` `markTourSeen()`（第 513-534 行）：在欢迎弹窗"开始体验"按钮点击时调用，也发送 `/api/auth/tour-complete` 请求

```javascript
// tour.js markTourComplete() 第 730-777 行
async markTourComplete() {
  // ... 设置 progress ...
  await fetch('/api/auth/tour-complete', { method: 'POST', ... });
}

// onboarding-manager.js markTourSeen() 第 513-534 行
async markTourSeen() {
  this.userState.has_seen_tour = true;
  await fetch('/api/auth/tour-complete', { method: 'POST', ... });
}
```

**影响**：
- 如果用户通过欢迎弹窗"开始体验"进入 tour，`markTourSeen()` 已调用 `/api/auth/tour-complete`，tour 完成时 `markTourComplete()` 再次调用同一 API——重复请求
- 跨页面 tour 进行中，如果新页面 `decideOnboarding()` 再次调用 `markTourSeen()`，可能与 `markTourComplete()` 产生竞态
- 两次 API 调用可能产生不一致的服务器状态

**修复方案**：统一为单一更新路径，添加防重机制（如 `_tourCompletePending` 标记）：

```javascript
// onboarding-manager.js
async markTourSeen() {
  if (this._tourCompletePending) return; // 防重
  this._tourCompletePending = true;
  try {
    this.userState.has_seen_tour = true;
    await fetch('/api/auth/tour-complete', { method: 'POST', ... });
  } finally {
    this._tourCompletePending = false;
  }
}

// tour.js
async markTourComplete() {
  // ... 设置 progress ...
  // 如果 markTourSeen 已经调用过，不再重复
  if (window.onboardingManager && window.onboardingManager.userState.has_seen_tour) {
    return;
  }
  await fetch('/api/auth/tour-complete', { method: 'POST', ... });
}
```

---

## P2：中等问题（影响代码质量或边缘场景）

### P2-18：`welcome-modal.js` 任务清单 `publishedChapter` 的 href `?guide=publish` 只高亮但不标记任务

**文件**：`welcome-modal.js` 第 144 行 + `page-guide-bridge.js` 第 146-154 行

**问题**：任务清单中"发布第一个章节"的 href 是 `/my-stories.html?guide=publish`，但 `guideConfigs.publish` 的 `taskKey` 为 `null`——意味着关闭高亮引导时不标记任何任务。`publishedChapter` 只能由实际的发布操作（`write.js` / `chapter.js`）触发标记。

```javascript
// page-guide-bridge.js 第 146-154 行
publish: {
  // ...
  taskKey: null, // 发布章节的标记由实际发布操作完成
  onComplete: function() {}
}
```

**影响**：用户从任务清单点击"发布第一个章节"，看到高亮引导后，任务不会被标记完成。用户需要实际发布一个章节才能标记。设计上是合理的，但用户可能困惑——看了引导以为任务完成了，但任务清单仍显示未完成。

**修复方案**：在 `onComplete` 中添加 toast 提示，告知用户需要实际发布章节才能完成任务：

```javascript
onComplete: function() {
  showNextStepToast('点击故事进入详情页，发布一个章节即可完成任务！', null, null);
}
```

---

### P2-19：`_redirectToStoryForConcept` 和 `_navigateToStoryForConcept` 重复实现

**文件**：`onboarding-manager.js` 第 444-477 行 + `welcome-modal.js` 第 231-264 行 + `tour.js` 第 517-528 行

**问题**：三处实现相同逻辑（搜索"反三国演义" → fallback 第一个故事 → 跳转 story 页），但 fallback 行为不一致：

| 位置 | fallback 行为 | 淡出动画 |
|---|---|---|
| `onboarding-manager.js` `_redirectToStoryForConcept` | 当前页显示 `conceptGuide.show()` | 无 |
| `welcome-modal.js` `_navigateToStoryForConcept` | 当前页显示 `conceptGuide.show()` | 无 |
| `tour.js` `navigateToStoryForConcept` | 跳转到 `/create-ai.html?tour=0` | 有 |

`tour.js` 的版本调用 `onboardingManager._redirectToStoryForConcept`（第 522-523 行），但 fallback 分支不同。

**影响**：三份重复代码，维护成本高，行为不一致。

**修复方案**：统一为 `OnboardingManager._redirectToStoryForConcept` 一个方法，其他文件调用之。`tour.js` 的淡出动画在外层包裹。

---

### P2-20：`concept-guide.js` `hide()` 调用 `markConceptGuideSeen` 与 `story-concept-bridge.js` 的 `onDestroyed` 回调重复标记

**文件**：`concept-guide.js` 第 69-72 行 + `story-concept-bridge.js` 第 86-87 行

**问题**：当 `?guide=concept` 路径执行时：
1. `story-concept-bridge.js` 的 `patchConceptGuideHide` 覆盖了 `conceptGuide.hide`
2. patched hide 调用 `originalHide()`（即 `concept-guide.js` 原始 `hide`），后者在第 70 行调用 `markConceptGuideSeen`
3. patched hide 然后调用 `highlightTreeChart`
4. `highlightTreeChart` 的 `onDestroyed` 回调（第 86-87 行）再次调用 `markConceptGuideSeen`

**影响**：`markConceptGuideSeen` 被调用两次，产生两次 `syncProgress` 网络请求。虽然操作幂等，但浪费网络请求。

**修复方案**：
- 方案 A：`concept-guide.js` 的 `hide()` 不直接调用 `markConceptGuideSeen`，让调用者（patch 者）决定后续行为
- 方案 B：`markConceptGuideSeen` 内部添加幂等检查（如果 `conceptGuideSeen` 已为 true 则跳过）

---

### P2-21：`getProgress()` 合并逻辑只取 local 的 true 值，不取 server 的 true 值

**文件**：`onboarding-manager.js` `getProgress()` 第 540-568 行

**问题**：当 server 和 local 都有 `tasks` 时，合并逻辑遍历 `localProgress.tasks` 的 key，如果 local 为 true 则设为 true。但不会遍历 `serverProgress.tasks` 的 key——如果 server 有 local 没有的任务 key（如另一台设备标记了 `publishedChapter`），该 key 会被保留在 merged 中（因为 `merged = { ...serverProgress }`），但如果 server 的值为 false 而 local 的值为 true，local 会覆盖 server。反过来，server 为 true 而 local 没有，server 的值会保留——这是正确的。

实际合并逻辑：
```javascript
const merged = { ...serverProgress };  // 先复制 server
if (localProgress.tasks) {
  for (const key of Object.keys(localProgress.tasks)) {
    if (localProgress.tasks[key]) {
      merged.tasks[key] = true;  // local 为 true 则覆盖
    }
  }
}
```

这个逻辑在"local 为 true 覆盖 server"场景下是正确的。但有一个隐含问题：如果 server 的 `onboarding_progress` 中有一个 local 没有的顶层字段（如 `writeGuideSeen`），它会被保留在 merged 中——这是正确的。但如果 local 有而 server 没有的字段，也会通过 `merged = { ...serverProgress }` 被丢失——不对，`localProgress` 的 `tasks` 是单独遍历合并的，但顶层字段如 `conceptGuideSeen`、`tourCompleted`、`welcomeSeen` 只在 local 为 true 时才合并：

```javascript
if (localProgress.conceptGuideSeen) merged.conceptGuideSeen = true;
if (localProgress.tourCompleted) merged.tourCompleted = true;
if (localProgress.welcomeSeen) merged.welcomeSeen = true;
```

这意味着 `writeGuideSeen` 没有被合并——如果 server 没有 `writeGuideSeen` 但 local 有，`getProgress()` 返回的 merged 中不会有 `writeGuideSeen`。

**影响**：`decideOnboarding()` 场景 4b 中单独处理了 `writeGuideSeen` 的合并（第 194-195 行 `const writeGuideSeen = progress.writeGuideSeen || localProgress.writeGuideSeen`），所以场景 4b 不受影响。但其他地方调用 `getProgress()` 时可能拿到缺少 `writeGuideSeen` 的进度对象。

**修复方案**：在合并顶层字段时添加 `writeGuideSeen`：

```javascript
if (localProgress.conceptGuideSeen) merged.conceptGuideSeen = true;
if (localProgress.tourCompleted) merged.tourCompleted = true;
if (localProgress.welcomeSeen) merged.welcomeSeen = true;
if (localProgress.writeGuideSeen) merged.writeGuideSeen = true;
```

---

### P2-22：`tour.js` `shouldShowTour` 重复请求 `/api/auth/me`

**文件**：`tour.js` `shouldShowTour()` 第 817-843 行 + `onboarding-manager.js` `fetchUserState()` 第 116-127 行

**问题**：`checkAndStartTour` 在 `?tour=` 路径下不被调用（`init()` 第 33-39 行直接 `checkAndStartTour`）。但在非 `?tour=` 路径下，如果 `page === 'index'`，`shouldShowTour` 会请求 `/api/auth/me`——而 `fetchUserState` 已经请求过同一个 API。这是重复请求。

**实际情况**：`init()` 在非 `?tour=` 路径下先调用 `fetchUserState()`（第 68 行），再调用 `decideOnboarding()`（第 73 行）。`decideOnboarding()` 场景 1 检查 `!has_seen_tour`。而 `checkAndStartTour` 只在 `?tour=` 路径下被调用，此时 `shouldShowTour` 的 `page === 'index'` 分支不会被触发——因为 `checkAndStartTour` 在 `?tour=` 存在时直接走 `startTour` 分支（第 791-802 行）。

但 `shouldShowTour` 的 `page === 'index'` 分支（第 806-811 行）在 `!hasTourParam` 时才执行。这种情况是：用户直接访问 index 页（无 `?tour=`），`checkAndStartTour` 被调用——但 `init()` 中 `!hasTourParam` 时不会调用 `checkAndStartTour`，而是调用 `decideOnboarding`。所以 `shouldShowTour` 实际上是死代码？

不——`checkAndStartTour` 在 `init()` 第 38 行被调用：`window.storyTreeTour.checkAndStartTour(pageName)`，这在 `hasTourParam` 为 true 时执行。`checkAndStartTour` 内部 `if (hasTourParam)` 为 true 时走 `startTour` 分支并 return。所以 `shouldShowTour` 确实只在 `!hasTourParam && page === 'index'` 时执行——但这种情况在 `init()` 中不会到达 `checkAndStartTour`。

**结论**：`shouldShowTour` 是死代码（在当前 `init()` 逻辑下永远不会被调用）。

**修复方案**：删除 `shouldShowTour` 方法和 `checkAndStartTour` 中的 `page === 'index'` 分支。

---

### P2-23：`tour.js` `markStepProgress` 手动更新 userState 缓存，与 `syncProgress` 逻辑重复

**文件**：`tour.js` `markStepProgress()` 第 681-725 行

**问题**：`markStepProgress` 在第 702-716 行手动更新 `st_user_state` 缓存，这与 `syncProgress` 中第 632-635 行的逻辑重复。虽然 `markStepProgress` 调用了 `syncProgress`（第 699 行），但 `syncProgress` 只更新 `this.userState.onboarding_progress = progress`，而 `markStepProgress` 还需要更新 `userState.onboarding_progress.tasks[taskKey]`。

实际上 `syncProgress` 中 `this.userState.onboarding_progress = progress` 已经包含了 `tasks[taskKey]`，因为 `progress` 是完整的进度对象。所以 `markStepProgress` 第 702-716 行的手动更新是冗余的。

**影响**：冗余代码，维护成本。

**修复方案**：删除 `markStepProgress` 中第 702-716 行的手动 userState 更新，依赖 `syncProgress` 的自动更新。

---

### P2-24：`tour.js` `markTourComplete` 手动更新 userState 缓存，与 `syncProgress` 逻辑重复

**文件**：`tour.js` `markTourComplete()` 第 766-776 行

**问题**：与 P2-23 类似，`markTourComplete` 在第 766-776 行手动更新 `st_user_state` 缓存，但 `syncProgress`（第 763 行调用）已经更新了 `this.userState`。手动更新还额外设置了 `has_seen_tour = true` 和 `_ts`，但 `syncProgress` 不会设置这两个字段。

**影响**：部分冗余，但 `has_seen_tour = true` 的手动更新是必要的（`syncProgress` 不负责设置 `has_seen_tour`）。`onboarding_progress` 的更新是冗余的。

**修复方案**：保留 `has_seen_tour = true` 和 `_ts` 的设置，删除 `onboarding_progress` 的手动赋值（已由 `syncProgress` 处理）。

---

### P2-25：`decideOnboarding` 场景 4 的进度来源不使用 `getProgress()`

**文件**：`onboarding-manager.js` `decideOnboarding()` 第 166 行

**问题**：`decideOnboarding` 使用 `const progress = onboarding_progress || this.progressCache` 获取进度，而不是 `getProgress()`。`getProgress()` 会合并 server 和 local 的 tasks（取并集），而当前方式在 `onboarding_progress` 存在时直接使用 server 数据，忽略 local 的增量更新。

场景 4b（第 194-195 行）单独处理了 `writeGuideSeen` 的合并，但场景 4（第 182-183 行 `!tasks.completedTour`）没有合并——如果 server 的 `completedTour` 为 false 但 local 已标记为 true（页面跳转时 `markStepProgress` 先写 local 再异步同步 server），场景 4 会错误触发。

**修复方案**：在 `decideOnboarding` 开头使用 `getProgress()` 替代直接解构：

```javascript
decideOnboarding() {
  const progress = this.getProgress();
  const has_seen_tour = this.userState.has_seen_tour;
  // ... 后续使用 progress 而非 onboarding_progress
}
```

---

### P2-26：`concept-guide.js` `_updateContent` 的 HTML 解析正则可能失败

**文件**：`concept-guide.js` `_updateContent()` 第 353-365 行

**问题**：`_updateContent` 使用正则 `/<div class="st-concept-modal">([\s\S]*)<\/div>\s*$/` 从 `_buildHTML()` 中提取 modal 内部 HTML。如果 `_buildHTML` 的结构变化（如添加新属性或嵌套 div），正则可能匹配失败，fallback 到 `_buildModalInner()`。

```javascript
modal.innerHTML = this._buildHTML().match(/<div class="st-concept-modal">([\s\S]*)<\/div>\s*$/)?.[1]
  || this._buildModalInner();
```

**影响**：正则匹配失败时 fallback 到 `_buildModalInner()`，功能不受影响，但代码脆弱。

**修复方案**：直接使用 `_buildModalInner()`，删除正则解析：

```javascript
modal.innerHTML = this._buildModalInner();
```

---

### P2-27：`page-guide-bridge.js` `showHighlight` 的 `onDestroyed` 在点击"跳过引导"时也会触发

**文件**：`page-guide-bridge.js` 第 98-102 行

**问题**：`showHighlight` 创建的 Driver.js 实例的 `onDestroyed` 回调会在任何销毁情况下触发——包括用户点击 overlay 关闭、按 ESC、或通过其他方式销毁。`onDestroyed` 中调用 `updateProgress(config.taskKey)`，如果 `taskKey` 不为 null，即使用户只是快速关闭了引导也会标记任务完成。

**影响**：用户在 discover 页快速关闭高亮引导，`browsedDiscover` 仍被标记为 true。

**修复方案**：区分"完成"和"关闭"——只有用户点击了下一步/完成按钮才标记任务。Driver.js 的 `onDestroyed` 不区分关闭原因，需要通过自定义按钮或标志位来实现。

---

### ~~P2-28：`welcome-modal.js` 点击遮罩关闭和 ESC 关闭不标记 `markTourSeen`~~

> **合并说明**：本条已合并入 P1-7。欢迎弹窗"跳过"按钮（原 P1-7）、点击遮罩关闭、ESC 关闭三个路径共享同一根因——不调用 `markTourSeen()`。统一在 P1-7 中描述和修复。

---

### P2-29：`onboarding-manager.js` `showNavHelpButton` 不处理 DOM 不存在的情况

**文件**：`onboarding-manager.js` 第 278-298 行

**问题**：`showNavHelpButton` 在 `navActions` 为 null 时直接 return，不重试。但某些页面可能是动态加载导航栏的，`init()` 调用时导航栏可能还未渲染。

**影响**：导航栏动态加载的页面不会显示帮助按钮。

**修复方案**：添加重试逻辑或使用 MutationObserver 监听导航栏出现。

---

### P2-30：`tour.js` 所有 step generator（除 `getWriteSteps`）无移动端适配

**文件**：`tour.js` 各 step generator 方法

**问题**：只有 `getWriteSteps()` 有移动端检测（`window.innerWidth <= 768` 时跳过侧边栏步骤）。其他 5 个方法（`getIndexSteps`、`getDiscoverSteps`、`getCreateAiSteps`、`getMyStoriesSteps`）在移动端会指向可能不存在或布局不同的元素。

**影响**：移动端引导可能指向不可见元素，`_waitForElement` 重试 5 次后放弃，引导静默失败。

**修复方案**：为每个 step generator 添加移动端检测，跳过不适用的步骤或使用替代选择器。

---

### P2-31：`tour.js` `getDiscoverSteps` 的 `.slice(tourStep)` 在跨页面续接时可能丢失步骤

**文件**：`tour.js` `getDiscoverSteps()` 第 187 行

**问题**：`getDiscoverSteps` 使用 `.slice(tourStep)` 裁剪步骤，`tourStep` 来自 URL 参数 `?tour=N`。如果 `N` 大于步骤总数，`slice` 返回空数组，`startTour` 中 `!steps || steps.length === 0` 判断为 true，打印 warning 后 `clearTourParam` return，引导流程断裂。

**影响**：跨页面续接时如果 tour step 参数错误，引导静默中断。

**修复方案**：添加边界检查，`tourStep >= steps.length` 时从头开始或跳到下一页面。

---

### P2-32：`concept-guide.js` `hide()` 中 `this.isVisible = false` 在 `setTimeout` 之前设置，可能导致快速重入

**文件**：`concept-guide.js` 第 57-73 行

**问题**：`hide()` 先设置 `this.isVisible = false`，然后通过 `setTimeout` 延迟 300ms 移除 DOM。在这 300ms 内，如果 `show()` 被调用，`isVisible` 为 false 会通过检查，创建新的 overlay，但旧 overlay 还在 DOM 中（300ms 后才移除），可能出现两个 overlay 同时存在。

**修复方案**：在 `setTimeout` 回调中才设置 `this.isVisible = false`，或者先移除 DOM 再设置标志。

---

### P2-33：`page-guide-bridge.js` `waitAndTrigger` 的 `clearGuideParam` 在引导显示前就清除 URL 参数

**文件**：`page-guide-bridge.js` 第 164 行

**问题**：`waitAndTrigger` 在开始等待元素时就调用 `clearGuideParam()` 清除 URL 中的 `?guide=` 参数。如果后续等待元素超时（20 次尝试后放弃），URL 参数已被清除，用户刷新页面不会再触发引导，但引导实际从未显示过。

**修复方案**：在引导成功显示后再清除 URL 参数，或在超时时提供 fallback 提示。

---

### P2-34：`decideOnboarding()` 场景 3 未检查 `has_seen_tour`，老用户访问 story 页仍看到概念引导

**文件**：`onboarding-manager.js` `decideOnboarding()` 第 216-228 行

**问题**：场景 3（story 页概念引导）的触发条件是 `currentPage === 'story' && !progress.conceptGuideSeen`，但没有检查 `has_seen_tour`。该场景位于 `if (!has_seen_tour)` 代码块之外（第 160 行 `if (!has_seen_tour)` 在第 179 行 `return` 结束），意味着即使老用户已完成 tour（`has_seen_tour = true`），只要 `conceptGuideSeen` 为 false，访问 story 页仍会弹出概念引导。

```javascript
// 第 160-179 行：!has_seen_tour 分支（场景 1、4、4b、2）
if (!has_seen_tour) {
  // 场景 1、4、4b、2 ...
  return;
}

// 第 216-228 行：场景 3（在 !has_seen_tour 块之外）
if (this.currentPage === 'story') {
  if (!progress || !progress.conceptGuideSeen) {
    setTimeout(() => {
      if (window.conceptGuide) {
        this._patchConceptGuideHideForStory();
        window.conceptGuide.show();
      }
    }, 1500);
  }
  // ← 不检查 has_seen_tour
}
```

**影响**：已熟悉产品的老用户（已完成 tour）访问 story 页时，仍会看到概念引导弹窗，体验不佳。

**修复方案**：在场景 3 中添加 `has_seen_tour` 检查，或者将场景 3 移入 `if (!has_seen_tour)` 块内：

```javascript
if (this.currentPage === 'story') {
  if (!has_seen_tour && (!progress || !progress.conceptGuideSeen)) {
    setTimeout(() => {
      if (window.conceptGuide) {
        this._patchConceptGuideHideForStory();
        window.conceptGuide.show();
      }
    }, 1500);
    return;
  }
}
```

或者，如果希望老用户也能看到概念引导（只是不想反复弹出），应依赖 `conceptGuideSeen` 做持久化标记——但需确保 `conceptGuideSeen` 在用户首次看完概念引导后被正确设置（参见 P1-12）。

---

## P3：低优先级问题（代码整洁、优化）

### P3-34：`onboarding-manager.js` `checkAndCelebrate` 是 `tryCelebrate` 的简单包装，可删除

**文件**：`onboarding-manager.js` 第 830-832 行

**问题**：`checkAndCelebrate` 只是调用 `this.tryCelebrate(null, { deferred: false })`，是 `tryCelebrate` 的简单包装。

```javascript
checkAndCelebrate() {
  this.tryCelebrate(null, { deferred: false });
}
```

**修复方案**：将 `decideOnboarding()` 第 236 行的 `this.checkAndCelebrate()` 改为 `this.tryCelebrate(null, { deferred: false })`，删除 `checkAndCelebrate` 方法。

---

### P3-35：`tour.js` `getCreateSteps` 中 `.slice(tourStep)` 与 `getDiscoverSteps` 不一致

**文件**：`tour.js` `getCreateSteps()` 第 252 行

**问题**：`getCreateSteps` 使用 `.slice(tourStep)`，但 `getCreateAiSteps` 没有使用 `.slice()`——create-ai 页的 tour 不支持跨页面续接。如果未来需要从 discover 页跳转到 create-ai 页续接 tour，`getCreateAiSteps` 不支持 `?tour=N` 参数。

**注意**：`getCreateSteps` 是死代码（P1-14），但如果将来需要续接 create-ai 页的 tour，需要给 `getCreateAiSteps` 添加 `.slice(tourStep)` 支持。

---

### P3-36：`welcome-modal.js` `_getDefaultProgress` 与 `onboarding-manager.js` `getDefaultProgress` 重复

**文件**：`welcome-modal.js` 第 266-279 行 + `onboarding-manager.js` 第 585-599 行

**问题**：两处定义了相同的默认进度对象，但字段略有不同——`onboarding-manager.js` 版本多了 `pagesGuided: []` 和 `lastUpdated` 字段。

**修复方案**：`welcome-modal.js` 调用 `onboardingManager.getDefaultProgress()` 而非自己定义。

---

### P3-37：`onboarding-manager.js` `getLocalProgress` 不处理 JSON 解析后的类型校验

**文件**：`onboarding-manager.js` 第 605-612 行

**问题**：`getLocalProgress` 使用 `try/catch` 包裹 `JSON.parse`，但不验证解析结果是否为对象。如果 `localStorage` 中存储了非对象值（如字符串 `"true"`），`JSON.parse` 返回 `true`（布尔值），后续代码 `progress.tasks` 会报错。

**修复方案**：添加类型检查：

```javascript
getLocalProgress() {
  try {
    const data = localStorage.getItem('st_onboarding_progress');
    const parsed = data ? JSON.parse(data) : null;
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch (e) {
    return null;
  }
}
```

---

### P3-38：`page-guide-bridge.js` `showNextStepToast` 的 toast 会在 8 秒后自动消失，但"下一步"按钮链接可能来不及点击

**文件**：`page-guide-bridge.js` 第 54-82 行

**问题**：toast 在 8 秒后自动消失，如果用户阅读较慢或正在操作其他内容，可能错过"下一步"链接。

**修复方案**：延长到 15 秒，或在用户 hover 时暂停自动消失计时器。

---

### P3-39：`tour.js` `navigateToNextPage` 的页面映射缺少 `story` 页

**文件**：`tour.js` `navigateToNextPage()` 第 533-551 行

**问题**：`pageUrls` 映射只有 `discover`、`create`、`write`、`my-stories`，没有 `story`。如果未来需要从其他页面跳转到 story 页续接 tour，需要添加映射。

**修复方案**：添加 `story: '/story.html'` 到映射中（注意 story 页需要 `id` 参数）。

---

### P3-40：`onboarding-manager.js` `enhanceEmptyStates` 延迟 2 秒执行，可能被 `decideOnboarding` 中的其他定时器干扰

**文件**：`onboarding-manager.js` 第 304-309 行

**问题**：`enhanceEmptyStates` 延迟 2 秒执行，而场景 1 的欢迎弹窗延迟 800ms、场景 4 的 tour 延迟 1500ms、场景 4b 的 tour 延迟 2000ms。空状态增强可能与 tour 或欢迎弹窗同时触发。

**影响**：不影响功能，但可能导致视觉闪烁。

**修复方案**：在确定不需要触发其他引导后再执行空状态增强，或延长延迟到 3 秒。

---

### P3-41：`concept-guide.js` ESC 关闭不区分当前是否在概念引导中

**文件**：`concept-guide.js` 第 325-328 行

**问题**：`_escHandler` 监听 `keydown` 事件，但不检查 `e.target` 是否在概念引导内。如果页面上有其他模态框或输入框，按 ESC 会同时触发概念引导的关闭。

**修复方案**：在 `hide()` 中检查 `this.isVisible`（已有第 58 行检查），但 ESC handler 在 `hide` 之前就被触发。可以添加 `e.stopPropagation()` 或在 handler 中检查 `this.isVisible`。

---

### P3-42：`story-concept-bridge.js` 的 `markConceptGuideSeen` 与 `onboarding-manager.js` 的 `markConceptGuideSeen` 实现不一致

**文件**：`story-concept-bridge.js` 第 165-191 行 + `onboarding-manager.js` 第 482-495 行

**问题**：两个 `markConceptGuideSeen` 做相同的事情，但实现不同：

| 差异点 | `story-concept-bridge.js` | `onboarding-manager.js` |
|---|---|---|
| 进度来源 | 直接读 localStorage | `this.getProgress()`（合并 server + local） |
| tasks 初始化 | `if (!progress.tasks) progress.tasks = {}` | `if (!progress.tasks) progress.tasks = this.getDefaultProgress().tasks` |
| 庆祝检查 | `tryCelebrate(progress, { deferred: false })` | `tryCelebrate(progress, { deferred: false })` |

**影响**：`story-concept-bridge.js` 版本直接读 localStorage，不合并 server 数据，可能丢失其他设备上的进度。`onboarding-manager.js` 版本使用 `getProgress()` 更完整。

**修复方案**：`story-concept-bridge.js` 的 `markConceptGuideSeen` 委托给 `onboardingManager.markConceptGuideSeen()`，删除自己的实现。

---

### P3-10：欢迎弹窗任务清单 `createdStory` 的 href `?guide=create-ai` 在 `guideConfigs` 中不存在

> **来源**：原 P1-8 降级。`?guide=create-ai` 流程可由 `onboarding-manager` scenario 4（tour 路径）接管，且 create-ai 页有完整 tour 步骤定义，影响有限。

**文件**：`welcome-modal.js` 第 137 行 + `page-guide-bridge.js` 第 118-155 行

**问题**：欢迎弹窗任务清单中"创建第一个故事"的 href 是 `/create-ai.html?guide=create-ai`，但 `page-guide-bridge.js` 的 `guideConfigs` 只定义了 `discover`、`create`、`publish` 三个 key，没有 `create-ai`。

```javascript
// welcome-modal.js 第 137 行
href: '/create-ai.html?guide=create-ai'

// page-guide-bridge.js 第 118-155 行
const guideConfigs = {
  discover: { ... },
  create: { ... },
  publish: { ... }
  // ← 没有 create-ai
};
```

**影响**：用户点击"创建第一个故事"跳转到 `/create-ai.html?guide=create-ai` 后，`page-guide-bridge.js` 的 `waitAndTrigger()` 函数查找 `guideConfigs['create-ai']` 得到 `undefined`，直接 `return`，不显示任何引导。但 `onboarding-manager.js` 的 `decideOnboarding()` 场景 4 可以接管该流程（检测 `?guide=create-ai` 并启动 tour），所以用户仍能看到引导。`page-guide-bridge.js` 层面缺少显式配置，维护者难以理解完整路由。

**修复方案**：两个选择：
- **方案 A**：在 `guideConfigs` 中添加 `create-ai` 配置（可为空处理函数），并注释说明由 `onboarding-manager` 接管
- **方案 B**：将 `welcome-modal.js` 中的 href 改为 `/create-ai.html?tour=0`，直接启动 create-ai 页的 tour（推荐，因为 create-ai 页已有完整的 tour 步骤定义）

---

## 问题统计

| 优先级 | 数量 | 编号 |
|---|---|---|
| P0 | 2 | P0-2, P0-4 |
| P1 | 14 | P1-5 ~ P1-19 |
| P2 | 17 | P2-18 ~ P2-27, P2-29 ~ P2-34 |
| P3 | 10 | P3-10, P3-34 ~ P3-42 |
| **合计** | **43** | |

**与原报告的差异**：
- 删除 P0-3（误报，代码已正确处理）
- P0-1 降级为 P1-18（场景 3 缺少 return，保留原描述）
- P1-8 降级为 P3-10（guideConfigs 缺少 create-ai，影响有限）
- P2-28 合并入 P1-7（三个关闭路径同一根因）
- 新增 P1-19（双重 has_seen_tour 更新路径）
- 新增 P2-34（场景 3 不检查 has_seen_tour）

---

## 问题分类

### 按问题类型分类

| 类型 | 数量 | 编号 |
|---|---|---|
| 控制流缺陷（缺 return、死分支） | 3 | P0-4, P1-5, P1-18 |
| 错误处理缺陷（API 失败、fallback 错误） | 1 | P0-2 |
| 状态不一致（用户切换、缓存过期） | 2 | P2-21, P2-25 |
| 双重更新路径/竞态 | 2 | P1-9, P1-19 |
| 重复代码 | 5 | P1-9, P1-11, P2-19, P2-20, P2-23, P2-24 |
| 死代码 | 4 | P1-14, P1-17, P2-22, P3-34 |
| 用户引导体验缺陷 | 7 | P0-4, P1-7, P1-10, P1-12, P1-15, P3-10, P2-34 |
| 移动端适配 | 1 | P2-30 |
| 逻辑错误（条件判断、边界） | 5 | P1-13, P1-16, P2-27, P2-31, P2-32 |
| 代码健壮性 | 5 | P2-26, P2-29, P2-33, P3-37, P3-41 |
| 数据合并缺陷 | 2 | P2-21, P2-25 |
| 其他 | 4 | P2-18, P3-35, P3-36, P3-38, P3-39, P3-40, P3-42 |

### 按文件分类

| 文件 | 问题数 | 主要问题 |
|---|---|---|
| `onboarding-manager.js` | 13 | P0-2, P1-6, P1-10, P1-17, P1-18, P1-19, P2-21, P2-25, P2-29, P2-34, P3-34, P3-37, P3-40 |
| `tour.js` | 9 | P0-4, P1-5, P1-14, P1-15, P1-16, P1-19, P2-22, P2-23, P2-24, P2-30, P2-31, P3-35, P3-39 |
| `welcome-modal.js` | 3 | P1-7, P3-10, P3-36 |
| `page-guide-bridge.js` | 4 | P1-13, P2-27, P2-33, P3-38 |
| `story-concept-bridge.js` | 3 | P1-9, P1-11, P3-42 |
| `concept-guide.js` | 4 | P1-12, P2-26, P2-32, P3-41 |
| 跨文件 | 2 | P2-18, P2-19 |

---

## 修复优先级建议

### 第一批：P0 + P1-5（修复回归和核心功能）
1. P0-2：修复 API 失败时的 fallback 逻辑
2. P0-4：create-ai tour 完成后跳转 write 页
3. P1-5：`markTourComplete` 仅在 write 页设置 `writeGuideSeen`
4. P1-15：`getWriteSteps` 最后一步始终设置 `writeGuideSeen`
5. P1-7：欢迎弹窗所有关闭路径调用 `markTourSeen`（含原 P2-28 的遮罩和 ESC 路径）

### 第二批：P1 其余（用户体验修复）
6. P1-6：`decideOnboarding` 使用 `getProgressWithFixup`
7. P1-9：统一 `conceptGuide.hide` patch 逻辑
8. P1-10：帮助按钮 allDone 时展示帮助内容
9. P1-11：统一 `markConceptGuideSeen` 实现
10. P1-12：概念引导仅在看完后标记
11. P1-13：添加 `fired` 标志
12. P1-14：删除死代码
13. P1-16：跳过按钮添加存在性检查
14. P1-17：删除 `syncProgressToServer`
15. P1-18：场景 3 添加 `return`（原 P0-1 降级）
16. P1-19：统一 `has_seen_tour` 更新路径，添加防重机制

### 第三批：P2（代码质量和边缘场景）
17-33. 按需修复

### 第四批：P3（代码整洁）
34-43. 按需修复

---

## 与第一轮计划文档的关系

第一轮计划文档中的 18 个修复项已全部实现。本轮发现的 43 个问题中：

- **2 个 P0** 是第一轮未发现的严重问题（P0-3 经验证为误报已删除）
- **P1-5** 是第一轮修复 A1 时引入的回归
- **P1-18**（原 P0-1）是场景 3 缺少 return 的控制流缺陷，降级为 P1
- **P1-19** 是跨文件双重 `has_seen_tour` 更新路径，第一轮未发现
- **P2-34** 是场景 3 不检查 `has_seen_tour` 的边界条件，第一轮未发现
- **其余** 是第一轮分析方法（线索追踪）的盲区

建议将本文档作为第一轮计划文档的补充，在完成第一轮的 18 项修复后，按本文档的优先级顺序继续修复。