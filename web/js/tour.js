/**
 * StoryTree 用户引导组件
 * 基于 Driver.js 实现多页面联动的新手引导
 */

class StoryTreeTour {
  constructor() {
    this.driver = null;
    this.currentPage = null;
  }

  /**
   * 初始化 Driver.js 实例
   */
  initDriver() {
    if (this.driver) return;

    const self = this;

    this.driver = window.driver.js.driver({
      showProgress: true,
      allowClose: false,
      overlayOpacity: 0.4,
      stagePadding: 12,
      stageRadius: 10,
      popoverOffset: 15,
      // 每个步骤渲染时注入插图 + "跳过引导"按钮
      onPopoverRender: (popover, { config }) => {
        const activeStep = config.steps[this.driver.getState().activeIndex];
        const illustrationType = activeStep?.illustration;
        if (illustrationType) {
          const existingIll = popover.wrapper.querySelector('.st-tour-illustration');
          if (!existingIll) {
            const illDiv = document.createElement('div');
            illDiv.className = 'st-tour-illustration';
            illDiv.innerHTML = self._getIllustrationSVG(illustrationType);
            popover.wrapper.insertBefore(illDiv, popover.title);
          }
        }
        if (!popover.footerButtons.querySelector('.st-tour-skip-btn')) {
          const skipBtn = document.createElement('button');
          skipBtn.className = 'st-tour-skip-btn';
          skipBtn.textContent = '跳过引导';
          skipBtn.addEventListener('click', async () => {
            await self.markTourComplete();
            self.driver.destroy();
          });
          popover.footerButtons.appendChild(skipBtn);
        }
      },
      onDestroyed: () => {
        // 引导结束时清理 URL 参数
        this.clearTourParam();
      }
    });
  }

  /**
   * 启动引导流程
   * @param {string} page - 页面名称: 'index' | 'discover' | 'create'
   */
  startTour(page) {
    this.currentPage = page;
    this.initDriver();

    const steps = this.getStepsForPage(page);
    if (!steps || steps.length === 0) {
      console.warn(`[StoryTreeTour] No tour steps defined for page: ${page}`);
      this.clearTourParam();
      return;
    }

    // 验证第一步的目标元素是否存在，不存在则指数退避重试
    const firstEl = steps[0].element;
    if (firstEl && !document.querySelector(firstEl)) {
      this._waitForElement(firstEl, 0, () => {
        this.driver.setSteps(steps);
        this.driver.drive();
      }, () => {
        console.error(`[StoryTreeTour] Target element "${firstEl}" still not found, aborting tour.`);
        this.clearTourParam();
      });
      return;
    }

    this.driver.setSteps(steps);
    this.driver.drive();
  }

  /**
   * 启动 AI 辅助创作页引导（便捷方法）
   */
  startCreateAiTour() {
    this.startTour('create-ai');
  }

  /**
   * 根据页面获取引导步骤
   */
  getStepsForPage(page) {
    const stepsMap = {
      index: this.getIndexSteps(),
      discover: this.getDiscoverSteps(),
      'create-ai': this.getCreateAiSteps(),
      write: this.getWriteSteps(),
      'my-stories': this.getMyStoriesSteps()
    };

    return stepsMap[page] || [];
  }

