# StoryTree UI/UX 重构快速实施指南

> 适用于开发人员的快速上手指南

---

## 第一步：文件结构准备

### 1.1 创建目录结构

```bash
cd /Users/jinkun/storytree/web
mkdir -p styles components js
```

### 1.2 文件清单

```
web/
├── styles/
│   ├── design-system.css    # CSS变量和基础样式
│   ├── components.css       # 组件样式
│   ├── utilities.css        # 工具类
│   ├── animations.css       # 动画效果
│   └── main.css            # 主样式文件（整合所有）
├── components/
│   ├── toast.js            # Toast组件
│   ├── modal.js            # Modal组件
│   └── loading.js          # Loading组件
└── js/
    └── utils.js            # 工具函数
```

---

## 第二步：更新HTML文件

### 2.1 替换CSS引入

在每个HTML文件的 `<head>` 中，替换原有的样式引入：

```html
<!-- 旧的方式 -->
<link rel="stylesheet" href="styles.css">

<!-- 新的方式 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles/design-system.css">
<link rel="stylesheet" href="styles/components.css">
<link rel="stylesheet" href="styles/utilities.css">
<link rel="stylesheet" href="styles/animations.css">
```

### 2.2 更新导航栏

```html
<nav class="navbar">
  <div class="navbar-content">
    <a href="/" class="navbar-brand">
      <i class="fas fa-tree"></i>
      StoryTree
    </a>
    <div class="navbar-menu">
      <a href="/" class="navbar-link active">首页</a>
      <a href="/discover" class="navbar-link">发现故事</a>
      <a href="/create" class="navbar-link">开始创作</a>
      <a href="/login" class="btn btn-primary btn-sm">登录</a>
    </div>
    <button class="mobile-menu-toggle" aria-label="打开菜单">
      <i class="fas fa-bars"></i>
    </button>
  </div>
</nav>
```

---

## 第三步：组件使用示例

### 3.1 按钮组件

```html
<!-- 主要按钮 -->
<button class="btn btn-primary">
  <i class="fas fa-plus"></i>
  创建故事
</button>

<!-- 次要按钮 -->
<button class="btn btn-secondary">取消</button>

<!-- 文字按钮 -->
<button class="btn btn-text">
  查看更多 <i class="fas fa-arrow-right"></i>
</button>

<!-- 不同尺寸 -->
<button class="btn btn-primary btn-sm">小按钮</button>
<button class="btn btn-primary">默认</button>
<button class="btn btn-primary btn-lg">大按钮</button>

<!-- 图标按钮 -->
<button class="btn btn-icon btn-secondary" aria-label="收藏">
  <i class="fas fa-heart"></i>
</button>

<!-- 块级按钮 -->
<button class="btn btn-primary btn-block">提交</button>

<!-- 加载状态 -->
<button class="btn btn-primary" disabled>
  <i class="fas fa-spinner fa-spin"></i>
  加载中...
</button>
```

### 3.2 卡片组件

```html
<!-- 基础卡片 -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">卡片标题</h3>
    <p class="card-subtitle">副标题</p>
  </div>
  <div class="card-body">
    卡片内容
  </div>
  <div class="card-footer">
    <span>左下角</span>
    <button class="btn btn-primary btn-sm">操作</button>
  </div>
</div>

<!-- 故事卡片 -->
<div class="story-card">
  <div class="story-card-cover">
    <i class="fas fa-book-open"></i>
    <span class="story-card-badge">12章</span>
  </div>
  <div class="story-card-content">
    <h3 class="story-card-title">故事标题</h3>
    <p class="story-card-desc">故事简介...</p>
    <div class="story-card-meta">
      <div class="story-card-author">
        <i class="fas fa-user-circle"></i>
        <span>作者名</span>
      </div>
      <div class="story-card-stats">
        <span class="story-card-stat">
          <i class="fas fa-heart"></i> 128
        </span>
        <span class="story-card-stat">
          <i class="fas fa-eye"></i> 1.2k
        </span>
      </div>
    </div>
  </div>
</div>
```

### 3.3 表单组件

