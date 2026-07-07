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
      // 仍需获取用户状态以显示导航栏帮助按钮
      await this.fetchUserState();
      const progress = this.userState ? (this.userState.onboarding_progress || this.progressCache) : this.progressCache;
      this.showNavHelpButton(progress);
      window.storyTreeTour.checkAndStartTour(pageName);
      return;
    }

    // 如果有 guide=concept 参数，跳转到示例故事页面触发引导
    // 但如果已经在故事页面，说明已经跳转过来了，不需要再次重定向
    // （再次重定向会取消 loadStoryDetail 中所有进行中的 fetch 请求）
    if (hasGuideParam === 'concept') {
      if (pageName === 'story') {
        // 已在故事页面，仍需获取用户状态以显示导航栏帮助按钮
        await this.fetchUserState();
        const progress = this.userState ? (this.userState.onboarding_progress || this.progressCache) : this.progressCache;
        this.showNavHelpButton(progress);
        // 让 story-concept-bridge.js 处理概念引导
        return;
      }
      this._redirectToStoryForConcept();
      return;
    }

    // ?welcome=1 强制显示欢迎弹窗（测试用）
    if (urlParams.get('welcome') === '1' && window.welcomeModal) {
      await this.fetchUserState();
      const progress = this.userState ? (this.userState.onboarding_progress || this.progressCache) : this.progressCache;
      this.showNavHelpButton(progress);
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

    // 如果刚注册/登录，强制跳过缓存
    const justRegistered = localStorage.getItem('st_just_registered');
    if (justRegistered) {
      localStorage.removeItem('st_just_registered');
      localStorage.removeItem('st_user_state');
      localStorage.removeItem('st_onboarding_progress');
      localStorage.removeItem('st_celebration_shown');
    }

    // 检查缓存是否新鲜（5 分钟内）
    if (!justRegistered) {
      const cached = localStorage.getItem('st_user_state');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // 校验缓存用户是否与当前登录用户一致
          const currentUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
          const cacheUserMatch = !parsed._userId || !currentUser.id || parsed._userId === currentUser.id;
          if (cacheUserMatch && Date.now() - parsed._ts < 5 * 60 * 1000) {
            this.userState = parsed;
            return;
          }
          // 用户不匹配时清除旧引导数据
          if (!cacheUserMatch) {
            localStorage.removeItem('st_user_state');
            localStorage.removeItem('st_onboarding_progress');
            localStorage.removeItem('st_celebration_shown');
            this.progressCache = null;
          }
        } catch (e) { /* 忽略解析错误 */ }
      }
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        // API 失败时尝试使用缓存，而非假设为新用户
        const cached = localStorage.getItem('st_user_state');
        if (cached) {
          try { this.userState = JSON.parse(cached); } catch (e) { /* 忽略 */ }
        }
        return;
      }

      const data = await response.json();
      if (data.user) {
        // 检测用户切换：如果缓存中的用户 ID 与当前登录用户不同，清除旧引导数据
        const cachedStr = localStorage.getItem('st_user_state');
        if (cachedStr) {
          try {
            const cachedState = JSON.parse(cachedStr);
            if (cachedState._userId && cachedState._userId !== data.user.id) {
              localStorage.removeItem('st_onboarding_progress');
              localStorage.removeItem('st_celebration_shown');
              this.progressCache = null;
            }
          } catch (e) { /* 忽略 */ }
        }

        this.userState = {
          _userId: data.user.id,
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
      // 网络错误时尝试使用缓存，而非假设为新用户
      const cached = localStorage.getItem('st_user_state');
      if (cached) {
        try { this.userState = JSON.parse(cached); } catch (e) { /* 忽略 */ }
      }
    }
  }

  /**
   * 根据用户状态决定显示哪种引导
   */
  decideOnboarding() {
    const { has_seen_tour } = this.userState;

    // 始终显示导航栏帮助按钮（已登录用户）
    const progress = this.getProgressWithFixup();
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

    // 场景 4（优先）：写作页/创建AI页首次访问自动启动引导 tour
    // 无论 has_seen_tour 状态如何，只要 completedTour 未完成就触发
    const tasks = progress && progress.tasks ? progress.tasks : {};
    if ((this.currentPage === 'write' || this.currentPage === 'create-ai') && !tasks.completedTour) {
      setTimeout(() => {
        if (window.storyTreeTour) {
          window.storyTreeTour.startTour(this.currentPage);
        }
      }, 1500);
      return;
    }

    // 场景 4b：写作页已完成主 tour 但首次进入写作页，显示写作功能引导
    // 合并本地缓存的 writeGuideSeen，避免因网络延迟导致重复触发
    const localProgress = this.progressCache || {};
    const writeGuideSeen = progress.writeGuideSeen || localProgress.writeGuideSeen;
    if (this.currentPage === 'write' && tasks.completedTour && !writeGuideSeen) {
      setTimeout(() => {
        if (window.storyTreeTour) {
          window.storyTreeTour.startTour('write');
          // 标记已看过写作引导
          const freshProgress = this.getProgress();
          freshProgress.writeGuideSeen = true;
          this.saveLocalProgress(freshProgress);
          this.syncProgress(freshProgress, { fireAndForget: true });
        }
      }, 2000);
      return;
    }

    // 场景 2：全新用户，非首页（可能是直接访问 discover/create）
    // 不主动弹窗，但增强空状态
    if (!has_seen_tour) {
      this.enhanceEmptyStates();
      return;
    }

    // 场景 3：特定页面首次访问触发概念讲解
    // 使用与 story-concept-bridge.js 一致的完整流程：ConceptGuide → 高亮树图 → 下一步提示
    if (this.currentPage === 'story' && has_seen_tour) {
      if (!progress || !progress.conceptGuideSeen) {
        setTimeout(() => {
          if (window.conceptGuide) {
            // 覆盖 hide 方法，在概念引导关闭后触发后续流程
            this._patchConceptGuideHideForStory();
            window.conceptGuide.show();
          }
        }, 1500);
        return;
      }
    }

    // 场景 5：首页不再显示进度卡片（已移除）
    // 灯泡按钮已在上方 showNavHelpButton 中处理

    // 检查是否有待显示的祝贺弹窗（跨页面跳转后触发）
    if (localStorage.getItem('st_celebration_pending')) {
      localStorage.removeItem('st_celebration_pending');
      this.tryCelebrate(null, { deferred: false });
    }

    // 始终增强空状态
    this.enhanceEmptyStates();
  }

  /**
   * 为故事页概念引导覆盖 hide 方法，使其关闭后触发后续流程
   * 复用 story-concept-bridge.js 暴露的函数
   */
  _patchConceptGuideHideForStory() {
    if (!window.conceptGuide || !window.StoryConceptBridge) return;
    // 避免重复 patch
    if (window.conceptGuide._patchedByManager || window.conceptGuide._patchedByBridge) return;
    window.conceptGuide._patchedByManager = true;

    const originalHide = window.conceptGuide.hide.bind(window.conceptGuide);
    window.conceptGuide.hide = () => {
      originalHide();
      setTimeout(() => {
        if (window.StoryConceptBridge) {
          window.StoryConceptBridge.highlightTreeChart();
        }
      }, 400);
    };
  }

  /**
   * 检查任务清单是否全部完成（明确检查 5 个已知任务 key）
   */
  allTasksCompleted(progress) {
    if (!progress || !progress.tasks) return false;
    const requiredTasks = ['completedTour', 'browsedDiscover', 'viewedStoryTree', 'createdStory', 'publishedChapter'];
    return requiredTasks.every(key => progress.tasks[key] === true);
  }

  /**
   * 在导航栏显示帮助按钮（灯泡图标）
   * 已登录用户显示；所有任务完成后改为帮助图标，不再显示红点
   */
  showNavHelpButton(progress) {
    const navActions = document.querySelector('.nav-menu') || document.querySelector('.nav-actions') || document.querySelector('.navbar-content');
    if (!navActions) {
      // 导航栏可能动态加载，延迟重试一次
      setTimeout(() => {
        const retryNav = document.querySelector('.nav-menu') || document.querySelector('.nav-actions') || document.querySelector('.navbar-content');
        if (retryNav && !document.querySelector('.st-onboarding-nav-btn')) {
          this._createNavHelpButton(retryNav, progress);
        }
      }, 2000);
      return;
    }

    // 检查是否已存在
    if (document.querySelector('.st-onboarding-nav-btn')) return;

    this._createNavHelpButton(navActions, progress);
  }

  _createNavHelpButton(navActions, progress) {
    const allDone = progress && this.allTasksCompleted(progress);
    const btn = document.createElement('button');
    btn.className = 'st-onboarding-nav-btn nav-link';
    btn.title = allDone ? '帮助' : '新手任务';
    btn.setAttribute('aria-label', allDone ? '帮助' : '新手引导帮助');
    btn.setAttribute('role', 'menuitem');
    btn.innerHTML = allDone
      ? '<i class="fas fa-question-circle" aria-hidden="true"></i><span class="nav-help-label">帮助</span>'
      : '<i class="fas fa-lightbulb" aria-hidden="true"></i><span class="nav-help-label">新手指引</span><span class="st-onboarding-nav-badge"></span>';
    btn.addEventListener('click', () => {
      if (window.welcomeModal) {
        window.welcomeModal.show();
      } else if (this.currentPage === 'story' && window.conceptGuide) {
        this._patchConceptGuideHideForStory();
        window.conceptGuide.show();
      } else if (window.storyTreeTour) {
        window.storyTreeTour.startTour(this.currentPage);
      }
    });

    // 插入到"用户"和"退出"之间
    const logoutLink = navActions.querySelector('#logoutLink');
    if (logoutLink) {
      navActions.insertBefore(btn, logoutLink);
    } else {
      navActions.appendChild(btn);
    }
  }

  /**
   * 增强空状态提示
   */
  enhanceEmptyStates() {
    // 延迟执行，等待页面动态内容加载，且避开 tour/欢迎弹窗的定时器
    setTimeout(() => {
      this._doEnhanceEmptyStates();
    }, 3000);
  }

  _doEnhanceEmptyStates() {
    const pageEnhancements = {
      'my-stories': () => this._enhanceMyStoriesEmpty(),
      'discover': () => this._enhanceDiscoverEmpty(),
      'index': () => this._enhanceIndexEmpty(),
      'write': () => this._enhanceWriteEmpty(),
      'create-ai': () => this._enhanceCreateAiEmpty(),
      'story': () => this._enhanceStoryEmpty()
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
      <a href="/create-ai.html" class="st-empty-guide-cta">创建第一个故事</a>
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
      <a href="/create-ai.html" class="st-empty-guide-cta">开始创作</a>
    `;
    emptyEl.appendChild(guide);
  }

  _enhanceWriteEmpty() {
    // write 页面没有明显的空状态容器，检查编辑器是否为空
    const editor = document.querySelector('.ql-editor, #editor, .editor-content');
    if (!editor || editor.querySelector('.st-empty-guide')) return;
    const hasContent = editor.textContent && editor.textContent.trim().length > 0;
    if (hasContent) return;

    const guide = document.createElement('div');
    guide.className = 'st-empty-guide st-empty-guide--write';
    guide.innerHTML = `
      <p class="st-empty-guide-title">开始写下你的第一个章节吧！</p>
      <p class="st-empty-guide-hint">提示：可以先用 AI 生成大纲，再逐章创作</p>
    `;
    editor.appendChild(guide);
  }

  _enhanceCreateAiEmpty() {
    // create-ai 页面：AI 创作表单区域
    const formArea = document.querySelector('.ai-create-form, .create-form, .story-form');
    if (!formArea || formArea.querySelector('.st-empty-guide')) return;

    const guide = document.createElement('div');
    guide.className = 'st-empty-guide st-empty-guide--create';
    guide.innerHTML = `
      <p class="st-empty-guide-title">输入故事主题，AI 将帮你生成完整故事</p>
      <p class="st-empty-guide-hint">例如：「一个关于时间旅行的科幻故事」</p>
    `;
    formArea.insertBefore(guide, formArea.firstChild);
  }

  _enhanceStoryEmpty() {
    // story 页面：章节列表为空时
    const chapterList = document.querySelector('.chapter-list, .chapters-container');
    if (!chapterList || chapterList.querySelector('.st-empty-guide')) return;
    const hasChapters = chapterList.querySelector('.chapter-item, .chapter-card, li');
    if (hasChapters) return;

    const guide = document.createElement('div');
    guide.className = 'st-empty-guide st-empty-guide--story';
    guide.innerHTML = `
      <p class="st-empty-guide-title">这个故事还没有章节</p>
      <a href="/write.html" class="st-empty-guide-cta">开始创作第一章</a>
    `;
    chapterList.appendChild(guide);
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
    await this.syncProgress(progress);
  }

  /**
   * 跳转到示例故事页面触发概念引导
   * 当 ?guide=concept 在非 story 页面被检测到时调用
   */
  async _redirectToStoryForConcept() {
    let storyId = null;

    try {
      const res = await fetch('/api/stories?search=反三国演义&limit=1');
      if (res.ok) {
        const data = await res.json();
        if (data.stories && data.stories.length > 0) {
          storyId = data.stories[0].id;
        }
      }

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
      console.warn('[OnboardingManager] Failed to fetch example story:', e);
    }

    if (storyId) {
      window.location.href = `/story.html?id=${storyId}&guide=concept`;
    } else {
      // fallback：如果找不到故事，直接在当前页显示概念引导
      if (window.conceptGuide) {
        window.conceptGuide.show();
      }
    }
  }

  /**
   * 标记概念讲解已看过
   */
  async markConceptGuideSeen() {
    const progress = this.getProgress();
    if (progress.conceptGuideSeen) return;
    progress.conceptGuideSeen = true;
    // 同时标记任务完成
    if (!progress.tasks) progress.tasks = this.getDefaultProgress().tasks;
    progress.tasks.viewedStoryTree = true;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgress(progress);

    // 祝贺检查
    this.tryCelebrate(progress, { deferred: false });
  }

  /**
   * 标记欢迎弹窗已看过
   */
  async markWelcomeSeen() {
    const progress = this.getProgress();
    progress.welcomeSeen = true;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgress(progress);
  }

  /**
   * 标记 has_seen_tour 为 true（防止每次进首页都弹出欢迎弹窗）
   * 调用后端 /api/auth/tour-complete 设置数据库字段
   */
  async markTourSeen() {
    // 防重：如果 has_seen_tour 已为 true，跳过重复调用
    if (this.userState && this.userState.has_seen_tour) {
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      await fetch('/api/auth/tour-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        keepalive: true
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
   * 获取当前进度（纯读取，无副作用）
   * 合并服务器状态和本地状态，确保最新的任务标记被反映
   */
  getProgress() {
    const serverProgress = (this.userState && this.userState.onboarding_progress)
      ? { ...this.userState.onboarding_progress }
      : null;
    const localProgress = this.getLocalProgress();

    let result;

    // 如果两者都存在，合并 tasks（取并集，任一为 true 则为 true）
    if (serverProgress && localProgress) {
      const merged = { ...serverProgress };
      if (!merged.tasks) merged.tasks = {};
      if (localProgress.tasks) {
        for (const key of Object.keys(localProgress.tasks)) {
          if (localProgress.tasks[key]) {
            merged.tasks[key] = true;
          }
        }
      }
      // 合并顶层布尔字段
      if (localProgress.conceptGuideSeen) merged.conceptGuideSeen = true;
      if (localProgress.tourCompleted) merged.tourCompleted = true;
      if (localProgress.welcomeSeen) merged.welcomeSeen = true;
      if (localProgress.writeGuideSeen) merged.writeGuideSeen = true;
      result = merged;
    } else {
      result = serverProgress || localProgress || this.getDefaultProgress();
    }

    return result;
  }

  /**
   * 获取进度并自动修复逻辑前置依赖（有副作用：可能触发网络同步）
   * 用于需要确保数据一致性的场景
   */
  getProgressWithFixup() {
    const result = this.getProgress();
    const fixed = this.ensurePrerequisiteTasks(result);
    if (fixed) {
      this.saveLocalProgress(result);
      this.syncProgress(result, { fireAndForget: true });
    }
    return result;
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
      const parsed = data ? JSON.parse(data) : null;
      return (parsed && typeof parsed === 'object') ? parsed : null;
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
   * 统一同步进度到后端（所有进度写入的单一出口）
   * @param {Object} progress - 进度对象
   * @param {Object} [options] - 可选配置
   * @param {boolean} [options.fireAndForget=false] - 不等待响应（用于页面跳转前）
   * @param {boolean} [options.useBeacon=false] - 使用 sendBeacon（用于页面卸载时）
   */
  syncProgress(progress, options = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return Promise.resolve();

    // 更新本地缓存的 userState
    if (this.userState) {
      this.userState.onboarding_progress = progress;
      localStorage.setItem('st_user_state', JSON.stringify(this.userState));
    }

    const body = JSON.stringify({ progress });

    // 使用 fetch + keepalive 替代 sendBeacon（sendBeacon 无法设置 Auth header）
    const promise = fetch('/api/auth/onboarding-progress', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body,
      keepalive: true
    }).catch(error => {
      console.error('[OnboardingManager] 同步进度失败:', error);
    });

    if (options.fireAndForget) return Promise.resolve();
    return promise;
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
        // 跳转到示例故事页面展示概念引导
        this._redirectToStoryForConcept();
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
      console.log('  - 概念讲解：/story.html?guide=concept');
    } catch (error) {
      console.error('[OnboardingManager] 重置失败:', error);
    }

    // 重置内部状态
    this.initialized = false;
    this.userState = null;
    this.progressCache = null;
  }

  /**
   * 确保逻辑前置任务被标记完成
   * 任务之间存在隐含依赖：发布章节 → 必然已创建故事；完成引导 → 必然已浏览发现页和了解概念
   * 如果后置任务已完成但前置任务未标记（跨页面跳转丢失等），在此修复
   * @param {Object} progress - 当前进度对象
   * @returns {boolean} 是否有修复发生
   */
  ensurePrerequisiteTasks(progress) {
    if (!progress || !progress.tasks) return false;
    let fixed = false;

    // 发布章节 → 必然已创建故事
    if (progress.tasks.publishedChapter && !progress.tasks.createdStory) {
      progress.tasks.createdStory = true;
      fixed = true;
    }

    // 创建故事 → 必然已了解故事树概念（创建流程经过概念引导）
    if (progress.tasks.createdStory && !progress.tasks.viewedStoryTree) {
      progress.tasks.viewedStoryTree = true;
      fixed = true;
    }

    // 完成引导 tour → 必然已浏览发现页
    if (progress.tasks.completedTour && !progress.tasks.browsedDiscover) {
      progress.tasks.browsedDiscover = true;
      fixed = true;
    }

    // 了解故事树概念 → 必然已浏览发现页（概念引导入口在发现页）
    if (progress.tasks.viewedStoryTree && !progress.tasks.browsedDiscover) {
      progress.tasks.browsedDiscover = true;
      fixed = true;
    }

    // 完成引导 tour → 必然已了解故事树概念（引导流程包含概念引导）
    if (progress.tasks.completedTour && !progress.tasks.viewedStoryTree) {
      progress.tasks.viewedStoryTree = true;
      fixed = true;
    }

    return fixed;
  }

  /**
   * 检查是否所有任务完成，如果是则弹出祝贺弹窗
   * 各处标记任务完成后调用此方法
   */
  /**
   * 统一的庆祝检查入口：各处标记任务完成后调用此方法
   * @param {Object} progress - 进度对象（可选，不传则从 localStorage 读取）
   * @param {Object} options
   * @param {boolean} options.deferred - 如果页面即将跳转/刷新，设为 true 则设置 pending 标志
   */
  tryCelebrate(progress, options = {}) {
    if (!progress) {
      const progressStr = localStorage.getItem('st_onboarding_progress');
      progress = progressStr ? JSON.parse(progressStr) : {};
    }
    if (!progress.tasks) progress.tasks = {};

    const fixed = this.ensurePrerequisiteTasks(progress);
    if (fixed) {
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
      this.syncProgress(progress, { fireAndForget: true });
    }

    if (!this.allTasksCompleted(progress)) return;
    if (localStorage.getItem('st_celebration_shown')) return;

    if (options.deferred) {
      localStorage.setItem('st_celebration_pending', 'true');
    } else {
      localStorage.setItem('st_celebration_shown', 'true');
      localStorage.removeItem('st_celebration_pending');
      setTimeout(() => this.showCompletionCelebration(), 1000);
    }
  }

  /**
   * 显示祝贺完成弹窗
   */
  showCompletionCelebration() {
    const overlay = document.createElement('div');
    overlay.className = 'st-celebration-overlay';
    overlay.innerHTML = `
      <div class="st-celebration-modal">
        <div class="st-celebration-icon">
          <svg viewBox="0 0 80 80" class="st-celebration-svg">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#2d5d5a" stroke-width="3" opacity="0.2"/>
            <circle cx="40" cy="40" r="36" fill="none" stroke="#2d5d5a" stroke-width="3"
              stroke-dasharray="226" stroke-dashoffset="226" class="st-celebration-circle"/>
            <path d="M24 42 L35 53 L56 30" fill="none" stroke="#2d5d5a" stroke-width="4"
              stroke-linecap="round" stroke-linejoin="round"
              stroke-dasharray="60" stroke-dashoffset="60" class="st-celebration-check"/>
          </svg>
        </div>
        <h2 class="st-celebration-title">恭喜完成新手教学！</h2>
        <p class="st-celebration-desc">你已经掌握了 StoryTree 的核心功能。<br>未来如果还需要，可以进入<strong>个人中心</strong>随时重新查看教程。</p>
        <button class="st-celebration-btn" onclick="this.closest('.st-celebration-overlay').remove()">
          开始创作之旅
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('st-celebration-overlay--visible'));
  }
}

// 导出全局实例
window.onboardingManager = new OnboardingManager();
