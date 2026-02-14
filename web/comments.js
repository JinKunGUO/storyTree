// 评论系统前端逻辑

class CommentSystem {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.currentPage = 1;
        this.limit = 20;
        this.comments = [];
    }

    // 初始化评论系统
    async init() {
        await this.loadComments();
        this.attachEventListeners();
    }

    // 加载评论列表
    async loadComments(page = 1) {
        try {
            const response = await fetch(`/api/comments/nodes/${this.nodeId}/comments?page=${page}&limit=${this.limit}`);
            
            if (!response.ok) {
                throw new Error('加载评论失败');
            }

            const data = await response.json();
            this.comments = data.comments;
            this.currentPage = data.pagination.page;
            this.totalPages = data.pagination.totalPages;

            this.renderComments();
            this.renderPagination();
        } catch (error) {
            console.error('加载评论错误:', error);
            this.showError('加载评论失败，请稍后重试');
        }
    }

    // 渲染评论列表
    renderComments() {
        const container = document.getElementById('comments-list');
        if (!container) return;

        if (this.comments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>还没有评论，快来抢沙发吧！</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.comments.map(comment => this.renderComment(comment)).join('');
    }

    // 渲染单个评论
    renderComment(comment, isReply = false) {
        const currentUser = this.getCurrentUser();
        const isOwner = currentUser && currentUser.id === comment.user.id;
        const avatar = comment.user.avatar || '/assets/default-avatar.png';

        return `
            <div class="comment-item ${isReply ? 'comment-reply' : ''}" data-comment-id="${comment.id}">
                <div class="comment-avatar">
                    <img src="${avatar}" alt="${comment.user.username}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.user.username}</span>
                        <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        <button class="btn-reply" data-comment-id="${comment.id}">
                            <i class="fas fa-reply"></i> 回复
                        </button>
                        ${isOwner ? `
                            <button class="btn-edit" data-comment-id="${comment.id}">
                                <i class="fas fa-edit"></i> 编辑
                            </button>
                            <button class="btn-delete" data-comment-id="${comment.id}">
                                <i class="fas fa-trash"></i> 删除
                            </button>
                        ` : ''}
                    </div>
                    ${comment.replies && comment.replies.length > 0 ? `
                        <div class="comment-replies">
                            ${comment.replies.map(reply => this.renderComment(reply, true)).join('')}
                        </div>
                    ` : ''}
                    <div class="reply-form-container" id="reply-form-${comment.id}" style="display: none;">
                        <textarea class="reply-input" placeholder="写下你的回复..." maxlength="500"></textarea>
                        <div class="reply-form-actions">
                            <button class="btn-cancel-reply">取消</button>
                            <button class="btn-submit-reply" data-parent-id="${comment.id}">发表回复</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染分页
    renderPagination() {
        const container = document.getElementById('comments-pagination');
        if (!container || this.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination">';
        
        // 上一页
        if (this.currentPage > 1) {
            html += `<button class="page-btn" data-page="${this.currentPage - 1}">上一页</button>`;
        }

        // 页码
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === this.currentPage) {
                html += `<button class="page-btn active">${i}</button>`;
            } else if (i === 1 || i === this.totalPages || Math.abs(i - this.currentPage) <= 2) {
                html += `<button class="page-btn" data-page="${i}">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += `<span class="page-ellipsis">...</span>`;
            }
        }

        // 下一页
        if (this.currentPage < this.totalPages) {
            html += `<button class="page-btn" data-page="${this.currentPage + 1}">下一页</button>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // 绑定事件监听器
    attachEventListeners() {
        // 发表评论
        const submitBtn = document.getElementById('submit-comment');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitComment());
        }

        // 事件委托处理评论操作
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // 回复按钮
            if (target.classList.contains('btn-reply')) {
                const commentId = target.dataset.commentId;
                this.showReplyForm(commentId);
            }

            // 取消回复
            if (target.classList.contains('btn-cancel-reply')) {
                const form = target.closest('.reply-form-container');
                if (form) form.style.display = 'none';
            }

            // 提交回复
            if (target.classList.contains('btn-submit-reply')) {
                const parentId = target.dataset.parentId;
                await this.submitReply(parentId);
            }

            // 编辑按钮
            if (target.classList.contains('btn-edit')) {
                const commentId = target.dataset.commentId;
                this.editComment(commentId);
            }

            // 删除按钮
            if (target.classList.contains('btn-delete')) {
                const commentId = target.dataset.commentId;
                await this.deleteComment(commentId);
            }

            // 分页按钮
            if (target.classList.contains('page-btn') && target.dataset.page) {
                const page = parseInt(target.dataset.page);
                await this.loadComments(page);
                // 滚动到评论区顶部
                document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 发表评论
    async submitComment() {
        const textarea = document.getElementById('comment-input');
        const content = textarea?.value.trim();

        if (!content) {
            this.showError('请输入评论内容');
            return;
        }

        if (content.length > 500) {
            this.showError('评论内容不能超过500字符');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            this.showError('请先登录');
            window.location.href = '/login';
            return;
        }

        try {
            const response = await fetch(`/api/comments/nodes/${this.nodeId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '发表失败');
            }

            // 清空输入框
            if (textarea) textarea.value = '';

            // 重新加载评论列表
            await this.loadComments(1);

            this.showSuccess('评论发表成功！');
        } catch (error) {
            console.error('发表评论错误:', error);
            this.showError(error.message || '发表失败，请稍后重试');
        }
    }

    // 显示回复表单
    showReplyForm(commentId) {
        // 隐藏所有回复表单
        document.querySelectorAll('.reply-form-container').forEach(form => {
            form.style.display = 'none';
        });

        // 显示当前回复表单
        const form = document.getElementById(`reply-form-${commentId}`);
        if (form) {
            form.style.display = 'block';
            const textarea = form.querySelector('.reply-input');
            if (textarea) textarea.focus();
        }
    }

    // 提交回复
    async submitReply(parentId) {
        const form = document.getElementById(`reply-form-${parentId}`);
        const textarea = form?.querySelector('.reply-input');
        const content = textarea?.value.trim();

        if (!content) {
            this.showError('请输入回复内容');
            return;
        }

        if (content.length > 500) {
            this.showError('回复内容不能超过500字符');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            this.showError('请先登录');
            window.location.href = '/login';
            return;
        }

        try {
            const response = await fetch(`/api/comments/nodes/${this.nodeId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content, parentId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '回复失败');
            }

            // 清空输入框并隐藏表单
            if (textarea) textarea.value = '';
            if (form) form.style.display = 'none';

            // 重新加载评论列表
            await this.loadComments(this.currentPage);

            this.showSuccess('回复发表成功！');
        } catch (error) {
            console.error('回复评论错误:', error);
            this.showError(error.message || '回复失败，请稍后重试');
        }
    }

    // 编辑评论
    editComment(commentId) {
        // TODO: 实现编辑功能
        console.log('编辑评论:', commentId);
    }

    // 删除评论
    async deleteComment(commentId) {
        if (!confirm('确定要删除这条评论吗？')) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            this.showError('请先登录');
            return;
        }

        try {
            const response = await fetch(`/api/comments/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '删除失败');
            }

            // 重新加载评论列表
            await this.loadComments(this.currentPage);

            this.showSuccess('评论删除成功！');
        } catch (error) {
            console.error('删除评论错误:', error);
            this.showError(error.message || '删除失败，请稍后重试');
        }
    }

    // 获取当前用户信息
    getCurrentUser() {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return {
                id: payload.userId,
                username: payload.username
            };
        } catch (error) {
            return null;
        }
    }

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diff < minute) {
            return '刚刚';
        } else if (diff < hour) {
            return `${Math.floor(diff / minute)}分钟前`;
        } else if (diff < day) {
            return `${Math.floor(diff / hour)}小时前`;
        } else if (diff < 7 * day) {
            return `${Math.floor(diff / day)}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示错误消息
    showError(message) {
        this.showMessage(message, 'error');
    }

    // 显示成功消息
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
        `;

        // 添加到页面
        document.body.appendChild(messageEl);

        // 3秒后自动移除
        setTimeout(() => {
            messageEl.classList.add('fade-out');
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }
}

// 导出
window.CommentSystem = CommentSystem;

