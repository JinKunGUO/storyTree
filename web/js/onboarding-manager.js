/**
 * StoryTree 新手引导管理器
 * 总调度器，协调欢迎弹窗、分步高亮引导、概念讲解、空状态引导
 */

class OnboardingManager {
  constructor() {
    this.currentPage = null;
    this.userState = null; // { has_seen_tour, onboarding_progress }
    this.progressCache = null;
    this.initialized = false;
  }

  /**
   * 初始化入口 — 每个页面 DOMContentLoaded 时调用
   * @param {string} pageName - 页面名称
   */
  async init(pageName) {
    if (this.initialized) return;
    this.initialized = true;
    this.currentPage = pageName;

    // 从 localStorage 读取缓存进度
    this.progressCache = this.getLocalProgress();

    // 检查 URL 参数中的引导指令
    const urlParams = new URLSearchParams(window.location.search);
    const hasTourParam = urlParams.has('tour');
    const hasGuideParam = urlParams.get('guide');

    // 如果有 tour 参数，直接启动分步引导（跨页面续接）
    if (hasTourParam && window.storyTreeTour) {
      window.storyTreeTour.checkAndStartTour(pageName);
      return;
    }

    // 如果有 guide 参数，触发对应引导
    if (hasGuideParam === 'concept' && window.conceptGuide) {
      window.conceptGuide.show();
      return;
    }

    // ?welcome=1 强制显示欢迎弹窗（测试用）
    if (urlParams.get('welcome') === '1' && window.welcomeModal) {
      setTimeout(() => window.welcomeModal.show(), 500);
      return;
    }

    // 获取用户状态
    await this.fetchUserState();

    if (!this.userState) return; // 未登录，不触发引导

    // 决策引导流程
    this.decideOnboarding();
  }

