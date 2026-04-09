# StoryTree 设计系统 v1.0

> 版本：v1.0 | 创建日期：2026-04-08 | 最后更新：2026-04-08
>
> StoryTree 平台的统一设计规范，包含视觉、交互、组件等完整设计标准。

---

## 目录

1. [设计原则](#一设计原则)
2. [色彩系统](#二色彩系统)
3. [字体系统](#三字体系统)
4. [间距系统](#四间距系统)
5. [组件规范](#五组件规范)
6. [布局规范](#六布局规范)
7. [动画规范](#七动画规范)
8. [响应式规范](#八响应式规范)
9. [无障碍规范](#九无障碍规范)
10. [实施指南](#十实施指南)

---

## 一、设计原则

### 1.1 核心设计理念

**创意协作 · 沉浸阅读 · 温暖社区**

- **清晰易读**：阅读体验优先，降低视觉干扰
- **温暖友好**：圆润的设计语言，友好的色彩
- **创意表达**：支持多样化的内容展示
- **协作开放**：强调社区互动和共创

### 1.2 设计关键词

```
活泼 · 友好 · 创意 · 温暖 · 专业 · 沉浸
```

### 1.3 设计目标

| 目标 | 描述 | 衡量标准 |
|------|------|---------|
| 一致性 | 全平台统一的视觉体验 | 设计审计通过率 > 95% |
| 可用性 | 直观易用的交互设计 | 任务完成率 > 90% |
| 性能 | 流畅的动画和加载 | FCP < 1.5s, LCP < 2.5s |
| 包容 | 支持所有用户群体 | WCAG 2.1 AA 合规 |

---

## 二、色彩系统

### 2.1 品牌色

```css
:root {
  /* 主品牌色 - 创意靛蓝 */
  --st-primary-50: #EEF2FF;
  --st-primary-100: #E0E7FF;
  --st-primary-200: #C7D2FE;
  --st-primary-300: #A5B4FC;
  --st-primary-400: #818CF8;
  --st-primary-500: #6366F1;  /* 主色 */
  --st-primary-600: #4F46E5;
  --st-primary-700: #4338CA;
  --st-primary-800: #3730A3;
  --st-primary-900: #312E81;
}
```

**使用场景**：
- `--st-primary-500`：主要按钮、链接、品牌标识
- `--st-primary-100`：背景高亮、hover状态
- `--st-primary-600`：按钮hover、激活状态

### 2.2 功能色

```css
:root {
  /* 成功 - 生机绿 */
  --st-success-50: #F0FDF4;
  --st-success-100: #DCFCE7;
  --st-success-500: #22C55E;
  --st-success-600: #16A34A;
  --st-success-700: #15803D;
  
  /* 警告 - 活力橙 */
  --st-warning-50: #FFFBEB;
  --st-warning-100: #FEF3C7;
  --st-warning-500: #F59E0B;
  --st-warning-600: #D97706;
  --st-warning-700: #B45309;
  
  /* 错误 - 警示红 */
  --st-error-50: #FEF2F2;
  --st-error-100: #FEE2E2;
  --st-error-500: #EF4444;
  --st-error-600: #DC2626;
  --st-error-700: #B91C1C;
  
  /* 信息 - 智慧蓝 */
  --st-info-50: #EFF6FF;
  --st-info-100: #DBEAFE;
  --st-info-500: #3B82F6;
  --st-info-600: #2563EB;
  --st-info-700: #1D4ED8;
}
```

### 2.3 中性色

```css
:root {
  /* 灰色系 */
  --st-gray-50: #F9FAFB;   /* 背景色 */
  --st-gray-100: #F3F4F6; /* 卡片背景 */
  --st-gray-200: #E5E7EB; /* 边框 */
  --st-gray-300: #D1D5DB; /* 禁用边框 */
  --st-gray-400: #9CA3AF; /* 占位符 */
  --st-gray-500: #6B7280; /* 次要文字 */
  --st-gray-600: #4B5563; /* 正文 */
  --st-gray-700: #374151; /* 标题 */
  --st-gray-800: #1F2937; /* 深色标题 */
  --st-gray-900: #111827; /* 主要文字 */
}
```

### 2.4 背景色

```css
:root {
  --st-bg-primary: #FFFFFF;      /* 主背景 */
  --st-bg-secondary: #F9FAFB;  /* 次级背景 */
  --st-bg-tertiary: #F3F4F6;   /* 第三级背景 */
  --st-bg-elevated: #FFFFFF;   /* 浮层背景 */
  --st-bg-overlay: rgba(0, 0, 0, 0.5); /* 遮罩层 */
}
```

### 2.5 文字色

```css
:root {
  --st-text-primary: #111827;   /* 主要文字 */
  --st-text-secondary: #4B5563; /* 次要文字 */
  --st-text-tertiary: #9CA3AF; /* 辅助文字 */
  --st-text-disabled: #D1D5DB;  /* 禁用文字 */
  --st-text-inverse: #FFFFFF;   /* 反色文字 */
  --st-text-link: #6366F1;      /* 链接文字 */
}
```

### 2.6 渐变规范

```css
:root {
  /* 品牌渐变 */
  --st-gradient-brand: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  --st-gradient-brand-hover: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
  
  /* 背景渐变 */
  --st-gradient-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  /* 成功渐变 */
  --st-gradient-success: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
  
  /* 金色渐变（VIP/特殊标识） */
  --st-gradient-gold: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
}
```

---

## 三、字体系统

### 3.1 字体家族

```css
:root {
  --st-font-sans: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --st-font-display: 'Fredoka', var(--st-font-sans);
  --st-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

**字体说明**：
- **Fredoka**：用于标题、品牌展示，活泼友好
- **Nunito**：用于正文，清晰易读
- **系统字体栈**：确保中文显示效果

### 3.2 字体引入

```html
<!-- 在 HTML head 中引入 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### 3.3 字号规范

| 样式 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Display | 48px (3rem) | 700 | 1.1 | 英雄区大标题 |
| H1 | 36px (2.25rem) | 700 | 1.2 | 页面主标题 |
| H2 | 30px (1.875rem) | 600 | 1.3 | 区块标题 |
| H3 | 24px (1.5rem) | 600 | 1.4 | 卡片标题 |
| H4 | 20px (1.25rem) | 600 | 1.4 | 小标题 |
| H5 | 18px (1.125rem) | 600 | 1.5 | 列表标题 |
| H6 | 16px (1rem) | 600 | 1.5 | 标签 |
| Body Large | 18px (1.125rem) | 400 | 1.8 | 阅读正文 |
| Body | 16px (1rem) | 400 | 1.75 | 默认正文 |
| Body Small | 14px (0.875rem) | 400 | 1.6 | 辅助文字 |
| Caption | 12px (0.75rem) | 400 | 1.5 | 说明文字 |
| Overline | 12px (0.75rem) | 600 | 1.5 | 标签、徽章 |

### 3.4 响应式字体

```css
/* 使用 clamp 实现流畅的响应式字体 */
.text-display {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  line-height: 1.1;
}

.text-h1 {
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 700;
  line-height: 1.2;
}

.text-h2 {
  font-size: clamp(1.5rem, 3vw, 1.875rem);
  font-weight: 600;
  line-height: 1.3;
}
```

---

## 四、间距系统

### 4.1 基础间距

基于 8px 网格系统：

```css
:root {
  --st-space-0: 0;
  --st-space-1: 0.25rem;   /* 4px */
  --st-space-2: 0.5rem;    /* 8px */
  --st-space-3: 0.75rem;   /* 12px */
  --st-space-4: 1rem;      /* 16px */
  --st-space-5: 1.25rem;  /* 20px */
  --st-space-6: 1.5rem;    /* 24px */
  --st-space-8: 2rem;      /* 32px */
  --st-space-10: 2.5rem;   /* 40px */
  --st-space-12: 3rem;     /* 48px */
  --st-space-16: 4rem;     /* 64px */
  --st-space-20: 5rem;     /* 80px */
  --st-space-24: 6rem;     /* 96px */
}
```

### 4.2 组件间距

| 组件 | 内边距 | 外边距 | 说明 |
|------|--------|--------|------|
| 卡片 | 24px | 16px | 标准卡片 |
| 按钮 | 12px 24px | 8px | 标准按钮 |
| 输入框 | 12px 16px | 16px | 表单输入 |
| 列表项 | 16px | 0 | 列表内容 |
| 区块 | 64px | 0 | 页面区块 |

### 4.3 布局间距

```css
:root {
  /* 页面边距 */
  --st-page-padding-x: 1rem;      /* 移动端 */
  --st-page-padding-x-md: 1.5rem; /* 平板 */
  --st-page-padding-x-lg: 2rem;   /* 桌面 */
  
  /* 容器最大宽度 */
  --st-container-sm: 640px;
  --st-container-md: 768px;
  --st-container-lg: 1024px;
  --st-container-xl: 1200px;
  --st-container-2xl: 1400px;
}
```

---

## 五、组件规范

### 5.1 按钮

#### 主按钮

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--st-gradient-brand);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 12px -2px rgba(99, 102, 241, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

#### 次级按钮

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: white;
  color: var(--st-primary-600);
  font-size: 1rem;
  font-weight: 600;
  border: 2px solid var(--st-primary-200);
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--st-primary-50);
  border-color: var(--st-primary-400);
}
```

#### 文字按钮

```css
.btn-text {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  color: var(--st-primary-600);
  font-size: 1rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-text:hover {
  color: var(--st-primary-700);
  background: var(--st-primary-50);
  border-radius: var(--st-radius-md);
}
```

#### 按钮尺寸

| 尺寸 | 高度 | 内边距 | 字体 |
|------|------|--------|------|
| Small | 32px | 8px 16px | 14px |
| Medium | 40px | 12px 24px | 16px |
| Large | 48px | 16px 32px | 18px |

### 5.2 卡片

#### 标准卡片

```css
.card {
  background: white;
  border-radius: var(--st-radius-xl);
  padding: var(--st-space-6);
  box-shadow: var(--st-shadow-md);
  transition: all 0.3s ease;
  border: 1px solid var(--st-gray-100);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--st-shadow-xl);
}

.card-header {
  margin-bottom: var(--st-space-4);
}

.card-title {
  font-size: var(--st-text-h4);
  font-weight: 600;
  color: var(--st-text-primary);
}

.card-body {
  color: var(--st-text-secondary);
}

.card-footer {
  margin-top: var(--st-space-4);
  padding-top: var(--st-space-4);
  border-top: 1px solid var(--st-gray-100);
}
```

#### 故事卡片（特殊组件）

```css
.story-card {
  background: white;
  border-radius: var(--st-radius-xl);
  overflow: hidden;
  box-shadow: var(--st-shadow-md);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.story-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: var(--st-shadow-xl);
}

.story-card-cover {
  height: 200px;
  background: var(--st-gradient-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 3rem;
  position: relative;
}

.story-card-content {
  padding: var(--st-space-5);
}

.story-card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--st-space-2);
  color: var(--st-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-card-desc {
  font-size: 0.875rem;
  color: var(--st-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: var(--st-space-3);
}

.story-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--st-space-3);
  border-top: 1px solid var(--st-gray-100);
  font-size: 0.875rem;
  color: var(--st-text-tertiary);
}
```

### 5.3 输入框

```css
.input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid var(--st-gray-200);
  border-radius: var(--st-radius-lg);
  font-size: 1rem;
  font-family: var(--st-font-sans);
  transition: all 0.2s ease;
  background: white;
}

.input:focus {
  outline: none;
  border-color: var(--st-primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input::placeholder {
  color: var(--st-gray-400);
}

.input:disabled {
  background: var(--st-gray-100);
  cursor: not-allowed;
}

.input-error {
  border-color: var(--st-error-500);
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-group .input {
  padding-left: 2.5rem;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--st-gray-400);
  pointer-events: none;
}
```

### 5.4 徽章

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--st-radius-full);
  white-space: nowrap;
}

.badge-primary {
  background: var(--st-primary-100);
  color: var(--st-primary-700);
}

.badge-success {
  background: var(--st-success-100);
  color: var(--st-success-700);
}

.badge-warning {
  background: var(--st-warning-100);
  color: var(--st-warning-700);
}

.badge-error {
  background: var(--st-error-100);
  color: var(--st-error-700);
}

.badge-gold {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: white;
}
```

### 5.5 Toast 通知

```css
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: white;
  border-radius: var(--st-radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 9999;
}

.toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.toast-success {
  border-left: 4px solid var(--st-success-500);
}

.toast-error {
  border-left: 4px solid var(--st-error-500);
}

.toast-warning {
  border-left: 4px solid var(--st-warning-500);
}

.toast-info {
  border-left: 4px solid var(--st-info-500);
}
```

---

## 六、布局规范

### 6.1 容器系统

```css
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--st-page-padding-x);
  padding-right: var(--st-page-padding-x);
}

@media (min-width: 640px) {
  .container {
    max-width: var(--st-container-sm);
    padding-left: var(--st-page-padding-x-md);
    padding-right: var(--st-page-padding-x-md);
  }
}

@media (min-width: 768px) {
  .container {
    max-width: var(--st-container-md);
  }
}

@media (min-width: 1024px) {
  .container {
    max-width: var(--st-container-lg);
    padding-left: var(--st-page-padding-x-lg);
    padding-right: var(--st-page-padding-x-lg);
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: var(--st-container-xl);
  }
}

@media (min-width: 1400px) {
  .container {
    max-width: var(--st-container-2xl);
  }
}
```

### 6.2 网格系统

```css
.grid {
  display: grid;
  gap: var(--st-space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

@media (min-width: 768px) {
  .md\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .lg\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
}
```

### 6.3 Flexbox 工具类

```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: var(--st-space-2); }
.gap-4 { gap: var(--st-space-4); }
.gap-6 { gap: var(--st-space-6); }
```

---

## 七、动画规范

### 7.1 过渡时间

```css
:root {
  --st-duration-fast: 150ms;
  --st-duration-normal: 200ms;
  --st-duration-slow: 300ms;
  --st-duration-slower: 500ms;
}
```

### 7.2 缓动函数

```css
:root {
  --st-ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --st-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --st-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --st-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 7.3 常用动画

```css
/* 淡入 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 滑入 */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 脉冲 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 旋转 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 弹跳 */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* 应用动画 */
.animate-fade-in {
  animation: fadeIn var(--st-duration-normal) var(--st-ease-out);
}

.animate-slide-up {
  animation: slideInUp var(--st-duration-slow) var(--st-ease-out);
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

### 7.4 悬停效果

```css
/* 上浮效果 */
.hover-lift {
  transition: transform var(--st-duration-normal) var(--st-ease-bounce);
}

.hover-lift:hover {
  transform: translateY(-4px);
}

/* 缩放效果 */
.hover-scale {
  transition: transform var(--st-duration-normal) var(--st-ease-bounce);
}

.hover-scale:hover {
  transform: scale(1.05);
}

/* 阴影效果 */
.hover-shadow {
  transition: box-shadow var(--st-duration-normal) var(--st-ease-default);
}

.hover-shadow:hover {
  box-shadow: var(--st-shadow-xl);
}
```

---

## 八、响应式规范

### 8.1 断点定义

```css
/* 移动优先 */
/* 默认：0-639px - 手机 */
/* sm: 640px+ - 大手机 */
/* md: 768px+ - 平板 */
/* lg: 1024px+ - 小桌面 */
/* xl: 1200px+ - 桌面 */
/* 2xl: 1400px+ - 大桌面 */
```

### 8.2 响应式模式

#### 导航栏

```css
/* 移动端：汉堡菜单 */
.navbar-menu {
  position: fixed;
  top: 60px;
  left: -100%;
  width: 100%;
  height: calc(100vh - 60px);
  background: white;
  flex-direction: column;
  transition: left 0.3s ease;
}

.navbar-menu.active {
  left: 0;
}

/* 桌面端：水平导航 */
@media (min-width: 768px) {
  .navbar-menu {
    position: static;
    flex-direction: row;
    height: auto;
    width: auto;
  }
}
```

#### 卡片网格

```css
.stories-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .stories-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .stories-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1400px) {
  .stories-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 8.3 触摸优化

```css
/* 增大触摸目标 */
@media (hover: none) {
  .btn,
  .nav-link,
  .card {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* 移除hover效果 */
  .card:hover {
    transform: none;
    box-shadow: var(--st-shadow-md);
  }
  
  /* 增大间距 */
  .stories-grid {
    gap: 2rem;
  }
}
```

---

## 九、无障碍规范

### 9.1 颜色对比度

- 正文文字与背景对比度 ≥ 4.5:1
- 大文字（18px+ 或 14px+ bold）对比度 ≥ 3:1
- 交互元素对比度 ≥ 3:1

### 9.2 键盘导航

```css
/* 焦点样式 */
:focus-visible {
  outline: 2px solid var(--st-primary-500);
  outline-offset: 2px;
}

/* 跳过链接 */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--st-primary-600);
  color: white;
  padding: 8px;
  z-index: 100;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 0;
}
```

### 9.3 ARIA 规范

```html
<!-- 按钮 -->
<button aria-label="关闭弹窗">
  <i class="fas fa-times"></i>
</button>

<!-- 导航 -->
<nav aria-label="主导航">
  <a href="/" aria-current="page">首页</a>
</nav>

<!-- 表单 -->
<form>
  <label for="email">邮箱</label>
  <input id="email" type="email" aria-required="true" aria-describedby="email-error">
  <span id="email-error" role="alert"></span>
</form>

<!-- 弹窗 -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">确认删除</h2>
</div>

<!-- 状态 -->
<div role="status" aria-live="polite">
  保存成功
</div>
```

### 9.4 减少动画

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 十、实施指南

### 10.1 文件结构

```
web/
├── styles/
│   ├── design-system.css    # 设计系统变量和基础
│   ├── components.css       # 组件样式
│   ├── utilities.css        # 工具类
│   └── animations.css       # 动画
├── components/
│   ├── button.js           # 按钮组件
│   ├── card.js             # 卡片组件
│   ├── toast.js            # Toast组件
│   └── modal.js            # 弹窗组件
└── pages/
    ├── index.html
    ├── discover.html
    ├── story.html
    └── chapter.html
```

### 10.2 实施步骤

#### 第一步：创建基础文件（Day 1-2）

1. 创建 `web/styles/design-system.css`
2. 迁移所有CSS变量
3. 更新所有HTML文件引入

#### 第二步：重构全局样式（Day 3-4）

1. 重写 `web/styles.css`
2. 基于设计系统更新基础样式
3. 确保所有页面正常显示

#### 第三步：组件化开发（Day 5-7）

1. 创建可复用组件CSS
2. 开发JavaScript组件
3. 编写组件文档

#### 第四步：页面重构（Day 8-12）

1. 首页重构
2. 发现页重构
3. 阅读页重构
4. 其他页面重构

#### 第五步：测试优化（Day 13-14）

1. 跨浏览器测试
2. 响应式测试
3. 性能测试
4. 无障碍测试

### 10.3 迁移检查清单

- [ ] 所有颜色使用CSS变量
- [ ] 所有字体使用设计系统规范
- [ ] 所有间距使用8px网格
- [ ] 所有动画使用缓动函数
- [ ] 所有交互元素有hover状态
- [ ] 所有页面响应式正常
- [ ] 所有图片有alt文本
- [ ] 所有表单有label关联
- [ ] 键盘导航完整可用
- [ ] 颜色对比度符合WCAG AA

### 10.4 维护指南

**新增组件流程**：
1. 在设计系统文档中定义组件规范
2. 在 `components.css` 中实现样式
3. 如有需要，创建JavaScript组件
4. 编写使用文档和示例
5. 更新本README

**修改规范流程**：
1. 评估影响范围
2. 更新设计系统文档
3. 同步更新所有使用位置
4. 进行回归测试

---

## 附录

### A. 设计Token

完整的设计Token定义在 `web/styles/tokens.css`

### B. 图标规范

- 使用 Font Awesome 6
- 图标尺寸：16px（small）、20px（normal）、24px（large）
- 图标与文字间距：8px

### C. 阴影规范

```css
--st-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--st-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--st-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

### D. 圆角规范

```css
--st-radius-sm: 0.375rem;   /* 6px - 小标签、输入框 */
--st-radius-md: 0.5rem;     /* 8px - 按钮、小卡片 */
--st-radius-lg: 0.75rem;    /* 12px - 卡片、弹窗 */
--st-radius-xl: 1rem;       /* 16px - 大卡片、模态框 */
--st-radius-2xl: 1.5rem;    /* 24px - 特殊卡片 */
--st-radius-full: 9999px;   /* 完全圆角 - 徽章、头像 */
```

---

**维护者**：StoryTree 设计团队  
**最后更新**：2026-04-08  
**版本**：v1.0

