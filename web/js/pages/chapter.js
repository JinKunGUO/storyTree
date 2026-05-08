        let currentChapter = null;
        let storyId = null;
        let commentSystem = null;
        let siblings = [];
        let selectedSiblingId = null;
        let recommendedBranch = null;

        // 页面初始化
        document.addEventListener('DOMContentLoaded', function() {
            checkAuthStatus();
            loadChapter();
            initSettings();
            initReadingProgress();
            initEditFeature(); // 初始化编辑功能
            initReportFeature(); // 初始化举报功能
            initBranchCompare(); // 初始化分支对比功能
            initAIRecommend(); // 初始化AI推荐功能
            
            // 监听窗口大小变化，动态调整工具栏位置
            window.addEventListener('resize', () => {
                if (fullBreadcrumbPath) {
                    updateToolbarPosition();
                }
            });
            
            // 初始化分享按钮
            document.getElementById('shareChapterBtn')?.addEventListener('click', function() {
                if (currentChapter && storyId) {
                    shareManager.showSharePanel({
                        storyId: storyId,
                        nodeId: currentChapter.id,
                        title: currentChapter.title,
                        description: currentChapter.content?.substring(0, 100) + '...'
                    });
                }
            });

            // 字符计数
            const commentInput = document.getElementById('comment-input');
            const currentChars = document.getElementById('currentChars');
            commentInput?.addEventListener('input', function() {
                currentChars.textContent = this.value.length;
            });

            // 书签按钮（收藏当前章节）
            document.getElementById('bookmarkBtn')?.addEventListener('click', toggleBookmark);
        });

        // 加载章节
        async function loadChapter() {
            const urlParams = new URLSearchParams(window.location.search);
            const chapterId = urlParams.get('id');

            if (!chapterId) {
                showError('章节ID不存在');
                window.history.back();
                return;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${chapterId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (!response.ok) {
                    throw new Error('加载章节失败');
                }

                const data = await response.json();
                console.log('章节API返回数据:', data);
                
                // API返回的是 {node: {...}, branches: [...]} 结构
                currentChapter = data.node;
                // 将branches字段添加到currentChapter对象中
                currentChapter.branches = data.branches || [];
                storyId = currentChapter.story_id;  // 修改为 story_id
                
                console.log('当前章节:', currentChapter);
                console.log('子分支数量:', currentChapter.branches.length);
                console.log('故事ID:', storyId);
                
                renderChapter(currentChapter);
                
                // 初始化评分组件
                initRating(currentChapter, data.userRating);
                // 获取故事信息（包括allow_comment设置）
                let storyInfo = null;
                try {
                    const storyResponse = await fetch(`/api/stories/${storyId}`);
                    if (storyResponse.ok) {
                        const storyData = await storyResponse.json();
                        storyInfo = storyData.story;
                        console.log('故事信息:', storyInfo);
                    }
                } catch (error) {
                    console.error('获取故事信息失败:', error);
                }
                
                // 初始化评论系统，传入故事信息
                commentSystem = new CommentSystem(chapterId, storyInfo);
                await commentSystem.init();

                // 更新评论数
                const commentCount = document.getElementById('commentCount');
                if (commentCount) {
                    commentCount.textContent = currentChapter.commentCount || 0;
                }

                // 加载章节导航
                await loadChapterNavigation(storyId, chapterId);

                // 加载面包屑导航
                await loadBreadcrumbNav(chapterId);

                // 隐藏加载状态
                document.getElementById('loadingState').style.display = 'none';
                document.getElementById('chapterContainer').style.display = 'block';

                // 保存阅读进度
                saveReadingProgress(chapterId);

                // 检查是否显示分支对比按钮
                checkShowCompareButton();

                // 检查是否显示AI推荐按钮
                checkShowRecommendButton();

                // 处理 hash 锚点（如 #comment-123），自动滚动到对应评论
                if (window.location.hash) {
                    const hash = window.location.hash.substring(1); // 去掉 #
                    setTimeout(() => {
                        const targetElement = document.getElementById(hash);
                        if (targetElement) {
                            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // 高亮目标评论（如果是评论的话）
                            if (hash.startsWith('comment-')) {
                                targetElement.style.backgroundColor = '#fff3cd';
                                setTimeout(() => {
                                    targetElement.style.backgroundColor = '';
                                }, 2000);
                            }
                        }
                    }, 500); // 延迟确保评论已加载
                }

            } catch (error) {
                console.error('加载章节错误:', error);
                showError('加载失败，请稍后重试');
            }
        }

// ========== 渲染章节 ==========
// 渲染章节
            function renderChapter(chapter) {
                // 调试：输出章节数据
                console.log('渲染章节详情:', chapter);
                console.log('AI 字段检查:', {
                    ai_generated: chapter.ai_generated,
                    aiGenerated: chapter.aiGenerated
                });
                console.log('插图字段:', chapter.image);
                
                // 设置标题，如果是 AI 生成则添加标记
                const titleElement = document.getElementById('chapterTitle');
                const aiGenerated = chapter.ai_generated || chapter.aiGenerated;
                
                console.log('AI 生成标记:', aiGenerated);
                
                let titleHTML = chapter.title;
                
                // 添加 AI 标记
                if (aiGenerated) {
                    titleHTML += ' <span class="ai-badge"><i class="fas fa-robot"></i> AI 创作</span>';
                }
                
                titleElement.innerHTML = titleHTML;
                
                document.getElementById('chapterAuthor').textContent = chapter.author?.username || '未知作者';
                document.getElementById('chapterDate').textContent = new Date(chapter.created_at).toLocaleDateString('zh-CN');
                document.getElementById('chapterWords').textContent = `${chapter.content?.length || 0}字`;
                
                // 渲染章节内容
                const chapterTextEl = document.getElementById('chapterText');
                const content = chapter.content || '暂无内容';
                
                // 正常显示章节内容
                if (chapter.image) {
                    // 有插图：在内容中间插入插图
                    const contentLength = content.length;
                    const insertPosition = Math.floor(contentLength / 2);
                    
                    // 找到插入位置附近的段落分隔符
                    let actualPosition = insertPosition;
                    for (let i = insertPosition; i < Math.min(insertPosition + 100, contentLength); i++) {
                        if (content[i] === '\n') {
                            actualPosition = i + 1;
                            break;
                        }
                    }
                    
                    // 插入插图
                    const beforeImage = content.substring(0, actualPosition);
                    const afterImage = content.substring(actualPosition);
                    
                    chapterTextEl.innerHTML = `
                        <div style="white-space: pre-wrap; text-indent: 2em;">${beforeImage}</div>
                        <div style="text-align: center; margin: 40px 0;">
                            <img src="${chapter.image}" 
                                 alt="章节插图" 
                                 style="max-width: 100%; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);" 
                                 onerror="this.style.display='none'">
                            <p style="color: #999; font-size: 14px; margin-top: 10px; text-indent: 0;">
                                <i class="fas fa-image"></i> AI 生成插图
                            </p>
                        </div>
                        <div style="white-space: pre-wrap; text-indent: 2em;">${afterImage}</div>
                    `;
                } else {
                    // 没有插图：直接显示文本
                    chapterTextEl.textContent = content;
                }

                // 更新页面标题
                document.title = `${chapter.title} - StoryTree`;

                // 检查是否是作者
                checkIfAuthor(chapter);
            }

// ========== 评分功能 ==========
        let currentUserRating = 0; // 当前用户的评分

        function initRating(chapter, userRating) {
            currentUserRating = userRating || 0;
            
            // 更新评分显示
            updateRatingDisplay(chapter.rating_avg || 0, chapter.rating_count || 0);
            
            // 高亮用户已评的星星
            const cancelBtn = document.getElementById('cancelRatingBtn');
            if (currentUserRating > 0) {
                highlightStars(currentUserRating);
                if (cancelBtn) cancelBtn.style.display = 'inline-block';
            } else {
                highlightStars(0);
                if (cancelBtn) cancelBtn.style.display = 'none';
            }

            // 星星点击事件（用 onclick 避免重复绑定）
            const stars = document.querySelectorAll('.rating-star');
            stars.forEach(star => {
                star.onclick = () => {
                    const score = parseInt(star.dataset.score);
                    rateChapter(score);
                };

                // 悬停效果
                star.onmouseenter = () => {
                    const score = parseInt(star.dataset.score);
                    stars.forEach(s => {
                        const sScore = parseInt(s.dataset.score);
                        s.classList.toggle('hover', sScore <= score);
                    });
                };

                star.onmouseleave = () => {
                    stars.forEach(s => s.classList.remove('hover'));
                };
            });

            // 取消评分按钮（用 onclick 避免重复绑定）
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    rateChapter(0);
                };
            }
        }

        function highlightStars(score) {
            const stars = document.querySelectorAll('.rating-star');
            stars.forEach(s => {
                const sScore = parseInt(s.dataset.score);
                s.classList.toggle('active', sScore <= score);
            });
        }

        function updateRatingDisplay(avg, count) {
            document.getElementById('ratingAvg').textContent = avg > 0 ? avg.toFixed(1) : '0.0';
            document.getElementById('ratingCount').textContent = count;
        }

        async function rateChapter(score) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录后再评分');
                return;
            }

            if (!currentChapter) return;

            try {
                const response = await fetch(`/api/nodes/${currentChapter.id}/rate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ score })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '评分失败');
                }

                const data = await response.json();
                
                if (score === 0) {
                    // 取消评分
                    currentUserRating = 0;
                    highlightStars(0);
                    document.getElementById('cancelRatingBtn').style.display = 'none';
                    showSuccess('已取消评分');
                } else {
                    // 评分成功
                    currentUserRating = score;
                    highlightStars(score);
                    document.getElementById('cancelRatingBtn').style.display = 'inline-block';
                    showSuccess(`评分成功：${score} 分`);
                }

                // 更新平均分显示
                updateRatingDisplay(data.rating_avg, data.rating_count);

            } catch (error) {
                console.error('评分失败:', error);
                showError(error.message || '评分失败，请稍后重试');
            }
        }
                    function escapeHtml(text) {
                        const div = document.createElement('div');
                        div.textContent = text;
                        return div.innerHTML;
                    }

                    // 发布草稿章节
                    async function publishDraft(chapterId) {
                        showConfirm('确定要发布这个草稿章节吗？<br><br>发布后，其他用户将可以看到这个章节。', async () => {
                        try {
                            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                            const publishBtn = document.getElementById('publishDraftBtn');
                            
                            // 禁用按钮并显示加载状态
                            publishBtn.disabled = true;
                            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发布中...';

                            const response = await fetch(`/api/nodes/${chapterId}/publish`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            if (!response.ok) {
                                const error = await response.json();
                                throw new Error(error.error || '发布失败');
                            }

                            const data = await response.json();
                            console.log('发布成功:', data);

                            // 更新当前章节状态
                            currentChapter.is_published = true;

                            // 显示成功消息
                            showSuccess(data.message || '章节发布成功！');

                            // 隐藏发布按钮
                            publishBtn.style.display = 'none';

                            // 刷新页面以显示最新状态
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);

                        } catch (error) {
                            console.error('发布失败:', error);
                            showError(error.message || '发布失败，请稍后重试');
                            
                            // 恢复按钮状态
                            const publishBtn = document.getElementById('publishDraftBtn');
                            publishBtn.disabled = false;
                            publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布草稿';
                        }
                        }, { title: '发布章节', confirmText: '确认发布', type: 'success' });
                    }

        // 检查是否是作者
        async function checkIfAuthor(chapter) {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    console.log('未登录，不显示编辑和创建分支按钮');
                    return;
                }

                // 获取当前用户信息
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    console.log('获取用户信息失败');
                    return;
                }

                const userData = await response.json();
                console.log('当前用户:', userData.user);
                console.log('章节作者ID:', chapter.author_id);

                // 获取用户在故事中的角色
                const roleResponse = await fetch(`/api/stories/${storyId}/role`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                let canCreateBranch = false;
                let roleData = null;
                if (roleResponse.ok) {
                    roleData = await roleResponse.json();
                    console.log('用户角色:', roleData);
                    
                    // 只有作者和有效协作者才能创建分支
                    if (roleData.is_author) {
                        canCreateBranch = true;
                        console.log('✅ 是作者，可以创建分支');
                    } else if (roleData.is_collaborator && roleData.allow_branch) {
                        canCreateBranch = true;
                        console.log('✅ 是协作者且允许续写，可以创建分支');
                    } else if (roleData.is_collaborator && !roleData.allow_branch) {
                        console.log('❌ 是协作者但不允许续写，不能创建分支');
                    } else {
                        console.log('❌ 不是作者也不是协作者，不能创建分支');
                    }
                }

                // 显示创建分支按钮（如果有权限）
                if (canCreateBranch) {
                    const createBranchBtn = document.getElementById('createBranchBtn');
                    
                    // 判断是否为叶子节点（无子分支）
                    const isLeafNode = !chapter.branches || chapter.branches.length === 0;
                    
                    if (isLeafNode) {
                        // 叶子节点：显示为"续写"
                        createBranchBtn.innerHTML = '<i class="fas fa-pen"></i>';
                        createBranchBtn.title = '续写';
                        console.log('✅ 叶子节点，按钮显示为"续写"');
                    } else {
                        // 中间节点：显示为"创建分支"
                        createBranchBtn.innerHTML = '<i class="fas fa-code-branch"></i>';
                        createBranchBtn.title = '创建分支';
                        console.log('✅ 中间节点，按钮显示为"创建分支"，子分支数:', chapter.branches.length);
                    }
                    
                    createBranchBtn.style.display = 'block';
                    
                    // 添加创建分支按钮的点击事件
                    createBranchBtn.onclick = () => {
                        window.location.href = `/write?storyId=${storyId}&parentId=${chapter.id}`;
                    };
                }

                // 比对用户ID，章节作者或故事主创可以编辑
                const isChapterAuthor = userData.user && userData.user.id === chapter.author_id;
                const isStoryCreator = roleData && roleData.is_author; // 故事主创
                if (isChapterAuthor || isStoryCreator) {
                    console.log('✅ 有编辑权限（章节作者或故事主创），显示编辑按钮');
                    document.getElementById('editChapterBtn').style.display = 'block';
                    
                    // 如果是草稿状态，显示发布按钮
                    if (!chapter.is_published) {
                        console.log('✅ 是草稿，显示发布按钮');
                        const publishBtn = document.getElementById('publishDraftBtn');
                        publishBtn.style.display = 'flex';
                        publishBtn.onclick = () => publishDraft(chapter.id);
                    }
                } else {
                    console.log('❌ 不是作者，不显示编辑按钮');
                }

            } catch (error) {
                console.error('检查作者权限错误:', error);
            }
        }

        // 跳转到write页面进行编辑
        function openEditModal() {
            if (!currentChapter) return;

            // 跳转到write页面，带上编辑参数
            // editMode=true 表示编辑模式
            // nodeId 表示要编辑的章节ID
            // storyId 表示所属故事ID
            window.location.href = `/write?storyId=${storyId}&nodeId=${currentChapter.id}&editMode=true`;
        }

        // 关闭编辑模态框
        function closeEditModal() {
            const modal = document.getElementById('editModal');
            modal.classList.remove('active');
        }

        // 保存编辑
        async function saveChapterEdit() {
            const titleInput = document.getElementById('editChapterTitle');
            const contentInput = document.getElementById('editChapterContent');
            const saveBtn = document.getElementById('saveEdit');

            const title = titleInput.value.trim();
            const content = contentInput.value.trim();

            // 验证
            if (!title) {
                showError('请输入章节标题');
                titleInput.focus();
                return;
            }

            if (!content) {
                showError('请输入章节内容');
                contentInput.focus();
                return;
            }

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = '保存中...';

                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${currentChapter.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title,
                        content
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '保存失败');
                }

                const data = await response.json();
                console.log('保存成功:', data);

                // 更新当前章节数据
                currentChapter.title = title;
                currentChapter.content = content;

                // 重新渲染章节
                renderChapter(currentChapter);

                // 关闭模态框
                closeEditModal();

                // 显示成功消息
                showSuccess('保存成功！');

            } catch (error) {
                console.error('保存失败:', error);
                showError(error.message || '保存失败，请稍后重试');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '保存修改';
            }
        }

        // 初始化编辑功能
        function initEditFeature() {
            const editBtn = document.getElementById('editChapterBtn');
            const closeBtn = document.getElementById('closeEditModal');
            const cancelBtn = document.getElementById('cancelEdit');
            const saveBtn = document.getElementById('saveEdit');
            const contentInput = document.getElementById('editChapterContent');
            const wordCount = document.getElementById('contentWordCount');
            const polishBtn = document.getElementById('polishContentBtn');

            // 编辑按钮点击
            editBtn?.addEventListener('click', openEditModal);

            // 关闭按钮
            closeBtn?.addEventListener('click', closeEditModal);
            cancelBtn?.addEventListener('click', closeEditModal);

            // 保存按钮
            saveBtn?.addEventListener('click', saveChapterEdit);

            // AI润色按钮
            polishBtn?.addEventListener('click', polishChapterContent);

            // 字数统计
            contentInput?.addEventListener('input', function() {
                wordCount.textContent = this.value.length;
            });

            // 点击模态框外部关闭
            document.getElementById('editModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeEditModal();
                }
            });

            // ESC键关闭
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    const modal = document.getElementById('editModal');
                    if (modal.classList.contains('active')) {
                        closeEditModal();
                    }
                }
            });
        }

        // 加载章节导航
        async function loadChapterNavigation(storyId, currentChapterId) {
            try {
                console.log('加载章节导航, storyId:', storyId);
                const response = await fetch(`/api/stories/${storyId}`);
                
                console.log('故事API响应状态:', response.status);
                
                if (!response.ok) {
                    console.error('加载故事失败:', response.status);
                    return;
                }

                const data = await response.json();
                console.log('故事API返回数据:', data);
                
                // API返回 {story: {...}, nodes: [...]}
                const chapters = data.nodes;
                const currentIndex = chapters.findIndex(c => c.id === parseInt(currentChapterId));

                // 上一章
                const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
                const prevBtns = [
                    document.getElementById('prevChapterBtn'),
                    document.getElementById('prevChapterBtnBottom')
                ];
                
                prevBtns.forEach(btn => {
                    if (prevChapter) {
                        btn.disabled = false;
                        btn.onclick = () => window.location.href = `/chapter?id=${prevChapter.id}`;
                    } else {
                        btn.disabled = true;
                    }
                });

                // 下一章
                const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
                const nextBtns = [
                    document.getElementById('nextChapterBtn'),
                    document.getElementById('nextChapterBtnBottom')
                ];
                
                nextBtns.forEach(btn => {
                    if (nextChapter) {
                        btn.disabled = false;
                        btn.onclick = () => window.location.href = `/chapter?id=${nextChapter.id}`;
                    } else {
                        btn.disabled = true;
                    }
                });

                // 返回按钮
                document.getElementById('backBtn').onclick = () => {
                    window.location.href = `/story?id=${storyId}`;
                };

            } catch (error) {
                console.error('加载导航错误:', error);
            }
        }

        // 全局变量：存储完整路径数据
        let fullBreadcrumbPath = null;
        let currentBreadcrumbStory = null;
        let hiddenNodesCount = 0; // 当前隐藏的节点数量

        // 加载面包屑导航
        async function loadBreadcrumbNav(nodeId) {
            try {
                console.log('加载面包屑导航, nodeId:', nodeId);
                const response = await fetch(`/api/stories/nodes/${nodeId}/path`);
                
                if (!response.ok) {
                    console.error('加载路径失败:', response.status);
                    return;
                }

                const data = await response.json();
                console.log('面包屑路径数据:', data);
                
                // 保存完整路径数据
                fullBreadcrumbPath = data.path;
                currentBreadcrumbStory = data.story;
                hiddenNodesCount = 0; // 重置展开状态
                
                // 渲染面包屑
                renderBreadcrumb();

            } catch (error) {
                console.error('加载面包屑导航错误:', error);
            }
        }

        // 渲染面包屑导航
        function renderBreadcrumb() {
            const breadcrumbContainer = document.getElementById('breadcrumbContainer');
            const breadcrumbNav = document.getElementById('breadcrumbNav');
            
            if (!breadcrumbContainer || !fullBreadcrumbPath || fullBreadcrumbPath.length === 0) {
                return;
            }

            let breadcrumbHTML = '';
            const pathLength = fullBreadcrumbPath.length;
            
            // 添加故事标题
            if (currentBreadcrumbStory) {
                breadcrumbHTML += `
                    <a href="/story?id=${currentBreadcrumbStory.id}" class="breadcrumb-item">
                        <i class="fas fa-book"></i>
                        <span>${currentBreadcrumbStory.title}</span>
                    </a>
                `;
            }
            
            // 如果路径很短（≤4个节点），直接显示全部
            if (pathLength <= 4) {
                fullBreadcrumbPath.forEach((node, index) => {
                    if (index > 0 || currentBreadcrumbStory) {
                        breadcrumbHTML += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
                    }
                    
                    if (index === pathLength - 1) {
                        breadcrumbHTML += `
                            <span class="breadcrumb-item current">
                                <i class="fas fa-file-alt"></i>
                                <span>${node.title}</span>
                            </span>
                        `;
                    } else {
                        breadcrumbHTML += `
                            <a href="/chapter?id=${node.id}" class="breadcrumb-item">
                                <i class="fas fa-file-alt"></i>
                                <span>${node.title}</span>
                            </a>
                        `;
                    }
                });
            } else {
                // 路径较长，需要折叠
                // 首部：始终显示第1个节点
                // 中间：省略号 + 已展开的节点
                // 尾部：始终显示最近3个节点 + 当前节点
                
                const tailVisibleCount = 3; // 尾部始终显示3个节点
                const tailStartIndex = pathLength - tailVisibleCount; // 尾部开始的索引
                
                // 1. 显示首部：第1个节点
                if (currentBreadcrumbStory) {
                    breadcrumbHTML += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
                }
                breadcrumbHTML += `
                    <a href="/chapter?id=${fullBreadcrumbPath[0].id}" class="breadcrumb-item">
                        <i class="fas fa-file-alt"></i>
                        <span>${fullBreadcrumbPath[0].title}</span>
                    </a>
                `;
                
                // 2. 中间部分：计算隐藏的节点数量
                // 总的可隐藏节点 = 路径长度 - 1(首部) - tailVisibleCount(尾部)
                const totalHiddenNodes = pathLength - 1 - tailVisibleCount;
                
                // 当前实际隐藏的节点数 = 总隐藏节点 - 已展开的节点数
                const actualHiddenCount = totalHiddenNodes - hiddenNodesCount;
                
                if (actualHiddenCount > 0) {
                    // 还有隐藏的节点，显示省略号
                    breadcrumbHTML += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
                    breadcrumbHTML += `
                        <span class="breadcrumb-ellipsis" onclick="expandBreadcrumb()" title="点击展开更多章节（还有${actualHiddenCount}个隐藏）">
                            <i class="fas fa-ellipsis-h"></i>
                        </span>
                    `;
                }
                
                // 显示已展开的节点（从后往前数）
                const expandedStartIndex = tailStartIndex - hiddenNodesCount;
                for (let i = expandedStartIndex; i < tailStartIndex; i++) {
                    if (i > 0) { // 跳过第0个（已在首部显示）
                        const node = fullBreadcrumbPath[i];
                        breadcrumbHTML += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
                        breadcrumbHTML += `
                            <a href="/chapter?id=${node.id}" class="breadcrumb-item">
                                <i class="fas fa-file-alt"></i>
                                <span>${node.title}</span>
                            </a>
                        `;
                    }
                }
                
                // 3. 显示尾部：最近3个节点 + 当前节点
                for (let i = tailStartIndex; i < pathLength; i++) {
                    const node = fullBreadcrumbPath[i];
                    breadcrumbHTML += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
                    
                    // 最后一个节点（当前章节）不可点击
                    if (i === pathLength - 1) {
                        breadcrumbHTML += `
                            <span class="breadcrumb-item current">
                                <i class="fas fa-file-alt"></i>
                                <span>${node.title}</span>
                            </span>
                        `;
                    } else {
                        breadcrumbHTML += `
                            <a href="/chapter?id=${node.id}" class="breadcrumb-item">
                                <i class="fas fa-file-alt"></i>
                                <span>${node.title}</span>
                            </a>
                        `;
                    }
                }
            }
            
            breadcrumbContainer.innerHTML = breadcrumbHTML;
            breadcrumbNav.style.display = 'block';
            
            // 动态更新工具栏位置，确保紧贴面包屑栏下方
            updateToolbarPosition();
            
            console.log('面包屑导航渲染完成, 已展开节点数:', hiddenNodesCount);
        }

        // 动态更新工具栏位置
        function updateToolbarPosition() {
            // 使用 requestAnimationFrame 确保在DOM更新后计算
            requestAnimationFrame(() => {
                const breadcrumbNav = document.getElementById('breadcrumbNav');
                const toolbar = document.querySelector('.reading-toolbar');
                
                if (breadcrumbNav && toolbar) {
                    // 获取面包屑栏的实际高度
                    const breadcrumbHeight = breadcrumbNav.offsetHeight;
                    
                    // 设置工具栏位置 = 面包屑栏的高度
                    toolbar.style.top = breadcrumbHeight + 'px';
                    
                    console.log('工具栏位置已更新, 面包屑高度:', breadcrumbHeight);
                }
            });
        }

        // 展开面包屑（每次从后往前展开3个节点）
        function expandBreadcrumb() {
            const expandStep = 3; // 每次展开3个节点
            const tailVisibleCount = 3;
            const totalHiddenNodes = fullBreadcrumbPath.length - 1 - tailVisibleCount;
            
            // 增加已展开的节点数，但不超过总隐藏节点数
            hiddenNodesCount = Math.min(hiddenNodesCount + expandStep, totalHiddenNodes);
            
            // 重新渲染面包屑（会自动更新工具栏位置）
            renderBreadcrumb();
            console.log('展开面包屑，已展开节点数:', hiddenNodesCount);
        }

        // 初始化设置
        function initSettings() {
            const settingsBtn = document.getElementById('settingsBtn');
            const settingsPanel = document.getElementById('settingsPanel');

            settingsBtn?.addEventListener('click', () => {
                settingsPanel.classList.toggle('active');
            });

            // 点击外部关闭设置面板
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.settings-panel') && !e.target.closest('#settingsBtn')) {
                    settingsPanel.classList.remove('active');
                }
            });

            // 字体大小控制
            document.querySelectorAll('.font-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    const fontSize = this.dataset.size;
                    const chapterText = document.querySelector('.chapter-content');
                    if (chapterText) {
                        chapterText.style.fontSize = fontSize + 'px';
                    }
                    localStorage.setItem('chapter_font_size', fontSize);
                });
            });

            // 恢复字体大小偏好
            const savedFontSize = localStorage.getItem('chapter_font_size');
            if (savedFontSize) {
                const btn = document.querySelector(`.font-btn[data-size="${savedFontSize}"]`);
                if (btn) btn.click();
            }

            // 恢复主题偏好
            const savedTheme = localStorage.getItem('chapter_theme') || 'light';
            if (savedTheme !== 'light') switchTheme(savedTheme, false);
        }

        // 切换阅读主题
        function switchTheme(theme, save = true) {
            // 移除旧主题
            document.body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
            if (theme !== 'light') document.body.classList.add(`theme-${theme}`);

            // 更新按钮状态
            document.querySelectorAll('.theme-btn').forEach(btn => {
                const isActive = btn.dataset.theme === theme;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive);
            });

            if (save) localStorage.setItem('chapter_theme', theme);
        }

        // ===== 评论排序 =====
        let currentCommentSort = 'new';

        function switchCommentSort(sort) {
            if (sort === currentCommentSort) return;
            currentCommentSort = sort;

            // 更新按钮状态
            document.querySelectorAll('.sort-btn').forEach(btn => {
                const isActive = btn.dataset.sort === sort;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', String(isActive));
            });

            if (!commentSystem || !commentSystem.comments) return;

            // 将置顶评论与普通评论分离，置顶评论不参与排序，始终置顶
            const pinnedComments = commentSystem.comments.filter(c => c.pinned);
            const normalComments = commentSystem.comments.filter(c => !c.pinned);

            if (normalComments.length < 2 && pinnedComments.length === 0) return;

            // 只对普通评论排序
            if (sort === 'hot') {
                normalComments.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
            } else {
                // 最新在前
                normalComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }

            // 置顶评论在最上方，排序后的普通评论跟随其后
            const sortedComments = [...pinnedComments, ...normalComments];

            const container = document.getElementById('comments-list');
            if (container) {
                container.innerHTML = sortedComments
                    .map(c => commentSystem.renderComment(c))
                    .join('');
            }
        }

        // ============================================
        // 阅读进度条
        // ============================================
        function initReadingProgress() {
            const fill = document.getElementById('readingProgressFill');
            const wrapper = document.getElementById('readingProgressWrapper');
            if (!fill) return;

            function updateProgress() {
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight <= 0) {
                    fill.style.width = '100%';
                    return;
                }
                const pct = Math.min(100, Math.round((scrollTop / docHeight) * 100));
                fill.style.width = pct + '%';
                wrapper.setAttribute('aria-valuenow', pct);
            }

            window.addEventListener('scroll', updateProgress, { passive: true });
            updateProgress();
        }

        // ============================================
        // 目录侧边栏
        // ============================================
        let tocLoaded = false;

        function toggleToc() {
            const sidebar = document.getElementById('tocSidebar');
            if (sidebar.classList.contains('open')) {
                closeToc();
            } else {
                openToc();
            }
        }

        function openToc() {
            const sidebar = document.getElementById('tocSidebar');
            sidebar.classList.add('open');
            sidebar.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

            if (!tocLoaded) {
                loadToc();
            }
        }

        function closeToc() {
            const sidebar = document.getElementById('tocSidebar');
            sidebar.classList.remove('open');
            sidebar.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        async function loadToc() {
            if (!currentChapter) return;

            const nav = document.getElementById('tocNav');
            const titleEl = document.getElementById('tocStoryTitle');
            const metaEl = document.getElementById('tocStoryMeta');

            nav.innerHTML = '<div class="toc-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

            try {
                // 使用 path 接口：返回从根章节到当前章节的祖先链
                const response = await fetch(`/api/stories/nodes/${currentChapter.id}/path`);
                if (!response.ok) throw new Error('加载章节路径失败');
                const data = await response.json();

                // 更新故事标题
                titleEl.textContent = data.story?.title || '未知故事';
                metaEl.textContent = `当前分支共 ${data.path?.length || 0} 章`;

                const path = data.path || [];

                if (path.length === 0) {
                    nav.innerHTML = '<div class="toc-loading">暂无章节</div>';
                    return;
                }

                const currentId = currentChapter.id;

                nav.innerHTML = path.map((node, idx) => {
                    const isCurrent = node.id === currentId;
                    return `
                        <a class="toc-item ${isCurrent ? 'toc-item-current' : ''}"
                           href="/chapter.html?id=${node.id}"
                           onclick="closeToc()"
                           title="${escapeHtml(node.title)}">
                            <span class="toc-item-index">${idx + 1}</span>
                            <span class="toc-item-title">${escapeHtml(node.title)}</span>
                        </a>
                    `;
                }).join('');

                // 滚动到当前章节
                const currentItem = nav.querySelector('.toc-item-current');
                if (currentItem) {
                    setTimeout(() => currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
                }

                tocLoaded = true;
            } catch (err) {
                console.error('目录加载失败:', err);
                nav.innerHTML = `<div class="toc-loading">加载失败：${err.message}</div>`;
            }
        }

        // ESC 键关闭目录
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeToc();
            }
        });

        // 初始化举报功能
        function initReportFeature() {
            const reportBtn = document.getElementById('reportBtn');
            const closeBtn = document.getElementById('closeReportModal');
            const cancelBtn = document.getElementById('cancelReport');
            const submitBtn = document.getElementById('submitReport');
            const reportDescription = document.getElementById('reportDescription');
            const reportCharCount = document.getElementById('reportCharCount');

            // 举报按钮点击
            reportBtn?.addEventListener('click', openReportModal);

            // 关闭按钮
            closeBtn?.addEventListener('click', closeReportModal);
            cancelBtn?.addEventListener('click', closeReportModal);

            // 提交按钮
            submitBtn?.addEventListener('click', submitReport);

            // 字数统计
            reportDescription?.addEventListener('input', function() {
                reportCharCount.textContent = this.value.length;
            });

            // 点击模态框外部关闭
            document.getElementById('reportModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeReportModal();
                }
            });
        }

        // 打开举报模态框
        function openReportModal() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            if (!token) {
                showError('请先登录');
                setTimeout(() => {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
                }, 1500);
                return;
            }

            const modal = document.getElementById('reportModal');
            const form = document.getElementById('reportForm');
            
            // 重置表单
            form.reset();
            document.getElementById('reportCharCount').textContent = '0';
            
            // 显示模态框
            modal.classList.add('active');
        }

        // 关闭举报模态框
        function closeReportModal() {
            const modal = document.getElementById('reportModal');
            modal.classList.remove('active');
        }

        // 提交举报
        async function submitReport() {
            const reasonSelect = document.getElementById('reportReason');
            const descriptionTextarea = document.getElementById('reportDescription');
            const submitBtn = document.getElementById('submitReport');

            const reason = reasonSelect.value;
            const description = descriptionTextarea.value.trim();

            // 验证
            if (!reason) {
                showError('请选择举报原因');
                reasonSelect.focus();
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = '提交中...';

                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${currentChapter.id}/report`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        reason,
                        description
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '举报失败');
                }

                const data = await response.json();
                console.log('举报成功:', data);

                // 关闭模态框
                closeReportModal();

                // 显示成功消息
                showSuccess('举报成功！感谢您为社区环境做出贡献');

            } catch (error) {
                console.error('举报失败:', error);
                showError(error.message || '举报失败，请稍后重试');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '提交举报';
            }
        }

        // 保存阅读进度
        function saveReadingProgress(chapterId) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            // 保存到本地存储
            const progress = {
                storyId: storyId,
                chapterId: chapterId,
                timestamp: Date.now()
            };
            localStorage.setItem(`reading_progress_${storyId}`, JSON.stringify(progress));

            // TODO: 同步到服务器
        }

        // ============================================
        // 收藏章节功能
        // ============================================
        
        // 切换收藏状态（收藏/取消收藏章节）
        async function toggleBookmark() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            if (!token) {
                showError('请先登录');
                setTimeout(() => {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
                }, 1500);
                return;
            }

            if (!currentChapter) {
                showError('章节信息加载中，请稍后重试');
                return;
            }

            const bookmarkBtn = document.getElementById('bookmarkBtn');
            const icon = bookmarkBtn.querySelector('i');
            
            try {
                // 禁用按钮，防止重复点击
                bookmarkBtn.disabled = true;

                // 调用收藏章节API
                const response = await fetch(`/api/bookmarks/node/${currentChapter.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '操作失败');
                }

                const data = await response.json();
                console.log('收藏操作结果:', data);

                // 更新按钮状态
                if (data.bookmarked) {
                    // 已收藏
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    showSuccess(data.message || '收藏成功！');
                } else {
                    // 已取消收藏
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    showSuccess(data.message || '已取消收藏');
                }

            } catch (error) {
                console.error('收藏操作错误:', error);
                showError(error.message || '操作失败，请稍后重试');
            } finally {
                // 恢复按钮状态
                bookmarkBtn.disabled = false;
            }
        }

        // 显示错误消息
        function showError(message) {
            showMessage(message, 'error');
        }

        // 显示成功消息
        function showSuccess(message) {
            showMessage(message, 'success');
        }

        // 显示消息
        function showMessage(message, type = 'info') {
            const messageEl = document.createElement('div');
            messageEl.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: white;
                padding: 15px 25px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 10000;
                border-left: 4px solid ${type === 'error' ? '#f44336' : '#4caf50'};
                animation: slideIn 0.3s ease-out;
            `;

            messageEl.innerHTML = `
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
                <span>${message}</span>
            `;

            document.body.appendChild(messageEl);

            setTimeout(() => {
                messageEl.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => messageEl.remove(), 300);
            }, 3000);
        }

        // AI润色章节内容
        async function polishChapterContent() {
            const contentTextarea = document.getElementById('editChapterContent');
            const styleSelect = document.getElementById('polishStyleSelect');
            const polishBtn = document.getElementById('polishContentBtn');

            const content = contentTextarea.value.trim();
            const style = styleSelect.value;

            // 验证
            if (!content) {
                showError('请先输入章节内容');
                return;
            }

            if (content.length < 10) {
                showError('内容太短（至少10字），无法润色');
                return;
            }

            if (content.length > 5000) {
                showError('内容过长（超过5000字），请分段润色');
                return;
            }

            try {
                // 禁用按钮，显示加载状态
                polishBtn.disabled = true;
                polishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 润色中...';

                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                console.log('调用AI润色API，风格:', style);
                const response = await fetch('/api/ai/v2/polish', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: content,
                        style: style
                    })
                });

                console.log('润色API响应状态:', response.status);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API错误 (${response.status})`);
                }

                const data = await response.json();
                console.log('润色API返回数据:', data);

                if (data.polished) {
                    // 显示确认弹窗
                    showConfirm(
                        `润色完成！<br><br>原文字数：${content.length} 字<br>润色后字数：${data.polished.length} 字<br><br>是否应用润色结果？`,
                        () => {
                            contentTextarea.value = data.polished;
                            document.getElementById('contentWordCount').textContent = data.polished.length;
                            showSuccess('润色已应用！');
                        },
                        { title: '润色完成', confirmText: '应用润色', cancelText: '保留原文', type: 'success' }
                    );
                } else {
                    throw new Error('AI未返回润色结果');
                }

            } catch (error) {
                console.error('AI润色错误:', error);
                
                let errorMessage = error.message || 'AI服务暂时不可用';
                
                if (error.message.includes('登录') || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用AI润色功能';
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足，请充值或升级会员';
                } else if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                }
                
                showError(errorMessage);
            } finally {
                // 恢复按钮状态
                polishBtn.disabled = false;
                polishBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> AI润色';
            }
        }

        // ============================================
        // 分支对比功能
        // ============================================

        // 初始化分支对比功能
        function initBranchCompare() {
            const compareBtn = document.getElementById('compareBranchesBtn');
            const closeBtn = document.getElementById('closeCompareModal');
            const branchSelect = document.getElementById('branchSelect');

            // 对比按钮点击
            compareBtn?.addEventListener('click', openCompareModal);

            // 关闭按钮
            closeBtn?.addEventListener('click', closeCompareModal);

            // 分支选择变化
            branchSelect?.addEventListener('change', function() {
                selectedSiblingId = parseInt(this.value);
                if (selectedSiblingId) {
                    loadCompareBranch(selectedSiblingId);
                }
            });

            // 点击模态框外部关闭
            document.getElementById('compareModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeCompareModal();
                }
            });
        }

        // 打开对比模态框
        async function openCompareModal() {
            const modal = document.getElementById('compareModal');
            const loading = document.getElementById('compareLoading');
            const noSiblingsMessage = document.getElementById('noSiblingsMessage');
            const selectorContainer = document.getElementById('branchSelectorContainer');
            const compareGrid = document.getElementById('compareGrid');

            // 重置显示状态
            loading.style.display = 'block';
            noSiblingsMessage.style.display = 'none';
            selectorContainer.style.display = 'none';
            compareGrid.style.display = 'none';

            // 显示模态框
            modal.classList.add('active');

            try {
                // 获取同级分支
                const response = await fetch(`/api/nodes/${currentChapter.id}/siblings`);
                if (!response.ok) {
                    throw new Error('获取同级分支失败');
                }

                const data = await response.json();
                siblings = data.siblings || [];

                console.log('同级分支:', siblings);

                loading.style.display = 'none';

                if (siblings.length === 0) {
                    // 没有同级分支
                    noSiblingsMessage.style.display = 'block';
                } else {
                    // 有同级分支，显示选择器
                    selectorContainer.style.display = 'block';
                    compareGrid.style.display = 'grid';
                    
                    // 填充分支选择器
                    const branchSelect = document.getElementById('branchSelect');
                    branchSelect.innerHTML = '<option value="">请选择要对比的分支...</option>';
                    
                    siblings.forEach(sibling => {
                        const option = document.createElement('option');
                        option.value = sibling.id;
                        option.textContent = `${sibling.title} - ${sibling.author.username}`;
                        branchSelect.appendChild(option);
                    });

                    // 显示当前分支信息
                    displayCurrentBranch();
                }

            } catch (error) {
                console.error('加载同级分支错误:', error);
                loading.style.display = 'none';
                noSiblingsMessage.style.display = 'block';
                document.querySelector('.no-siblings-message h3').textContent = '加载失败';
                document.querySelector('.no-siblings-message p').textContent = error.message;
            }
        }

        // 关闭对比模态框
        function closeCompareModal() {
            const modal = document.getElementById('compareModal');
            modal.classList.remove('active');
            selectedSiblingId = null;
        }

        // 显示当前分支信息
        function displayCurrentBranch() {
            document.getElementById('currentBranchTitle').textContent = currentChapter.title;
            document.getElementById('currentBranchMeta').innerHTML = `
                <span><i class="fas fa-user"></i> ${currentChapter.author?.username || '未知'}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(currentChapter.created_at).toLocaleDateString('zh-CN')}</span>
            `;
            document.getElementById('currentBranchContent').textContent = currentChapter.content || '暂无内容';
            document.getElementById('currentReadCount').textContent = currentChapter.read_count || 0;
            document.getElementById('currentRating').textContent = (currentChapter.rating_avg || 0).toFixed(1);
            document.getElementById('currentComments').textContent = currentChapter.comment_count || 0;
        }

        // 加载对比分支
        async function loadCompareBranch(siblingId) {
            const compareGrid = document.getElementById('compareGrid');

            try {
                // 显示加载状态
                compareGrid.style.opacity = '0.5';
                
                // 获取分支详情
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${siblingId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (!response.ok) {
                    throw new Error('获取分支详情失败');
                }

                const data = await response.json();
                const branch = data.node;

                console.log('对比分支:', branch);

                // 显示对比分支信息
                document.getElementById('compareBranchTitle').textContent = branch.title;
                document.getElementById('compareBranchMeta').innerHTML = `
                    <span><i class="fas fa-user"></i> ${branch.author?.username || '未知'}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(branch.created_at).toLocaleDateString('zh-CN')}</span>
                `;
                document.getElementById('compareBranchContent').textContent = branch.content || '暂无内容';
                document.getElementById('compareReadCount').textContent = branch.read_count || 0;
                document.getElementById('compareRating').textContent = (branch.rating_avg || 0).toFixed(1);
                document.getElementById('compareComments').textContent = branch.comment_count || 0;

                compareGrid.style.opacity = '1';

            } catch (error) {
                console.error('加载对比分支错误:', error);
                showError(error.message);
                compareGrid.style.opacity = '1';
            }
        }

        // 检查是否显示对比按钮
        async function checkShowCompareButton() {
            // 只有当章节有父节点时才可能有同级分支
            if (!currentChapter.parent_id) {
                return;
            }

            try {
                // 快速检查是否有同级分支
                const response = await fetch(`/api/nodes/${currentChapter.id}/siblings`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.siblings && data.siblings.length > 0) {
                        // 有同级分支，显示对比按钮
                        document.getElementById('compareBranchesBtn').style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('检查同级分支错误:', error);
            }
        }

        // ============================================
        // AI分支推荐功能
        // ============================================

        // 初始化AI推荐功能
        function initAIRecommend() {
            const recommendBtn = document.getElementById('aiRecommendBtn');
            const closeBtn = document.getElementById('closeRecommendModal');

            // 推荐按钮点击
            recommendBtn?.addEventListener('click', openRecommendModal);

            // 关闭按钮
            closeBtn?.addEventListener('click', closeRecommendModal);

            // 点击模态框外部关闭
            document.getElementById('recommendModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeRecommendModal();
                }
            });
        }

        // 打开AI推荐模态框
        async function openRecommendModal() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            if (!token) {
                showError('请先登录');
                setTimeout(() => {
                    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.href);
                }, 1500);
                return;
            }

            const modal = document.getElementById('recommendModal');
            const loading = document.getElementById('recommendLoading');
            const noRecommendMessage = document.getElementById('noRecommendMessage');
            const recommendResult = document.getElementById('recommendResult');

            // 重置显示状态
            loading.style.display = 'block';
            noRecommendMessage.style.display = 'none';
            recommendResult.style.display = 'none';

            // 显示模态框
            modal.classList.add('active');

            try {
                // 调用AI推荐API
                const response = await fetch('/api/ai/v2/recommend-branch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nodeId: currentChapter.id
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'AI推荐失败');
                }

                const data = await response.json();
                console.log('AI推荐结果:', data);

                loading.style.display = 'none';

                if (!data.recommended) {
                    // 没有分支
                    noRecommendMessage.style.display = 'block';
                } else {
                    // 显示推荐结果
                    recommendedBranch = data.recommended;
                    displayRecommendResult(data);
                }

            } catch (error) {
                console.error('AI推荐错误:', error);
                loading.style.display = 'none';
                noRecommendMessage.style.display = 'block';
                document.querySelector('#noRecommendMessage h3').textContent = '推荐失败';
                document.querySelector('#noRecommendMessage p').textContent = error.message;
            }
        }

        // 关闭AI推荐模态框
        function closeRecommendModal() {
            const modal = document.getElementById('recommendModal');
            modal.classList.remove('active');
            recommendedBranch = null;
        }

        // 显示推荐结果
        function displayRecommendResult(data) {
            const recommendResult = document.getElementById('recommendResult');
            const recommended = data.recommended;
            const alternatives = data.alternatives || [];

            // 显示推荐理由
            document.getElementById('recommendReason').textContent = data.reason;

            // 显示推荐分支信息
            document.getElementById('recommendTitle').textContent = recommended.title;
            document.getElementById('recommendAuthor').textContent = recommended.author.username;
            document.getElementById('recommendReadCount').textContent = recommended.readCount;
            document.getElementById('recommendRating').textContent = (recommended.rating || 0).toFixed(1);
            document.getElementById('recommendComments').textContent = recommended.commentCount;

            // AI标记
            if (recommended.aiGenerated) {
                document.getElementById('recommendAIBadge').style.display = 'inline-block';
            } else {
                document.getElementById('recommendAIBadge').style.display = 'none';
            }

            // 跳转按钮
            document.getElementById('goToRecommendBtn').onclick = () => {
                window.location.href = `/chapter?id=${recommended.id}`;
            };

            // 显示备选分支
            if (alternatives.length > 0) {
                const alternativesContainer = document.getElementById('alternativesContainer');
                const alternativesList = document.getElementById('alternativesList');
                
                alternativesList.innerHTML = alternatives.map(alt => `
                    <div style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s;"
                         onmouseover="this.style.boxShadow='0 5px 15px rgba(0,0,0,0.1)'"
                         onmouseout="this.style.boxShadow='none'"
                         onclick="window.location.href='/chapter?id=${alt.id}'">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #333;">${alt.title}</h4>
                            ${alt.aiGenerated ? '<span style="background: var(--st-primary-700); color: white; padding: 2px 8px; border-radius: 8px; font-size: 11px;"><i class="fas fa-robot"></i> AI</span>' : ''}
                        </div>
                        <div style="color: #999; font-size: 13px; margin-bottom: 10px;">
                            <i class="fas fa-user"></i> ${alt.author.username}
                        </div>
                        <div style="display: flex; gap: 15px; font-size: 13px; color: #666;">
                            <span><i class="fas fa-eye"></i> ${alt.readCount}</span>
                            <span><i class="fas fa-star" style="color: #ffc107;"></i> ${(alt.rating || 0).toFixed(1)}</span>
                            <span><i class="fas fa-comment"></i> ${alt.commentCount}</span>
                        </div>
                    </div>
                `).join('');

                alternativesContainer.style.display = 'block';
            }

            recommendResult.style.display = 'block';
        }

        // 检查是否显示AI推荐按钮
        async function checkShowRecommendButton() {
            try {
                // 检查是否有子分支（使用已有的branches数据或重新获取）
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(`/api/nodes/${currentChapter.id}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (response.ok) {
                    const data = await response.json();
                    // 只有当子分支数量大于1时才显示AI推荐按钮（避免只有一个分支时的歧义）
                    if (data.branches && data.branches.length > 1) {
                        // 有多个子分支，显示AI推荐按钮
                        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                        if (token) {
                            document.getElementById('aiRecommendBtn').style.display = 'block';
                            console.log('✅ 显示AI推荐按钮，子分支数:', data.branches.length);
                        } else {
                            console.log('❌ 未登录，不显示AI推荐按钮');
                        }
                    } else if (data.branches && data.branches.length === 1) {
                        console.log('❌ 只有一个子分支，不显示AI推荐按钮（避免歧义）');
                    } else {
                        console.log('❌ 没有子分支，不显示AI推荐按钮');
                    }
                }
            } catch (error) {
                console.error('检查子分支错误:', error);
            }
        }
