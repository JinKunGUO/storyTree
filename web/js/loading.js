/**
 * StoryTree Loading 组件
 * 提供：Spinner 加载动画、骨架屏、全屏加载遮罩
 *
 * 使用方式：
 *   // Spinner
 *   const spinner = Loading.spinner(container);
 *   spinner.remove();
 *
 *   // 骨架屏
 *   const skeleton = Loading.skeleton(container, { rows: 3, avatar: true });
 *   skeleton.remove();
 *
 *   // 全屏遮罩
 *   Loading.showOverlay('保存中...');
 *   Loading.hideOverlay();
 *
 *   // 故事卡片骨架屏（批量）
 *   Loading.storyCards(container, 6);
 */

(function (global) {
    'use strict';

    // ===== 内联样式（确保组件独立工作）=====
    const STYLES = `
.st-loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem;
    color: var(--st-text-tertiary, #9CA3AF);
    flex-direction: column;
    gap: 0.75rem;
}

.st-spinner-icon {
    width: 36px;
    height: 36px;
    border: 3px solid var(--st-gray-200, #E5E7EB);
    border-top-color: var(--st-primary-500, #6366F1);
    border-radius: 50%;
    animation: st-spin 0.8s linear infinite;
}

.st-spinner-icon.st-spinner-sm {
    width: 20px;
    height: 20px;
    border-width: 2px;
}

.st-spinner-icon.st-spinner-lg {
    width: 48px;
    height: 48px;
    border-width: 4px;
}

.st-spinner-text {
    font-size: 0.875rem;
    color: var(--st-text-tertiary, #9CA3AF);
}

@keyframes st-spin {
    to { transform: rotate(360deg); }
}

/* 骨架屏 */
.st-skeleton {
    padding: 1rem 0;
}

.st-skeleton-item {
    background: linear-gradient(
        90deg,
        var(--st-gray-100, #F3F4F6) 25%,
        var(--st-gray-200, #E5E7EB) 50%,
        var(--st-gray-100, #F3F4F6) 75%
    );
    background-size: 200% 100%;
    border-radius: var(--st-radius-md, 6px);
    animation: st-shimmer 1.5s infinite;
}

@keyframes st-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.st-skeleton-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
}

.st-skeleton-row {
    height: 14px;
    margin-bottom: 10px;
    border-radius: var(--st-radius-sm, 4px);
}

.st-skeleton-row.st-w-full { width: 100%; }
.st-skeleton-row.st-w-3-4 { width: 75%; }
.st-skeleton-row.st-w-2-3 { width: 66%; }
.st-skeleton-row.st-w-1-2 { width: 50%; }
.st-skeleton-row.st-w-1-3 { width: 33%; }
.st-skeleton-row.st-title { height: 20px; }

.st-skeleton-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.st-skeleton-header-content {
    flex: 1;
}

/* 故事卡片骨架屏 */
.st-skeleton-card {
    background: white;
    border-radius: var(--st-radius-xl, 12px);
    overflow: hidden;
    box-shadow: var(--st-shadow-sm, 0 1px 3px rgba(0,0,0,0.1));
}

.st-skeleton-cover {
    height: 180px;
    width: 100%;
}

.st-skeleton-card-body {
    padding: 1.25rem;
}

/* 全屏遮罩 */
.st-loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9998;
    gap: 1rem;
    animation: st-fade-in 0.2s ease;
}

.st-loading-overlay .st-spinner-icon {
    width: 48px;
    height: 48px;
    border-width: 4px;
}

.st-loading-overlay .st-overlay-text {
    font-size: 1rem;
    color: var(--st-text-secondary, #4B5563);
    font-weight: 500;
}

@keyframes st-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
`;

    // 注入样式（只注入一次）
    function injectStyles() {
        if (document.getElementById('st-loading-styles')) return;
        const style = document.createElement('style');
        style.id = 'st-loading-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // ===== Loading 类 =====
    const Loading = {

        /**
         * 在容器内显示 Spinner
         * @param {HTMLElement} container - 目标容器
         * @param {Object} options - { text, size: 'sm'|'md'|'lg' }
         * @returns {HTMLElement} spinner 元素（可调用 .remove() 移除）
         */
        spinner(container, options = {}) {
            injectStyles();
            const { text = '', size = 'md' } = options;

            const el = document.createElement('div');
            el.className = 'st-loading-spinner';
            el.setAttribute('aria-label', text || '加载中');
            el.setAttribute('role', 'status');

            el.innerHTML = `
                <div class="st-spinner-icon ${size === 'sm' ? 'st-spinner-sm' : size === 'lg' ? 'st-spinner-lg' : ''}" aria-hidden="true"></div>
                ${text ? `<span class="st-spinner-text">${text}</span>` : ''}
            `;

            if (container) {
                container.innerHTML = '';
                container.appendChild(el);
            }

            return el;
        },

        /**
         * 在容器内显示骨架屏
         * @param {HTMLElement} container - 目标容器
         * @param {Object} options - { rows, avatar, widths }
         * @returns {HTMLElement} skeleton 元素
         */
        skeleton(container, options = {}) {
            injectStyles();
            const {
                rows = 3,
                avatar = false,
                widths = ['full', '3-4', '2-3']
            } = options;

            const el = document.createElement('div');
            el.className = 'st-skeleton';
            el.setAttribute('aria-label', '内容加载中');
            el.setAttribute('aria-busy', 'true');

            let html = '';

            if (avatar) {
                html += `
                    <div class="st-skeleton-header">
                        <div class="st-skeleton-item st-skeleton-avatar"></div>
                        <div class="st-skeleton-header-content">
                            <div class="st-skeleton-item st-skeleton-row st-title st-w-1-2" style="margin-bottom: 8px;"></div>
                            <div class="st-skeleton-item st-skeleton-row st-w-1-3"></div>
                        </div>
                    </div>
                `;
            }

            for (let i = 0; i < rows; i++) {
                const w = widths[i % widths.length];
                const isTitle = i === 0 && !avatar;
                html += `<div class="st-skeleton-item st-skeleton-row ${isTitle ? 'st-title' : ''} st-w-${w}"></div>`;
            }

            el.innerHTML = html;

            if (container) {
                container.innerHTML = '';
                container.appendChild(el);
            }

            return el;
        },

        /**
         * 在容器内生成 N 个故事卡片骨架屏
         * @param {HTMLElement} container - 目标容器（通常是 grid）
         * @param {number} count - 卡片数量
         */
        storyCards(container, count = 6) {
            injectStyles();
            if (!container) return;

            container.innerHTML = Array.from({ length: count }, () => `
                <div class="st-skeleton-card" aria-hidden="true">
                    <div class="st-skeleton-item st-skeleton-cover"></div>
                    <div class="st-skeleton-card-body">
                        <div class="st-skeleton-item st-skeleton-row st-title st-w-3-4" style="margin-bottom: 12px;"></div>
                        <div class="st-skeleton-item st-skeleton-row st-w-full"></div>
                        <div class="st-skeleton-item st-skeleton-row st-w-2-3"></div>
                        <div class="st-skeleton-item st-skeleton-row st-w-1-2" style="margin-top: 16px;"></div>
                    </div>
                </div>
            `).join('');
        },

        /**
         * 显示全屏加载遮罩
         * @param {string} text - 提示文字
         */
        showOverlay(text = '加载中...') {
            injectStyles();
            this.hideOverlay(); // 确保不重复

            const overlay = document.createElement('div');
            overlay.id = 'st-loading-overlay';
            overlay.className = 'st-loading-overlay';
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-label', text);

            overlay.innerHTML = `
                <div class="st-spinner-icon" aria-hidden="true"></div>
                <span class="st-overlay-text">${text}</span>
            `;

            document.body.appendChild(overlay);
        },

        /**
         * 隐藏全屏加载遮罩
         */
        hideOverlay() {
            const el = document.getElementById('st-loading-overlay');
            if (el) el.remove();
        },

        /**
         * 按钮加载状态
         * @param {HTMLButtonElement} btn - 按钮元素
         * @param {boolean} loading - true 显示加载，false 恢复
         * @param {string} loadingText - 加载时显示的文字
         */
        button(btn, loading, loadingText = '处理中...') {
            injectStyles();
            if (!btn) return;

            if (loading) {
                btn._originalHTML = btn.innerHTML;
                btn._originalDisabled = btn.disabled;
                btn.disabled = true;
                btn.innerHTML = `
                    <span class="st-spinner-icon st-spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:6px;" aria-hidden="true"></span>
                    ${loadingText}
                `;
            } else {
                if (btn._originalHTML !== undefined) {
                    btn.innerHTML = btn._originalHTML;
                    btn.disabled = btn._originalDisabled || false;
                    delete btn._originalHTML;
                    delete btn._originalDisabled;
                }
            }
        }
    };

    // 挂载到全局
    global.Loading = Loading;

})(window);

