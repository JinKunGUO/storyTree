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

    // 如果有 guide=concept 参数，跳转到示例故事页面触发引导
    // 但如果已经在故事页面，说明已经跳转过来了，不需要再次重定向
    // （再次重定向会取消 loadStoryDetail 中所有进行中的 fetch 请求）
    if (hasGuideParam === 'concept') {
      if (pageName === 'story') {
                // 已在故事页面，让 story-concept-bridge.js 处理概念引导
        return;
      }
            this._redirectToStoryForConcept();
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
        // 请求失败但有 token，构造默认状态确保新用户引导能触发
        this.userState = { has_seen_tour: false, onboarding_progress: null, _ts: Date.now() };
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
      // 网络错误时构造默认状态，确保引导流程不被阻断
      this.userState = { has_seen_tour: false, onboarding_progress: null, _ts: Date.now() };
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
    if (this.currentPage === 'write' && tasks.completedTour && !progress.writeGuideSeen) {
      setTimeout(() => {
        if (window.storyTreeTour) {
          window.storyTreeTour.startTour('write');
          // 标记已看过写作引导
          progress.writeGuideSeen = true;
          localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
          const tk = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (tk) {
            fetch('/api/auth/onboarding-progress', {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ progress })
            }).catch(() => {});
          }
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
    if (this.currentPage === 'story-tree' || this.currentPage === 'story') {
      if (!progress || !progress.conceptGuideSeen) {
        setTimeout(() => {
          if (window.conceptGuide) {
            window.conceptGuide.show();
          }
        }, 1500);
      }
    }

    // 场景 5：首页不再显示进度卡片（已移除）
    // 灯泡按钮已在上方 showNavHelpButton 中处理

    // 检查是否有待显示的祝贺弹窗（跨页面跳转后触发）
    if (localStorage.getItem('st_celebration_pending')) {
      localStorage.removeItem('st_celebration_pending');
      this.checkAndCelebrate();
    }

    // 始终增强空状态
    this.enhanceEmptyStates();
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
   * 已登录用户显示；所有任务完成后隐藏
   */
  showNavHelpButton(progress) {
    const navActions = document.querySelector('.nav-actions') || document.querySelector('.navbar-content');
    if (!navActions) return;

    // 检查是否已存在
    if (document.querySelector('.st-onboarding-nav-btn')) return;

    // 所有任务完成后不显示灯泡
    if (progress && this.allTasksCompleted(progress)) return;

    const btn = document.createElement('button');
    btn.className = 'st-onboarding-nav-btn';
    btn.title = '新手任务';
    btn.setAttribute('aria-label', '新手引导帮助');
    btn.innerHTML = `
      <i class="fas fa-lightbulb"></i>
      <span class="st-onboarding-nav-badge"></span>
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
      { key: 'completedTour', label: '熟悉平台功能' },
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
    progress.conceptGuideSeen = true;
    // 同时标记任务完成
    if (!progress.tasks) progress.tasks = this.getDefaultProgress().tasks;
    progress.tasks.viewedStoryTree = true;
    progress.lastUpdated = new Date().toISOString();

    this.saveLocalProgress(progress);
    await this.syncProgressToServer(progress);

    // 祝贺检查
    this.checkAndCelebrate();
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
      result = merged;
    } else {
      result = serverProgress || localProgress || this.getDefaultProgress();
    }

    // 确保逻辑前置任务被补全，如果有修复则持久化
    const fixed = this.ensurePrerequisiteTasks(result);
    if (fixed) {
      this.saveLocalProgress(result);
      // 异步同步到服务器（不阻塞）
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        fetch('/api/auth/onboarding-progress', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: result })
        }).catch(() => {});
      }
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
      console.log('  - 概念讲解：/story-tree.html?guide=concept');
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

    return fixed;
  }

  /**
   * 检查是否所有任务完成，如果是则弹出祝贺弹窗
   * 各处标记任务完成后调用此方法
   */
  checkAndCelebrate() {
    const progressStr = localStorage.getItem('st_onboarding_progress');
    let progress = progressStr ? JSON.parse(progressStr) : {};
    if (!progress.tasks) progress.tasks = {};

    // 修复逻辑依赖不一致
    const fixed = this.ensurePrerequisiteTasks(progress);
    if (fixed) {
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
      // 异步同步到服务器
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        fetch('/api/auth/onboarding-progress', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress })
        }).catch(() => {});
      }
    }

    if (!this.allTasksCompleted(progress)) return;
    // 只弹一次
    if (localStorage.getItem('st_celebration_shown')) return;
    localStorage.setItem('st_celebration_shown', 'true');
    localStorage.removeItem('st_celebration_pending');
    setTimeout(() => this.showCompletionCelebration(), 1000);
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
