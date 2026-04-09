# StoryTree UI/UX 重构实施计划

> 版本：v1.0 | 创建日期：2026-04-08 | 预计工期：2周
>
> 详细的分步实施指南，包含每一天的具体任务和代码实现

---

## 项目概览

### 目标
- 建立统一的设计系统
- 提升用户体验和视觉一致性
- 优化性能和可访问性

### 交付物
1. 设计系统CSS文件
2. 重构后的所有页面
3. 组件库
4. 文档和示例

### 里程碑
- **Day 1-2**: 基础架构搭建
- **Day 3-7**: 核心页面重构
- **Day 8-12**: 组件开发
- **Day 13-14**: 测试优化

---

## 第一周：基础架构与核心页面

### Day 1：创建设计系统基础文件

#### 任务清单
- [ ] 创建 `web/styles/design-system.css` - CSS变量系统
- [ ] 创建 `web/styles/utilities.css` - 工具类
- [ ] 创建 `web/styles/animations.css` - 动画系统
- [ ] 更新所有HTML文件引入新CSS

#### 具体步骤

**步骤1：创建目录结构**
```bash
mkdir -p web/styles web/components web/js
```

**步骤2：创建 design-system.css**
- 复制设计系统文档中的CSS变量
- 添加基础样式重置
- 添加字体引入

**步骤3：创建 utilities.css**
- 间距工具类
- Flexbox工具类
- 文字工具类
- 显示/隐藏工具类

**步骤4：创建 animations.css**
- 定义所有动画关键帧
- 创建动画工具类
- 添加过渡效果

**验证标准**
- [ ] 所有CSS文件无语法错误
- [ ] 在浏览器控制台能正确读取CSS变量
- [ ] 字体正确加载

---

### Day 2：重构全局样式

#### 任务清单
- [ ] 重写 `web/styles.css`
- [ ] 更新导航栏组件
- [ ] 更新按钮样式
- [ ] 更新卡片样式
- [ ] 更新表单样式

#### 具体步骤

**步骤1：备份原文件**
```bash
cp web/styles.css web/styles.css.backup
```

**步骤2：重构基础样式**
- 使用CSS变量替换所有硬编码颜色
- 统一使用8px网格间距
- 更新字体家族

**步骤3：重构导航栏**
```css
/* 新导航栏样式 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--st-gray-200);
  z-index: 1000;
}
```

**步骤4：重构按钮组件**
- 创建 `.btn`、`.btn-primary`、`.btn-secondary`、`.btn-text`
- 添加悬停、激活、禁用状态
- 添加尺寸变体 `.btn-sm`、`.btn-lg`

**步骤5：重构卡片组件**
- 创建 `.card` 基础样式
- 创建 `.story-card` 专用样式
- 添加悬停动画

**验证标准**
- [ ] 首页样式正常
- [ ] 所有按钮有hover效果
- [ ] 卡片悬停有动画
- [ ] 导航栏固定在顶部

---

### Day 3：首页（index.html）重构

#### 任务清单
- [ ] 重构英雄区域
- [ ] 重构故事列表
- [ ] 添加加载状态
- [ ] 优化空状态
- [ ] 添加动画效果

#### 具体步骤

**步骤1：英雄区域重构**
```html
<section class="hero">
  <div class="hero-bg">
    <div class="hero-gradient"></div>
    <div class="hero-pattern"></div>
  </div>
  <div class="hero-content container">
    <h1 class="hero-title">
      <span class="gradient-text">创作</span>属于你的故事
    </h1>
    <p class="hero-subtitle">在 StoryTree，每个故事都有无限可能</p>
    <div class="hero-actions">
      <a href="/create" class="btn btn-primary btn-lg">
        <i class="fas fa-pen-nib"></i>
        开始创作
      </a>
      <a href="/discover" class="btn btn-secondary btn-lg">
        <i class="fas fa-compass"></i>
        探索故事
      </a>
    </div>
  </div>
</section>
```