```html
<!-- 表单组 -->
<div class="form-group">
  <label class="form-label form-label-required">邮箱</label>
  <div class="input-group">
    <i class="fas fa-envelope input-icon"></i>
    <input type="email" class="input" placeholder="请输入邮箱">
  </div>
  <p class="form-help">我们将发送验证邮件到此邮箱</p>
</div>

<!-- 带错误提示 -->
<div class="form-group">
  <label class="form-label">密码</label>
  <input type="password" class="input input-error" value="123">
  <p class="form-error">
    <i class="fas fa-exclamation-circle"></i>
    密码长度至少6位
  </p>
</div>

<!-- 文本域 -->
<div class="form-group">
  <label class="form-label">简介</label>
  <textarea class="textarea" rows="4" placeholder="请输入简介..."></textarea>
</div>

<!-- 选择框 -->
<div class="form-group">
  <label class="form-label">分类</label>
  <select class="select">
    <option>科幻</option>
    <option>奇幻</option>
    <option>悬疑</option>
  </select>
</div>

<!-- 复选框 -->
<label class="checkbox">
  <input type="checkbox" checked>
  <span>记住我</span>
</label>

<!-- 开关 -->
<label class="switch">
  <input type="checkbox" class="switch-input">
  <span class="switch-slider"></span>
  <span class="switch-label">接收通知</span>
</label>
```

### 3.4 徽章组件

```html
<span class="badge badge-primary">新</span>
<span class="badge badge-success">已完成</span>
<span class="badge badge-warning">审核中</span>
<span class="badge badge-error">已拒绝</span>
<span class="badge badge-info">信息</span>
<span class="badge badge-gold">VIP</span>
```

### 3.5 标签/Chip组件

```html
<!-- 普通标签 -->
<button class="chip">科幻</button>
<button class="chip active">已选中</button>

<!-- 可删除标签 -->
<span class="chip chip-removable">
  已选标签
  <button class="chip-remove" aria-label="删除">
    <i class="fas fa-times"></i>
  </button>
</span>
```

### 3.6 头像组件

```html
<!-- 文字头像 -->
<div class="avatar">张</div>

<!-- 图片头像 -->
<div class="avatar">
  <img src="avatar.jpg" alt="用户名">
</div>

<!-- 不同尺寸 -->
<div class="avatar avatar-sm">小</div>
<div class="avatar">默认</div>
<div class="avatar avatar-lg">大</div>
<div class="avatar avatar-xl">超大</div>

<!-- 带边框 -->
<div class="avatar avatar-bordered">
  <img src="avatar.jpg" alt="用户名">
</div>
```

---

## 第四步：工具类使用

### 4.1 布局工具类

```html
<!-- Flexbox布局 -->
<div class="flex items-center justify-between gap-4">
  <div>左侧</div>
  <div>右侧</div>
</div>

<!-- Grid布局 -->
<div class="grid grid-cols-3 gap-6">
  <div>列1</div>
  <div>列2</div>
  <div>列3</div>
</div>

<!-- 响应式Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- 移动端1列，平板2列，桌面3列 -->
</div>
```

### 4.2 间距工具类

```html
<!-- Margin -->
<div class="m-4">四周16px</div>
<div class="mx-auto">水平居中</div>
<div class="mt-6 mb-4">上24px 下16px</div>

<!-- Padding -->
<div class="p-6">内边距24px</div>
<div class="px-4 py-2">水平16px 垂直8px</div>
```

### 4.3 文字工具类

```html
<!-- 字号 -->
<p class="text-xs">12px</p>
<p class="text-sm">14px</p>
<p class="text-base">16px</p>
<p class="text-lg">18px</p>
<p class="text-xl">20px</p>
<p class="text-2xl">24px</p>

<!-- 字重 -->
<p class="font-light">细体</p>
<p class="font-normal">正常</p>
<p class="font-medium">中等</p>
<p class="font-semibold">半粗</p>
<p class="font-bold">粗体</p>

<!-- 文字颜色 -->
<p class="text-primary">主要文字</p>
<p class="text-secondary">次要文字</p>
<p class="text-tertiary">辅助文字</p>
<p class="text-brand">品牌色</p>
<p class="text-success">成功</p>
<p class="text-error">错误</p>

<!-- 文字对齐 -->
<p class="text-left">左对齐</p>
<p class="text-center">居中</p>
<p class="text-right">右对齐</p>

<!-- 文字截断 -->
<p class="truncate">单行截断...</p>
<p class="line-clamp-2">多行截断，最多显示2行...</p>
<p class="line-clamp-3">多行截断，最多显示3行...</p>
```

