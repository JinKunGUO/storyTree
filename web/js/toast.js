/**
 * StoryTree Toast 通知组件
 * 替代所有 alert() 调用，提供统一的通知体验
 */

class Toast {
    constructor() {
        this.container = null;
        this._init();
    }

    _init() {
        if (document.getElementById('st-toast-container')) {
            this.container = document.getElementById('st-toast-container');
            return;
        }
        this.container = document.createElement('div');
        this.container.id = 'st-toast-container';
        this.container.setAttribute('aria-live', 'assertive');
        this.container.setAttribute('aria-atomic', 'false');
        this.container.style.cssText = `
            position: fixed;
            bottom: 1.5rem;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column-reverse;
            gap: 0.5rem;
            align-items: center;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
        this._injectStyles();
    }

    _injectStyles() {
        if (document.getElementById('st-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'st-toast-styles';
        style.textContent = `
            .st-toast {
                display: inline-flex;
                align-items: center;
                gap: 0.625rem;
                padding: 0.875rem 1.25rem;
                background: white;
                border-radius: 0.75rem;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -5px rgba(0,0,0,0.08);
                font-size: 0.9375rem;
                font-weight: 500;
                color: #111827;
                pointer-events: auto;
                min-width: 240px;
                max-width: 420px;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                cursor: pointer;
                user-select: none;
            }
            .st-toast.show {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .st-toast.hide {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .st-toast-icon {
                font-size: 1.125rem;
                flex-shrink: 0;
            }
            .st-toast-msg { flex: 1; line-height: 1.4; }
            .st-toast-close {
                color: #9CA3AF;
                font-size: 0.875rem;
                margin-left: 0.25rem;
                flex-shrink: 0;
                transition: color 0.15s;
            }
            .st-toast:hover .st-toast-close { color: #6B7280; }

            /* 类型 */
            .st-toast-success { border-left: 4px solid #22C55E; }
            .st-toast-success .st-toast-icon { color: #22C55E; }
            .st-toast-error { border-left: 4px solid #EF4444; }
            .st-toast-error .st-toast-icon { color: #EF4444; }
            .st-toast-warning { border-left: 4px solid #F59E0B; }
            .st-toast-warning .st-toast-icon { color: #F59E0B; }
            .st-toast-info { border-left: 4px solid #3B82F6; }
            .st-toast-info .st-toast-icon { color: #3B82F6; }

            /* 进度条 */
            .st-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                border-radius: 0 0 0.75rem 0.75rem;
                animation: st-toast-progress linear forwards;
            }
            .st-toast-success .st-toast-progress { background: #22C55E; }
            .st-toast-error .st-toast-progress { background: #EF4444; }
            .st-toast-warning .st-toast-progress { background: #F59E0B; }
            .st-toast-info .st-toast-progress { background: #3B82F6; }

            @keyframes st-toast-progress {
                from { width: 100%; }
                to { width: 0%; }
            }

            /* 暗色背景 Toast */
            .st-toast-dark {
                background: #1F2937;
                color: white;
            }
            .st-toast-dark .st-toast-close { color: #6B7280; }
        `;
        document.head.appendChild(style);
    }

    /**
     * 显示 Toast 通知
     * @param {string} message - 消息内容
     * @param {'success'|'error'|'warning'|'info'} type - 类型
     * @param {number} duration - 显示时长（ms），0 表示不自动消失
     */
    show(message, type = 'info', duration = 3500) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
        };

        const toast = document.createElement('div');
        toast.className = `st-toast st-toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.style.position = 'relative';
        toast.style.overflow = 'hidden';
        toast.innerHTML = `
            <i class="${icons[type] || icons.info} st-toast-icon" aria-hidden="true"></i>
            <span class="st-toast-msg">${this._escapeHtml(message)}</span>
            <i class="fas fa-times st-toast-close" aria-label="关闭" aria-hidden="true"></i>
            ${duration > 0 ? `<div class="st-toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
        `;

        // 点击关闭
        toast.addEventListener('click', () => this._dismiss(toast));

        this.container.appendChild(toast);

        // 动画进入
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        // 自动消失
        if (duration > 0) {
            setTimeout(() => this._dismiss(toast), duration);
        }

        return toast;
    }

    _dismiss(toast) {
        if (!toast || toast.dataset.dismissing) return;
        toast.dataset.dismissing = 'true';
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 便捷方法
    success(msg, duration) { return this.show(msg, 'success', duration); }
    error(msg, duration) { return this.show(msg, 'error', duration); }
    warning(msg, duration) { return this.show(msg, 'warning', duration); }
    info(msg, duration) { return this.show(msg, 'info', duration); }
}

// 全局单例
window.toast = new Toast();