**步骤2：故事卡片网格**
```html
<section class="stories-section">
  <div class="container">
    <div class="section-header">
      <h2 class="section-title">热门故事</h2>
      <a href="/discover" class="btn btn-text">
        查看全部 <i class="fas fa-arrow-right"></i>
      </a>
    </div>
    <div class="stories-grid" id="storiesGrid">
      <!-- 骨架屏 -->
      <div class="story-card skeleton" aria-hidden="true">
        <div class="skeleton-cover"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
        </div>
      </div>
      <!-- 重复5次 -->
    </div>
  </div>
</section>
```

**步骤3：添加CSS样式**
```css
.hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--st-space-20) var(--st-space-6);
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-pattern {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG图案 */
  opacity: 0.1;
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  color: white;
}

.hero-title {
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 700;
  margin-bottom: var(--st-space-6);
  line-height: 1.1;
}

.gradient-text {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: var(--st-space-8);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  display: flex;
  gap: var(--st-space-4);
  justify-content: center;
  flex-wrap: wrap;
}
```

**步骤4：添加加载动画**
```css
.skeleton {
  background: var(--st-gray-100);
  border-radius: var(--st-radius-xl);
  overflow: hidden;
}

.skeleton > * {
  background: linear-gradient(
    90deg,
    var(--st-gray-100) 25%,
    var(--st-gray-200) 50%,
    var(--st-gray-100) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**验证标准**
- [ ] 首页加载时间 < 2秒
- [ ] 英雄区域视觉效果良好
- [ ] 故事卡片有骨架屏
- [ ] 响应式正常

---

### Day 4：发现页（discover.html）重构

#### 任务清单
- [ ] 重构搜索区域
- [ ] 重构筛选标签
- [ ] 重构故事列表
- [ ] 添加高级筛选面板
- [ ] 优化空状态

#### 具体步骤

**步骤1：搜索区域重构**
```html
<div class="search-section">
  <div class="container">
    <div class="search-box">
      <div class="input-group input-group-lg">
        <i class="fas fa-search input-icon"></i>
        <input 
          type="text" 
          class="input" 
          id="searchInput" 
          placeholder="搜索故事标题、作者、标签..."
          aria-label="搜索故事"
        >
      </div>
      <button class="btn btn-primary btn-lg" onclick="searchStories()">
        搜索
      </button>
    </div>
    
    <!-- 热门搜索 -->
    <div class="hot-searches">
      <span class="hot-searches-label">热门搜索：</span>
      <div class="hot-searches-tags">
        <button class="tag">科幻</button>
        <button class="tag">悬疑</button>
        <button class="tag">古风</button>
        <button class="tag">甜宠</button>
      </div>
    </div>
  </div>
</div>
```

**步骤2：筛选标签重构**
```html
<div class="filter-section">
  <div class="container">
    <div class="filter-bar">
      <div class="filter-tabs">
        <button class="filter-tab active" data-filter="all">
          <i class="fas fa-th-large"></i> 全部
        </button>
        <button class="filter-tab" data-filter="hot">
          <i class="fas fa-fire"></i> 热门
        </button>
        <button class="filter-tab" data-filter="new">
          <i class="fas fa-clock"></i> 最新
        </button>
        <button class="filter-tab" data-filter="completed">
          <i class="fas fa-check-circle"></i> 已完结
        </button>
      </div>
      
      <button class="btn btn-text" id="advancedFilterToggle">
        <i class="fas fa-sliders-h"></i> 高级筛选
      </button>
    </div>
    
    <!-- 高级筛选面板 -->
    <div class="advanced-filters" id="advancedFilters" hidden>
      <div class="filter-groups">
        <div class="filter-group">
          <label class="filter-label">类型</label>
          <div class="filter-chips">
            <button class="chip">科幻</button>
            <button class="chip">奇幻</button>
            <button class="chip">悬疑</button>
            <button class="chip">言情</button>
            <button class="chip">历史</button>
            <button class="chip">现代</button>
          </div>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">字数</label>
          <div class="filter-chips">
            <button class="chip">短篇（&lt;5万字）</button>
            <button class="chip">中篇（5-20万字）</button>
            <button class="chip">长篇（&gt;20万字）</button>
          </div>
        </div>
        
        <div class="filter-group">
          <label class="filter-label">排序</label>
          <select class="input" id="sortSelect">
            <option value="hot">🔥 最热</option>
            <option value="new">🆕 最新</option>
            <option value="rating">⭐ 好评</option>
            <option value="words">📝 字数</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</div>