### 4.4 背景工具类

```html
<div class="bg-primary">白色背景</div>
<div class="bg-secondary">浅灰背景</div>
<div class="bg-tertiary">深灰背景</div>
<div class="bg-gradient-brand">品牌渐变</div>
```

### 4.5 边框和圆角

```html
<!-- 边框 -->
<div class="border">默认边框</div>
<div class="border-2 border-brand">品牌色边框</div>

<!-- 圆角 -->
<div class="rounded-sm">小圆角</div>
<div class="rounded">默认圆角</div>
<div class="rounded-lg">大圆角</div>
<div class="rounded-xl">超大圆角</div>
<div class="rounded-full">完全圆角</div>
```

### 4.6 阴影工具类

```html
<div class="shadow-sm">小阴影</div>
<div class="shadow">默认阴影</div>
<div class="shadow-lg">大阴影</div>
<div class="shadow-xl">超大阴影</div>
```

---

## 第五步：动画使用

### 5.1 基础动画

```html
<!-- 淡入 -->
<div class="animate-fade-in">淡入效果</div>

<!-- 滑入 -->
<div class="animate-slide-up">从下方滑入</div>
<div class="animate-slide-down">从上方滑入</div>

<!-- 缩放 -->
<div class="animate-zoom-in">缩放进入</div>

<!-- 其他动画 -->
<div class="animate-bounce">弹跳</div>
<div class="animate-pulse">脉冲</div>
<div class="animate-spin">旋转</div>
<div class="animate-shake">摇晃</div>
```

### 5.2 悬停效果

```html
<!-- 上浮 -->
<div class="hover-lift">悬停上浮</div>

<!-- 缩放 -->
<div class="hover-scale">悬停缩放</div>

<!-- 阴影 -->
<div class="hover-shadow">悬停阴影</div>

<!-- 组合效果 -->
<div class="hover-card">卡片悬停效果</div>

<!-- 下划线 -->
<a href="#" class="hover-underline">悬停下划线</a>

<!-- 发光 -->
<div class="hover-glow">悬停发光</div>
```

### 5.3 过渡效果

```html
<!-- 基础过渡 -->
<div class="transition">所有属性过渡</div>

<!-- 特定属性 -->
<div class="transition-colors">颜色过渡</div>
<div class="transition-transform">变换过渡</div>
<div class="transition-opacity">透明度过渡</div>
<div class="transition-shadow">阴影过渡</div>
```

### 5.4 加载动画

```html
<!-- 旋转加载器 -->
<div class="loader"></div>
<div class="loader loader-sm"></div>
<div class="loader loader-lg"></div>

<!-- 点状加载器 -->
<div class="loader-dots">
  <span></span>
  <span></span>
  <span></span>
</div>

<!-- 脉冲加载器 -->
<div class="loader-pulse"></div>

<!-- 骨架屏 -->
<div class="skeleton skeleton-text"></div>
<div class="skeleton skeleton-title"></div>
<div class="skeleton skeleton-circle" style="width: 48px; height: 48px;"></div>
```

---

## 第六步：JavaScript组件

### 6.1 Toast 通知

```javascript
// 显示成功消息
toast.show('操作成功！', 'success');

// 显示错误消息
toast.show('操作失败，请重试', 'error');

// 显示警告
toast.show('请注意', 'warning');

// 显示信息
toast.show('新消息', 'info');

// 自定义持续时间
toast.show('长显示消息', 'info', 5000);
```

### 6.2 Modal 弹窗

```javascript
// 确认弹窗
showConfirm('确定要删除吗？', 
  () => {
    // 点击确定
    console.log('已删除');
  },
  () => {
    // 点击取消
    console.log('已取消');
  }
);

// 自定义弹窗
showModal({
  title: '自定义标题',
  content: '<p>自定义内容</p>',
  confirmText: '确认操作',
  cancelText: '关闭',
  onConfirm: () => {
    console.log('确认');
  },
  onCancel: () => {
    console.log('取消');
  }
});
```

