/**
 * StoryTree Modal 弹窗组件
 * 替代所有 confirm() / alert() 调用，提供统一的弹窗体验
 */

class Modal {
    /**
     * @param {object} options
     * @param {string} options.title - 标题
     * @param {string} options.content - 内容（支持 HTML）
     * @param {string} [options.confirmText='确定'] - 确认按钮文字
     * @param {string} [options.cancelText='取消'] - 取消按钮文字
     * @param {boolean} [options.showCancel=true] - 是否显示取消按钮
     * @param {'default'|'danger'|'warning'|'success'} [options.type='default'] - 类型
     * @param {Function} [options.onConfirm] - 确认回调
     * @param {Function} [options.onCancel] - 取消回调
     * @param {boolean} [options.closeOnOverlay=true] - 点击遮罩是否关闭
     */
    constructor(options = {}) {
        this.options = {
            title: '提示',
            content: '',
            confirmText: '确定',
            cancelText: '取消',
            showCancel: true,
            type: 'default',
            onConfirm: () => {},
            onCancel: () => {},
            closeOnOverlay: true,
            ...options,
        };
        this._overlay = null;
        this._modal = null;
        this._keydownHandler = null;
        this._injectStyles();
        this._render();
    }

    _injectStyles() {
        if (document.getElementById('st-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'st-modal-styles';
        style.textContent = `
            .st-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                opacity: 0;
                transition: opacity 0.25s ease;
            }
            .st-modal-overlay.show { opacity: 1; }

            .st-modal {
                background: white;
                border-radius: 1.25rem;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                width: 100%;
                max-width: 440px;
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
                opacity: 0;
                overflow: hidden;
            }
            .st-modal-overlay.show .st-modal {
                transform: scale(1) translateY(0);
                opacity: 1;
            }

            .st-modal-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1.25rem 1.5rem 0;
            }
            .st-modal-icon {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 0.75rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.125rem;
                flex-shrink: 0;
            }
            .st-modal-icon.type-default { background: #EEF2FF; color: #6366F1; }
            .st-modal-icon.type-danger { background: #FEF2F2; color: #EF4444; }
            .st-modal-icon.type-warning { background: #FFFBEB; color: #F59E0B; }
            .st-modal-icon.type-success { background: #F0FDF4; color: #22C55E; }

            .st-modal-title {
                font-size: 1.0625rem;
                font-weight: 600;
                color: #111827;
                flex: 1;
            }
            .st-modal-close-btn {
                background: none;
                border: none;
                color: #9CA3AF;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 0.375rem;
                font-size: 0.875rem;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .st-modal-close-btn:hover { background: #F3F4F6; color: #374151; }

            .st-modal-body {
                padding: 1rem 1.5rem 1.25rem;
                color: #4B5563;
                font-size: 0.9375rem;
                line-height: 1.6;
            }

            .st-modal-footer {
                display: flex;
                gap: 0.75rem;
                padding: 0 1.5rem 1.5rem;
                justify-content: flex-end;
            }

            .st-modal-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.375rem;
                padding: 0.625rem 1.25rem;
                font-size: 0.9375rem;
                font-weight: 600;
                border: 2px solid transparent;
                border-radius: 0.625rem;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 80px;
            }
            .st-modal-btn-cancel {
                background: white;
                color: #4B5563;
                border-color: #E5E7EB;
            }
            .st-modal-btn-cancel:hover { background: #F9FAFB; border-color: #D1D5DB; }

            .st-modal-btn-confirm {
                background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
                color: white;
                box-shadow: 0 4px 6px -1px rgba(99,102,241,0.2);
            }
            .st-modal-btn-confirm:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 12px -2px rgba(99,102,241,0.3);
            }
            .st-modal-btn-confirm.type-danger {
                background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
                box-shadow: 0 4px 6px -1px rgba(239,68,68,0.2);
            }
            .st-modal-btn-confirm.type-danger:hover {
                box-shadow: 0 6px 12px -2px rgba(239,68,68,0.3);
            }
            .st-modal-btn-confirm.type-warning {
                background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                box-shadow: 0 4px 6px -1px rgba(245,158,11,0.2);
            }
            .st-modal-btn-confirm.type-success {
                background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
                box-shadow: 0 4px 6px -1px rgba(34,197,94,0.2);
            }

            /* 分割线 */
            .st-modal-divider {
                height: 1px;
                background: #F3F4F6;
                margin: 0 1.5rem;
            }
        `;
        document.head.appendChild(style);
    }

    _render() {
        const typeIcons = {
            default: 'fas fa-info-circle',
            danger: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            success: 'fas fa-check-circle',
        };
        const { title, content, confirmText, cancelText, showCancel, type } = this.options;

        this._overlay = document.createElement('div');
        this._overlay.className = 'st-modal-overlay';
        this._overlay.setAttribute('role', 'dialog');
        this._overlay.setAttribute('aria-modal', 'true');
        this._overlay.setAttribute('aria-labelledby', 'st-modal-title');

        this._modal = document.createElement('div');
        this._modal.className = 'st-modal';
        this._modal.innerHTML = `
            <div class="st-modal-header">
                <div class="st-modal-icon type-${type}">
                    <i class="${typeIcons[type] || typeIcons.default}" aria-hidden="true"></i>
                </div>
                <h3 class="st-modal-title" id="st-modal-title">${this._escapeHtml(title)}</h3>
                <button class="st-modal-close-btn" aria-label="关闭弹窗">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="st-modal-body">${content}</div>
            <div class="st-modal-divider"></div>
            <div class="st-modal-footer">
                ${showCancel ? `<button class="st-modal-btn st-modal-btn-cancel">${this._escapeHtml(cancelText)}</button>` : ''}
                <button class="st-modal-btn st-modal-btn-confirm type-${type}">${this._escapeHtml(confirmText)}</button>
            </div>
        `;

        this._overlay.appendChild(this._modal);
        document.body.appendChild(this._overlay);

        this._bindEvents();

        // 动画进入
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this._overlay.classList.add('show'));
        });