```

**步骤3：故事列表重构**
```html
<div class="stories-section">
  <div class="container">
    <div class="section-header">
      <h2 class="section-title">
        <span id="resultCount">0</span> 个故事
      </h2>
      <div class="view-toggle">
        <button class="view-btn active" data-view="grid" aria-label="网格视图">
          <i class="fas fa-th-large"></i>
        </button>
        <button class="view-btn" data-view="list" aria-label="列表视图">
          <i class="fas fa-list"></i>
        </button>
      </div>
    </div>
    
    <div class="stories-grid" id="storiesGrid">
      <!-- 动态加载内容 -->
    </div>
    
    <!-- 加载更多 -->
    <div class="load-more">
      <button class="btn btn-secondary" id="loadMoreBtn">
        <i class="fas fa-spinner fa-spin" style="display: none;"></i>
        加载更多
      </button>
    </div>
  </div>
</div>
```

**验证标准**
- [ ] 搜索功能正常
- [ ] 筛选标签可点击切换
- [ ] 高级筛选面板可展开/收起
- [ ] 列表/网格视图可切换
- [ ] 加载更多功能正常

---

### Day 5：阅读页（chapter.html）重构 - 第一部分

#### 任务清单
- [ ] 重构阅读工具栏
- [ ] 添加阅读进度条
- [ ] 重构章节内容区域
- [ ] 添加阅读设置面板

#### 具体步骤

**步骤1：阅读工具栏重构**
```html
<header class="reading-header">
  <!-- 进度条 -->
  <div class="reading-progress" role="progressbar" aria-label="阅读进度">
    <div class="reading-progress-bar" id="readingProgressBar"></div>
  </div>
  
  <!-- 工具栏 -->
  <div class="reading-toolbar">
    <div class="toolbar-left">
      <button class="toolbar-btn" onclick="history.back()" aria-label="返回">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="chapter-nav">
        <button class="nav-btn" id="prevChapter" disabled>
          <i class="fas fa-chevron-left"></i> 上一章
        </button>
        <button class="nav-btn" id="nextChapter">
          下一章 <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
    
    <div class="toolbar-center">
      <h1 class="chapter-title-compact" id="chapterTitleCompact">章节标题</h1>
    </div>
    
    <div class="toolbar-right">
      <button class="toolbar-btn" id="bookmarkBtn" aria-label="添加书签">
        <i class="far fa-bookmark"></i>
      </button>
      <button class="toolbar-btn" id="settingsBtn" aria-label="阅读设置">
        <i class="fas fa-cog"></i>
      </button>
      <button class="toolbar-btn" id="tocBtn" aria-label="目录">
        <i class="fas fa-list"></i>
      </button>
    </div>
  </div>
</header>
```

**步骤2：阅读进度条**
```css
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(99, 102, 241, 0.2);
  z-index: 10001;
}