  /**
   * 获取用户状态（优先 localStorage 缓存，超过 5 分钟才请求后端）
   */
  async fetchUserState() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    // 检查缓存是否新鲜（5 分钟内）
    const cached = localStorage.getItem('st_user_state');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed._ts < 5 * 60 * 1000) {
          this.userState = parsed;
          return;
        }
      } catch (e) { /* 忽略解析错误 */ }
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.user) {
        this.userState = {
          has_seen_tour: data.user.has_seen_tour,
          onboarding_progress: data.user.onboarding_progress
            ? JSON.parse(data.user.onboarding_progress)
            : null,
          _ts: Date.now()
        };
        localStorage.setItem('st_user_state', JSON.stringify(this.userState));
      }
    } catch (error) {
      console.error('[OnboardingManager] 获取用户状态失败:', error);
    }
  }

  /**
   * 根据用户状态决定显示哪种引导
   */
  decideOnboarding() {
    const { has_seen_tour, onboarding_progress } = this.userState;

    // 始终显示导航栏帮助按钮（已登录用户）
    const progress = onboarding_progress || this.progressCache;
    this.showNavHelpButton(progress);

    // 场景 1：全新用户，首页显示欢迎弹窗
    if (!has_seen_tour && this.currentPage === 'index') {
      // 延迟显示，等页面渲染完成
      setTimeout(() => {
        if (window.welcomeModal) {
          window.welcomeModal.show({ isAutoShow: true });
        }
      }, 800);
      return;
    }

    // 场景 2：全新用户，非首页（可能是直接访问 discover/create）
    // 不主动弹窗，但增强空状态
    if (!has_seen_tour) {
      this.enhanceEmptyStates();
      return;
    }

    // 场景 3：特定页面首次访问触发概念讲解
    if (this.currentPage === 'story-tree' || this.currentPage === 'story') {
      if (!progress || !progress.conceptGuideSeen) {
        setTimeout(() => {
          if (window.conceptGuide) {
            window.conceptGuide.show();
          }
        }, 1500);
      }
    }

    // 场景 4：首页显示进度卡片（任务未全部完成时）
    if (this.currentPage === 'index' && progress && !this.allTasksCompleted(progress)) {
      this.showProgressCard(progress);
    }

    // 始终增强空状态
    this.enhanceEmptyStates();
  }

  /**
   * 检查任务清单是否全部完成
   */
  allTasksCompleted(progress) {
    if (!progress || !progress.tasks) return false;
    return Object.values(progress.tasks).every(v => v === true);
  }

  /**
   * 在导航栏显示帮助按钮（灯泡图标）
   * 已登录用户始终显示；有未完成任务时带小红点
   */
  showNavHelpButton(progress) {
    const navActions = document.querySelector('.nav-actions') || document.querySelector('.navbar-content');
    if (!navActions) return;

    // 检查是否已存在
    if (document.querySelector('.st-onboarding-nav-btn')) return;

    const hasUnfinished = !progress || !this.allTasksCompleted(progress);

    const btn = document.createElement('button');
    btn.className = 'st-onboarding-nav-btn';
    btn.title = '新手任务';
    btn.setAttribute('aria-label', '新手引导帮助');
    btn.innerHTML = `
      <i class="fas fa-lightbulb"></i>
      ${hasUnfinished ? '<span class="st-onboarding-nav-badge"></span>' : ''}
    `;
    btn.addEventListener('click', () => {
      if (window.welcomeModal) {
        window.welcomeModal.show();
      }
    });

    navActions.appendChild(btn);
  }

  /**
   * 在首页显示进度卡片（任务未全部完成时）
   */
  showProgressCard(progress) {
    // 检查用户是否手动折叠了卡片
    const collapsed = localStorage.getItem('st_progress_card_collapsed') === 'true';

    const tasks = progress.tasks || {};
    const taskList = [
      { key: 'completedTour', label: '完成新手引导' },
      { key: 'browsedDiscover', label: '浏览发现页' },
      { key: 'viewedStoryTree', label: '了解故事树概念' },
      { key: 'createdStory', label: '创建第一个故事' },
      { key: 'publishedChapter', label: '发布第一个章节' }
    ];
    const completedCount = taskList.filter(t => !!tasks[t.key]).length;
    const totalCount = taskList.length;
    const percent = Math.round((completedCount / totalCount) * 100);

    // 延迟插入，等页面内容加载
    setTimeout(() => {
      // 找到插入位置：hero 区域后面
      const hero = document.querySelector('.hero-section');
      const insertTarget = hero ? hero.nextElementSibling : document.querySelector('.main-content, .stories-section, [class*="section"]');
      if (!insertTarget && !hero) return;

      // 检查是否已存在
      if (document.querySelector('.st-progress-card')) return;

      const card = document.createElement('div');
      card.className = `st-progress-card ${collapsed ? 'st-progress-card--collapsed' : ''}`;
      card.innerHTML = `
        <div class="st-progress-card-header">
          <div class="st-progress-card-title">
            <i class="fas fa-lightbulb"></i>
            <span>新手任务</span>
            <span class="st-progress-card-count">${completedCount}/${totalCount}</span>
          </div>
          <button class="st-progress-card-toggle" aria-label="折叠/展开" title="${collapsed ? '展开' : '折叠'}">
            <i class="fas fa-chevron-${collapsed ? 'down' : 'up'}"></i>
          </button>
        </div>
        <div class="st-progress-card-body">
          <div class="st-progress-bar">
            <div class="st-progress-bar-fill" style="width: ${percent}%"></div>
          </div>
          <ul class="st-progress-tasks">
            ${taskList.map(t => `
              <li class="st-progress-task ${tasks[t.key] ? 'completed' : ''}">
                <span class="st-progress-task-check">
                  ${tasks[t.key] ? '<i class="fas fa-check"></i>' : ''}
                </span>
                <span class="st-progress-task-label">${t.label}</span>
              </li>
            `).join('')}
          </ul>
          <button class="st-progress-card-action" id="stProgressCardOpen">
            查看详情
          </button>
        </div>
      `;

      // 插入到页面
      if (hero) {
        hero.insertAdjacentElement('afterend', card);
      } else if (insertTarget) {
        insertTarget.insertAdjacentElement('beforebegin', card);
      }

      // 绑定事件
      const toggleBtn = card.querySelector('.st-progress-card-toggle');
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = card.classList.toggle('st-progress-card--collapsed');
        localStorage.setItem('st_progress_card_collapsed', isCollapsed ? 'true' : 'false');
        toggleBtn.querySelector('i').className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        toggleBtn.title = isCollapsed ? '展开' : '折叠';
      });

      const actionBtn = card.querySelector('#stProgressCardOpen');
      actionBtn.addEventListener('click', () => {
        if (window.welcomeModal) {
          window.welcomeModal.show();
        }
      });
    }, 1000);
  }

  /**
   * 增强空状态提示
   */
  enhanceEmptyStates() {
    // 延迟执行，等待页面动态内容加载
    setTimeout(() => {
      this._doEnhanceEmptyStates();
    }, 2000);
  }

  _doEnhanceEmptyStates() {
    const pageEnhancements = {
      'my-stories': () => this._enhanceMyStoriesEmpty(),
      'discover': () => this._enhanceDiscoverEmpty(),
      'index': () => this._enhanceIndexEmpty()
    };

    const enhancer = pageEnhancements[this.currentPage];
    if (enhancer) enhancer();
  }

  _enhanceMyStoriesEmpty() {
    const emptyEl = document.querySelector('.empty-state, .no-stories');
    if (!emptyEl) return;
    if (emptyEl.querySelector('.st-empty-guide')) return; // 已增强

    const guide = document.createElement('div');
    guide.className = 'st-empty-guide';
    guide.innerHTML = `
      <p class="st-empty-guide-title">三步开始你的创作之旅</p>
      <div class="st-empty-guide-steps">
        <div class="st-empty-guide-step">
          <span class="st-empty-guide-step-num">1</span>
          <span class="st-empty-guide-step-text">创建故事</span>
        </div>
        <div class="st-empty-guide-step">
          <span class="st-empty-guide-step-num">2</span>
          <span class="st-empty-guide-step-text">撰写章节</span>
        </div>
        <div class="st-empty-guide-step">
          <span class="st-empty-guide-step-num">3</span>
          <span class="st-empty-guide-step-text">邀请协作</span>
        </div>
      </div>
      <a href="/create.html" class="st-empty-guide-cta">创建第一个故事</a>
    `;
    emptyEl.appendChild(guide);
  }

  _enhanceDiscoverEmpty() {
    const emptyEl = document.querySelector('.no-results, .empty-state');
    if (!emptyEl || emptyEl.querySelector('.st-empty-guide')) return;

    const tip = document.createElement('p');
    tip.className = 'st-empty-guide-title';
    tip.style.marginTop = '1rem';
    tip.textContent = '试试其他关键词，或去创建一个新故事';
    emptyEl.appendChild(tip);
  }

  _enhanceIndexEmpty() {
    const grid = document.getElementById('storiesGrid');
    if (!grid) return;
    const emptyEl = grid.querySelector('.empty-state, .no-stories');
    if (!emptyEl || emptyEl.querySelector('.st-empty-guide')) return;

    const guide = document.createElement('div');
    guide.className = 'st-empty-guide';
    guide.innerHTML = `
      <p class="st-empty-guide-title">故事广场还很安静，来创作第一个故事吧！</p>
      <a href="/create.html" class="st-empty-guide-cta">开始创作</a>
    `;
    emptyEl.appendChild(guide);
  }

  /**
   * 更新任务进度（前端调用）
   * @param {string} taskKey - 任务键名
   * @param {boolean} completed - 是否完成
   */
  async updateTask(taskKey, completed = true) {
    const progress = this.getProgress();
    if (!progress.tasks) progress.tasks = {};
    progress.tasks[taskKey] = completed;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgressToServer(progress);
  }

  /**
   * 标记概念讲解已看过
   */
  async markConceptGuideSeen() {
    const progress = this.getProgress();
    progress.conceptGuideSeen = true;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgressToServer(progress);
  }

  /**
   * 标记欢迎弹窗已看过
   */
  async markWelcomeSeen() {
    const progress = this.getProgress();
    progress.welcomeSeen = true;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgressToServer(progress);
  }

  /**
   * 标记 has_seen_tour 为 true（防止每次进首页都弹出欢迎弹窗）
   * 调用后端 /api/auth/tour-complete 设置数据库字段
   */
  async markTourSeen() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      await fetch('/api/auth/tour-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // 更新本地缓存
      if (this.userState) {
        this.userState.has_seen_tour = true;
        localStorage.setItem('st_user_state', JSON.stringify(this.userState));
      }
    } catch (error) {
      console.error('[OnboardingManager] 标记引导已读失败:', error);
    }
  }

  /**
   * 获取当前进度
   */
  getProgress() {
    if (this.userState && this.userState.onboarding_progress) {
      return { ...this.userState.onboarding_progress };
    }
    return this.getLocalProgress() || this.getDefaultProgress();
  }

  getDefaultProgress() {
    return {
      welcomeSeen: false,
      tourCompleted: false,
      conceptGuideSeen: false,
      tasks: {
        browsedDiscover: false,
        createdStory: false,
        viewedStoryTree: false,
        publishedChapter: false,
        completedTour: false
      },
      pagesGuided: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * localStorage 操作
   */
  getLocalProgress() {
    try {
      const data = localStorage.getItem('st_onboarding_progress');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveLocalProgress(progress) {
    try {
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 同步进度到后端
   */
  async syncProgressToServer(progress) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      await fetch('/api/auth/onboarding-progress', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress })
      });

      // 更新本地缓存的 userState
      if (this.userState) {
        this.userState.onboarding_progress = progress;
        localStorage.setItem('st_user_state', JSON.stringify(this.userState));
      }
    } catch (error) {
      console.error('[OnboardingManager] 同步进度失败:', error);
    }
  }

  /**
   * 手动触发引导（导航栏"帮助"按钮）
   * @param {string} type - 'tour' | 'welcome' | 'concept'
   */
  triggerGuide(type) {
    switch (type) {
      case 'tour':
        if (window.storyTreeTour) {
          window.storyTreeTour.startTour(this.currentPage);
        }
        break;
      case 'welcome':
        if (window.welcomeModal) {
          window.welcomeModal.show();
        }
        break;
      case 'concept':
        if (window.conceptGuide) {
          window.conceptGuide.show();
        }
        break;
    }
  }

  /**
   * 【测试用】重置引导状态，无需新账户即可重新体验完整流程
   * 使用方法：在浏览器控制台执行 onboardingManager.resetForTesting()
   * 
   * 会清除：
   * - localStorage 中的引导进度缓存
   * - 后端 has_seen_tour 和 onboarding_progress 字段
   * 
   * 刷新页面后即可重新触发完整新手引导流程
   */
  async resetForTesting() {
    // 清除本地缓存
    localStorage.removeItem('st_onboarding_progress');
    localStorage.removeItem('st_user_state');

    // 重置后端状态
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      console.log('[OnboardingManager] 未登录，仅清除了本地缓存。');
      console.log('[OnboardingManager] 刷新页面后将以"未登录"状态运行。');
      return;
    }

    try {
      // 重置 has_seen_tour 为 false
      await fetch('/api/auth/tour-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reset: true })
      });

      // 用 PUT 重置 onboarding_progress 为空
      await fetch('/api/auth/onboarding-progress', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress: null })
      });

      console.log('[OnboardingManager] 引导状态已重置！');
      console.log('[OnboardingManager] 刷新页面即可重新体验完整新手引导。');
      console.log('');
      console.log('  快捷测试 URL：');
      console.log('  - 欢迎弹窗：当前页面?welcome=1');
      console.log('  - 分步引导：当前页面?tour=0');
      console.log('  - 概念讲解：/story-tree.html?guide=concept');
    } catch (error) {
      console.error('[OnboardingManager] 重置失败:', error);
    }

    // 重置内部状态
    this.initialized = false;
    this.userState = null;
    this.progressCache = null;
  }
}

// 导出全局实例
window.onboardingManager = new OnboardingManager();
