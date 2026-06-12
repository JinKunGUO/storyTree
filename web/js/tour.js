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
      create: this.getCreateSteps(),
      'create-ai': this.getCreateAiSteps(),
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
          description: '通过分类标签筛选不同类型的故事。接下来带你了解故事树的核心概念——分支创作！',
          side: 'bottom',
          align: 'center',
          onNextClick: () => {
            this.navigateToStoryForConcept();
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
          title: '方式一：AI 辅助创作',
          description: '点击这里进入 AI 辅助创作页面，支持智能导入立项、生成大纲、经典仿写和故事模板四种方式，适合还没有明确想法的创作者。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#title',
        popover: {
          title: '方式二：手动创建故事',
          description: '如果你已经有了想法，可以直接在下方填写故事信息。首先给你的故事起一个吸引人的标题。',
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
   * AI 辅助创作页引导步骤
   */
  getCreateAiSteps() {
    return [
      {
        element: '.page-header',
        popover: {
          title: 'AI 辅助创作',
          description: '这里提供了四种 AI 辅助创作方式，根据你的创作阶段选择最合适的方式开始。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="project"]',
        popover: {
          title: '💡 智能导入立项',
          description: '如果你已经有完整的想法或故事梗概，AI 会帮你整理成规范的项目立项书，并自动推导生成章节大纲。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="outline"]',
        popover: {
          title: '📝 AI 辅助大纲',
          description: '只有模糊想法也没关系！告诉 AI 你的灵感片段，它会帮你完善世界观、角色设定和分章大纲。',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-method="pastiche"]',
        popover: {
          title: '📚 经典仿写',
          description: '基于已有作品进行仿写、续写或同人创作。AI 会分析原作风格，帮你保持一致的文风。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-method="template"]',
        popover: {
          title: '🎯 故事模板',
          description: '新手推荐！使用预制模板快速搭建故事框架，降低创作门槛。选择一个模板即可开始。',
          side: 'top',
          align: 'center',
          onNextClick: async () => {
            await this.markTourComplete();
            this.driver.destroy();
          }
        }
      }
    ];
  }

  /**
   * 写作编辑器引导步骤
   */
  getWriteSteps() {
    const isMobile = window.innerWidth <= 768;
    const steps = [];

    // 侧边栏在移动端默认隐藏，仅PC端展示此步骤
    if (!isMobile) {
      steps.push({
        element: '#writeSidebar',
        popover: {
          title: '侧边栏：立项书 & 大纲',
          description: '左侧侧边栏包含故事立项书和大纲管理，帮助你规划故事结构。',
          side: 'right',
          align: 'start'
        }
      });
    }

    steps.push(
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
        element: '#aiSuggestBtn',
        popover: {
          title: 'AI 续写',
          description: '写到一半没灵感？点击这里让 AI 帮你续写一小段内容，你可以选择采纳或重新生成。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#aiPolishBtn',
        popover: {
          title: 'AI 润色',
          description: '选中一段文字后点击润色，AI 会优化文笔和表达，让你的文字更加流畅优美。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#aiIllustrationBtn',
        popover: {
          title: 'AI 插图',
          description: '根据当前章节内容自动生成配图，让你的故事图文并茂、更具吸引力。',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#publishBtn',
        popover: {
          title: '发布章节',
          description: '满意后点击这里发布章节，让更多读者看到你的故事！引导到此结束，祝您创作愉快！',
          side: 'top',
          align: 'end',
          onNextClick: async () => {
            // 仅在主 tour 流程中标记完成，独立写作引导不重复标记
            const progressStr = localStorage.getItem('st_onboarding_progress');
            const progress = progressStr ? JSON.parse(progressStr) : {};
            if (!progress.tasks || !progress.tasks.completedTour) {
              await this.markTourComplete();
            }
            this.driver.destroy();
          }
        }
      }
    );

    return steps;
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
   * 跳转到示例故事页面并触发概念引导
   * 先尝试获取"反三国演义"，失败则取发现页第一本故事
   */
  async navigateToStoryForConcept() {
    // 淡出过渡效果
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';

    let storyId = null;

    try {
      // 尝试搜索"反三国演义"
      const res = await fetch('/api/stories?search=反三国演义&limit=1');
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length > 0) {
          storyId = data.stories[0].id;
        }
      }

      // fallback：获取发现页第一本故事
      if (!storyId) {
        const res2 = await fetch('/api/stories?limit=1');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.stories && data2.stories.length > 0) {
            storyId = data2.stories[0].id;
          }
        }
      }
    } catch (e) {
      console.warn('[StoryTreeTour] Failed to fetch example story:', e);
    }

    setTimeout(() => {
      if (storyId) {
        window.location.href = `/story.html?id=${storyId}&guide=concept`;
      } else {
        // 最终 fallback：跳转到创建页继续引导
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

      // 1. 标记 has_seen_tour
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

      // 2. 同步更新 onboarding progress 中的相关任务
      // tour 流程经过了 index → discover → story(concept) → create-ai/write
      // 因此完成 tour 时，browsedDiscover 和 viewedStoryTree 也应标记为完成
      const progressStr = localStorage.getItem('st_onboarding_progress');
      let progress = progressStr ? JSON.parse(progressStr) : {};
      if (!progress.tasks) progress.tasks = {};
      progress.tasks.completedTour = true;
      progress.tasks.browsedDiscover = true;
      progress.tasks.viewedStoryTree = true;
      progress.tourCompleted = true;
      progress.conceptGuideSeen = true;
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));

      // 同步到服务器
      await fetch('/api/auth/onboarding-progress', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress })
      });

      // 更新本地 userState 缓存
      const userStateStr = localStorage.getItem('st_user_state');
      if (userStateStr) {
        try {
          const userState = JSON.parse(userStateStr);
          userState.has_seen_tour = true;
          userState.onboarding_progress = progress;
          userState._ts = Date.now();
          localStorage.setItem('st_user_state', JSON.stringify(userState));
        } catch (e) { /* ignore */ }
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
