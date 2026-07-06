/**
 * StoryTree 欢迎弹窗 + 任务清单组件
 * 新用户首次登录时显示，含任务清单跟踪进度
 */

class WelcomeModal {
  constructor() {
    this.overlay = null;
    this.isVisible = false;
  }

  /**
   * 显示欢迎弹窗
   * @param {Object} options - 可选配置
   * @param {boolean} options.isAutoShow - 是否为自动弹出（首次进入时）
   */
  show(options = {}) {
    if (this.isVisible) return;
    this.isVisible = true;

    const progress = window.onboardingManager
      ? window.onboardingManager.getProgress()
      : { tasks: {} };

    this.overlay = document.createElement('div');
    this.overlay.className = 'st-welcome-overlay';
    this.overlay.innerHTML = this._buildHTML(progress);

    document.body.appendChild(this.overlay);
    this._bindEvents();

    // 仅首次自动弹出时标记 welcome 已看过，防止每次进首页都弹出
    // markTourSeen 移至用户点击"开始体验引导"按钮时调用，避免仅看到弹窗就被标记
    if (options.isAutoShow && window.onboardingManager) {
      window.onboardingManager.markWelcomeSeen();
    }
  }

  /**
   * 关闭弹窗
   */
  hide() {
    if (!this.overlay) return;
    this.overlay.style.animation = 'stWelcomeFadeIn 0.2s ease reverse';
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
      this.isVisible = false;
    }, 200);
  }

  /**
   * 构建弹窗 HTML
   */
  _buildHTML(progress) {
    const tasks = this._getTaskList(progress);
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;

    return `
      <div class="st-welcome-modal" role="dialog" aria-labelledby="st-welcome-title" aria-modal="true">
        <div class="st-welcome-header">
          <img src="/assets/logo.png" alt="StoryTree" class="st-welcome-logo" onerror="this.style.display='none'">
          <h2 class="st-welcome-title" id="st-welcome-title">欢迎来到 StoryTree！</h2>
          <p class="st-welcome-subtitle">在这里，每个故事都是一棵树。你可以创作、分支、协作，让故事生长出无限可能。</p>
        </div>

        <ul class="st-task-list" aria-label="新手任务清单">
          ${tasks.map(task => `
            <li class="st-task-item ${task.completed ? 'completed' : ''}" data-task="${task.key}" ${task.href ? `data-href="${task.href}"` : ''}>
              <span class="st-task-icon">
                ${task.completed ? '<i class="fas fa-check"></i>' : task.icon}
              </span>
              <div class="st-task-content">
                <p class="st-task-title">${task.title}</p>
                <p class="st-task-desc">${task.desc}</p>
              </div>
              <span class="st-task-check">
                ${task.completed ? '<i class="fas fa-check" style="font-size: 10px;"></i>' : ''}
              </span>
            </li>
          `).join('')}
        </ul>

        <div class="st-welcome-footer">
          <button class="st-welcome-btn-primary" id="stWelcomeStart">
            ${completedCount === 0 ? '开始体验引导' : `继续探索 (${completedCount}/${totalCount})`}
          </button>
          <button class="st-welcome-btn-secondary" id="stWelcomeSkip">
            ${completedCount === 0 ? '跳过，自己探索' : '关闭'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 获取任务列表
   */
  _getTaskList(progress) {
    const tasks = progress && progress.tasks ? progress.tasks : {};

    return [
      {
        key: 'completedTour',
        icon: '<i class="fas fa-route"></i>',
        title: '熟悉平台功能',
        desc: '跟随引导快速了解各页面功能',
        completed: !!tasks.completedTour,
        href: null // 启动 tour
      },
      {
        key: 'browsedDiscover',
        icon: '<i class="fas fa-compass"></i>',
        title: '浏览发现页',
        desc: '探索社区中的精彩故事',
        completed: !!tasks.browsedDiscover,
        href: '/discover.html?guide=discover'
      },
      {
        key: 'viewedStoryTree',
        icon: '<i class="fas fa-sitemap"></i>',
        title: '了解故事树概念',
        desc: '理解树状分支创作模式',
        completed: !!tasks.viewedStoryTree,
        href: null // 触发概念讲解
      },
      {
        key: 'createdStory',
        icon: '<i class="fas fa-pen-fancy"></i>',
        title: '创建第一个故事',
        desc: '开启你的创作之旅',
        completed: !!tasks.createdStory,
        href: '/create-ai.html?tour=0'
      },
      {
        key: 'publishedChapter',
        icon: '<i class="fas fa-paper-plane"></i>',
        title: '发布第一个章节',
        desc: '让你的故事被更多人看到',
        completed: !!tasks.publishedChapter,
        href: '/my-stories.html?guide=publish'
      }
    ];
  }

  /**
   * 绑定事件
   */
  _bindEvents() {
    if (!this.overlay) return;

    // "开始体验" 按钮
    const startBtn = this.overlay.querySelector('#stWelcomeStart');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.hide();
        // 用户主动点击"开始体验引导"时才标记 has_seen_tour
        if (window.onboardingManager) {
          window.onboardingManager.markTourSeen();
        }
        // 启动分步高亮引导
        setTimeout(() => {
          if (window.storyTreeTour) {
            window.storyTreeTour.startTour('index');
          }
        }, 300);
      });
    }

    // "跳过" 按钮
    const skipBtn = this.overlay.querySelector('#stWelcomeSkip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.hide();
        if (window.onboardingManager) {
          window.onboardingManager.markTourSeen();
        }
      });
    }

    // 任务项点击
    const taskItems = this.overlay.querySelectorAll('.st-task-item');
    taskItems.forEach(item => {
      item.addEventListener('click', () => {
        const taskKey = item.dataset.task;
        const href = item.dataset.href;

        if (taskKey === 'completedTour') {
          this.hide();
          setTimeout(() => {
            if (window.storyTreeTour) {
              window.storyTreeTour.startTour('index');
            }
          }, 300);
        } else if (taskKey === 'viewedStoryTree') {
          this.hide();
          if (window.onboardingManager) {
            window.onboardingManager._redirectToStoryForConcept();
          }
        } else if (href) {
          this.hide();
          window.location.href = href;
        }
      });
    });

    // 点击遮罩关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
        if (window.onboardingManager) {
          window.onboardingManager.markTourSeen();
        }
      }
    });

    // ESC 键关闭
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
        if (window.onboardingManager) {
          window.onboardingManager.markTourSeen();
        }
        document.removeEventListener('keydown', this._escHandler);
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }
}

// 导出全局实例
window.welcomeModal = new WelcomeModal();