### 6.3 Loading 加载

```javascript
// 显示加载
const loader = Loading.show(container, 'spinner');

// 显示骨架屏
const skeleton = Loading.show(container, 'skeleton');

// 隐藏加载
Loading.hide(loader);
```

---

## 第七步：响应式设计

### 7.1 断点说明

```
默认：0-639px（手机）
sm: 640px+（大手机）
md: 768px+（平板）
lg: 1024px+（小桌面）
xl: 1280px+（桌面）
```

### 7.2 响应式类使用

```html
<!-- 显示/隐藏 -->
<div class="hidden md:block">
  平板及以上显示，手机隐藏
</div>

<div class="block md:hidden">
  手机显示，平板及以上隐藏
</div>

<!-- 响应式Grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  <!-- 响应式布局 -->
</div>

<!-- 响应式间距 -->
<div class="p-4 md:p-6 lg:p-8">
  响应式内边距
</div>
```

---

## 第八步：无障碍支持

### 8.1 必要的ARIA属性

```html
<!-- 按钮 -->
<button aria-label="关闭">
  <i class="fas fa-times" aria-hidden="true"></i>
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
```

### 8.2 焦点管理

```html
<!-- 跳过链接 -->
<a href="#main-content" class="sr-only sr-only-focusable">
  跳转到主要内容
</a>

<main id="main-content">
  <!-- 主要内容 -->
</main>
```

---

## 第九步：性能优化

### 9.1 CSS加载优化

```html
<!-- 关键CSS内联 -->
<style>
  /* 首屏关键样式 */
</style>

<!-- 非关键CSS异步加载 -->
<link rel="preload" href="styles/components.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="styles/components.css"></noscript>
```

### 9.2 图片优化

```html
<!-- 响应式图片 -->
<picture>
  <source srcset="image-large.webp 1024w, image-medium.webp 768w, image-small.webp 480w" type="image/webp">
  <img src="image-fallback.jpg" alt="描述" loading="lazy" decoding="async">
</picture>

<!-- 懒加载 -->
<img data-src="image.jpg" alt="描述" class="lazy-load">
```

### 9.3 JavaScript优化

```javascript
// 防抖
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
```

---

## 第十步：调试和测试

### 10.1 浏览器开发者工具

```javascript
// 检查CSS变量
getComputedStyle(document.documentElement).getPropertyValue('--st-primary-500');

// 检查颜色对比度
// 使用浏览器开发者工具的Accessibility面板
```

### 10.2 常用检查清单

- [ ] 所有颜色使用CSS变量
- [ ] 所有间距使用8px网格
- [ ] 所有交互元素有hover状态
- [ ] 所有图片有alt属性
- [ ] 所有表单有label关联
- [ ] 键盘导航完整
- [ ] 响应式正常
- [ ] 动画流畅
- [ ] 加载状态明确
- [ ] 错误提示友好

---

## 附录：常用代码片段

### A. 页面模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题 - StoryTree</title>
  
  <!-- 字体 -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- 图标 -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  
  <!-- 样式 -->
  <link rel="stylesheet" href="styles/design-system.css">
  <link rel="stylesheet" href="styles/components.css">
  <link rel="stylesheet" href="styles/utilities.css">
  <link rel="stylesheet" href="styles/animations.css">
</head>
<body>
  <!-- 导航栏 -->
  <nav class="navbar">
    <!-- ... -->
  </nav>
  
  <!-- 主内容 -->
  <main class="main-content" style="margin-top: 64px;">
    <!-- ... -->
  </main>
  
  <!-- 脚本 -->
  <script src="components/toast.js"></script>
  <script src="components/modal.js"></script>
  <script src="js/utils.js"></script>
</body>
</html>
```

### B. 快速调试样式

```css
/* 显示所有元素的边框（调试用） */
* {
  outline: 1px solid red;
}

/* 显示网格线（调试用） */
.grid-debug {
  background-image: 
    linear-gradient(to right, rgba(255,0,0,0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,0,0,0.1) 1px, transparent 1px);
  background-size: 8px 8px;
}
```

---

**维护者**：StoryTree 前端团队  
**最后更新**：2026-04-08  
**版本**：v1.0

