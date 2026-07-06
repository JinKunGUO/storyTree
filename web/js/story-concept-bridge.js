/**
 * Story 页面概念引导桥接脚本
 * 检测 ?guide=concept 参数，在页面加载完成后触发概念引导
 * 概念引导结束后，用 Driver.js 高亮分支图区域，并提供"创建故事"入口
 */

(function() {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const hasGuideParam = urlParams.get('guide');

  if (hasGuideParam !== 'concept') return;

  // 清理 URL 中的 guide 参数（保留 id 参数）
  function clearGuideParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('guide');
    window.history.replaceState({}, '', url.toString());
  }

  /**
   * 概念引导结束后，高亮分支图区域并提供下一步操作
   */
  function highlightTreeChart() {
    // 优先高亮分支图容器（不含工具栏），fallback 到整个 tab
    const treeContainer = document.querySelector('.tree-chart-container') || document.querySelector('#treeChart') || document.querySelector('#treeTab');
    if (!treeContainer || !window.driver) {
      // Driver.js 不可用时直接弹 toast
      markConceptGuideSeen();
      showNextStepPrompt();
      return;
    }

    // 确定实际使用的选择器
    const elementSelector = document.querySelector('.tree-chart-container') ? '.tree-chart-container'
      : document.querySelector('#treeChart') ? '#treeChart' : '#treeTab';

    // 检查是否已创建过故事
    let alreadyCreated = false;
    try {
      const progressStr = localStorage.getItem('st_onboarding_progress');
      if (progressStr) {
        const p = JSON.parse(progressStr);
        alreadyCreated = !!(p.tasks && p.tasks.createdStory);
      }
    } catch (e) { /* ignore */ }

    const driverInstance = window.driver.js.driver({
      showProgress: false,
      allowClose: true,
      overlayOpacity: 0.4,
      stagePadding: 12,
      stageRadius: 12,
      popoverOffset: 16,
      animate: false,
      popoverClass: 'st-concept-highlight',
      onPopoverRender: (popover) => {
        // 在 popover 底部插入操作按钮
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'st-concept-highlight-actions';

        if (!alreadyCreated) {
          actionsDiv.innerHTML = `
            <a href="/create-ai.html?tour=0" class="st-concept-highlight-cta">
              <i class="fas fa-pen-fancy"></i> 创建第一个故事
            </a>
            <button class="st-concept-highlight-dismiss">稍后再说</button>
          `;
        } else {
          actionsDiv.innerHTML = `
            <button class="st-concept-highlight-dismiss">我知道了</button>
          `;
        }

        popover.wrapper.appendChild(actionsDiv);

        // 绑定"稍后再说"按钮
        const dismissBtn = actionsDiv.querySelector('.st-concept-highlight-dismiss');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            driverInstance.destroy();
          });
        }
      },
      onDestroyed: () => {
        markConceptGuideSeen();
        // 如果用户没有点击"创建故事"按钮而是直接关闭，仍弹 toast 提醒
        if (!alreadyCreated) {
          showNextStepPrompt();
        }
      }
    });

    driverInstance.highlight({
      element: elementSelector,
      popover: {
        title: '🌳 这就是故事树的分支图',
        description: '每个节点代表一个章节，分支代表不同的故事走向。你可以点击任何节点查看详情，或从任意节点续写新的故事分支。',
        side: 'bottom',
        align: 'center'
      }
    });
  }

  /**
   * 显示"下一步"提示 toast（兜底方案）
   */
  function showNextStepPrompt() {
    // 如果已经创建过故事，不再提示
    try {
      const progressStr = localStorage.getItem('st_onboarding_progress');
      if (progressStr) {
        const progress = JSON.parse(progressStr);
        if (progress.tasks && progress.tasks.createdStory) return;
      }
    } catch (e) { /* ignore */ }

    // 短暂延迟确保 Driver.js 遮罩已完全移除
    setTimeout(() => {
      // 避免重复创建
      if (document.querySelector('.st-next-step-toast')) return;

      const toast = document.createElement('div');
      toast.className = 'st-next-step-toast';
      toast.innerHTML = `
        <div class="st-next-step-content">
          <i class="fas fa-check-circle" style="color:#2d5d5a;font-size:18px;"></i>
          <div class="st-next-step-text">
            <strong>概念引导完成！</strong>
            <span>接下来试试创建你的第一个故事？</span>
          </div>
          <a href="/create-ai.html?tour=0" class="st-next-step-btn">去创建</a>
          <button class="st-next-step-close" aria-label="关闭">&times;</button>
        </div>
      `;
      document.body.appendChild(toast);

      // 动画进入
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add('st-next-step-toast--visible');
        });
      });

      // 关闭按钮
      toast.querySelector('.st-next-step-close').addEventListener('click', () => {
        toast.classList.remove('st-next-step-toast--visible');
        setTimeout(() => toast.remove(), 300);
      });

      // 10秒后自动消失
      setTimeout(() => {
        if (toast.parentNode) {
          toast.classList.remove('st-next-step-toast--visible');
          setTimeout(() => toast.remove(), 300);
        }
      }, 10000);
    }, 200);
  }

  /**
   * 标记概念引导已看过
   */
  async function markConceptGuideSeen() {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      // 更新 onboarding progress
      const progressStr = localStorage.getItem('st_onboarding_progress');
      let progress = progressStr ? JSON.parse(progressStr) : {};
      progress.conceptGuideSeen = true;
      if (!progress.tasks) progress.tasks = {};
      progress.tasks.viewedStoryTree = true;
      progress.lastUpdated = new Date().toISOString();
      localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));

      // 统一通过 OnboardingManager.syncProgress 同步
      if (window.onboardingManager) {
        await window.onboardingManager.syncProgress(progress);
      }

      // 祝贺检查：当前页面不跳转，直接触发检查
      if (window.onboardingManager) {
        window.onboardingManager.tryCelebrate(progress, { deferred: false });
      }
    } catch (e) {
      console.warn('[StoryConceptBridge] Failed to mark concept guide seen:', e);
    }
  }

  /**
   * 覆盖 ConceptGuide 的 hide 方法，在关闭后高亮分支图
   */
  function patchConceptGuideHide() {
    if (!window.conceptGuide) return;
    // 避免与 onboarding-manager 的 patch 冲突
    if (window.conceptGuide._patchedByManager || window.conceptGuide._patchedByBridge) return;
    window.conceptGuide._patchedByBridge = true;

    const originalHide = window.conceptGuide.hide.bind(window.conceptGuide);
    window.conceptGuide.hide = function() {
      originalHide();
      // 延迟让概念引导弹窗完全消失后再高亮
      setTimeout(() => {
        highlightTreeChart();
      }, 400);
    };
  }

  /**
   * 等待页面内容加载完成后触发概念引导
   */
  function waitAndTrigger() {
        let attempts = 0;
    const maxAttempts = 20; // 最多等 10 秒

    const check = setInterval(() => {
      attempts++;
      const treeChart = document.querySelector('#treeChart');
      const storyContent = document.querySelector('#storyContent');
      const contentDisplay = storyContent ? storyContent.style.display : 'N/A';

      
      // 等待故事内容显示且分支图容器存在
      if ((storyContent && storyContent.style.display !== 'none' && treeChart) || attempts >= maxAttempts) {
        clearInterval(check);
                clearGuideParam();

        if (window.conceptGuide) {
          patchConceptGuideHide();
          setTimeout(() => {
            window.conceptGuide.show();
          }, 800);
        } else {
          // 概念引导组件没加载，直接高亮分支图
          setTimeout(() => {
            highlightTreeChart();
          }, 800);
        }
      }
    }, 500);
  }

  // 暴露关键函数供 onboarding-manager 等外部调用
  window.StoryConceptBridge = {
    patchConceptGuideHide,
    highlightTreeChart,
    showNextStepPrompt,
    markConceptGuideSeen
  };

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndTrigger);
  } else {
    waitAndTrigger();
  }
})();
