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
      overlayOpacity: 0.6,
      stagePadding: 12,
      stageRadius: 10,
      popoverOffset: 15,
      // 每个步骤渲染时注入"跳过引导"按钮
      onPopoverRender: (popover) => {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'st-tour-skip-btn';
        skipBtn.textContent = '跳过引导';
        skipBtn.addEventListener('click', async () => {
          await self.markTourComplete();
          self.driver.destroy();
        });
        popover.footerButtons.appendChild(skipBtn);
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

    // 验证第一步的目标元素是否存在，不存在则延迟重试一次
    const firstEl = steps[0].element;
    if (firstEl && !document.querySelector(firstEl)) {
      console.warn(`[StoryTreeTour] Target element "${firstEl}" not found, retrying in 1s...`);
      setTimeout(() => {
        if (document.querySelector(firstEl)) {
          this.driver.setSteps(steps);
          this.driver.drive();
        } else {
          console.error(`[StoryTreeTour] Target element "${firstEl}" still not found, aborting tour.`);
          this.clearTourParam();
        }
      }, 1000);
      return;
    }

    this.driver.setSteps(steps);
    this.driver.drive();
  }

  /**
   * 根据页面获取引导步骤
   */
  getStepsForPage(page) {
    const stepsMap = {
      index: this.getIndexSteps(),
      discover: this.getDiscoverSteps(),
      create: this.getCreateSteps(),
      write: this.getWriteSteps(),
      'story-tree': this.getStoryTreeSteps(),
      'my-stories': this.getMyStoriesSteps()
    };

    return stepsMap[page] || [];
  }

  /**
   * 首页引导步骤
   */
  getIndexSteps() {
    return [
      {
        element: '.navbar',
        popover: {
          title: '欢迎来到 StoryTree！',
          description: '这里是导航栏，您可以快速访问各个功能模块。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.hero-actions',
        popover: {
          title: '开始创作',
          description: '点击这里可以立即开始创作您的第一个故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#storiesGrid',
        popover: {
          title: '故事广场',
          description: '这里展示了社区中的精彩故事，您可以浏览和阅读。接下来让我们去发现页看看更多内容。',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            this.navigateToNextPage('discover', 1);
          }
        }
      }
    ];
  }

  /**
   * 发现页引导步骤
   */
  getDiscoverSteps() {
    const urlParams = new URLSearchParams(window.location.search);
    const tourStep = parseInt(urlParams.get('tour')) || 0;

    return [
      {
        element: '.search-section',
        popover: {
          title: '搜索故事',
          description: '使用搜索功能快速找到您感兴趣的故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.filter-tabs',
        popover: {
          title: '筛选分类',
          description: '通过分类标签筛选不同类型的故事。现在让我们去创作页开始您的创作之旅！',
          side: 'bottom',
          align: 'center',
          onNextClick: () => {
            this.navigateToNextPage('create', 0);
          }
        }
      }
    ].slice(tourStep);
  }

  /**
   * 创作页引导步骤
   */
  getCreateSteps() {
    const urlParams = new URLSearchParams(window.location.search);
    const tourStep = parseInt(urlParams.get('tour')) || 0;

    return [
      {
        element: '.ai-creation-banner',
        popover: {
          title: 'AI 辅助创作',
          description: '如果还没有明确的想法，可以试试 AI 辅助创作——支持智能导入立项、生成大纲、经典仿写和故事模板。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#title',
        popover: {
          title: '故事标题',
          description: '给你的故事起一个吸引人的标题，好标题能让读者第一眼就产生兴趣。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#description',
        popover: {
          title: '故事简介',
          description: '用几句话描述你的故事核心内容，让读者快速了解故事的主题和看点。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#genre',
        popover: {
          title: '选择类型',
          description: '为故事选择一个类型标签，帮助读者在发现页更快找到你的作品。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#submitBtn',
        popover: {
          title: '创建故事',
          description: '填好信息后点击这里创建故事，创建成功后就可以开始撰写第一个章节了！引导到此结束，祝您创作愉快！',
          side: 'top',
          align: 'end',
          onNextClick: async () => {
            await this.markTourComplete();
            this.driver.destroy();
          }
        }
      }
    ].slice(tourStep);
  }

  /**
   * 写作编辑器引导步骤
   */
  getWriteSteps() {
    return [
      {
        element: '#writeSidebar',
        popover: {
          title: '侧边栏：立项书 & 大纲',
          description: '左侧侧边栏包含故事立项书和大纲管理，帮助你规划故事结构。',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.chapter-title-input',
        popover: {
          title: '章节标题',
          description: '为你的章节起一个吸引人的标题吧。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#editor',
        popover: {
          title: '编辑器',
          description: '这是你的创作空间。支持富文本编辑，可以直接开始写作。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.write-actions',
        popover: {
          title: 'AI 助手 & 操作',
          description: 'AI 润色、AI 续写、AI 插图帮你提升创作效率。写完后可以保存草稿或直接发布。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#publishBtn',
        popover: {
          title: '发布章节',
          description: '满意后点击这里发布章节，让更多读者看到你的故事！',
          side: 'top',
          align: 'end',
          onNextClick: async () => {
            await this.markTourComplete();
            this.driver.destroy();
          }
        }
      }
    ];
  }

  /**
   * 故事树页面引导步骤
   */
  getStoryTreeSteps() {
    return [
      {
        element: '.tree-container',
        popover: {
          title: '故事树全景',
          description: '这是故事的树状分支结构图。每个节点代表一个章节，分支代表不同的故事走向。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tree-toolbar',
        popover: {
          title: '工具栏',
          description: '在这里可以切换布局方式（垂直/水平/辐射）、展开折叠节点、缩放画布。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#layoutVertical',
        popover: {
          title: '布局切换',
          description: '尝试不同的布局方式，找到最适合你浏览故事树的视角。',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#zoomIn',
        popover: {
          title: '缩放控制',
          description: '节点太多看不清？用缩放按钮调整画面大小。',
          side: 'left',
          align: 'center',
          onNextClick: async () => {
            this.driver.destroy();
          }
        }
      }
    ];
  }

  /**
   * 我的故事页引导步骤
   */
  getMyStoriesSteps() {
    return [
      {
        element: '.create-story-btn',
        popover: {
          title: '创建新故事',
          description: '点击这里开始创建一个全新的故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.filter-tabs',
        popover: {
          title: '筛选故事',
          description: '在「我创建的」和「我协作的」之间切换，快速找到你参与的故事。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#storiesContainer',
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
  }

  /**
   * 跳转到下一个页面并继续引导（带淡出过渡）
   */
  navigateToNextPage(page, step) {
    const pageUrls = {
      discover: '/discover.html',
      create: '/create.html',
      write: '/write.html',
      'story-tree': '/story-tree.html',
      'my-stories': '/my-stories.html'
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
  clearTourParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    window.history.replaceState({}, '', url.toString());
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

      const response = await fetch('/api/auth/tour-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[StoryTreeTour] Failed to mark tour as complete:', response.status, response.statusText);
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

    // 否则检查用户是否已看过引导
    if (page === 'index') {
      const shouldShow = await this.shouldShowTour();
      if (shouldShow) {
        this.startTour('index');
      }
    }
  }

  /**
   * 检查用户是否需要看引导（仅首页调用）
   */
  async shouldShowTour() {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        console.log('[StoryTreeTour] No token found, skipping tour check');
        return false;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('[StoryTreeTour] /api/auth/me failed:', response.status, response.statusText);
        return false;
      }

      const data = await response.json();
      const hasSeen = data.user?.has_seen_tour;
      console.log('[StoryTreeTour] has_seen_tour:', hasSeen);
      return data.user && !hasSeen;
    } catch (error) {
      console.error('[StoryTreeTour] Error checking tour status:', error);
      return false;
    }
  }
}

// 导出全局实例
window.storyTreeTour = new StoryTreeTour();
