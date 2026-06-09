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

    this.driver = window.driver({
      showProgress: true,
      allowClose: false,
      overlayOpacity: 0.7,
      stagePadding: 10,
      stageRadius: 8,
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
      create: this.getCreateSteps()
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
            this.navigateToNextPage('create', 2);
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
        element: '#createStoryForm',
        popover: {
          title: '创作您的故事',
          description: '在这里填写故事标题、内容和设置，开始您的创作。引导到此结束，祝您创作愉快！',
          side: 'left',
          align: 'start',
          onNextClick: async () => {
            await this.markTourComplete();
            this.driver.destroy();
          }
        }
      }
    ].slice(tourStep);
  }

  /**
   * 跳转到下一个页面并继续引导（带淡出过渡）
   */
  navigateToNextPage(page, step) {
    const pageUrls = {
      discover: '/discover.html',
      create: '/create.html'
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
