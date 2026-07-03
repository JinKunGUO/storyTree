/**
 * StoryTree 故事树概念讲解组件
 * 全屏 Modal 式分步图解，用 CSS 动画 + SVG 图示讲解故事树核心概念
 * 触发时机：首次进入 story 页面
 */

class ConceptGuide {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 5;
    this.overlay = null;
    this.isVisible = false;

    this.steps = [
      {
        title: '欢迎来到故事树',
        desc: '故事树是一种全新的协作创作方式——每个故事都像一棵大树，从根部生长出无数分支。',
        illustration: 'tree-grow'
      },
      {
        title: '节点 = 章节',
        desc: '树上的每个节点代表一个章节。你可以阅读任何人写的章节，也可以从任何节点续写。',
        illustration: 'node-chapter'
      },
      {
        title: '分支 = 不同走向',
        desc: '一个节点可以有多个子节点，代表故事的不同发展方向。读者可以选择自己喜欢的路线阅读。',
        illustration: 'branch-paths'
      },
      {
        title: '你可以续写任何节点',
        desc: '看到某个章节有灵感？点击「续写」就能从那里开始你的创作，让故事向新方向生长。',
        illustration: 'write-node'
      },
      {
        title: '开始探索吧！',
        desc: '现在你已经了解了故事树的核心概念。点击树上的任何节点，开始你的阅读与创作之旅。',
        illustration: 'explore'
      }
    ];
  }

  /**
   * 显示概念讲解
   */
  show() {
    if (this.isVisible) return;
    this.isVisible = true;
    this.currentStep = 0;
    this._render();
    this._bindEvents();
  }

  /**
   * 隐藏概念讲解
   */
  hide() {
    if (!this.isVisible) return;
    this.isVisible = false;

    if (this.overlay) {
      this.overlay.classList.add('st-concept-fade-out');
      setTimeout(() => {
        this.overlay.remove();
        this.overlay = null;
      }, 300);
    }

    // 标记已看过
    if (window.onboardingManager) {
      window.onboardingManager.markConceptGuideSeen();
    }
  }

  /**
   * 渲染 Modal
   */
  _render() {
    // 移除已有的
    const existing = document.querySelector('.st-concept-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.className = 'st-concept-overlay';
    this.overlay.innerHTML = this._buildHTML();
    document.body.appendChild(this.overlay);

    // 触发入场动画
    requestAnimationFrame(() => {
      this.overlay.classList.add('st-concept-visible');
    });
  }

  /**
   * 构建完整 HTML
   */
  _buildHTML() {
    const step = this.steps[this.currentStep];
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === this.totalSteps - 1;

    return `
      <div class="st-concept-modal">
        <button class="st-concept-close" aria-label="关闭">
          <i class="fas fa-times"></i>
        </button>

        <div class="st-concept-illustration">
          ${this._getIllustration(step.illustration)}
        </div>

        <div class="st-concept-content">
          <h2 class="st-concept-title">${step.title}</h2>
          <p class="st-concept-desc">${step.desc}</p>
        </div>

        <div class="st-concept-progress">
          ${this._buildDots()}
        </div>

        <div class="st-concept-actions">
          ${!isFirst ? '<button class="st-concept-btn-prev"><i class="fas fa-arrow-left"></i> 上一步</button>' : '<span></span>'}
          ${isLast
            ? '<button class="st-concept-btn-finish">开始探索 <i class="fas fa-rocket"></i></button>'
            : '<button class="st-concept-btn-next">下一步 <i class="fas fa-arrow-right"></i></button>'
          }
        </div>
      </div>
    `;
  }

  /**
   * 构建步骤指示器圆点
   */
  _buildDots() {
    let html = '';
    for (let i = 0; i < this.totalSteps; i++) {
      const activeClass = i === this.currentStep ? 'active' : '';
      const doneClass = i < this.currentStep ? 'done' : '';
      html += `<span class="st-concept-dot ${activeClass} ${doneClass}"></span>`;
    }
    return html;
  }

  /**
   * 获取步骤插图 SVG
   */
  _getIllustration(type) {
    const illustrations = {
      'tree-grow': `
        <svg viewBox="0 0 240 180" class="st-concept-svg st-anim-tree-grow">
          <!-- 树干 -->
          <path class="st-svg-trunk" d="M120 170 L120 90" stroke="#2d5d5a" stroke-width="4" fill="none" stroke-linecap="round"/>
          <!-- 主枝 -->
          <path class="st-svg-branch st-anim-delay-1" d="M120 90 L80 50" stroke="#3a7a76" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path class="st-svg-branch st-anim-delay-2" d="M120 90 L160 50" stroke="#3a7a76" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path class="st-svg-branch st-anim-delay-3" d="M120 110 L70 80" stroke="#3a7a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path class="st-svg-branch st-anim-delay-4" d="M120 110 L170 75" stroke="#3a7a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- 叶子节点 -->
          <circle class="st-svg-leaf st-anim-delay-2" cx="80" cy="50" r="10" fill="#6ee7b7"/>
          <circle class="st-svg-leaf st-anim-delay-3" cx="160" cy="50" r="10" fill="#6ee7b7"/>
          <circle class="st-svg-leaf st-anim-delay-4" cx="70" cy="80" r="8" fill="#a7f3d0"/>
          <circle class="st-svg-leaf st-anim-delay-5" cx="170" cy="75" r="8" fill="#a7f3d0"/>
          <!-- 根节点 -->
          <circle cx="120" cy="170" r="12" fill="#2d5d5a"/>
          <text x="120" y="174" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">根</text>
        </svg>
      `,
      'node-chapter': `
        <svg viewBox="0 0 240 180" class="st-concept-svg st-anim-node-pulse">
          <!-- 连接线 -->
          <line x1="120" y1="40" x2="120" y2="80" stroke="#c8d8d6" stroke-width="2"/>
          <line x1="120" y1="100" x2="80" y2="140" stroke="#c8d8d6" stroke-width="2"/>
          <line x1="120" y1="100" x2="160" y2="140" stroke="#c8d8d6" stroke-width="2"/>
          <!-- 节点 -->
          <g class="st-svg-node-group">
            <rect x="90" y="20" width="60" height="40" rx="8" fill="#f0f9f8" stroke="#2d5d5a" stroke-width="2"/>
            <text x="120" y="38" text-anchor="middle" fill="#2d5d5a" font-size="9" font-weight="600">第一章</text>
            <text x="120" y="52" text-anchor="middle" fill="#6b7280" font-size="7">起源</text>
          </g>
          <g class="st-svg-node-group st-anim-delay-2">
            <rect x="90" y="80" width="60" height="40" rx="8" fill="#2d5d5a" stroke="#2d5d5a" stroke-width="2"/>
            <text x="120" y="98" text-anchor="middle" fill="#fff" font-size="9" font-weight="600">第二章</text>
            <text x="120" y="112" text-anchor="middle" fill="#a7f3d0" font-size="7">转折</text>
          </g>
          <g class="st-svg-node-group st-anim-delay-3">
            <rect x="50" y="130" width="60" height="35" rx="8" fill="#f0f9f8" stroke="#3a7a76" stroke-width="1.5" stroke-dasharray="4"/>
            <text x="80" y="150" text-anchor="middle" fill="#3a7a76" font-size="8">第三章 A</text>
          </g>
          <g class="st-svg-node-group st-anim-delay-4">
            <rect x="130" y="130" width="60" height="35" rx="8" fill="#f0f9f8" stroke="#3a7a76" stroke-width="1.5" stroke-dasharray="4"/>
            <text x="160" y="150" text-anchor="middle" fill="#3a7a76" font-size="8">第三章 B</text>
          </g>
          <!-- 高亮指示 -->
          <circle class="st-svg-pulse" cx="120" cy="100" r="26" fill="none" stroke="#2d5d5a" stroke-width="1.5" opacity="0.4"/>
        </svg>
      `,
      'branch-paths': `
        <svg viewBox="0 0 240 180" class="st-concept-svg st-anim-branch-split">
          <!-- 主干 -->
          <path d="M120 20 L120 60" stroke="#2d5d5a" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- 分支路径 -->
          <path class="st-svg-path-a" d="M120 60 Q90 90 60 120 Q40 140 40 160" stroke="#3a7a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path class="st-svg-path-b" d="M120 60 L120 120 L120 160" stroke="#2d5d5a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path class="st-svg-path-c" d="M120 60 Q150 90 180 120 Q200 140 200 160" stroke="#6ee7b7" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- 路径标签 -->
          <g class="st-anim-delay-2">
            <rect x="15" y="148" width="50" height="22" rx="6" fill="#3a7a76"/>
            <text x="40" y="163" text-anchor="middle" fill="#fff" font-size="8" font-weight="600">悲剧线</text>
          </g>
          <g class="st-anim-delay-3">
            <rect x="95" y="148" width="50" height="22" rx="6" fill="#2d5d5a"/>
            <text x="120" y="163" text-anchor="middle" fill="#fff" font-size="8" font-weight="600">主线</text>
          </g>
          <g class="st-anim-delay-4">
            <rect x="175" y="148" width="50" height="22" rx="6" fill="#059669"/>
            <text x="200" y="163" text-anchor="middle" fill="#fff" font-size="8" font-weight="600">喜剧线</text>
          </g>
          <!-- 起点 -->
          <circle cx="120" cy="20" r="8" fill="#2d5d5a"/>
          <!-- 分叉点 -->
          <circle cx="120" cy="60" r="6" fill="#fff" stroke="#2d5d5a" stroke-width="2"/>
        </svg>
      `,
      'write-node': `
        <svg viewBox="0 0 240 180" class="st-concept-svg st-anim-write">
          <!-- 树结构 -->
          <line x1="80" y1="30" x2="80" y2="70" stroke="#c8d8d6" stroke-width="2"/>
          <line x1="80" y1="70" x2="80" y2="110" stroke="#c8d8d6" stroke-width="2"/>
          <line x1="80" y1="70" x2="40" y2="110" stroke="#c8d8d6" stroke-width="1.5"/>
          <!-- 已有节点 -->
          <circle cx="80" cy="30" r="10" fill="#e8f5f3" stroke="#2d5d5a" stroke-width="1.5"/>
          <circle cx="80" cy="70" r="10" fill="#e8f5f3" stroke="#2d5d5a" stroke-width="1.5"/>
          <circle cx="80" cy="110" r="10" fill="#e8f5f3" stroke="#2d5d5a" stroke-width="1.5"/>
          <circle cx="40" cy="110" r="8" fill="#e8f5f3" stroke="#2d5d5a" stroke-width="1"/>
          <!-- 新续写节点（高亮） -->
          <line class="st-svg-new-line" x1="80" y1="70" x2="155" y2="100" stroke="#2d5d5a" stroke-width="2" stroke-dasharray="4"/>
          <g class="st-svg-new-node">
            <circle cx="155" cy="100" r="14" fill="#2d5d5a"/>
            <text x="155" y="104" text-anchor="middle" fill="#fff" font-size="12">+</text>
          </g>
          <!-- 写作面板 -->
          <g class="st-svg-write-panel st-anim-delay-2">
            <rect x="130" y="120" width="90" height="50" rx="8" fill="#fff" stroke="#2d5d5a" stroke-width="1.5" filter="url(#shadow)"/>
            <line x1="140" y1="133" x2="200" y2="133" stroke="#e5e7eb" stroke-width="1.5"/>
            <line x1="140" y1="143" x2="190" y2="143" stroke="#e5e7eb" stroke-width="1.5"/>
            <line x1="140" y1="153" x2="180" y2="153" stroke="#e5e7eb" stroke-width="1.5"/>
            <text x="145" y="165" fill="#2d5d5a" font-size="7" font-weight="600">续写中...</text>
          </g>
          <!-- 光标闪烁 -->
          <rect class="st-svg-cursor" x="140" y="128" width="1.5" height="10" fill="#2d5d5a"/>
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1"/>
            </filter>
          </defs>
        </svg>
      `,
      'explore': `
        <svg viewBox="0 0 240 180" class="st-concept-svg st-anim-explore">
          <!-- 大树 -->
          <path d="M120 170 L120 100" stroke="#2d5d5a" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M120 100 L70 60" stroke="#3a7a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M120 100 L170 55" stroke="#3a7a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M120 120 L60 95" stroke="#3a7a76" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M120 120 L180 90" stroke="#3a7a76" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M70 60 L40 35" stroke="#6ee7b7" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M70 60 L90 30" stroke="#6ee7b7" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M170 55 L190 25" stroke="#6ee7b7" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M170 55 L150 30" stroke="#6ee7b7" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <!-- 节点 -->
          <circle cx="120" cy="170" r="10" fill="#2d5d5a"/>
          <circle cx="120" cy="100" r="7" fill="#3a7a76"/>
          <circle cx="70" cy="60" r="6" fill="#3a7a76"/>
          <circle cx="170" cy="55" r="6" fill="#3a7a76"/>
          <circle cx="60" cy="95" r="5" fill="#6ee7b7"/>
          <circle cx="180" cy="90" r="5" fill="#6ee7b7"/>
          <circle cx="40" cy="35" r="4" fill="#a7f3d0"/>
          <circle cx="90" cy="30" r="4" fill="#a7f3d0"/>
          <circle cx="190" cy="25" r="4" fill="#a7f3d0"/>
          <circle cx="150" cy="30" r="4" fill="#a7f3d0"/>
          <!-- 人物 -->
          <g class="st-svg-person" transform="translate(120, 170)">
            <circle cx="0" cy="-20" r="5" fill="#f59e0b"/>
            <path d="M-4 -14 L4 -14 L3 -6 L-3 -6 Z" fill="#f59e0b"/>
          </g>
          <!-- 星星装饰 -->
          <g class="st-svg-stars">
            <text x="30" y="20" font-size="12" fill="#f59e0b" opacity="0.7">✦</text>
            <text x="210" y="45" font-size="10" fill="#6ee7b7" opacity="0.8">✦</text>
            <text x="15" y="130" font-size="8" fill="#3a7a76" opacity="0.5">✦</text>
            <text x="225" y="130" font-size="9" fill="#f59e0b" opacity="0.6">✦</text>
          </g>
        </svg>
      `
    };

    return illustrations[type] || '';
  }

  /**
   * 绑定事件
   */
  _bindEvents() {
    if (!this.overlay) return;

    // 关闭按钮
    this.overlay.querySelector('.st-concept-close')?.addEventListener('click', () => this.hide());

    // 下一步
    this.overlay.querySelector('.st-concept-btn-next')?.addEventListener('click', () => this._next());

    // 上一步
    this.overlay.querySelector('.st-concept-btn-prev')?.addEventListener('click', () => this._prev());

    // 完成
    this.overlay.querySelector('.st-concept-btn-finish')?.addEventListener('click', () => this.hide());

    // 点击遮罩关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // ESC 关闭
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._escHandler);
  }

  /**
   * 下一步
   */
  _next() {
    if (this.currentStep >= this.totalSteps - 1) return;
    this.currentStep++;
    this._updateContent();
  }

  /**
   * 上一步
   */
  _prev() {
    if (this.currentStep <= 0) return;
    this.currentStep--;
    this._updateContent();
  }

  /**
   * 更新内容（带过渡动画）
   */
  _updateContent() {
    const modal = this.overlay.querySelector('.st-concept-modal');
    if (!modal) return;

    modal.classList.add('st-concept-step-transition');

    setTimeout(() => {
      modal.innerHTML = this._buildHTML().match(/<div class="st-concept-modal">([\s\S]*)<\/div>\s*$/)?.[1]
        || this._buildModalInner();

      modal.classList.remove('st-concept-step-transition');
      this._bindEvents();
    }, 200);
  }

  /**
   * 构建 Modal 内部 HTML（用于步骤切换）
   */
  _buildModalInner() {
    const step = this.steps[this.currentStep];
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === this.totalSteps - 1;

    return `
      <button class="st-concept-close" aria-label="关闭">
        <i class="fas fa-times"></i>
      </button>

      <div class="st-concept-illustration">
        ${this._getIllustration(step.illustration)}
      </div>

      <div class="st-concept-content">
        <h2 class="st-concept-title">${step.title}</h2>
        <p class="st-concept-desc">${step.desc}</p>
      </div>

      <div class="st-concept-progress">
        ${this._buildDots()}
      </div>

      <div class="st-concept-actions">
        ${!isFirst ? '<button class="st-concept-btn-prev"><i class="fas fa-arrow-left"></i> 上一步</button>' : '<span></span>'}
        ${isLast
          ? '<button class="st-concept-btn-finish">开始探索 <i class="fas fa-rocket"></i></button>'
          : '<button class="st-concept-btn-next">下一步 <i class="fas fa-arrow-right"></i></button>'
        }
      </div>
    `;
  }

  /**
   * 销毁（页面卸载时清理）
   */
  destroy() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.isVisible = false;
  }
}

// 导出全局实例
window.conceptGuide = new ConceptGuide();
