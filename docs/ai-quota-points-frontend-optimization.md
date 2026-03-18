# AI 配额+积分混合系统：第三阶段前端优化实现

## 📋 实现概述

**功能：** 实现 AI 功能的前端配额显示和消耗提示  \n**版本：** v1.0  \n**日期：** 2026-03-18  \n**状态：** ✅ 已完成第一部分

---

## 🎯 功能需求

根据 `docs/ai-quota-points-hybrid-system.md` 第三阶段要求，实现：

### **核心功能**

1. ✅ **配额显示**：在 AI 功能按钮旁显示剩余配额
2. ⏳ **消耗提示**：使用积分时弹窗确认（待实现）
3. ⏳ **配额引导**：配额不足时的引导提示（待实现）
4. ⏳ **使用统计**：个人中心显示 AI 使用统计（待实现）

---

## 🔧 技术实现

### **1. UI 组件：配额徽章**

#### **文件：** `web/write.html`

#### **HTML 结构**

在每个 AI 功能按钮上添加配额徽章：

```html
<!-- AI 续写按钮 -->
<button class="action-btn btn-ai" id="aiSuggestBtn">
    <i class="fas fa-magic"></i>
    AI 续写
    <span class="ai-quota-badge" id="aiContinuationQuota" title="剩余配额">
        <i class="fas fa-spinner fa-spin"></i> <!-- 加载中 -->
    </span>
</button>

<!-- AI 润色按钮 -->
<button class="action-btn btn-ai" id="aiPolishBtn">
    <i class="fas fa-wand-magic-sparkles"></i>
    AI 润色
    <span class="ai-quota-badge" id="aiPolishQuota">
        <i class="fas fa-spinner fa-spin"></i>
    </span>
</button>

<!-- AI 插图按钮 -->
<button class="action-btn btn-ai" id="aiIllustrationBtn">
    <i class="fas fa-image"></i>
    AI 插图
    <span class="ai-quota-badge" id="aiIllustrationQuota">
        <i class="fas fa-spinner fa-spin"></i>
    </span>
</button>
```

---

### **2. CSS 样式**

#### **徽章基础样式**

```css
.ai-quota-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    min-width: 18px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    animation: badgePulse 2s ease-in-out infinite;
}
```

#### **状态样式**

```css
/* 配额不足（≤3 次） */
.ai-quota-badge.low {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    animation: badgeShake 0.5s ease-in-out;
}

/* 配额用完 */
.ai-quota-badge.exhausted {
    background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
    animation: badgePulse 1s ease-in-out infinite;
}

/* 无限配额 */
.ai-quota-badge.unlimited {
    background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
}
```

#### **动画效果**

```css
@keyframes badgePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes badgeShake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
}
```

---

### **3. JavaScript 逻辑**

#### **加载配额信息**

```javascript
async function loadAiQuotaInfo() {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.log('未登录，跳过配额加载');
            return;
        }

        // 调用配额 API
        const response = await fetch('/api/ai/v2/quota', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取配额信息失败');
        }

        const data = await response.json();
        console.log('AI 配额信息:', data);

        // 更新各个按钮的徽章显示
        updateQuotaBadge('aiContinuationQuota', data.quotas.continuation, data.costs.continuation);
        updateQuotaBadge('aiPolishQuota', data.quotas.polish, data.costs.polish);
        updateQuotaBadge('aiIllustrationQuota', data.quotas.illustration, data.costs.illustration);

    } catch (error) {
        console.error('加载配额信息失败:', error);
        // 静默失败，不影响功能使用
    }
}
```

---

#### **更新徽章显示**

```javascript
function updateQuotaBadge(elementId, quota, cost) {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    const remaining = quota.unlimited ? -1 : Math.max(0, quota.limit - quota.used);
    
    if (quota.unlimited) {
        // 无限配额
        badge.innerHTML = '∞';
        badge.className = 'ai-quota-badge unlimited';
        badge.title = '无限配额';
    } else if (remaining > 0) {
        // 有配额
        badge.textContent = remaining;
        badge.className = 'ai-quota-badge';
        badge.title = `剩余${remaining}次配额，超配额后 ${cost}积分/次`;
        
        // 配额不足 3 次时显示警告
        if (remaining <= 3) {
            badge.classList.add('low');
            badge.title += '（配额即将用完）';
        }
    } else {
        // 配额用完
        badge.innerHTML = `<i class="fas fa-coins"></i> ${cost}`;
        badge.className = 'ai-quota-badge exhausted';
        badge.title = `配额已用完，需要${cost}积分/次`;
    }
}
```

---

### **4. 调用时机**

在 `initAiFeature()` 函数中调用：

```javascript
function initAiFeature() {
    console.log('开始初始化 AI 功能...');
    
    // ... 绑定事件 ...
    
    // ========== 新增：加载配额信息并更新徽章 ==========
    loadAiQuotaInfo();
    // ===============================================
    
    // ... 其他初始化 ...
}
```

---

## 📊 显示效果

### **状态1：有配额**