  /**
   * 首页引导步骤
   */
  getIndexSteps() {
    const isMobile = window.innerWidth <= 768;
    const steps = [
      {
        element: '.navbar, .nav, .navbar-content',
        illustration: 'nav-compass',
        popover: {
          title: '欢迎来到 StoryTree！',
          description: '这里是导航栏，您可以快速访问各个功能模块。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.hero-actions, .hero-buttons, .btn-create',
        illustration: 'create-start',
        popover: {
          title: '开始创作',
          description: '点击这里可以立即开始创作您的第一个故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#storiesGrid, .stories-grid, .story-list',
        illustration: 'explore',
        popover: {
          title: '故事广场',
          description: '这里展示了社区中的精彩故事，您可以浏览和阅读。接下来让我们去发现页看看更多内容。',
          side: isMobile ? 'bottom' : 'top',
          align: 'center',
          onNextClick: async () => {
            // 完成首页引导，增量标记 completedTour
            this.markStepProgress('completedTour');
            await this.markTourComplete();
            this.navigateToNextPage('discover', 1);
          }
        }
      }
    ];

    return steps;
  }

  /**
   * 发现页引导步骤
   */
  getDiscoverSteps() {
    const isMobile = window.innerWidth <= 768;
    const urlParams = new URLSearchParams(window.location.search);
    const tourStep = parseInt(urlParams.get('tour')) || 0;

    const allSteps = [
      {
        element: '.search-section, .search-input, #searchInput',
        illustration: 'explore',
        popover: {
          title: '搜索故事',
          description: '使用搜索功能快速找到您感兴趣的故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.filter-tabs, .category-tabs, .tabs-container',
        illustration: 'branch-paths',
        popover: {
          title: '筛选分类',
          description: '通过分类标签筛选不同类型的故事。接下来带你了解故事树的核心概念——分支创作！',
          side: isMobile ? 'top' : 'bottom',
          align: 'center',
          onNextClick: async () => {
            // 完成发现页引导，增量标记 browsedDiscover
            this.markStepProgress('browsedDiscover');
            await this.markTourComplete();
            this.navigateToStoryForConcept();
          }
        }
      }
    ];

    if (tourStep >= allSteps.length) {
      console.warn(`[StoryTreeTour] tour step ${tourStep} exceeds discover steps count ${allSteps.length}, skipping`);
      return [];
    }

    return allSteps.slice(tourStep);
  }

  /**
   * AI 辅助创作页引导步骤
   */
  getCreateAiSteps() {
    const isMobile = window.innerWidth <= 768;
    const steps = [
      {
        element: '.page-header, .create-ai-header, h1',
        illustration: 'ai-spark',
        popover: {
          title: 'AI 辅助创作',
          description: '这里提供了四种 AI 辅助创作方式，根据你的创作阶段选择最合适的方式开始。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="project"]',
        illustration: 'write-node',
        popover: {
          title: '💡 智能导入立项',
          description: '如果你已经有完整的想法或故事梗概，AI 会帮你整理成规范的项目立项书，并自动推导生成章节大纲。',
          side: isMobile ? 'top' : 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="outline"]',
        illustration: 'write-node',
        popover: {
          title: '📝 AI 辅助大纲',
          description: '只有模糊想法也没关系！告诉 AI 你的灵感片段，它会帮你完善世界观、角色设定和分章大纲。',
          side: isMobile ? 'top' : 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="pastiche"]',
        illustration: 'write-node',
        popover: {
          title: '📚 经典仿写',
          description: '基于已有作品进行仿写、续写或同人创作。AI 会分析原作风格，帮你保持一致的文风。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-method="template"]',
        illustration: 'write-node',
        popover: {
          title: '🎯 故事模板',
          description: '新手推荐！使用预制模板快速搭建故事框架，降低创作门槛。选择一个模板即可开始。',
          side: 'top',
          align: 'center',
          onNextClick: async () => {
            this.markStepProgress('createdStory');
            await this.markTourComplete();
            this.driver.destroy();
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('tour')) {
              this.navigateToNextPage('write', 4);
            }
          }
        }
      }
    ];

    return steps;
  }

  /**
   * 写作编辑器引导步骤
   */
  getWriteSteps() {
    const isMobile = window.innerWidth <= 768;
    const steps = [];

    // 侧边栏在移动端默认隐藏，仅PC端展示此步骤
    if (!isMobile) {
      steps.push(
        {
          element: '#panelProject',
          illustration: 'node-chapter',
          popover: {
            title: '📋 项目立项书',
            description: '立项书是故事的"蓝图"——包含故事简介、核心主题、目标读者和风格定位。AI 创作时会自动生成，你也可以随时手动编辑完善。',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '.sidebar-tab[data-tab="outline"]',
          illustration: 'node-chapter',
          popover: {
            title: '📝 故事大纲',
            description: '大纲管理故事的章节结构、角色设定和世界观。支持多版本管理，可以在不同构思之间切换。点击此标签即可查看和编辑。',
            side: 'right',
            align: 'start'
          }
        }
      );
    }

    steps.push(
      {
        element: '.chapter-title-input',
        illustration: 'node-chapter',
        popover: {
          title: '章节标题',
          description: '为你的章节起一个吸引人的标题吧。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#editor',
        illustration: 'write-node',
        popover: {
          title: '编辑器',
          description: '这是你的创作空间。支持富文本编辑，可以直接开始写作。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#aiSuggestBtn',
        illustration: 'write-node',
        popover: {
          title: 'AI 续写',
          description: '写到一半没灵感？点击这里让 AI 帮你续写一小段内容，你可以选择采纳或重新生成。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#aiPolishBtn',
        illustration: 'write-node',
        popover: {
          title: 'AI 润色',
          description: '选中一段文字后点击润色，AI 会优化文笔和表达，让你的文字更加流畅优美。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#aiIllustrationBtn',
        illustration: 'write-node',
        popover: {
          title: 'AI 插图',
          description: '根据当前章节内容自动生成配图，让你的故事图文并茂、更具吸引力。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#publishBtn',
        illustration: 'write-node',
        popover: {
          title: '发布章节',
          description: '满意后点击这里发布章节，让更多读者看到你的故事！引导到此结束，祝您创作愉快！',
          side: 'top',
          align: 'end',
          onNextClick: async () => {
            this.markStepProgress('publishedChapter');
            if (!window.onboardingManager || !window.onboardingManager.getProgress().tasks?.completedTour) {
              await this.markTourComplete();
            } else {
              // 已标记过 tour 完成，仅更新 writeGuideSeen
              if (window.onboardingManager) {
                const p = window.onboardingManager.getProgress();
                p.writeGuideSeen = true;
                window.onboardingManager.saveLocalProgress(p);
                await window.onboardingManager.syncProgress(p);
              }
            }
            this.driver.destroy();
          }
        }
      }
    );

    return steps;
  }

  /**
   * 我的故事页引导步骤
   */
  getMyStoriesSteps() {
    const isMobile = window.innerWidth <= 768;
    const steps = [
      {
        element: '.create-story-btn, .btn-create, #createBtn',
        illustration: 'node-chapter',
        popover: {
          title: '创建新故事',
          description: '点击这里开始创建一个全新的故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.filter-tabs, .nav-tabs, .tabs-container',
        illustration: 'branch-paths',
        popover: {
          title: '筛选故事',
          description: '在「我创建的」和「我协作的」之间切换，快速找到你参与的故事。',
          side: isMobile ? 'top' : 'bottom',
          align: 'center'
        }
      },
      {
        element: '#storiesContainer, .story-list, .stories-grid',
        illustration: 'explore',
        popover: {
          title: '故事列表',
          description: '你的所有故事都在这里。点击任意故事卡片可以查看详情或继续创作。',
          side: 'top',
          align: 'center',
          onNextClick: async () => {
            this.driver.destroy();
          }
        }
      }
    ];

    return steps;
  }

  /**
   * 跳转到示例故事页面并触发概念引导
   * 先尝试获取"反三国演义"，失败则取发现页第一本故事
   */
  navigateToStoryForConcept() {
    // 淡出过渡效果
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';
    setTimeout(() => {
      if (window.onboardingManager) {
        window.onboardingManager._redirectToStoryForConcept();
      } else {
        window.location.href = '/create-ai.html?tour=0';
      }
    }, 300);
  }

  /**
   * 跳转到下一个页面并继续引导（带淡出过渡）
   */
  navigateToNextPage(page, step) {
    const pageUrls = {
      discover: '/discover.html',
      create: '/create-ai.html',
      write: '/write.html',
      'my-stories': '/my-stories.html',
      story: '/story.html'
    };

    const url = pageUrls[page];
    if (!url) return;

    // 淡出过渡效果
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';

    setTimeout(() => {
      window.location.href = `${url}?tour=${step}`;
    }, 300);
  }

  /**
   * 清理 URL 中的 tour 参数
   */
  /**
   * 指数退避等待元素出现
   * @param {string} selector - CSS 选择器
   * @param {number} attempt - 当前尝试次数（内部使用）
   * @param {Function} onFound - 找到元素后的回调
   * @param {Function} onTimeout - 超时回调
   * @param {number} [maxAttempts=5] - 最大重试次数
   */
  _waitForElement(selector, attempt, onFound, onTimeout, maxAttempts = 5) {
    if (attempt >= maxAttempts) {
      onTimeout();
      return;
    }
    const delay = Math.min(200 * Math.pow(2, attempt), 5000); // 200ms, 400ms, 800ms, 1600ms, 3200ms
    setTimeout(() => {
      if (document.querySelector(selector)) {
        onFound();
      } else {
        this._waitForElement(selector, attempt + 1, onFound, onTimeout, maxAttempts);
      }
    }, delay);
  }

  /**
   * 获取迷你 SVG 插图（概念引导动画风格）
   * @param {string} type - 插图类型: tree-grow | node-chapter | branch-paths | write-node | explore | nav-compass | create-start | ai-spark
   * @returns {string} SVG HTML 字符串
   */
  _getIllustrationSVG(type) {
    const illustrations = {
      'tree-grow': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-tree-grow">
          <rect x="96" y="60" width="8" height="50" rx="4" fill="#8B5E3C" class="st-svg-trunk"/>
          <g class="st-anim-delay-1">
            <path d="M100 60 Q60 30 30 20" stroke="#4CAF50" stroke-width="4" stroke-linecap="round" class="st-svg-branch"/>
            <circle cx="30" cy="20" r="8" fill="#66BB6A" class="st-svg-leaf"/>
          </g>
          <g class="st-anim-delay-2">
            <path d="M100 55 Q120 25 160 15" stroke="#4CAF50" stroke-width="4" stroke-linecap="round" class="st-svg-branch"/>
            <circle cx="160" cy="15" r="8" fill="#66BB6A" class="st-svg-leaf"/>
          </g>
          <g class="st-anim-delay-3">
            <path d="M100 50 Q70 40 50 50" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" class="st-svg-branch"/>
            <circle cx="50" cy="50" r="6" fill="#81C784" class="st-svg-leaf"/>
          </g>
          <g class="st-anim-delay-4">
            <path d="M100 48 Q140 35 170 45" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" class="st-svg-branch"/>
            <circle cx="170" cy="45" r="6" fill="#81C784" class="st-svg-leaf"/>
          </g>
        </g>
      </svg>`,
      'node-chapter': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-node-pulse">
          <circle cx="100" cy="55" r="30" fill="#FF9800" opacity="0.15" class="st-svg-pulse"/>
          <circle cx="100" cy="55" r="22" fill="#FF9800" opacity="0.3" class="st-svg-pulse st-anim-delay-1"/>
          <circle cx="100" cy="55" r="14" fill="#FF9800" class="st-svg-node"/>
          <text x="100" y="60" text-anchor="middle" fill="white" font-size="12" font-weight="bold">1</text>
        </g>
        <g class="st-anim-delay-2">
          <line x1="100" y1="85" x2="100" y2="105" stroke="#FF9800" stroke-width="3" stroke-linecap="round"/>
          <circle cx="100" cy="110" r="5" fill="#FF9800" class="st-svg-new-node"/>
        </g>
      </svg>`,
      'branch-paths': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-write">
          <g class="st-anim-delay-1">
            <rect x="20" y="35" width="45" height="22" rx="11" fill="#2196F3" opacity="0.15" stroke="#2196F3" stroke-width="1.5"/>
            <text x="42" y="50" text-anchor="middle" fill="#2196F3" font-size="9" opacity="0.6">全部</text>
          </g>
          <g class="st-anim-delay-2">
            <rect x="72" y="35" width="45" height="22" rx="11" fill="#2196F3" class="st-svg-cursor"/>
            <text x="94" y="50" text-anchor="middle" fill="white" font-size="9" font-weight="bold">奇幻</text>
          </g>
          <g class="st-anim-delay-3">
            <rect x="124" y="35" width="45" height="22" rx="11" fill="#2196F3" opacity="0.15" stroke="#2196F3" stroke-width="1.5"/>
            <text x="146" y="50" text-anchor="middle" fill="#2196F3" font-size="9" opacity="0.6">悬疑</text>
          </g>
          <g class="st-anim-delay-1">
            <line x1="94" y1="62" x2="94" y2="75" stroke="#2196F3" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            <rect x="65" y="78" width="58" height="14" rx="4" fill="#2196F3" opacity="0.08"/>
            <rect x="72" y="82" width="44" height="2.5" rx="1" fill="#2196F3" opacity="0.3"/>
            <rect x="72" y="87" width="30" height="2.5" rx="1" fill="#2196F3" opacity="0.2"/>
          </g>
        </g>
      </svg>`,
      'write-node': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-write">
          <rect x="30" y="20" width="140" height="80" rx="8" fill="#9C27B0" opacity="0.1" class="st-svg-write-panel"/>
          <rect x="30" y="20" width="140" height="80" rx="8" stroke="#9C27B0" stroke-width="2" fill="none"/>
          <g class="st-anim-delay-1">
            <rect x="45" y="35" width="80" height="4" rx="2" fill="#9C27B0" opacity="0.5"/>
            <rect x="45" y="45" width="110" height="3" rx="1.5" fill="#9C27B0" opacity="0.3"/>
            <rect x="45" y="53" width="90" height="3" rx="1.5" fill="#9C27B0" opacity="0.3"/>
            <rect x="45" y="61" width="100" height="3" rx="1.5" fill="#9C27B0" opacity="0.3"/>
          </g>
          <g class="st-anim-delay-2">
            <rect x="135" y="35" width="20" height="4" rx="2" fill="#9C27B0" opacity="0.7" class="st-svg-cursor"/>
          </g>
        </g>
      </svg>`,
      'explore': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-explore">
          <circle cx="100" cy="55" r="35" stroke="#00BCD4" stroke-width="2" stroke-dasharray="4 3" opacity="0.5"/>
          <circle cx="100" cy="55" r="6" fill="#00BCD4" class="st-svg-person"/>
          <g class="st-anim-delay-1">
            <circle cx="70" cy="40" r="4" fill="#00BCD4" opacity="0.7" class="st-svg-stars"/>
            <circle cx="130" cy="35" r="3" fill="#00BCD4" opacity="0.5" class="st-svg-stars"/>
            <circle cx="85" cy="75" r="3.5" fill="#00BCD4" opacity="0.6" class="st-svg-stars"/>
            <circle cx="120" cy="70" r="4" fill="#00BCD4" opacity="0.7" class="st-svg-stars"/>
            <circle cx="55" cy="60" r="2.5" fill="#00BCD4" opacity="0.4" class="st-svg-stars"/>
            <circle cx="145" cy="55" r="2.5" fill="#00BCD4" opacity="0.4" class="st-svg-stars"/>
          </g>
        </g>
      </svg>`,
      'nav-compass': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-explore">
          <circle cx="100" cy="55" r="38" stroke="#FF7043" stroke-width="2" fill="none" opacity="0.3"/>
          <circle cx="100" cy="55" r="30" stroke="#FF7043" stroke-width="2" fill="none" opacity="0.5"/>
          <g class="st-anim-delay-1">
            <polygon points="100,30 106,55 100,50 94,55" fill="#FF7043"/>
            <polygon points="100,80 94,55 100,60 106,55" fill="#FFAB91"/>
          </g>
          <circle cx="100" cy="55" r="4" fill="#D84315"/>
          <g class="st-anim-delay-2">
            <text x="100" y="24" text-anchor="middle" fill="#FF7043" font-size="10" font-weight="bold">N</text>
            <text x="100" y="104" text-anchor="middle" fill="#FFAB91" font-size="9">S</text>
            <text x="138" y="59" text-anchor="middle" fill="#FFAB91" font-size="9">E</text>
            <text x="62" y="59" text-anchor="middle" fill="#FFAB91" font-size="9">W</text>
          </g>
        </g>
      </svg>`,
      'create-start': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-write">
          <rect x="45" y="30" width="110" height="50" rx="25" fill="#4CAF50" opacity="0.15" class="st-svg-write-panel"/>
          <rect x="45" y="30" width="110" height="50" rx="25" stroke="#4CAF50" stroke-width="2" fill="none"/>
          <g class="st-anim-delay-1">
            <text x="100" y="60" text-anchor="middle" fill="#4CAF50" font-size="14" font-weight="bold">✍ 创作</text>
          </g>
          <g class="st-anim-delay-2">
            <circle cx="155" cy="55" r="18" fill="#4CAF50" opacity="0.2" class="st-svg-cursor"/>
            <circle cx="155" cy="55" r="12" fill="#4CAF50" opacity="0.4" class="st-svg-cursor"/>
            <circle cx="155" cy="55" r="6" fill="#4CAF50" class="st-svg-cursor"/>
          </g>
          <g class="st-anim-delay-3">
            <path d="M100 85 L100 100" stroke="#4CAF50" stroke-width="2" stroke-dasharray="3 2" opacity="0.5"/>
            <rect x="80" y="100" width="40" height="3" rx="1.5" fill="#4CAF50" opacity="0.3"/>
            <rect x="85" y="106" width="30" height="3" rx="1.5" fill="#4CAF50" opacity="0.2"/>
          </g>
        </g>
      </svg>`,
      'ai-spark': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g class="st-anim-node-pulse">
          <g class="st-anim-delay-1">
            <path d="M100 25 L105 45 L125 50 L105 55 L100 75 L95 55 L75 50 L95 45 Z" fill="#7C4DFF" opacity="0.8" class="st-svg-spark"/>
          </g>
          <g class="st-anim-delay-2">
            <circle cx="60" cy="35" r="3" fill="#B388FF" opacity="0.6" class="st-svg-stars"/>
            <circle cx="140" cy="40" r="4" fill="#B388FF" opacity="0.5" class="st-svg-stars"/>
            <circle cx="50" cy="70" r="2.5" fill="#B388FF" opacity="0.4" class="st-svg-stars"/>
            <circle cx="150" cy="75" r="3.5" fill="#B388FF" opacity="0.5" class="st-svg-stars"/>
            <circle cx="75" cy="90" r="2" fill="#B388FF" opacity="0.3" class="st-svg-stars"/>
            <circle cx="130" cy="95" r="2" fill="#B388FF" opacity="0.3" class="st-svg-stars"/>
          </g>
          <g class="st-anim-delay-3">
            <rect x="70" y="85" width="60" height="20" rx="4" fill="#7C4DFF" opacity="0.12"/>
            <rect x="80" y="92" width="40" height="2.5" rx="1" fill="#7C4DFF" opacity="0.4"/>
            <rect x="80" y="98" width="30" height="2.5" rx="1" fill="#7C4DFF" opacity="0.3"/>
          </g>
        </g>
      </svg>`
    };
    return illustrations[type] || '';
  }

  clearTourParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * 增量标记单个步骤完成（跨页面跳转时调用）
   * 不标记 has_seen_tour，仅更新 progress.tasks 中对应的 key
   * @param {string} taskKey - 任务键名，如 'completedTour'、'browsedDiscover'
   */
  markStepProgress(taskKey) {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      // 使用 onboarding-manager 的 getProgress 确保合并 server + local
      const progress = window.onboardingManager
        ? window.onboardingManager.getProgress()
        : (() => {
            const s = localStorage.getItem('st_onboarding_progress');
            return s ? JSON.parse(s) : { tasks: {} };
          })();
      if (!progress.tasks) progress.tasks = {};

      // 已标记则跳过
      if (progress.tasks[taskKey]) return;

      progress.tasks[taskKey] = true;
      progress.lastUpdated = new Date().toISOString();

      if (window.onboardingManager) {
        window.onboardingManager.saveLocalProgress(progress);
        // 用 fetch + fireAndForget 而非 sendBeacon（sendBeacon 无法设置 Auth header）
        window.onboardingManager.syncProgress(progress, { fireAndForget: true });
      } else {
        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
      }

      // 祝贺检查
      if (window.onboardingManager) {
        window.onboardingManager.tryCelebrate(progress, { deferred: true });
      }
    } catch (e) {
      console.warn('[StoryTreeTour] markStepProgress failed:', e);
    }
  }

  /**
   * 标记引导已完成（调用后端 API）
   */
  async markTourComplete() {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        console.warn('[StoryTreeTour] No auth token found, skipping tour completion API call');
        return;
      }

      // 防重：检查是否已标记过
      const userStateStr = localStorage.getItem('st_user_state');
      if (userStateStr) {
        try {
          const userState = JSON.parse(userStateStr);
          if (userState.has_seen_tour) {
            // 已标记过，仅更新本地 progress，跳过 API 调用
            const progress = window.onboardingManager
              ? window.onboardingManager.getProgress()
              : (() => {
                  const s = localStorage.getItem('st_onboarding_progress');
                  return s ? JSON.parse(s) : { tasks: {} };
                })();
            if (!progress.tasks) progress.tasks = {};
            progress.tasks.completedTour = true;
            progress.tourCompleted = true;
            if (this.currentPage === 'write') {
              progress.writeGuideSeen = true;
            }
            if (window.onboardingManager) {
              window.onboardingManager.saveLocalProgress(progress);
              await window.onboardingManager.syncProgress(progress);
            } else {
              localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
            }
            return;
          }
        } catch (e) { /* ignore */ }
      }

      // 1. 标记 has_seen_tour
      const response = await fetch('/api/auth/tour-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        keepalive: true
      });

      if (!response.ok) {
        console.error('[StoryTreeTour] Failed to mark tour as complete:', response.status, response.statusText);
      }

      // 2. 同步更新 onboarding progress 中的相关任务
      // 只标记 tour 完成本身，不代标记其他任务（browsedDiscover/viewedStoryTree 等由各自触发点独立标记）
      const progress = window.onboardingManager
        ? window.onboardingManager.getProgress()
        : (() => {
            const s = localStorage.getItem('st_onboarding_progress');
            return s ? JSON.parse(s) : { tasks: {} };
          })();
      if (!progress.tasks) progress.tasks = {};
      progress.tasks.completedTour = true;
      progress.tourCompleted = true;
      if (this.currentPage === 'write') {
        progress.writeGuideSeen = true;
      }
      if (window.onboardingManager) {
        window.onboardingManager.saveLocalProgress(progress);
      } else {
        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
      }

      // 同步到服务器
      if (window.onboardingManager) {
        await window.onboardingManager.syncProgress(progress);
      }

      // 更新本地 userState 缓存（仅更新 has_seen_tour，onboarding_progress 已由 syncProgress 处理）
      const userStateStr2 = localStorage.getItem('st_user_state');
      if (userStateStr2) {
        try {
          const userState = JSON.parse(userStateStr2);
          userState.has_seen_tour = true;
          userState._ts = Date.now();
          localStorage.setItem('st_user_state', JSON.stringify(userState));
        } catch (e) { /* ignore */ }
      }

      // 同步内存中的 userState，使 markTourSeen 的防重检查生效
      if (window.onboardingManager && window.onboardingManager.userState) {
        window.onboardingManager.userState.has_seen_tour = true;
      }
    } catch (error) {
      console.error('[StoryTreeTour] Error marking tour complete:', error);
    }
  }

  /**
   * 检查是否应该自动启动引导
   * 在页面加载时调用，根据 URL 参数或用户状态决定
   */
  async checkAndStartTour(page) {
    const urlParams = new URLSearchParams(window.location.search);
    const hasTourParam = urlParams.has('tour');

    // 如果 URL 有 tour 参数（跨页面引导），延迟启动以等待页面渲染完成
    if (hasTourParam) {
      // 淡入效果：页面从透明恢复
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease';
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });

      setTimeout(() => {
        this.startTour(page);
      }, 500);
      return;
    }
  }
}

// 导出全局实例
window.storyTreeTour = new StoryTreeTour();