        // 聚焦确认按钮
        setTimeout(() => {
            this._modal.querySelector('.st-modal-btn-confirm')?.focus();
        }, 300);
    }

    _bindEvents() {
        // 关闭按钮
        this._modal.querySelector('.st-modal-close-btn')?.addEventListener('click', () => {
            this._cancel();
        });

        // 取消按钮
        this._modal.querySelector('.st-modal-btn-cancel')?.addEventListener('click', () => {
            this._cancel();
        });

        // 确认按钮
        this._modal.querySelector('.st-modal-btn-confirm')?.addEventListener('click', () => {
            this._confirm();
        });

        // 点击遮罩关闭
        if (this.options.closeOnOverlay) {
            this._overlay.addEventListener('click', (e) => {
                if (e.target === this._overlay) this._cancel();
            });
        }

        // ESC 键关闭
        this._keydownHandler = (e) => {
            if (e.key === 'Escape') this._cancel();
            if (e.key === 'Enter') {
                const confirmBtn = this._modal.querySelector('.st-modal-btn-confirm');
                if (document.activeElement === confirmBtn) this._confirm();
            }
        };
        document.addEventListener('keydown', this._keydownHandler);
    }

    _confirm() {
        this.close();
        this.options.onConfirm?.();
    }

    _cancel() {
        this.close();
        this.options.onCancel?.();
    }

    close() {
        if (!this._overlay) return;
        this._overlay.classList.remove('show');
        document.removeEventListener('keydown', this._keydownHandler);
        setTimeout(() => {
            if (this._overlay?.parentNode) {
                this._overlay.parentNode.removeChild(this._overlay);
            }
            this._overlay = null;
            this._modal = null;
        }, 300);
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// ===== 全局便捷方法 =====

/**
 * 显示确认弹窗
 * @param {string} content - 内容
 * @param {Function} onConfirm - 确认回调
 * @param {object} [options] - 额外选项
 */
window.showConfirm = function(content, onConfirm, options = {}) {
    return new Modal({
        title: '确认操作',
        content,
        confirmText: '确定',
        cancelText: '取消',
        type: 'default',
        onConfirm,
        ...options,
    });
};

/**
 * 显示危险确认弹窗（删除等操作）
 * @param {string} content - 内容
 * @param {Function} onConfirm - 确认回调
 * @param {object} [options] - 额外选项
 */
window.showDangerConfirm = function(content, onConfirm, options = {}) {
    return new Modal({
        title: '危险操作',
        content,
        confirmText: '确认删除',
        cancelText: '取消',
        type: 'danger',
        onConfirm,
        ...options,
    });
};

/**
 * 显示提示弹窗（无取消按钮）
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {Function} [onClose] - 关闭回调
 */
window.showAlert = function(title, content, onClose) {
    return new Modal({
        title,
        content,
        confirmText: '知道了',
        showCancel: false,
        type: 'info',
        onConfirm: onClose,
    });
};

// 导出
window.Modal = Modal;