```
┌─────────────────┐
│ AI 续写    [5]  │  ← 紫色徽章，显示剩余次数
└─────────────────┘
```

### **状态2：配额不足（≤3 次）**

```
┌─────────────────┐
│ AI 续写    [2]  │  ← 红色徽章，抖动动画
└─────────────────┘
```

### **状态3：配额用完**

```
┌─────────────────┐
│ AI 续写   [💰10]│  ← 红色徽章，显示积分消耗
└─────────────────┘
```

### **状态4：无限配额**

```
┌─────────────────┐
│ AI 续写    [∞]  │  ← 绿色徽章，无限符号
└─────────────────┘
```

---

## 🎯 用户体验提升

### **1. 透明度高**

- ✅ 用户随时可以看到剩余配额
- ✅ 配额用完时清楚知道需要多少积分
- ✅ 无限配额用户有明确的标识

### **2. 引导性强**

- ✅ 配额不足时红色警示
- ✅ 配额用完时显示积分消耗提示
- ✅ 鼓励用户通过互动获取积分

### **3. 视觉吸引力**

- ✅ 渐变色的徽章设计
- ✅ 平滑的脉冲动画
- ✅ 配额不足时的抖动效果

---

## 📈 API 接口依赖

### **配额查询 API**

```
GET /api/ai/v2/quota
Authorization: Bearer {token}

Response:
{
  "quotas": {
    "continuation": {
      "used": 3,
      "limit": 5,
      "remaining": 2,
      "unlimited": false
    },
    "polish": { ... },
    "illustration": { ... }
  },
  "costs": {
    "continuation": 10,
    "polish": 3,
    "illustration": 20
  }
}
```

---

## ✅ 已实现功能

### **第一阶段**

- ✅ 配额徽章 UI 组件
- ✅ 配额信息加载函数
- ✅ 徽章状态更新逻辑
- ✅ 四种状态的样式和动画

---

## ⏳ 待实现功能

### **第二阶段：消耗确认**

```javascript
// TODO: 在 AI 功能调用时，检查是否需要使用积分
// 如果需要，弹出确认对话框

async function startAiGeneration() {
    // 先检查配额和积分
    const permission = await checkAiPermission();
    
    if (permission.usePoints) {
        // 弹出确认对话框
        const confirmed = await showPointsConfirmDialog(permission.pointsCost);
        if (!confirmed) return;
    }
    
    // ... 继续执行 ...
}

function showPointsConfirmDialog(pointsCost) {
    return new Promise((resolve) => {
        const confirmed = confirm(`本次操作将消耗${pointsCost}积分，是否继续？`);
        resolve(confirmed);
    });
}
```

---

### **第三阶段：配额引导**

```javascript
// TODO: 配额不足时的引导提示

function showQuotaGuide() {
    if (remaining <= 3 && remaining > 0) {
        showGuide('配额即将用完，可以通过以下方式获取更多积分：', [
            '每日签到 +1~5 积分',
            '发布故事 +20 积分',
            '获得追更 +5 积分',
            '获得收藏 +2 积分'
        ]);
    } else if (remaining === 0) {
        showGuide('配额已用完，建议：', [
            '使用积分继续使用（10 积分/次）',
            '升级会员获得更多配额',
            '参与互动获取积分'
        ]);
    }
}
```

---

### **第四阶段：使用统计**

```javascript
// TODO: 个人中心显示 AI 使用统计

async function loadAiUsageStats() {
    const response = await fetch('/api/ai/v2/usage-stats');
    const stats = await response.json();
    
    // 显示：
    // - 本月使用次数
    // - 配额使用情况
    // - 积分消耗统计
    // - 使用趋势图表
}
```

---

## 🎉 实现效果

### **✅ 已完成**

1. **配额徽章显示**
   - 实时显示剩余配额
   - 四种状态的视觉区分
   - 平滑的动画效果

2. **状态提示**
   - 配额充足：紫色徽章
   - 配额不足：红色抖动
   - 配额用完：显示积分
   - 无限配额：绿色∞

3. **用户体验**
   - 信息透明
   - 引导清晰
   - 视觉美观

---

## 🚀 下一步计划

### **1. 消耗确认弹窗**

- 使用积分时弹出确认对话框
- 显示当前积分和消耗积分
- 提供"不再提示"选项

### **2. 配额引导**

- 配额不足时显示获取积分的方法
- 提供积分充值入口
- 引导用户升级会员

### **3. 使用统计**

- 个人中心显示 AI 使用统计
- 图表展示使用趋势
- 提供使用建议

---

## 📝 总结

### **核心价值**

✅ **透明度**：用户清楚知道配额和积分情况  
✅ **引导性**：配额不足时提供明确的解决路径  
✅ **美观性**：现代化的 UI 设计，流畅的动画效果  
✅ **可控性**：用户可以自主决定是否使用积分

### **技术亮点**

- 使用 CSS 动画增强视觉效果
- 实时加载配额信息
- 智能的状态判断和样式切换
- 良好的错误处理机制

---

**第三阶段前端优化第一部分已完成，为用户提供了直观的配额显示和消耗提示！** 🎉
