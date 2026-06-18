/**
 * StoryTree 分页阅读器（CSS Multi-Column 方案）
 * 
 * 利用 CSS column 布局实现行级别的自动分页：
 * - 段落内容可以跨页，每页被完全填满
 * - 浏览器原生处理文字断行，精确度最高
 * - 水平 translateX 滑动翻页
 * 
 * 使用方式：
 *   const reader = new PaginationReader({
 *     contentEl: document.getElementById('chapterText'),
 *     containerEl: document.querySelector('.chapter-content'),
 *     onPageChange: (currentPage, totalPages) => {},
 *     onPrevChapter: () => {},
 *     onNextChapter: () => {},
 *   });
 *   reader.init();
 */

class PaginationReader {
  constructor(options) {
    this.contentEl = options.contentEl;
    this.containerEl = options.containerEl;
    this.onPageChange = options.onPageChange || (() => {});
    this.onPrevChapter = options.onPrevChapter || (() => {});
    this.onNextChapter = options.onNextChapter || (() => {});

    this.currentPage = 0;
    this.totalPages = 0;
    this.isAnimating = false;

    // 触摸相关
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchDeltaX = 0;
    this.isSwiping = false;
    this.swipeThreshold = 50;

    // DOM 引用
    this.wrapper = null;
    this.columnContainer = null;
    this.indicator = null;

    // 配置
    this.columnGap = 40; // 列间距（翻页时的视觉间隔）
    this.pagePadding = 20; // 页面上下内边距
    this.enabled = true;
  }