.reading-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366F1, #8B5CF6);
  width: 0%;
  transition: width 0.1s linear;
}
```

**步骤3：阅读设置面板**
```html
<!-- 阅读设置面板 -->
<div class="reading-settings-panel" id="readingSettingsPanel" hidden>
  <div class="settings-overlay" id="settingsOverlay"></div>
  <div class="settings-content">
    <div class="settings-header">
      <h3>阅读设置</h3>
      <button class="btn btn-icon" id="closeSettings" aria-label="关闭">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <div class="settings-body">
      <!-- 主题 -->
      <div class="setting-item">
        <label class="setting-label">主题</label>
        <div class="theme-options">
          <button class="theme-btn active" data-theme="light" aria-label="浅色主题">
            <span class="theme-preview theme-light"></span>
            <span>浅色</span>
          </button>
          <button class="theme-btn" data-theme="sepia" aria-label="护眼主题">
            <span class="theme-preview theme-sepia"></span>
            <span>护眼</span>
          </button>
          <button class="theme-btn" data-theme="dark" aria-label="深色主题">
            <span class="theme-preview theme-dark"></span>
            <span>深色</span>
          </button>
        </div>
      </div>
      
      <!-- 字体大小 -->
      <div class="setting-item">
        <label class="setting-label">字号</label>
        <div class="font-size-control">
          <button class="btn btn-sm" id="fontSizeDec">A-</button>
          <span class="font-size-value" id="fontSizeValue">18</span>
          <button class="btn btn-sm" id="fontSizeInc">A+</button>
        </div>
      </div>
      
      <!-- 行距 -->
      <div class="setting-item">
        <label class="setting-label">行距</label>
        <div class="line-height-options">
          <button class="lh-btn" data-lh="1.5">紧凑</button>
          <button class="lh-btn active" data-lh="1.8">舒适</button>
          <button class="lh-btn" data-lh="2.2">宽松</button>
        </div>
      </div>
      
      <!-- 字体 -->
      <div class="setting-item">
        <label class="setting-label">字体</label>
        <select class="input" id="fontFamily">
          <option value="system">系统默认</option>
          <option value="serif">宋体</option>
          <option value="sans">黑体</option>
        </select>
      </div>
    </div>
  </div>
</div>
```

**步骤4：章节内容区域**
```html
<main class="reading-main">
  <article class="chapter-article" id="chapterArticle">
    <header class="chapter-header">
      <h1 class="chapter-title" id="chapterTitle">第一章：故事的开始</h1>
      <div class="chapter-meta">
        <span class="chapter-author">
          <i class="fas fa-user-circle"></i>
          <span id="chapterAuthor">作者名</span>
        </span>
        <span class="chapter-date">
          <i class="fas fa-calendar"></i>
          <span id="chapterDate">2024-01-01</span>
        </span>
        <span class="chapter-wordcount">
          <i class="fas fa-file-word"></i>
          <span id="chapterWordCount">3,256 字</span>
        </span>
      </div>
    </header>
    
    <div class="chapter-content" id="chapterContent">
      <!-- 章节内容 -->
    </div>
    
    <footer class="chapter-footer">
      <div class="chapter-actions">
        <button class="btn btn-secondary" id="likeChapter">
          <i class="far fa-thumbs-up"></i>
          <span id="likeCount">128</span>
        </button>
        <button class="btn btn-secondary" id="bookmarkChapter">
          <i class="far fa-bookmark"></i>
          收藏
        </button>
        <button class="btn btn-secondary" id="shareChapter">
          <i class="fas fa-share-alt"></i>
          分享
        </button>
      </div>
    </footer>
  </article>
</main>
```

**验证标准**
- [ ] 进度条随滚动更新
- [ ] 工具栏滚动时自动隐藏/显示
- [ ] 设置面板可打开/关闭
- [ ] 主题切换即时生效
- [ ] 字体大小可调节

---

### Day 6：阅读页（chapter.html）重构 - 第二部分

#### 任务清单
- [ ] 重构评论区
- [ ] 添加评论排序功能
- [ ] 优化评论交互
- [ ] 添加目录侧边栏

#### 具体步骤

**步骤1：评论区重构**
```html
<section class="comments-section">
  <div class="container">
    <div class="comments-header">
      <h2 class="comments-title">
        <i class="fas fa-comments"></i>
        评论 <span class="comments-count" id="commentsCount">(32)</span>
      </h2>
      <div class="comments-sort">
        <button class="sort-btn active" data-sort="hot">最热</button>
        <button class="sort-btn" data-sort="new">最新</button>
      </div>
    </div>
    
    <!-- 评论输入 -->
    <div class="comment-form">
      <div class="comment-avatar">
        <img src="avatar.jpg" alt="用户头像">
      </div>
      <div class="comment-input-wrapper">
        <textarea 
          class="comment-textarea" 
          id="commentInput"
          placeholder="分享你的想法..."
          rows="3"
        ></textarea>
        <div class="comment-form-footer">
          <span class="char-count"><span id="charCount">0</span>/500</span>
          <button class="btn btn-primary" id="submitComment" disabled>
            发表评论
          </button>
        </div>
      </div>
    </div>
    
    <!-- 评论列表 -->
    <div class="comments-list" id="commentsList">
      <!-- 动态加载 -->
    </div>
    
    <!-- 加载更多 -->
    <div class="comments-load-more">
      <button class="btn btn-text" id="loadMoreComments">
        加载更多评论
      </button>
    </div>
  </div>
