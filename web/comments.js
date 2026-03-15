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
    renderComment(comment, isReply = false, rootCommentId = null, replyToUsername = null) {
        const currentUser = this.getCurrentUser();
        const isOwner = currentUser && currentUser.id === comment.user.id;
        const avatar = comment.user.avatar || '/assets/default-avatar.png';
        const isDeleted = comment.is_deleted || false;
        
        // 如果是顶级评论，rootCommentId就是自己的ID
        const actualRootId = rootCommentId || comment.id;

        // 点赞/踩按钮HTML（已删除的评论不显示）
        const voteButtons = isDeleted ? '' : `
            <button class="btn-vote btn-like ${comment.userVote === 'like' ? 'active' : ''}" data-comment-id="${comment.id}" data-vote-type="like">
                <i class="fas fa-thumbs-up"></i>
                <span class="vote-count">${comment.likeCount || 0}</span>
            </button>
            <button class="btn-vote btn-dislike ${comment.userVote === 'dislike' ? 'active' : ''}" data-comment-id="${comment.id}" data-vote-type="dislike">
                <i class="fas fa-thumbs-down"></i>
                <span class="vote-count">${comment.dislikeCount || 0}</span>
            </button>
        `;

        // 如果是回复评论，使用简化的结构（不再递归，所有回复都在同一层级）
        if (isReply) {
            // 如果有replyToUsername，说明是回复子评论，需要添加@前缀
            const contentPrefix = replyToUsername ? `<span class="reply-to">@${replyToUsername}：</span>` : '';
            
            return `
                <div class="comment-reply" data-comment-id="${comment.id}" data-root-id="${actualRootId}">
                    <div class="comment-avatar">
                        <img src="${avatar}" alt="${comment.user.username}">
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${comment.user.username}</span>
                            <span class="comment-time">${this.formatTime(comment.created_at)}</span>
                        </div>
                        <div class="comment-text ${isDeleted ? 'deleted-text' : ''}">${contentPrefix}${this.escapeHtml(comment.content)}</div>
                        <div class="comment-actions">
                            ${voteButtons}
                            ${!isDeleted ? `
                                <button class="btn-reply" data-comment-id="${comment.id}" data-root-id="${actualRootId}" data-author="${comment.user.username}">
                                    <i class="fas fa-reply"></i> 回复
                                </button>
                            ` : ''}
                            ${isOwner && !isDeleted ? `
                                <button class="btn-edit" data-comment-id="${comment.id}">
                                    <i class="fas fa-edit"></i> 编辑
                                </button>
                                <button class="btn-delete" data-comment-id="${comment.id}">
                                    <i class="fas fa-trash"></i> 删除
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // 主评论的完整结构
        // 扁平化所有回复，并保存被回复用户的信息
        const flattenReplies = (replies, parentComment = null) => {
            let result = [];
            replies.forEach(reply => {
                // 添加当前回复，记录被回复的用户名
                result.push({
                    comment: reply,
                    replyTo: parentComment ? parentComment.user.username : null
                });
                // 递归处理子回复
                if (reply.other_comments && reply.other_comments.length > 0) {
                    result = result.concat(flattenReplies(reply.other_comments, reply));
                }
            });
            return result;
        };

        const allRepliesFlat = comment.other_comments ? flattenReplies(comment.other_comments) : [];
        const replyCount = allRepliesFlat.length;
        const showCollapse = replyCount > 3; // 超过3条回复时显示折叠
        
        const visibleReplies = showCollapse ? allRepliesFlat.slice(0, 3) : allRepliesFlat;
        
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-avatar">
                    <img src="${avatar}" alt="${comment.user.username}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.user.username}</span>
                        <span class="comment-time">${this.formatTime(comment.created_at)}</span>
                    </div>
                    <div class="comment-text ${isDeleted ? 'deleted-text' : ''}">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        ${voteButtons}
                        ${!isDeleted ? `
                            <button class="btn-reply" data-comment-id="${comment.id}" data-root-id="${comment.id}" data-author="${comment.user.username}">
                                <i class="fas fa-reply"></i> 回复
                            </button>
                        ` : ''}
                        ${isOwner && !isDeleted ? `
                            <button class="btn-edit" data-comment-id="${comment.id}">
                                <i class="fas fa-edit"></i> 编辑
                            </button>
                            <button class="btn-delete" data-comment-id="${comment.id}">
                                <i class="fas fa-trash"></i> 删除
                            </button>
                        ` : ''}
                    </div>
                    <div class="reply-form-container" id="reply-form-${comment.id}" style="display: none;" data-root-id="${comment.id}">
                        <textarea class="reply-input" placeholder="写下你的回复..." maxlength="500"></textarea>
                        <div class="reply-form-actions">
                            <button class="btn-cancel-reply">取消</button>
                            <button class="btn-submit-reply" data-parent-id="${comment.id}" data-root-id="${comment.id}">发表回复</button>
                        </div>
                    </div>
                    ${allRepliesFlat.length > 0 ? `
                        <div class="comment-replies" id="replies-${comment.id}">
                            ${visibleReplies.map(item => this.renderComment(item.comment, true, comment.id, item.replyTo)).join('')}
                            ${showCollapse ? `
                                <div class="hidden-replies" style="display: none;">
                                    ${allRepliesFlat.slice(3).map(item => this.renderComment(item.comment, true, comment.id, item.replyTo)).join('')}
                                </div>
                                <div class="replies-toolbar" data-comment-id="${comment.id}">
                                    <button class="btn-toggle-replies">
                                        <span class="toggle-text">共${replyCount}条回复，点击查看全部</span>
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="comment-replies" id="replies-${comment.id}" style="display: none;"></div>
                    `}
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
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault(); // 阻止默认行为
                e.stopPropagation(); // 阻止事件冒泡
                this.submitComment();
            });
        }

        // 事件委托处理评论操作
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // 点赞/踩按钮
            if (target.classList.contains('btn-vote')) {
                const commentId = target.dataset.commentId;
                const voteType = target.dataset.voteType;
                await this.voteComment(commentId, voteType, target);
            }

            // 展开/折叠回复
            if (target.classList.contains('btn-toggle-replies')) {
                const toolbar = target.closest('.replies-toolbar');
                const repliesContainer = toolbar.closest('.comment-replies');
                const hiddenReplies = repliesContainer.querySelector('.hidden-replies');
                
                if (hiddenReplies) {
                    const commentId = toolbar.dataset.commentId;
                    const comment = this.comments.find(c => c.id === parseInt(commentId));
                    
                    // 扁平化计算总回复数
                    const flattenReplies = (replies) => {
                        let result = [];
                        replies.forEach(reply => {
                            result.push(reply);
                            if (reply.other_comments && reply.other_comments.length > 0) {
                                result = result.concat(flattenReplies(reply.other_comments));
                            }
                        });
                        return result;
                    };
                    const replyCount = comment?.other_comments ? flattenReplies(comment.other_comments).length : 0;
                    
                    if (hiddenReplies.style.display === 'none') {
                        hiddenReplies.style.display = 'block';
                        target.querySelector('.toggle-text').textContent = '收起回复';
                        target.querySelector('i').className = 'fas fa-chevron-up';
                    } else {
                        hiddenReplies.style.display = 'none';
                        target.querySelector('.toggle-text').textContent = `共${replyCount}条回复，点击查看全部`;
                        target.querySelector('i').className = 'fas fa-chevron-down';
                    }
                }
            }

            // 回复按钮
            if (target.classList.contains('btn-reply')) {
                const commentId = target.dataset.commentId;
                const rootId = target.dataset.rootId;
                this.showReplyForm(commentId, rootId);
            }

            // 取消回复
            if (target.classList.contains('btn-cancel-reply')) {
                const form = target.closest('.reply-form-container');
                if (form) form.style.display = 'none';
            }

            // 提交回复
            if (target.classList.contains('btn-submit-reply')) {
                const parentId = target.dataset.parentId;
                await this.submitReply(parentId, target);
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

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            this.showError('请先登录再发表评论');
            // 不自动跳转，让用户自己决定是否登录
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
    showReplyForm(commentId, rootId) {
        const author = event.target.dataset.author || '';
        
        // 隐藏所有回复表单
        document.querySelectorAll('.reply-form-container').forEach(form => {
            if (!form.id) { // 只隐藏动态创建的表单
                form.remove();
            } else {
                form.style.display = 'none';
            }
        });

        // 找到顶级评论的回复区域
        const repliesContainer = document.getElementById(`replies-${rootId}`);
        if (!repliesContainer) {
            console.error('找不到回复容器:', rootId);
            return;
        }

        // 确保回复容器可见
        repliesContainer.style.display = 'block';

        // 创建新的回复表单
        // 注意：这里使用 commentId 作为 parent-id，而不是 rootId
        // 这样回复子评论时，parent_id 会指向被回复的子评论ID
        const dynamicForm = document.createElement('div');
        dynamicForm.className = 'reply-form-container active-reply-form';
        dynamicForm.innerHTML = `
            <div class="reply-to-hint">回复 @${author}</div>
            <textarea class="reply-input" placeholder="写下你的回复..." maxlength="500"></textarea>
            <div class="reply-form-actions">
                <button class="btn-cancel-reply">取消</button>
                <button class="btn-submit-reply" data-parent-id="${commentId}" data-root-id="${rootId}">发表回复</button>
            </div>
        `;

        // 将表单添加到回复区域的末尾
        repliesContainer.appendChild(dynamicForm);

        // 聚焦到文本框
        const textarea = dynamicForm.querySelector('.reply-input');
        if (textarea) {
            textarea.focus();
        }

        // 滚动到表单位置
        dynamicForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 提交回复
    async submitReply(parentId, buttonElement) {
        // 从按钮元素向上查找最近的表单容器
        let form = null;
        let textarea = null;
        
        if (buttonElement) {
            form = buttonElement.closest('.reply-form-container');
            textarea = form?.querySelector('.reply-input');
        }
        
        // 如果没有找到，尝试使用ID查找（兼容顶级评论的静态表单）
        if (!form) {
            form = document.getElementById(`reply-form-${parentId}`);
            textarea = form?.querySelector('.reply-input');
        }

        const content = textarea?.value.trim();

        if (!content) {
            this.showError('请输入回复内容');
            return;
        }

        if (content.length > 500) {
            this.showError('回复内容不能超过500字符');
            return;
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            this.showError('请先登录再回复评论');
            // 不自动跳转，让用户自己决定是否登录
            return;
        }

        try {
            const response = await fetch(`/api/comments/nodes/${this.nodeId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content, parent_id: parentId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '回复失败');
            }

            // 清空输入框并隐藏表单
            if (textarea) textarea.value = '';
            if (form) {
                form.style.display = 'none';
                // 如果是动态创建的表单，直接删除
                if (!form.id) {
                    form.remove();
                }
            }

            // 重新加载评论列表
            await this.loadComments(this.currentPage);

            this.showSuccess('回复发表成功！');
        } catch (error) {
            console.error('回复评论错误:', error);
            this.showError(error.message || '回复失败，请稍后重试');
        }
    }

    // 编辑评论
    async editComment(commentId) {
        // 找到评论元素
        const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentItem) return;

        // 找到评论文本元素
        const commentText = commentItem.querySelector('.comment-text');
        if (!commentText) return;

        // 获取原始评论内容
        const originalContent = commentText.textContent;

        // 创建编辑表单
        const editForm = document.createElement('div');
        editForm.className = 'edit-form-container';
        editForm.innerHTML = `
            <textarea class="edit-input" maxlength="500">${this.escapeHtml(originalContent)}</textarea>
            <div class="edit-form-actions">
                <button class="btn-cancel-edit">取消</button>
                <button class="btn-save-edit" data-comment-id="${commentId}">保存</button>
            </div>
        `;

        // 隐藏原始文本，显示编辑表单
        commentText.style.display = 'none';
        commentText.parentNode.insertBefore(editForm, commentText.nextSibling);

        // 聚焦到文本框
        const textarea = editForm.querySelector('.edit-input');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // 取消编辑
        editForm.querySelector('.btn-cancel-edit').addEventListener('click', () => {
            commentText.style.display = 'block';
            editForm.remove();
        });

        // 保存编辑
        editForm.querySelector('.btn-save-edit').addEventListener('click', async () => {
            const newContent = textarea.value.trim();

            if (!newContent) {
                this.showError('评论内容不能为空');
                return;
            }

            if (newContent.length > 500) {
                this.showError('评论内容不能超过500字符');
                return;
            }

            if (newContent === originalContent) {
                commentText.style.display = 'block';
                editForm.remove();
                return;
            }

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                this.showError('请先登录');
                return;
            }

            try {
                const response = await fetch(`/api/comments/comments/${commentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: newContent })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '更新失败');
                }

                // 更新显示的评论内容
                commentText.textContent = newContent;
                commentText.style.display = 'block';
                editForm.remove();

                this.showSuccess('评论已更新！');
            } catch (error) {
                console.error('更新评论错误:', error);
                this.showError(error.message || '更新失败，请稍后重试');
            }
        });
    }

    // 删除评论
    async deleteComment(commentId) {
        if (!confirm('确定要删除这条评论吗？')) {
            return;
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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

    // 点赞或踩评论
    async voteComment(commentId, voteType, buttonElement) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            this.showError('请先登录');
            return;
        }

        try {
            const response = await fetch(`/api/comments/comments/${commentId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ voteType })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '操作失败');
            }

            const data = await response.json();

            // 更新UI - 查找评论元素
            const commentEl = buttonElement.closest('[data-comment-id]');
            if (!commentEl) {
                console.error('找不到评论元素');
                // 重新加载评论列表以更新UI
                await this.loadComments(this.currentPage);
                return;
            }

            const likeBtn = commentEl.querySelector('.btn-like');
            const dislikeBtn = commentEl.querySelector('.btn-dislike');

            if (!likeBtn || !dislikeBtn) {
                console.error('找不到点赞/踩按钮');
                await this.loadComments(this.currentPage);
                return;
            }

            // 获取最新的投票统计
            const voteResponse = await fetch(`/api/comments/comments/${commentId}/votes`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (voteResponse.ok) {
                const voteData = await voteResponse.json();
                
                // 更新点赞数
                const likeCount = likeBtn.querySelector('.vote-count');
                if (likeCount) likeCount.textContent = voteData.likeCount;

                // 更新踩数
                const dislikeCount = dislikeBtn.querySelector('.vote-count');
                if (dislikeCount) dislikeCount.textContent = voteData.dislikeCount;

                // 更新按钮状态
                likeBtn.classList.toggle('active', voteData.userVote === 'like');
                dislikeBtn.classList.toggle('active', voteData.userVote === 'dislike');
            }

        } catch (error) {
            console.error('投票错误:', error);
            this.showError(error.message || '操作失败，请稍后重试');
        }
    }

    // 获取当前用户信息
    getCurrentUser() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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