  /**
   * 初始化分页阅读器
   */
  init() {
    if (!this.contentEl || !this.containerEl) return;

    // 获取原始内容
    const rawContent = this.contentEl.innerHTML;
    if (!rawContent || rawContent.trim() === '') return;

    // 存储原始内容
    this._rawContent = rawContent;

    // 构建分页 DOM 结构
    this.buildPaginationDOM();

    // 等待浏览器完成布局计算后再分页
    // 必须用 rAF 确保 DOM 已经被渲染，clientWidth/clientHeight 有值
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._initAfterLayout();
      });
    });
  }

  /**
   * 布局完成后执行分页初始化
   */
  _initAfterLayout() {
    // 计算分页
    this.paginate();

    // 如果内容不足一页，禁用分页
    if (this.totalPages <= 1) {
      this.disable();
      return;
    }

    // 绑定事件
    this.bindEvents();

    // 显示第一页
    this.goToPage(0, false);
  }

  /**
   * 构建基于 CSS columns 的 DOM 结构
   */
  buildPaginationDOM() {
    // 创建外层包装器（固定尺寸，overflow hidden）
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'pr-wrapper';

    // 创建 column 容器（内容在此通过 CSS columns 自动分列）
    this.columnContainer = document.createElement('div');
    this.columnContainer.className = 'pr-column-container';

    // 将内容转换为适合分列的 HTML 格式
    this.columnContainer.innerHTML = this._prepareContent(this._rawContent);

    this.wrapper.appendChild(this.columnContainer);

    // 创建页码指示器
    this.indicator = document.createElement('div');
    this.indicator.className = 'pr-indicator';

    // 替换原有内容
    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(this.wrapper);
    this.contentEl.appendChild(this.indicator);
  }

  /**
   * 核心分页：利用 CSS columns 计算总页数
   * 浏览器自动处理行级断页，段落可以跨页
   */
  paginate() {
    const wrapperWidth = this.wrapper.clientWidth;
    const wrapperHeight = this.wrapper.clientHeight;

    if (wrapperWidth <= 0 || wrapperHeight <= 0) {
      this.disable();
      return;
    }

    // 每页内容区高度 = wrapper 高度 - 上下 padding
    const pageContentHeight = wrapperHeight - this.pagePadding * 2;

    // 第一步：先移除 column 布局，测量内容自然流高度
    this.columnContainer.style.cssText = `
      padding: ${this.pagePadding}px 0;
      box-sizing: content-box;
      height: auto;
      column-count: auto;
    `;
    const naturalHeight = this.columnContainer.scrollHeight - this.pagePadding * 2;

    // 如果内容不超过一页，不需要分页
    if (naturalHeight <= pageContentHeight) {
      this.totalPages = 1;
      return;
    }

    // 第二步：设置 column 布局
    this.columnContainer.style.cssText = `
      column-width: ${wrapperWidth}px;
      column-gap: ${this.columnGap}px;
      column-fill: auto;
      height: ${pageContentHeight}px;
      padding: ${this.pagePadding}px 0;
      box-sizing: content-box;
    `;

    // 第三步：计算总页数
    // 方法1：通过 scrollWidth（浏览器支持好时最准确）
    const totalScrollWidth = this.columnContainer.scrollWidth;
    const pageWidth = wrapperWidth + this.columnGap;

    if (totalScrollWidth > wrapperWidth + 1) {
      // scrollWidth 有效，用它计算
      this.totalPages = Math.round(totalScrollWidth / pageWidth);
      // 修正：确保至少为 scrollWidth / wrapperWidth 向上取整
      if (this.totalPages < 2) {
        this.totalPages = Math.ceil(totalScrollWidth / wrapperWidth);
      }
    } else {
      // 方法2：回退 - 用自然高度估算页数
      this.totalPages = Math.ceil(naturalHeight / pageContentHeight);
    }

    this.totalPages = Math.max(1, this.totalPages);

    // 更新指示器
    this.updateIndicator();
  }

  /**
   * 绑定触摸和键盘事件
   */
  bindEvents() {
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundTap = this._onTap.bind(this);
    this._boundKeyDown = this._onKeyDown.bind(this);

    this.wrapper.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    this.wrapper.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    this.wrapper.addEventListener('touchend', this._boundTouchEnd, { passive: true });
    this.wrapper.addEventListener('click', this._boundTap);
    document.addEventListener('keydown', this._boundKeyDown);

    // 窗口大小变化时重新分页
    let resizeTimer;
    this._boundResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (this.enabled) {
          const currentProgress = this.currentPage / Math.max(this.totalPages - 1, 1);
          this.paginate();
          const newPage = Math.min(
            Math.round(currentProgress * (this.totalPages - 1)),
            this.totalPages - 1
          );
          this.goToPage(newPage, false);
        }
      }, 300);
    };
    window.addEventListener('resize', this._boundResize);
  }

  _onTouchStart(e) {
    if (!this.enabled || this.isAnimating) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchDeltaX = 0;
    this.isSwiping = false;
    this.columnContainer.style.transition = 'none';
  }

  _onTouchMove(e) {
    if (!this.enabled || this.isAnimating) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    if (!this.isSwiping && Math.abs(deltaX) > 10) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.isSwiping = true;
      }
    }

    if (this.isSwiping) {
      e.preventDefault();
      this.touchDeltaX = deltaX;

      // 边界阻力
      let resistance = 1;
      if ((this.currentPage === 0 && deltaX > 0) ||
          (this.currentPage === this.totalPages - 1 && deltaX < 0)) {
        resistance = 0.3;
      }

      const pageWidth = this.wrapper.clientWidth + this.columnGap;
      const offset = -this.currentPage * pageWidth + deltaX * resistance;
      this.columnContainer.style.transform = `translateX(${offset}px)`;
    }
  }

  _onTouchEnd(e) {
    if (!this.enabled || !this.isSwiping) return;
    this.isSwiping = false;

    if (this.touchDeltaX < -this.swipeThreshold) {
      this.nextPage();
    } else if (this.touchDeltaX > this.swipeThreshold) {
      this.prevPage();
    } else {
      this.goToPage(this.currentPage, true);
    }
  }

  _onTap(e) {
    if (!this.enabled || this.isSwiping) return;
    const rect = this.wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      this.prevPage();
    } else if (x > width * 2 / 3) {
      this.nextPage();
    }
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.prevPage();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      this.nextPage();
    }
  }

  /**
   * 跳转到指定页
   */
  goToPage(pageIndex, animate = true) {
    if (pageIndex < 0 || pageIndex >= this.totalPages) return;

    this.currentPage = pageIndex;
    const pageWidth = this.wrapper.clientWidth + this.columnGap;
    const offset = -pageIndex * pageWidth;

    if (animate) {
      this.isAnimating = true;
      this.columnContainer.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      setTimeout(() => { this.isAnimating = false; }, 300);
    } else {
      this.columnContainer.style.transition = 'none';
    }

    this.columnContainer.style.transform = `translateX(${offset}px)`;
    this.updateIndicator();
    this.onPageChange(this.currentPage, this.totalPages);
  }

  /**
   * 下一页
   */
  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.goToPage(this.currentPage + 1);
    } else {
      this._showChapterTransition('next');
    }
  }

  /**
   * 上一页
   */
  prevPage() {
    if (this.currentPage > 0) {
      this.goToPage(this.currentPage - 1);
    } else {
      this._showChapterTransition('prev');
    }
  }

  /**
   * 章节切换
   */
  _showChapterTransition(direction) {
    if (this.isAnimating) return;
    this.goToPage(this.currentPage, true);

    if (direction === 'next') {
      this.onNextChapter();
    } else {
      this.onPrevChapter();
    }
  }

  /**
   * 更新页码指示器
   */
  updateIndicator() {
    if (!this.indicator) return;
    this.indicator.innerHTML = `
      <span class="pr-indicator-text">${this.currentPage + 1} / ${this.totalPages}</span>
    `;
  }

  /**
   * 将原始内容转换为适合 CSS columns 分列的 HTML
   * 纯文本需要转为 <p> 段落，否则 CSS columns 无法正确断页
   */
  _prepareContent(rawContent) {
    // 检查是否已经包含块级 HTML 元素
    const hasBlockElements = /<(div|p|h[1-6]|blockquote|ul|ol|figure|table)\b/i.test(rawContent);

    if (hasBlockElements) {
      // 已有 HTML 结构，直接使用
      return rawContent;
    }

    // 纯文本内容：按空行分段，每段包裹为 <p>
    // 先对 HTML 特殊字符进行转义（防止 XSS，同时保留原有转义）
    const lines = rawContent.split('\n');
    const paragraphs = [];
    let currentPara = [];

    for (const line of lines) {
      if (line.trim() === '') {
        // 空行 = 段落分隔
        if (currentPara.length > 0) {
          paragraphs.push(currentPara.join('\n'));
          currentPara = [];
        }
      } else {
        currentPara.push(line);
      }
    }
    // 最后一段
    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join('\n'));
    }

    // 如果没有空行分段（整篇是一段），按固定行数分段以帮助 columns 断页
    if (paragraphs.length <= 1 && lines.length > 5) {
      // 每行作为独立段落（适用于诗歌、日记等短行内容）
      // 或者保持为一整块让 columns 自行断行
      // 这里选择保持原样，用 <p> 包裹整体即可
      return `<p style="white-space:pre-wrap;text-indent:2em;margin:0;">${rawContent}</p>`;
    }

    // 多段落：每段用 <p> 包裹
    return paragraphs
      .map(p => `<p style="text-indent:2em;margin:0 0 1.2em 0;white-space:pre-wrap;">${p}</p>`)
      .join('');
  }

  /**
   * 禁用分页（内容太短不需要分页时）
   */
  disable() {
    this.enabled = false;
    if (this._rawContent && this.contentEl) {
      this.contentEl.innerHTML = this._rawContent;
    }
    if (this.indicator) {
      this.indicator.style.display = 'none';
    }
  }

  /**
   * 销毁实例，清理事件
   */
  destroy() {
    this.enabled = false;
    if (this.wrapper) {
      this.wrapper.removeEventListener('touchstart', this._boundTouchStart);
      this.wrapper.removeEventListener('touchmove', this._boundTouchMove);
      this.wrapper.removeEventListener('touchend', this._boundTouchEnd);
      this.wrapper.removeEventListener('click', this._boundTap);
    }
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
    }
    if (this._rawContent && this.contentEl) {
      this.contentEl.innerHTML = this._rawContent;
    }
  }

  /**
   * 获取当前阅读进度（0-1）
   */
  getProgress() {
    if (this.totalPages <= 1) return 1;
    return this.currentPage / (this.totalPages - 1);
  }
}

// 导出
window.PaginationReader = PaginationReader;