</section>
```

**步骤2：目录侧边栏**
```html
<!-- 目录侧边栏 -->
<aside class="toc-sidebar" id="tocSidebar" hidden>
  <div class="toc-overlay" id="tocOverlay"></div>
  <div class="toc-panel">
    <div class="toc-header">
      <h3>目录</h3>
      <button class="btn btn-icon" id="closeToc" aria-label="关闭目录">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="toc-content">
      <div class="toc-story-info">
        <h4 class="toc-story-title" id="tocStoryTitle">故事标题</h4>
        <span class="toc-chapter-count">共 <span id="tocChapterCount">50</span> 章</span>
      </div>
      <nav class="toc-nav" id="tocNav">
        <!-- 动态生成章节列表 -->
      </nav>
    </div>
  </div>
</aside>
```

**验证标准**
- [ ] 评论可正常发布
- [ ] 评论可排序
- [ ] 目录可展开/收起
- [ ] 点击目录项跳转对应章节

---

### Day 7：其他页面重构

#### 任务清单
- [ ] 登录/注册页
- [ ] 个人中心页
- [ ] 创作页
- [ ] 故事详情页

#### 具体步骤

**步骤1：登录/注册页**
- 使用新的表单样式
- 添加表单验证提示
- 优化错误状态显示

**步骤2：个人中心页**
- 重构用户信息卡片
- 重构统计数据展示
- 重构故事列表

**步骤3：创作页**
- 重构编辑器工具栏
- 添加自动保存提示
- 优化发布流程

**步骤4：故事详情页**
- 重构故事信息区域
- 重构章节列表
- 添加故事统计

**验证标准**
- [ ] 所有页面样式统一
- [ ] 表单验证正常
- [ ] 响应式正常

---

## 第二周：组件开发与优化

### Day 8：Toast 组件

#### 任务清单
- [ ] 创建 Toast 组件
- [ ] 添加多种类型（success、error、warning、info）
- [ ] 添加动画效果
- [ ] 替换所有alert

#### 具体步骤

**步骤1：创建 Toast 组件**
```javascript
// web/components/toast.js
class Toast {
  constructor() {
    this.container = null;
    this.init();
  }
  
  init() {
    // 创建容器
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }
  
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: 'check-circle',
      error: 'times-circle',
      warning: 'exclamation-circle',
      info: 'info-circle'
    };
    
    toast.innerHTML = `
      <i class="fas fa-${icons[type]}"></i>
      <span>${message}</span>
    `;
    
    this.container.appendChild(toast);
    
    // 动画进入
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // 自动移除
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// 全局实例
window.toast = new Toast();
```

**步骤2：使用示例**
```javascript
// 替换所有 alert
toast.show('保存成功！', 'success');
toast.show('操作失败，请重试', 'error');
toast.show('请注意', 'warning');
toast.show('新消息', 'info');
```

**验证标准**
- [ ] Toast 正常显示
- [ ] 不同类型有不同颜色
- [ ] 动画流畅
- [ ] 多个Toast可堆叠

---

### Day 9：Modal 组件

#### 任务清单
- [ ] 创建 Modal 组件
- [ ] 添加确认/取消功能
- [ ] 添加动画效果
- [ ] 替换所有confirm

#### 具体步骤

**步骤1：创建 Modal 组件**
```javascript
// web/components/modal.js
class Modal {
  constructor(options = {}) {
    this.options = {
      title: '提示',
      content: '',
      confirmText: '确定',
      cancelText: '取消',
      showCancel: true,
      onConfirm: () => {},
      onCancel: () => {},
      ...options
    };
    
    this.element = null;
    this.init();
  }
  
