/**
 * 通用页面引导桥接脚本
 * 检测 URL 中的 ?guide=xxx 参数，在对应页面自动弹出引导框
 * 支持：discover（发现页）、create（创建故事）、publish（发布章节）
 */

(function() {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const guideType = urlParams.get('guide');

  if (!guideType || guideType === 'concept') return; // concept 由 story-concept-bridge.js 处理

  // 清理 URL 中的 guide 参数
  function clearGuideParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('guide');
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * 更新引导进度
   */
  async function updateProgress(taskKey) {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      const progressStr = localStorage.getItem('st_onboarding_progress');
      let progress = progressStr ? JSON.parse(progressStr) : {};
      if (!progress.tasks) progress.tasks = {};
      progress.tasks[taskKey] = true;
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));

      // 同步到服务器（包裹在 { progress } 中，与 onboarding-manager 格式一致）
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
          if (userState.onboarding_progress) {
            if (!userState.onboarding_progress.tasks) userState.onboarding_progress.tasks = {};
            userState.onboarding_progress.tasks[taskKey] = true;
          } else {
            userState.onboarding_progress = progress;
          }
          userState._ts = Date.now();
          localStorage.setItem('st_user_state', JSON.stringify(userState));
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('[PageGuideBridge] Failed to update progress:', e);
    }

    // 检查是否所有任务完成，弹出祝贺
    if (window.onboardingManager) {
      window.onboardingManager.checkAndCelebrate();
    }
  }

  /**
   * 显示下一步提示 toast
   */
  function showNextStepToast(message, btnText, btnHref) {
    const toast = document.createElement('div');
    toast.className = 'st-next-step-toast';
    toast.innerHTML = `
      <div class="st-next-step-content">
        <i class="fas fa-check-circle" style="color:#2d5d5a;font-size:18px;"></i>
        <div class="st-next-step-text">
          <strong>${message}</strong>
          ${btnHref ? `<span>继续下一步？</span>` : ''}
        </div>
        ${btnHref ? `<a href="${btnHref}" class="st-next-step-btn">${btnText}</a>` : ''}
        <button class="st-next-step-close" aria-label="关闭">&times;</button>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('st-next-step-toast--visible'));

    toast.querySelector('.st-next-step-close').addEventListener('click', () => {
      toast.classList.remove('st-next-step-toast--visible');
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('st-next-step-toast--visible');
        setTimeout(() => toast.remove(), 300);
      }
    }, 8000);
  }

  /**
   * 创建 Driver.js 高亮引导
   */
  function showHighlight(config) {
    if (!window.driver) return;

    const driverInstance = window.driver.js.driver({
      showProgress: false,
      allowClose: true,
      overlayOpacity: 0.35,
      stagePadding: 10,
      stageRadius: 12,
      popoverOffset: 15,
      popoverClass: 'st-highlight-only',
      onDestroyed: () => {
        if (config.taskKey) updateProgress(config.taskKey);
        if (config.onComplete) config.onComplete();
      }
    });

    driverInstance.highlight({
      element: config.element,
      popover: {
        title: config.title,
        description: config.description + '<br><br><em style="opacity:0.7;font-size:12px;">点击任意位置关闭</em>',
        side: config.side || 'bottom',
        align: config.align || 'center'
      }
    });
  }

  /**
   * 各页面的引导配置
   */
  const guideConfigs = {
    discover: {
      waitFor: '.discover-hero, .search-input, .stories-grid',
      element: '.search-input, #searchInput, .search-section',
      title: '欢迎来到发现页！',
      description: '在这里你可以搜索和浏览社区中其他创作者的故事。试试搜索感兴趣的关键词，或浏览推荐故事获取灵感。',
      side: 'bottom',
      taskKey: 'browsedDiscover',
      onComplete: function() {
        // 检查是否还需要了解故事树概念
        const progressStr = localStorage.getItem('st_onboarding_progress');
        let progress = progressStr ? JSON.parse(progressStr) : {};
        if (!progress.tasks || !progress.tasks.viewedStoryTree) {
          showNextStepToast('发现页探索完成！', '了解故事树', null);
        }
      }
    },
    create: {
      waitFor: '#createStoryForm, .create-card, #title',
      element: '#createStoryForm, .create-card',
      title: '创建你的第一个故事',
      description: '填写故事标题和简介，选择一个分类，然后点击"创建故事"。创建完成后你就可以开始撰写第一个章节了！',
      side: 'top',
      taskKey: null, // 创建故事的标记由实际创建操作完成
      onComplete: function() {
        // 不额外提示，让用户自然填写表单
      }
    },
    publish: {
      waitFor: '.my-stories-container, #storiesContainer, .stories-grid',
      element: '#storiesContainer, .stories-grid, .my-stories-container',
      title: '发布你的第一个章节',
      description: '这里是你的故事管理页。点击任意故事进入详情页，然后在故事树中添加新章节并发布，让更多人看到你的创作！',
      side: 'top',
      taskKey: null, // 发布章节的标记由实际发布操作完成
      onComplete: function() {}
    }
  };

  /**
   * 等待目标元素出现后触发引导
   */
  function waitAndTrigger() {
    const config = guideConfigs[guideType];
    if (!config) return;

    clearGuideParam();

    let attempts = 0;
    const maxAttempts = 20;

    const check = setInterval(() => {
      attempts++;

      // 尝试多个可能的选择器
      const selectors = config.waitFor.split(', ');
      let found = false;
      for (const sel of selectors) {
        if (document.querySelector(sel.trim())) {
          found = true;
          break;
        }
      }

      if (found || attempts >= maxAttempts) {
        clearInterval(check);

        // 找到实际存在的元素
        const elementSelectors = config.element.split(', ');
        let targetElement = null;
        for (const sel of elementSelectors) {
          const el = document.querySelector(sel.trim());
          if (el) {
            targetElement = sel.trim();
            break;
          }
        }

        if (targetElement) {
          setTimeout(() => {
            showHighlight({
              element: targetElement,
              title: config.title,
              description: config.description,
              side: config.side,
              align: config.align,
              taskKey: config.taskKey,
              onComplete: config.onComplete
            });
          }, 800);
        }
      }
    }, 500);
  }

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndTrigger);
  } else {
    waitAndTrigger();
  }

  /**
   * 被动触发：用户正常访问发现页时，停留超过 8 秒自动标记 browsedDiscover
   * 无需 ?guide=discover 参数
   */
  function passiveDiscoverMark() {
    // 仅在 discover.html 页面生效
    if (!window.location.pathname.includes('discover')) return;
    // 如果已通过 guide 参数触发过，跳过
    if (guideType === 'discover') return;
    // 如果已经完成了该任务，跳过
    const progressStr = localStorage.getItem('st_onboarding_progress');
    let progress = progressStr ? JSON.parse(progressStr) : {};
    if (progress.tasks && progress.tasks.browsedDiscover) return;

    let timer = setTimeout(() => {
      updateProgress('browsedDiscover');
    }, 8000);

    // 如果用户离开页面就取消
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', passiveDiscoverMark);
  } else {
    passiveDiscoverMark();
  }
})();