  init() {
    this.element = document.createElement('div');
    this.element.className = 'modal-overlay';
    this.element.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title">${this.options.title}</h3>
          <button class="btn btn-icon modal-close" aria-label="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${this.options.content}
        </div>
        <div class="modal-footer">
          ${this.options.showCancel ? `
            <button class="btn btn-secondary modal-cancel">
              ${this.options.cancelText}
            </button>
          ` : ''}
          <button class="btn btn-primary modal-confirm">
            ${this.options.confirmText}
          </button>
        </div>
      </div>
    `;
    
    this.bindEvents();
    document.body.appendChild(this.element);
    
    // 动画进入
    requestAnimationFrame(() => {
      this.element.classList.add('show');
    });
  }
  
  bindEvents() {
    // 关闭
    this.element.querySelector('.modal-close')?.addEventListener('click', () => {
      this.close();
      this.options.onCancel();
    });
    
    // 取消
    this.element.querySelector('.modal-cancel')?.addEventListener('click', () => {
      this.close();
      this.options.onCancel();
    });
    
    // 确认
    this.element.querySelector('.modal-confirm').addEventListener('click', () => {
      this.close();
      this.options.onConfirm();
    });
    
    // 点击遮罩关闭
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
        this.options.onCancel();
      }
    });
    
    // ESC关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.element) {
        this.close();
        this.options.onCancel();
      }
    });
  }
  
  close() {
    this.element.classList.remove('show');
    setTimeout(() => this.element.remove(), 300);
  }
}

// 便捷方法
window.showModal = (options) => new Modal(options);
window.showConfirm = (content, onConfirm, onCancel) => {
  new Modal({
    title: '确认',
    content,
    onConfirm,
    onCancel
  });
};
```

**验证标准**
- [ ] Modal 正常显示
- [ ] 动画流畅
- [ ] 点击遮罩可关闭
- [ ] ESC键可关闭
- [ ] 焦点管理正确

---

### Day 10：Loading 组件

#### 任务清单
- [ ] 创建 Loading 组件
- [ ] 添加骨架屏
- [ ] 添加加载动画
- [ ] 统一所有加载状态

#### 具体步骤

**步骤1：创建 Loading 组件**
```javascript
// web/components/loading.js
class Loading {
  static show(container, type = 'spinner') {
    const loader = document.createElement('div');
    loader.className = `loading loading-${type}`;
    
    if (type === 'spinner') {
      loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else if (type === 'skeleton') {
      loader.innerHTML = `
        <div class="skeleton">
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
        </div>
      `;
    }
    
    container.appendChild(loader);
    return loader;
  }
  
  static hide(loader) {
    loader?.remove();
  }
}

window.Loading = Loading;
```

**验证标准**
- [ ] Loading 正常显示
- [ ] 骨架屏样式正确
- [ ] 可正常隐藏

---

### Day 11：性能优化

#### 任务清单
- [ ] 图片懒加载
- [ ] CSS优化
- [ ] JavaScript优化
- [ ] 添加性能监控

#### 具体步骤

**步骤1：图片懒加载**
```javascript
// 使用 Intersection Observer
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.add('loaded');
      observer.unobserve(img);
    }
  });
});

document.querySelectorAll('img[data-src]').forEach(img => {
  imageObserver.observe(img);
});
```

**步骤2：CSS优化**
- 提取关键CSS内联
- 异步加载非关键CSS
- 压缩CSS文件

**步骤3：JavaScript优化**
- 代码分割
- 懒加载组件
- 防抖节流

**验证标准**
- [ ] Lighthouse 性能评分 > 80
- [ ] FCP < 1.5s
- [ ] LCP < 2.5s

---

### Day 12：无障碍优化

#### 任务清单
- [ ] 添加ARIA标签
- [ ] 优化键盘导航
- [ ] 检查颜色对比度
- [ ] 测试屏幕阅读器

#### 具体步骤

**步骤1：ARIA标签检查清单**
- [ ] 所有按钮有 aria-label
- [ ] 所有图标有 aria-hidden
- [ ] 所有表单有 label 关联
- [ ] 所有弹窗有 role="dialog"

**步骤2：键盘导航**
- [ ] Tab顺序正确
- [ ] 焦点可见
- [ ] ESC可关闭弹窗
- [ ] 焦点陷阱在弹窗内

**步骤3：颜色对比度**
- [ ] 正文对比度 > 4.5:1
- [ ] 大文字对比度 > 3:1
- [ ] 交互元素对比度 > 3:1

**验证标准**
- [ ] Lighthouse 可访问性评分 > 90
- [ ] 键盘可完全操作
- [ ] 屏幕阅读器可正常使用

---

### Day 13：响应式测试

#### 任务清单
- [ ] 测试所有断点
- [ ] 测试触摸设备
- [ ] 测试不同浏览器
- [ ] 修复响应式问题

#### 测试清单

**断点测试**
- [ ] 375px - iPhone SE
- [ ] 414px - iPhone 12 Pro
- [ ] 768px - iPad Mini
- [ ] 1024px - iPad Pro
- [ ] 1440px - 桌面

**触摸测试**
- [ ] 触摸目标 > 44px
- [ ] 滑动手势正常
- [ ] 双击缩放正常

**浏览器测试**
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Edge

---

### Day 14：最终优化与文档

#### 任务清单
- [ ] 代码审查
- [ ] 性能测试
- [ ] 更新文档
- [ ] 准备上线

#### 最终检查清单

**代码质量**
- [ ] 无控制台错误
- [ ] 无未使用的CSS
- [ ] 无未使用的JavaScript
- [ ] 代码格式统一

**性能**
- [ ] 首屏加载 < 2秒
- [ ] 交互响应 < 100ms
- [ ] 动画流畅 60fps

**用户体验**
- [ ] 所有功能正常
- [ ] 错误提示友好
- [ ] 加载状态明确
- [ ] 空状态友好

---

## 附录

### A. 每日检查清单模板

```markdown
## Day X：任务名称

### 今日目标
- [ ] 目标1
- [ ] 目标2

### 具体任务
1. 任务1
   - [ ] 子任务1
   - [ ] 子任务2

2. 任务2
   - [ ] 子任务1
   - [ ] 子任务2

### 验证标准
- [ ] 标准1
- [ ] 标准2

### 遇到的问题
1. 问题1：解决方案
2. 问题2：解决方案

### 明日计划
- 计划1
- 计划2

### 时间记录
- 开始时间：
- 结束时间：
- 总用时：
```

### B. 代码审查清单

```markdown
## CSS审查
- [ ] 使用CSS变量
- [ ] 遵循8px网格
- [ ] 添加适当注释
- [ ] 无重复代码
- [ ] 选择器性能良好

## HTML审查
- [ ] 语义化标签
- [ ] ARIA标签完整
- [ ] 图片有alt
- [ ] 表单有label
- [ ] 无内联样式

## JavaScript审查
- [ ] 使用ES6+
- [ ] 添加JSDoc注释
- [ ] 错误处理完整
- [ ] 无内存泄漏
- [ ] 性能优化
```

### C. 常用命令

```bash
# 启动本地服务器
cd web && python3 -m http.server 3000

# 检查CSS语法
npx stylelint "styles/*.css"

# 压缩CSS
npx clean-css-cli styles.css -o styles.min.css

# 压缩JS
npx terser js/app.js -o js/app.min.js
```

---

**维护者**：StoryTree 前端团队  
**最后更新**：2026-04-08  
**版本**：v1.0

