        let quill;
        let storyId;
        let story;
        
        // 编辑模式相关变量
        let isEditMode = false;
        let editNodeId = null;
        let editNodeData = null;

        // 页面初始化
        document.addEventListener('DOMContentLoaded', function() {
            console.log('页面加载完成');
            checkAuthStatus();
            
            // 初始化 WebSocket 连接
            StoryTreeWS.connect();
            
            // 等待Quill.js加载完成
            if (typeof Quill === 'undefined') {
                console.error('Quill.js未加载');
                showError('编辑器加载失败，请刷新页面重试');
                return;
            }
            
            // 检查是否为编辑模式
            checkEditMode();
            
            initEditor();
            initSidebar();
            loadStoryInfo();
            
            // 延迟初始化AI功能，确保DOM完全加载
            setTimeout(() => {
                initAiFeature();
            }, 100);

            // 检测从创建页跳转来的情况，弹出下一步提示
            checkFromCreateToast();
        });
        
        // 检查编辑模式
        function checkEditMode() {
            const urlParams = new URLSearchParams(window.location.search);
            const editMode = urlParams.get('editMode');
            const nodeId = urlParams.get('nodeId');
            
            if (editMode === 'true' && nodeId) {
                isEditMode = true;
                editNodeId = parseInt(nodeId);
                console.log('✅ 编辑模式已启用，章节ID:', editNodeId);
                
                // 更新页面标题
                document.title = '编辑章节 - StoryTree';
            } else {
                console.log('📝 创作模式');
            }
        }

        // 检测从创建页跳转过来，弹出下一步提示
        function checkFromCreateToast() {
            const urlParams = new URLSearchParams(window.location.search);
            const from = urlParams.get('from');
            if (from !== 'create') return;

            // 清理 URL 中的 from 参数
            const url = new URL(window.location.href);
            url.searchParams.delete('from');
            window.history.replaceState({}, '', url.toString());

            // 延迟弹出提示，等待页面加载完成
            setTimeout(() => {
                const toast = document.createElement('div');
                toast.className = 'st-next-step-toast';
                toast.innerHTML = `
                    <div class="st-next-step-content">
                        <i class="fas fa-check-circle" style="color:#2d5d5a;font-size:18px;"></i>
                        <div class="st-next-step-text">
                            <strong>故事创建成功！</strong>
                            <span>撰写内容后点击"发布章节"完成最后一步</span>
                        </div>
                        <button class="st-next-step-close" aria-label="关闭">&times;</button>
                    </div>
                `;
                document.body.appendChild(toast);
                requestAnimationFrame(() => toast.classList.add('st-next-step-toast--visible'));

                toast.querySelector('.st-next-step-close').addEventListener('click', () => {
                    toast.classList.remove('st-next-step-toast--visible');
                    setTimeout(() => toast.remove(), 300);
                });

                // 8秒后自动消失
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.classList.remove('st-next-step-toast--visible');
                        setTimeout(() => toast.remove(), 300);
                    }
                }, 8000);
            }, 2000);
        }

        // 初始化编辑器
        function initEditor() {
            console.log('开始初始化编辑器...');
            
            try {
                // 注册自定义字号（class-based）
                var Size = Quill.import('formats/size');
                Size.whitelist = ['12px', '14px', '16px', false, '20px', '24px', '28px', '32px'];
                Quill.register(Size, true);

                quill = new Quill('#editor', {
                    theme: 'snow',
                    placeholder: '开始撰写你的故事...\n\n可以使用工具栏格式化文本，让你的故事更加精彩！',
                    modules: {
                        toolbar: [
                            [{ 'size': ['12px', '14px', '16px', false, '20px', '24px', '28px', '32px'] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'indent': '-1'}, { 'indent': '+1' }],
                            [{ 'align': [] }],
                            ['blockquote', 'code-block'],
                            [{ 'color': [] }, { 'background': [] }],
                            ['clean']
                        ]
                    }
                });

                console.log('编辑器初始化成功');

                // 监听内容变化，更新字数
                quill.on('text-change', function() {
                    updateWordCount();
                    hasUnsavedChanges = true;
                    
                    // 重置自动保存定时器
                    resetAutoSaveTimer();
                });
                
                // 聚焦编辑器
                setTimeout(() => {
                    quill.focus();
                }, 500);
                
                // 启动自动保存
                startAutoSave();
                
            } catch (error) {
                console.error('编辑器初始化失败:', error);
                showError('编辑器初始化失败');
            }
        }

        // ============================================
        // 自动保存功能
        // ============================================
        
        let autoSaveTimer = null;
        let autoSaveInterval = 2 * 60 * 1000; // 2分钟自动保存一次
        let lastAutoSaveTime = Date.now();
        
        // 启动自动保存
        function startAutoSave() {
            console.log('自动保存功能已启动，每2分钟自动保存一次');
            
            // 设置定时器
            autoSaveTimer = setInterval(() => {
                performAutoSave();
            }, autoSaveInterval);
        }
        
        // 重置自动保存定时器（用户有输入时调用）
        function resetAutoSaveTimer() {
            if (autoSaveTimer) {
                clearInterval(autoSaveTimer);
            }
            autoSaveTimer = setInterval(() => {
                performAutoSave();
            }, autoSaveInterval);
        }
        
        // 执行自动保存
        async function performAutoSave() {
            // 检查是否有未保存的更改
            if (!hasUnsavedChanges) {
                console.log('没有未保存的更改，跳过自动保存');
                return;
            }
            
            const title = document.getElementById('chapterTitle').value.trim();
            const textContent = quill.getText().trim();
            
            // 必须有标题和内容才自动保存
            if (!title || textContent.length === 0) {
                console.log('标题或内容为空，跳过自动保存');
                return;
            }
            
            // 距离上次保存至少30秒
            const now = Date.now();
            if (now - lastAutoSaveTime < 30000) {
                console.log('距离上次保存时间太短，跳过自动保存');
                return;
            }
            
            console.log('执行自动保存...');
            lastAutoSaveTime = now;
            
            try {
                const content = quill.root.innerHTML;
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    console.log('未登录，跳过自动保存');
                    return;
                }
                
                // 判断是第一章还是续写章节
                const isFirstChapter = !window.lastNodeId;
                
                let requestBody, apiUrl;
                
                if (isFirstChapter) {
                    apiUrl = '/api/nodes';
                    requestBody = {
                        storyId: parseInt(storyId),
                        title,
                        content: textContent,
                        parentId: null,
                        path: '1'
                    };
                } else {
                    apiUrl = `/api/nodes/${window.lastNodeId}/branches`;
                    requestBody = {
                        title,
                        content: textContent
                    };
                }
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(requestBody)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // 清除未保存标记
                    hasUnsavedChanges = false;
                    
                    // 保存节点ID
                    if (data.node && data.node.id) {
                        window.lastNodeId = data.node.id;
                    }
                    
                    // 显示自动保存成功提示（不太显眼）
                    showAutoSaveSuccess();
                    console.log('自动保存成功');
                } else {
                    console.error('自动保存失败:', response.status);
                }
            } catch (error) {
                console.error('自动保存错误:', error);
            }
        }
        
        // 显示自动保存成功提示
        function showAutoSaveSuccess() {
            if (window.toast) {
                // 使用 toast 显示轻量级提示（info 级别，不打扰用户）
                toast.info('已自动保存', { duration: 2000 });
            } else {
                // 降级：在字数统计旁边显示一个小提示
                const wordCountEl = document.querySelector('.word-count');
                if (!wordCountEl) return;
                const saveIndicator = document.createElement('span');
                saveIndicator.innerHTML = ' <i class="fas fa-check-circle" style="color: #4caf50; margin-left: 10px;"></i> 已自动保存';
                saveIndicator.style.cssText = 'font-size: 12px; color: #4caf50; animation: fadeIn 0.3s;';
                wordCountEl.appendChild(saveIndicator);
                setTimeout(() => {
                    saveIndicator.style.animation = 'fadeOut 0.3s';
                    setTimeout(() => saveIndicator.remove(), 300);
                }, 3000);
            }
        }
        
        // 页面卸载时清理定时器
        window.addEventListener('beforeunload', function() {
            if (autoSaveTimer) {
                clearInterval(autoSaveTimer);
            }
        });

        // 更新字数统计
        function updateWordCount() {
            const text = quill.getText().trim();
            const wordCount = text.length;
            document.getElementById('wordCount').textContent = wordCount;
        }

        // 加载故事信息
        async function loadStoryInfo() {
            const urlParams = new URLSearchParams(window.location.search);
            storyId = urlParams.get('storyId');
            const parentId = urlParams.get('parentId'); // 获取parentId参数

            console.log('开始加载故事信息, storyId:', storyId, 'parentId:', parentId, '编辑模式:', isEditMode);

            if (!storyId) {
                console.error('故事ID不存在');
                showError('故事ID不存在');
                setTimeout(() => {
                    window.location.href = '/create-ai.html';
                }, 2000);
                return;
            }

            // storyId 已获取，加载立项书和大纲
            loadProjectBrief();
            loadOutline();

            try {
                console.log('请求API: /api/stories/' + storyId);
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const response = await fetch(`/api/stories/${storyId}`, { headers });
                console.log('API响应状态:', response.status);
                
                if (!response.ok) {
                    throw new Error('加载故事失败');
                }

                const data = await response.json();
                console.log('API返回数据:', data);
                
                story = data.story || data;
                const nodes = data.nodes || [];
                
                // 判断当前用户是否是故事作者
                const currentUserStr = localStorage.getItem('user') || sessionStorage.getItem('user');
                if (currentUserStr && story) {
                    try {
                        const currentUser = JSON.parse(currentUserStr);
                        isStoryAuthor = String(currentUser.id) === String(story.author_id);
                    } catch(e) { /* 忽略解析错误 */ }
                }
                
                // 根据权限控制立项书编辑按钮的显示
                const editProjectBtn = document.getElementById('editProjectBtn');
                if (editProjectBtn) {
                    editProjectBtn.style.display = isStoryAuthor ? '' : 'none';
                }
                
                console.log('解析后的story:', story);
                console.log('故事的章节数:', nodes.length);
                
                if (story && story.title) {
                    document.getElementById('storyTitle').textContent = story.title;
                    
                    // 如果是编辑模式，加载章节数据
                    if (isEditMode && editNodeId) {
                        await loadEditChapter();
                    } else {
                        // 创作模式：根据章节数量更新提示文字
                        setupCreateMode(parentId, nodes);
                    }
                    
                    document.title = isEditMode 
                        ? `编辑 - ${story.title} - StoryTree` 
                        : `撰写 - ${story.title} - StoryTree`;
                    console.log('故事标题已更新:', story.title);
                } else {
                    console.error('故事数据不完整:', story);
                    showError('故事数据不完整');
                }

            } catch (error) {
                console.error('加载故事错误:', error);
                showError('加载故事信息失败: ' + error.message);
            }
        }
        
        // 设置创作模式
        function setupCreateMode(parentId, nodes) {
            let chapterHint = '撰写第一章';
            
            if (parentId) {
                // 如果URL中指定了parentId，使用它作为父节点
                window.lastNodeId = parseInt(parentId);
                const parentNode = nodes.find(n => n.id === parseInt(parentId));
                
                if (parentNode) {
                    chapterHint = `从「${parentNode.title}」创建分支`;
                    console.log('使用URL指定的父节点:', parentNode.title, 'ID:', parentNode.id);
                } else {
                    chapterHint = `创建新分支`;
                    console.log('使用URL指定的父节点ID:', parentId);
                }
            } else if (nodes.length > 0) {
                // 如果没有指定parentId，找到最后一章作为父节点
                const sortedNodes = nodes.sort((a, b) => {
                    const pathA = a.path.split('.').map(Number);
                    const pathB = b.path.split('.').map(Number);
                    for (let i = 0; i < Math.max(pathA.length, pathB.length); i++) {
                        const diff = (pathA[i] || 0) - (pathB[i] || 0);
                        if (diff !== 0) return diff;
                    }
                    return 0;
                });
                const lastNode = sortedNodes[sortedNodes.length - 1];
                
                // 保存最后一章的ID作为父节点
                window.lastNodeId = lastNode.id;
                
                // 计算下一章的章节号
                const nextChapterNum = nodes.length + 1;
                chapterHint = `续写第${nextChapterNum}章`;
                
                console.log('最后一章:', lastNode.title, 'ID:', lastNode.id);
                console.log('将作为父节点创建第', nextChapterNum, '章');
            }
            
            document.querySelector('.story-info div:last-child').textContent = chapterHint;
        }
        
        // 加载要编辑的章节数据
        async function loadEditChapter() {
            console.log('加载要编辑的章节, ID:', editNodeId);
            
            try {
                // 获取 token 用于访问被驳回/隐藏的章节（作者本人可以访问）
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                const response = await fetch(`/api/nodes/${editNodeId}`, { headers });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || '加载章节失败');
                }
                
                const data = await response.json();
                editNodeData = data.node;
                
                console.log('章节数据:', editNodeData);
                
                // 填充标题
                document.getElementById('chapterTitle').value = editNodeData.title || '';
                
                // 填充内容到编辑器
                if (editNodeData.content) {
                    // 将纯文本转换为HTML格式（如果需要）
                    const content = editNodeData.content;
                    
                    // 检查内容是否已经是HTML格式
                    if (content.includes('<') && content.includes('>')) {
                        // 已经是HTML，直接设置
                        quill.root.innerHTML = content;
                    } else {
                        // 纯文本，转换为HTML（保留换行）
                        const htmlContent = content
                            .split('\n')
                            .map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>')
                            .join('');
                        quill.root.innerHTML = htmlContent;
                    }
                }
                
                // 更新字数统计
                updateWordCount();
                
                // 更新提示文字
                document.querySelector('.story-info div:last-child').textContent = `编辑「${editNodeData.title}」`;
                
                // 更新按钮文字
                document.getElementById('saveDraftBtn').innerHTML = '<i class="fas fa-save"></i> 保存修改';
                
                // 重置未保存标记
                hasUnsavedChanges = false;
                
                console.log('✅ 章节数据加载完成');
                
            } catch (error) {
                console.error('加载章节失败:', error);
                showError('加载章节失败: ' + error.message);
            }
        }

        // 保存草稿
        document.getElementById('saveDraftBtn').addEventListener('click', async function() {
            await saveChapter(false); // false = 保存草稿，不跳转
        });

        // 发布章节
        document.getElementById('publishBtn').addEventListener('click', async function() {
            await saveChapter(true); // true = 发布并跳转
        });

        // 保存章节
        async function saveChapter(shouldPublishAndRedirect = false) {
            const title = document.getElementById('chapterTitle').value.trim();
            const content = quill.root.innerHTML;
            const textContent = quill.getText().trim();

            // 验证
            if (!title) {
                showError('请输入章节标题');
                return;
            }

            // 只有发布时才检查字数限制，保存草稿不限制
            if (shouldPublishAndRedirect && textContent.length < 50) {
                showError('发布章节内容至少需要50个字');
                return;
            }

            // 保存草稿时至少要有一些内容
            if (!shouldPublishAndRedirect && textContent.length === 0) {
                showError('请输入一些内容后再保存');
                return;
            }

            // 显示加载状态
            document.getElementById('loadingOverlay').classList.add('active');
            const publishBtn = document.getElementById('publishBtn');
            const saveDraftBtn = document.getElementById('saveDraftBtn');
            publishBtn.disabled = true;
            saveDraftBtn.disabled = true;

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                console.log('开始保存章节...');
                console.log('模式:', shouldPublishAndRedirect ? '发布并跳转' : '保存草稿');
                console.log('编辑模式:', isEditMode);
                console.log('Token:', token ? '存在' : '不存在');
                
                // 判断是编辑模式还是创作模式
                if (isEditMode && editNodeId) {
                    // 编辑模式：PUT /api/nodes/:id
                    await updateChapter(title, textContent, shouldPublishAndRedirect, token);
                } else {
                    // 创作模式：创建新章节
                    await createChapter(title, textContent, shouldPublishAndRedirect, token);
                }
                
            } catch (error) {
                console.error('保存章节错误:', error);
                showError(error.message || '保存失败，请重试');
                publishBtn.disabled = false;
                saveDraftBtn.disabled = false;
                document.getElementById('loadingOverlay').classList.remove('active');
            }
        }
        
        // 创建新章节（创作模式）
        async function createChapter(title, textContent, shouldPublishAndRedirect, token) {
            // 判断是第一章还是续写章节
            const isFirstChapter = !window.lastNodeId;
            
            let requestBody, apiUrl;
            
            if (isFirstChapter) {
                // 创建第一章：POST /api/nodes
                apiUrl = '/api/nodes';
                requestBody = {
                    storyId: parseInt(storyId),
                    title,
                    content: textContent,
                    parentId: null,
                    path: '1',
                    isPublished: shouldPublishAndRedirect  // 根据操作类型设置发布状态
                };
                console.log('创建第一章，请求数据:', requestBody);
            } else {
                // 续写章节：POST /api/nodes/:id/branches
                apiUrl = `/api/nodes/${window.lastNodeId}/branches`;
                requestBody = {
                    title,
                    content: textContent,
                    isPublished: shouldPublishAndRedirect  // 根据操作类型设置发布状态
                };
                console.log('续写章节，父节点ID:', window.lastNodeId);
                console.log('请求数据:', requestBody);
            }
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('API响应状态:', response.status);
            console.log('响应Content-Type:', response.headers.get('content-type'));

            // 检查响应是否为JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // 不是JSON响应，可能是HTML错误页面
                const text = await response.text();
                console.error('API返回非JSON响应:', text.substring(0, 200));
                
                if (response.status === 401) {
                    throw new Error('未登录或登录已过期，请重新登录');
                } else if (response.status === 403) {
                    throw new Error('没有权限执行此操作');
                } else if (response.status === 404) {
                    throw new Error('API接口不存在');
                } else {
                    throw new Error(`服务器错误 (${response.status})`);
                }
            }

            const data = await response.json();
            console.log('API返回数据:', data);

            if (response.ok) {
                const chapterNum = isFirstChapter ? '第一章' : '新章节';
                
                if (shouldPublishAndRedirect) {
                    // 发布模式：显示成功消息并跳转
                    showSuccess(`${chapterNum}发布成功！即将跳转...`);
                    
                    // 标记新手任务：发布第一个章节
                    try {
                      const progressStr = localStorage.getItem('st_onboarding_progress');
                      let progress = progressStr ? JSON.parse(progressStr) : {};
                      if (!progress.tasks) progress.tasks = {};
                      if (!progress.tasks.publishedChapter) {
                        progress.tasks.publishedChapter = true;
                        // 发布章节必然意味着已创建故事和了解概念
                        if (!progress.tasks.createdStory) progress.tasks.createdStory = true;
                        if (!progress.tasks.viewedStoryTree) progress.tasks.viewedStoryTree = true;
                        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
                        const tk = localStorage.getItem('token') || sessionStorage.getItem('token');
                        if (tk) {
                          fetch('/api/auth/onboarding-progress', {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ progress })
                          }).catch(() => {});
                        }
                        // 检查是否所有任务完成，标记待显示（跳转后在下一页展示）
                        if (window.onboardingManager && window.onboardingManager.allTasksCompleted(progress)) {
                          if (!localStorage.getItem('st_celebration_shown')) {
                            localStorage.setItem('st_celebration_pending', 'true');
                          }
                        }
                      }
                    } catch (e) { /* ignore */ }

                    // 清除未保存标记
                    hasUnsavedChanges = false;
                    
                    // 保存节点ID，以便下次续写
                    if (data.node && data.node.id) {
                        window.lastNodeId = data.node.id;
                    }
                    
                    // 跳转到新创建的章节页面
                    setTimeout(() => {
                        if (data.node && data.node.id) {
                            window.location.href = `/chapter.html?id=${data.node.id}`;
                        } else {
                            window.location.href = `/story.html?id=${storyId}`;
                        }
                    }, 1500);
                } else {
                    // 草稿模式：显示成功消息，留在当前页面
                    showSuccess(`${chapterNum}草稿保存成功！`);
                    
                    // 清除未保存标记
                    hasUnsavedChanges = false;
                    
                    // 保存节点ID，以便下次续写或发布
                    if (data.node && data.node.id) {
                        window.lastNodeId = data.node.id;
                        console.log('草稿已保存，节点ID:', data.node.id);
                    }
                    
                    // 重新启用按钮
                    document.getElementById('publishBtn').disabled = false;
                    document.getElementById('saveDraftBtn').disabled = false;
                    
                    // 移除加载状态
                    document.getElementById('loadingOverlay').classList.remove('active');
                }
            } else {
                throw new Error(data.error || '保存失败');
            }
        }
        
        // 更新章节（编辑模式）
        async function updateChapter(title, textContent, shouldPublishAndRedirect, token) {
            console.log('更新章节, ID:', editNodeId);
            
            const apiUrl = `/api/nodes/${editNodeId}`;
            const requestBody = {
                title,
                content: textContent
            };
            
            console.log('请求数据:', requestBody);
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('API响应状态:', response.status);

            // 检查响应是否为JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('API返回非JSON响应:', text.substring(0, 200));
                
                if (response.status === 401) {
                    throw new Error('未登录或登录已过期，请重新登录');
                } else if (response.status === 403) {
                    throw new Error('没有权限编辑此章节');
                } else if (response.status === 404) {
                    throw new Error('章节不存在');
                } else {
                    throw new Error(`服务器错误 (${response.status})`);
                }
            }

            const data = await response.json();
            console.log('API返回数据:', data);

            if (response.ok) {
                if (shouldPublishAndRedirect) {
                    // 如果章节是草稿状态，需要调用发布接口将其发布
                    const isDraft = editNodeData && editNodeData.is_published === false;
                    if (isDraft) {
                        console.log('章节为草稿，调用发布接口...');
                        try {
                            const publishResponse = await fetch(`/api/nodes/${editNodeId}/publish`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            if (!publishResponse.ok) {
                                const publishData = await publishResponse.json().catch(() => ({}));
                                console.warn('发布接口返回非成功状态:', publishResponse);
                                // 发布失败不影响主流程，章节内容已更新成功
                                showSuccess('章节内容已更新，但发布失败：' + (publishData.error || '未知错误'));
                                hasUnsavedChanges = false;
                                setTimeout(() => {
                                    window.location.href = `/chapter.html?id=${editNodeId}`;
                                }, 2000);
                                return;
                            }
                            
                            const publishData = await publishResponse.json();
                            console.log('发布结果:', publishData);
                            
                            // 如果内容需要审核
                            if (publishData.reviewStatus === 'pending') {
                                showSuccess('章节已发布，内容需要审核');
                            } else {
                                showSuccess('章节发布成功！即将返回...');
                            }
                        } catch (publishError) {
                            console.error('发布接口调用失败:', publishError);
                            showSuccess('章节内容已更新，但发布失败：' + publishError.message);
                            hasUnsavedChanges = false;
                            setTimeout(() => {
                                window.location.href = `/chapter.html?id=${editNodeId}`;
                            }, 2000);
                            return;
                        }
                    } else {
                        showSuccess('章节更新成功！即将返回...');
                    }
                    
                    // 标记新手任务：发布第一个章节
                    try {
                      const progressStr = localStorage.getItem('st_onboarding_progress');
                      let progress = progressStr ? JSON.parse(progressStr) : {};
                      if (!progress.tasks) progress.tasks = {};
                      if (!progress.tasks.publishedChapter) {
                        progress.tasks.publishedChapter = true;
                        // 发布章节必然意味着已创建故事和了解概念
                        if (!progress.tasks.createdStory) progress.tasks.createdStory = true;
                        if (!progress.tasks.viewedStoryTree) progress.tasks.viewedStoryTree = true;
                        localStorage.setItem('st_onboarding_progress', JSON.stringify(progress));
                        const tk = localStorage.getItem('token') || sessionStorage.getItem('token');
                        if (tk) {
                          fetch('/api/auth/onboarding-progress', {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ progress })
                          }).catch(() => {});
                        }
                        // 检查是否所有任务完成
                        if (window.onboardingManager && window.onboardingManager.allTasksCompleted(progress)) {
                          if (!localStorage.getItem('st_celebration_shown')) {
                            localStorage.setItem('st_celebration_pending', 'true');
                          }
                        }
                      }
                    } catch (e) { /* ignore */ }

                    // 清除未保存标记
                    hasUnsavedChanges = false;
                    
                    // 跳转回章节页面
                    setTimeout(() => {
                        window.location.href = `/chapter.html?id=${editNodeId}`;
                    }, 1500);
                } else {
                    // 保存修改：显示成功消息，留在当前页面
                    showSuccess('修改已保存！');
                    
                    // 清除未保存标记
                    hasUnsavedChanges = false;
                    
                    // 更新本地数据
                    if (editNodeData) {
                        editNodeData.title = title;
                        editNodeData.content = textContent;
                    }
                    
                    // 重新启用按钮
                    document.getElementById('publishBtn').disabled = false;
                    document.getElementById('saveDraftBtn').disabled = false;
                    
                    // 移除加载状态
                    document.getElementById('loadingOverlay').classList.remove('active');
                }
            } else {
                throw new Error(data.error || '更新失败');
            }
        }

        // 显示成功消息
        function showSuccess(message) {
            if (window.toast) {
                toast.success(message);
            } else {
                showMessage(message, 'success');
            }
        }

        // 显示错误消息
        function showError(message) {
            if (window.toast) {
                toast.error(message);
            } else {
                showMessage(message, 'error');
            }
        }

        // 显示消息（降级兜底）
        function showMessage(message, type = 'info') {
            const messageEl = document.createElement('div');
            messageEl.className = `message message-${type}`;
            messageEl.innerHTML = `
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
                <span>${escapeHtml(message)}</span>
            `;

            document.body.appendChild(messageEl);

            setTimeout(() => {
                messageEl.classList.add('fade-out');
                setTimeout(() => messageEl.remove(), 300);
            }, 3000);
        }

        // ========== 新增：积分确认弹窗 ==========
        function showPointsConfirmDialog(featureName, pointsCost, description) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                `;

                overlay.innerHTML = `
                    <div style="
                        background: white;
                        border-radius: 20px;
                        max-width: 450px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                        animation: slideIn 0.3s ease-out;
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 60px;
                            height: 60px;
                            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                            border-radius: 50%;
                            margin: 0 auto 20px;
                        ">
                            <i class="fas fa-coins" style="font-size: 28px; color: white;"></i>
                        </div>
                        <h3 style="
                            text-align: center;
                            color: #333;
                            margin: 0 0 15px 0;
                            font-size: 22px;
                        ">
                            积分消耗确认
                        </h3>
                        <p style="
                            text-align: center;
                            color: #666;
                            margin: 0 0 10px 0;
                            font-size: 16px;
                        ">
                            使用 <strong>${escapeHtml(featureName)}</strong> 功能
                        </p>
                        <p style="
                            text-align: center;
                            color: #333;
                            margin: 0 0 25px 0;
                            font-size: 18px;
                            font-weight: 600;
                        ">
                            将消耗 <span style="color: #f5576c;">${pointsCost}</span> 积分
                        </p>
                        ${description ? `
                            <p style="
                                text-align: center;
                                color: #999;
                                margin: 0 0 25px 0;
                                font-size: 14px;
                                background: #f8f9fa;
                                padding: 12px;
                                border-radius: 8px;
                            ">
                                ${escapeHtml(description)}
                            </p>
                        ` : ''}
                        <div style="
                            display: flex;
                            gap: 15px;
                            margin-top: 20px;
                        ">
                            <button id="cancelPointsBtn" style="
                                flex: 1;
                                padding: 14px 20px;
                                background: #f1f3f5;
                                color: #333;
                                border: none;
                                border-radius: 12px;
                                font-size: 16px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                            ">
                                取消
                            </button>
                            <button id="confirmPointsBtn" style="
                                flex: 1;
                                padding: 14px 20px;
                                background: linear-gradient(135deg, var(--st-primary-500) 0%, var(--st-primary-700) 100%);
                                color: white;
                                border: none;
                                border-radius: 12px;
                                font-size: 16px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                            ">
                                确认使用
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(overlay);

                // 按钮事件
                const cancelBtn = document.getElementById('cancelPointsBtn');
                const confirmBtn = document.getElementById('confirmPointsBtn');

                const closeDialog = () => {
                    overlay.style.animation = 'slideOut 0.3s ease-out';
                    setTimeout(() => overlay.remove(), 300);
                };

                cancelBtn.addEventListener('click', () => {
                    closeDialog();
                    resolve(false);
                });

                confirmBtn.addEventListener('click', () => {
                    closeDialog();
                    resolve(true);
                });

                // 点击背景关闭
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        closeDialog();
                        resolve(false);
                    }
                });
            });
        }
        // ===============================================

        // 防止意外离开
        let hasUnsavedChanges = false;
        
        // 监听标题变化
        document.getElementById('chapterTitle').addEventListener('input', function() {
            hasUnsavedChanges = true;
        });
        
        window.addEventListener('beforeunload', function(e) {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '你有未保存的内容，确定要离开吗？';
            }
});

        // ============================================
        // AI 续写功能
        // ============================================

        let aiModal;
        let aiOptions = [];
        let currentUserId = null;
        let selectedSurpriseTime = 'immediate'; // 默认立即生成
        let selectedAiStyle = 'suspense'; // 默认悬疑风格
        let selectedAiWordCount = 1000; // 默认 1000 字（小段落）
        let currentAiTaskId = null; // 当前 AI 任务 ID
        let aiMode = 'segment'; // AI 模式：'segment' = 续写小段落，'chapter' = 创作整章

        // ========== 新增：加载配额信息并更新徽章 ==========
        async function loadAiQuotaInfo() {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    console.log('未登录，跳过配额加载');
                    return;
                }

                const response = await fetch('/api/ai/v2/quota', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`获取配额信息失败：HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log('📊 AI 配额信息:', data);

                // 防御性检查：确保数据结构正确
                // 注意：API 返回的是 quota 而不是 quotas
                const quotaData = data.quota || data.quotas;
                if (!quotaData) {
                    console.error('❌ API 返回的数据缺少 quota 字段:', data);
                    return;
                }

                // 更新各个按钮的徽章显示
                if (quotaData.continuation && data.costs) {
                    updateQuotaBadge('aiContinuationQuota', quotaData.continuation, data.costs.continuation);
                }
                if (quotaData.polish && data.costs) {
                    updateQuotaBadge('aiPolishQuota', quotaData.polish, data.costs.polish);
                }
                if (quotaData.illustration && data.costs) {
                    updateQuotaBadge('aiIllustrationQuota', quotaData.illustration, data.costs.illustration);
                }

            } catch (error) {
                console.error('❌ 加载配额信息失败:', error);
                // 静默失败，不影响功能使用
            }
        }

        function updateQuotaBadge(elementId, quota, cost) {
            const badge = document.getElementById(elementId);
            if (!badge) return;

            const remaining = quota.unlimited ? -1 : Math.max(0, quota.limit - quota.used);
            
            if (quota.unlimited) {
                // 无限配额
                badge.innerHTML = '∞';
                badge.className = 'ai-quota-badge unlimited';
                badge.title = '无限配额';
            } else if (remaining > 0) {
                // 有配额
                badge.textContent = remaining;
                badge.className = 'ai-quota-badge';
                badge.title = `剩余${remaining}次配额，超配额后 ${cost}积分/次`;
                
                // 配额不足 3 次时显示警告
                if (remaining <= 3) {
                    badge.classList.add('low');
                    badge.title += '（配额即将用完）';
                }
            } else {
                // 配额用完
                badge.innerHTML = `<i class="fas fa-coins"></i> ${cost}`;
                badge.className = 'ai-quota-badge exhausted';
                badge.title = `配额已用完，需要${cost}积分/次`;
            }
        }
// 初始化 AI 功能
        function initAiFeature() {
            console.log('开始初始化 AI 功能...');
            
            aiModal = document.getElementById('aiModal');
            const aiSuggestBtn = document.getElementById('aiSuggestBtn');
            const closeAiModal = document.getElementById('closeAiModal');
            const cancelAiBtn = document.getElementById('cancelAiBtn');
            const regenerateBtn = document.getElementById('regenerateBtn');
            const startAiGenerationBtn = document.getElementById('startAiGenerationBtn');

            console.log('DOM 元素查找结果:', {
                aiModal: !!aiModal,
                aiSuggestBtn: !!aiSuggestBtn,
                closeAiModal: !!closeAiModal,
                cancelAiBtn: !!cancelAiBtn,
                regenerateBtn: !!regenerateBtn,
                startAiGenerationBtn: !!startAiGenerationBtn
            });

            if (!aiModal) {
                console.error('❌ AI 模态框元素未找到');
                return;
            }

            // AI 续写按钮（小段落）
            if (aiSuggestBtn) {
                aiSuggestBtn.addEventListener('click', () => openAiModal('segment'));
                console.log('✅ AI 续写按钮事件已绑定');
            } else {
                console.error('❌ AI 续写按钮未找到');
            }
            
            if (closeAiModal) {
                closeAiModal.addEventListener('click', closeAiModalFunc);
            }
            if (cancelAiBtn) {
                cancelAiBtn.addEventListener('click', closeAiModalFunc);
            }
            if (regenerateBtn) {
                regenerateBtn.addEventListener('click', regenerateAiSuggestions);
            }
            if (startAiGenerationBtn) {
                startAiGenerationBtn.addEventListener('click', startAiGeneration);
            }

            // 用户自定义输入字符计数实时更新
            const userPromptInput = document.getElementById('userPromptInput');
            const userPromptCounter = document.getElementById('userPromptCounter');
            if (userPromptInput && userPromptCounter) {
                userPromptInput.addEventListener('input', function() {
                    userPromptCounter.textContent = `${this.value.length}/200`;
                });
            }


            // 点击模态框背景关闭
            if (aiModal) {
                aiModal.addEventListener('click', function(e) {
                    if (e.target === aiModal) {
                        closeAiModalFunc();
                    }
                });
            }

            // ========== 新增：加载配额信息并更新徽章 ==========
            loadAiQuotaInfo();
            // ===============================================
            document.querySelectorAll('.surprise-time-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.surprise-time-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    selectedSurpriseTime = this.dataset.time;
                    console.log('选择惊喜时间:', selectedSurpriseTime);
                    
                    // 如果选择自定义，显示自定义时间选择器
                    const customTimeSelector = document.getElementById('customTimeSelector');
                    if (selectedSurpriseTime === 'custom') {
                        customTimeSelector.style.display = 'block';
                        // 设置最小时间为当前时间
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 5); // 至少5分钟后
                        const minDateTime = now.toISOString().slice(0, 16);
                        document.getElementById('customDateTime').min = minDateTime;
                        document.getElementById('customDateTime').value = minDateTime;
                    } else {
                        customTimeSelector.style.display = 'none';
                    }
                });
            });
            
            // 确认自定义时间
            document.getElementById('confirmCustomTime')?.addEventListener('click', function() {
                const customDateTime = document.getElementById('customDateTime').value;
                if (!customDateTime) {
                    showError('请选择一个时间');
                    return;
                }
                
                const selectedTime = new Date(customDateTime);
                const now = new Date();
                
                if (selectedTime <= now) {
                    showError('请选择未来的时间');
                    return;
                }
                
                // 保存自定义时间
                selectedSurpriseTime = customDateTime;
                console.log('确认自定义时间:', selectedSurpriseTime);
                showSuccess('已设置自定义时间：' + selectedTime.toLocaleString('zh-CN'));
            });

            // 初始化AI风格按钮
            document.querySelectorAll('.ai-style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.ai-style-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    // 检查是风格按钮还是字数按钮
                    if (this.dataset.style) {
                        selectedAiStyle = this.dataset.style;
                        console.log('选择AI风格:', selectedAiStyle);
                    } else if (this.dataset.wordcount) {
                        const wordcount = this.dataset.wordcount;
                        
                        if (wordcount === 'custom') {
                            // 显示自定义输入框
                            document.getElementById('customWordCountInput').style.display = 'block';
                            console.log('显示自定义字数输入框');
                        } else {
                            // 隐藏自定义输入框
                            document.getElementById('customWordCountInput').style.display = 'none';
                            selectedAiWordCount = parseInt(wordcount);
                            console.log('选择期望字数:', selectedAiWordCount);
                        }
                    }
                });
            });
            
            // 确认自定义字数按钮
            document.getElementById('confirmCustomWordCount')?.addEventListener('click', function() {
                const customValue = parseInt(document.getElementById('customWordCountValue').value);
                
                // 验证输入
                if (!customValue || customValue < 200 || customValue > 5000) {
                    showError('请输入200-5000之间的字数');
                    return;
                }
                
                selectedAiWordCount = customValue;
                console.log('确认自定义字数:', selectedAiWordCount);
                
                // 更新按钮文字显示
                const customBtn = document.querySelector('#aiWordCountSelector .ai-style-btn[data-wordcount="custom"]');
                customBtn.innerHTML = `<i class="fas fa-edit"></i> 自定义<br><span style="font-size: 12px; opacity: 0.8;">${customValue}字</span>`;
                
                showSuccess(`已设置期望字数：${customValue}字`);
            });

            // 初始化润色功能
            initPolishFeature();

            // 初始化插图功能
            initIllustrationFeature();

            console.log('✅ AI功能初始化完成');
        }

        // 打开AI模态框（写作页面只支持小段落续写）
        function openAiModal(mode = 'segment') {
            console.log('打开AI续写模态框');
            aiMode = 'segment'; // 写作页面固定为小段落模式

            // 检查编辑器是否已初始化
            if (!quill) {
                showError('编辑器未初始化，请刷新页面');
                return;
            }

            // 获取当前内容
            const currentContent = quill.getText().trim();
            
            // 检查50字限制
            if (currentContent.length < 50) {
                showError('请先写一些内容（至少50字），AI才能更好地理解故事方向');
                return;
            }

            // 设置UI（小段落模式：隐藏惊喜时间选择器）
            const modalTitle = document.getElementById('aiModalTitle');
            const surpriseTimeSelector = document.getElementById('surpriseTimeSelector');
            
            modalTitle.innerHTML = '<i class="fas fa-magic"></i> AI续写';
            surpriseTimeSelector.style.display = 'none';
            selectedSurpriseTime = 'immediate'; // 强制立即生成

            // 显示选择器，隐藏其他内容
            document.getElementById('aiStyleSelector').style.display = 'block';
            document.getElementById('startAiGenerationBtn').parentElement.style.display = 'block';
            document.getElementById('aiLoading').style.display = 'none';
            document.getElementById('aiOptions').style.display = 'none';
            document.getElementById('aiError').style.display = 'none';
            document.getElementById('regenerateBtn').style.display = 'none';

            // 打开模态框
            aiModal.classList.add('active');
        }

// 开始 AI 生成
        async function startAiGeneration() {
            console.log('开始 AI 生成，惊喜时间:', selectedSurpriseTime, '风格:', selectedAiStyle);

            // 检查编辑器
            if (!quill) {
                showError('编辑器未初始化');
                return;
            }

            const currentContent = quill.getText().trim();
            
            // ========== 新增：检查是否需要使用积分 ==========
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    throw new Error('请先登录');
                }

                // 获取配额信息
                const quotaResponse = await fetch('/api/ai/v2/quota', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (quotaResponse.ok) {
                    const quotaData = await quotaResponse.json();
                    const quotaInfo = quotaData.quota || quotaData.quotas;
                    const costs = quotaData.costs;

                    // 检查续写配额
                    if (quotaInfo && quotaInfo.continuation) {
                        const remaining = quotaInfo.continuation.unlimited ? -1 : 
                            Math.max(0, quotaInfo.continuation.limit - quotaInfo.continuation.used);

                        // 配额用完且需要消耗积分
                        if (remaining === 0 && costs && costs.continuation > 0) {
                            // 检查当前用户积分
                            const userPointsResponse = await fetch('/api/auth/me', {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            if (userPointsResponse.ok) {
                                const userData = await userPointsResponse.json();
                                const userPoints = userData.user.points || 0;

                                // 积分足够，弹窗确认
                                if (userPoints >= costs.continuation) {
                                    const confirmed = await showPointsConfirmDialog(
                                        'AI 续写',
                                        costs.continuation,
                                        `本次操作将消耗 ${costs.continuation} 积分（您的积分余额：${userPoints}）`
                                    );

                                    if (!confirmed) {
                                        console.log('用户取消使用积分');
                                        return;
                                    }
                                } else {
                                    showError('积分不足，无法使用 AI 续写功能');
                                    return;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('检查配额和积分失败:', error);
                // 继续执行，不阻止用户操作
            }
            // ===============================================

            // 隐藏选择器，显示加载状态
            document.getElementById('surpriseTimeSelector').style.display = 'none';
            document.getElementById('aiStyleSelector').style.display = 'none';
            document.getElementById('startAiGenerationBtn').parentElement.style.display = 'none';
            document.getElementById('aiLoading').style.display = 'block';
            document.getElementById('aiOptions').style.display = 'none';
            document.getElementById('aiError').style.display = 'none';
            const loadingText = document.getElementById('aiLoadingText');
            if (selectedSurpriseTime === 'immediate') {
                loadingText.textContent = 'AI 正在创作中...';
            } else {
                const timeMap = {
                    '1hour': '1小时后',
                    'tonight': '今晚22:00',
                    'tomorrow': '明天8:00'
                };
                loadingText.textContent = `任务已提交，AI将在${timeMap[selectedSurpriseTime]}为你创作新章节`;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                // 获取用户自定义输入
                const userPromptInput = document.getElementById('userPromptInput');
                const userPrompt = userPromptInput ? userPromptInput.value.trim() : undefined;

                console.log('调用AI续写...');
                console.log('故事ID:', storyId, '风格:', selectedAiStyle, '字数:', selectedAiWordCount);

                if (selectedSurpriseTime === 'immediate') {
                    // ===== 立即模式：使用流式 SSE 接口 =====
                    loadingText.textContent = 'AI 正在创作中...';
                    
                    // 显示流式输出容器
                    document.getElementById('aiLoading').style.display = 'none';
                    document.getElementById('aiOptions').style.display = 'block';
                    const optionsContainer = document.getElementById('aiOptions');
                    optionsContainer.innerHTML = `
                        <div class="ai-option-card ai-streaming-card">
                            <div class="ai-option-header">
                                <span class="ai-option-style">${selectedAiStyle || 'AI 续写'}</span>
                                <span class="ai-streaming-indicator"><i class="fas fa-pen-nib"></i> 正在书写...</span>
                            </div>
                            <div class="ai-stream-content" id="aiStreamContent"></div>
                            <div class="ai-option-actions" id="aiStreamActions" style="display:none;">
                                <button class="btn-use" id="aiStreamAcceptBtn">
                                    <i class="fas fa-check"></i> 插入编辑器
                                </button>
                                <button class="btn-preview" id="aiStreamAbortBtn">
                                    <i class="fas fa-stop"></i> 停止生成
                                </button>
                            </div>
                        </div>
                    `;

                    const streamContent = document.getElementById('aiStreamContent');
                    const streamActions = document.getElementById('aiStreamActions');
                    streamActions.style.display = 'flex';

                    // 停止按钮
                    let currentStream = null;
                    document.getElementById('aiStreamAbortBtn').onclick = () => {
                        if (currentStream) currentStream.abort();
                    };

                    // 启动流式请求
                    currentStream = new SSEStream('/api/ai/stream/continuation', {
                        body: {
                            storyId: parseInt(storyId),
                            nodeId: window.lastNodeId || null,
                            context: currentContent,
                            style: selectedAiStyle,
                            mode: aiMode,
                            wordCount: selectedAiWordCount,
                            userPrompt: userPrompt || undefined
                        },
                        onChunk: (text, fullText) => {
                            // 逐字渲染（将换行转为 <br>）
                            streamContent.innerHTML = fullText.replace(/\n/g, '<br>');
                            streamContent.scrollTop = streamContent.scrollHeight;
                        },
                        onDone: (result) => {
                            // 完成：更新状态
                            const indicator = optionsContainer.querySelector('.ai-streaming-indicator');
                            if (indicator) indicator.innerHTML = '<i class="fas fa-check-circle"></i> 生成完成';
                            
                            // 保存结果供插入
                            const finalText = result.fullText;
                            aiOptions = [{ title: 'AI续写', content: finalText, style: selectedAiStyle || '续写' }];
                            
                            // 绑定插入按钮
                            document.getElementById('aiStreamAcceptBtn').onclick = () => {
                                useAiSuggestion(0);
                            };
                            // 替换停止按钮为重新生成
                            document.getElementById('aiStreamAbortBtn').innerHTML = '<i class="fas fa-redo"></i> 重新生成';
                            document.getElementById('aiStreamAbortBtn').onclick = () => {
                                showAiSuggestions();
                            };
                        },
                        onError: (message) => {
                            streamContent.innerHTML = `<span style="color: var(--st-error-500);">${message}</span>`;
                            const indicator = optionsContainer.querySelector('.ai-streaming-indicator');
                            if (indicator) indicator.innerHTML = '<i class="fas fa-exclamation-circle"></i> 生成失败';
                        },
                        onAbort: (partialText) => {
                            // 用户中断，保留已生成内容
                            if (partialText) {
                                aiOptions = [{ title: 'AI续写(部分)', content: partialText, style: selectedAiStyle || '续写' }];
                                const indicator = optionsContainer.querySelector('.ai-streaming-indicator');
                                if (indicator) indicator.innerHTML = '<i class="fas fa-pause-circle"></i> 已停止';
                                document.getElementById('aiStreamAcceptBtn').onclick = () => { useAiSuggestion(0); };
                                document.getElementById('aiStreamAbortBtn').innerHTML = '<i class="fas fa-redo"></i> 重新生成';
                                document.getElementById('aiStreamAbortBtn').onclick = () => { showAiSuggestions(); };
                            }
                        }
                    });

                    await currentStream.start();

                } else {
                    // ===== 延迟模式：保持原有队列逻辑 =====
                    const response = await fetch('/api/ai/v2/continuation/submit', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            storyId: parseInt(storyId),
                            nodeId: window.lastNodeId || null,
                            context: currentContent,
                            style: selectedAiStyle,
                            count: 3,
                            mode: aiMode,
                            surpriseTime: selectedSurpriseTime,
                            wordCount: selectedAiWordCount,
                            userPrompt: userPrompt || undefined
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `API错误 (${response.status})`);
                    }

                    const data = await response.json();
                    currentAiTaskId = data.taskId;

                    // 延迟生成：显示成功消息
                    document.getElementById('aiLoading').style.display = 'none';
                    showSuccess(data.message || '任务已提交');
                    setTimeout(() => {
                        closeAiModalFunc();
                    }, 2000);
                }

            } catch (error) {
                console.error('AI生成错误:', error);
                document.getElementById('aiLoading').style.display = 'none';
                document.getElementById('aiError').style.display = 'block';
                document.getElementById('regenerateBtn').style.display = 'inline-block';
                
                let errorMessage = error.message || 'AI服务暂时不可用';
                
                if (error.message.includes('登录') || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用AI续写功能';
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足';
                } else if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                }
                
                document.getElementById('aiErrorMessage').textContent = errorMessage;
            }
        }

        // 监听AI任务状态（WebSocket 优先，降级轮询兜底）
        async function pollTaskStatus(taskId) {
            console.log('开始监听任务状态:', taskId, 'WebSocket:', StoryTreeWS.isConnected() ? '已连接' : '未连接');
            
            // 注册任务回调（WebSocket 收到推送或降级轮询完成时触发）
            const handleTaskUpdate = (data) => {
                console.log('收到任务状态更新:', data);
                if (data.taskId !== taskId) return;
                
                if (data.status === 'completed') {
                    // 任务完成，显示结果
                    console.log('任务完成，结果:', data.result);
                    displayAiTaskResult(data.result);
                    // 清理监听
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                } else if (data.status === 'failed') {
                    // 任务失败
                    console.error('任务失败:', data.errorMessage);
                    document.getElementById('aiLoading').style.display = 'none';
                    document.getElementById('aiError').style.display = 'block';
                    document.getElementById('aiErrorMessage').textContent = data.errorMessage || '生成失败';
                    // 清理监听
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                }
            };
            
            // 通过 WebSocket 监听
            StoryTreeWS.on('task:status', handleTaskUpdate);
            
            // 同时注册降级轮询任务（WebSocket 断开时自动启动轮询）
            StoryTreeWS.watchTask(taskId, handleTaskUpdate);
        }

        // 显示AI任务结果（写作页面：仅小段落模式）
        function displayAiTaskResult(result) {
            console.log('显示AI任务结果:', result);
            
            document.getElementById('aiLoading').style.display = 'none';
            document.getElementById('aiOptions').style.display = 'block';
            document.getElementById('regenerateBtn').style.display = 'inline-block';

            const optionsContainer = document.getElementById('aiOptions');
            optionsContainer.innerHTML = '';

            // 保存选项供后续使用
            const options = result.options || [];
            aiOptions = options;

            if (options.length === 0) {
                optionsContainer.innerHTML = '<p style="text-align: center; color: #999;">未生成续写选项</p>';
                return;
            }

            options.forEach((option, index) => {
                const card = document.createElement('div');
                card.className = 'ai-option-card';
                
                // 小段落模式：插入编辑器
                card.innerHTML = `
                    <div class="ai-option-header">
                        <span class="ai-option-style">${option.style || '风格' + (index + 1)}</span>
                        <span style="font-size: 12px; color: #999;">
                            <i class="fas fa-robot"></i> AI创作
                        </span>
                    </div>
                    <div class="ai-option-title">${option.title}</div>
                    <div class="ai-option-content">${option.content}</div>
                    <div class="ai-option-actions">
                        <button class="btn-use" onclick="useAiSuggestion(${index})">
                            <i class="fas fa-check"></i> 插入编辑器
                        </button>
                        <button class="btn-preview" onclick="previewAiSuggestion(${index})">
                            <i class="fas fa-eye"></i> 查看完整
                        </button>
                    </div>
                `;
                optionsContainer.appendChild(card);
            });
        }

        // 显示AI续写建议（使用v2异步队列模式）
        async function showAiSuggestions() {
            console.log('用户点击AI续写建议（v2异步模式）');

            // 检查编辑器是否已初始化
            if (!quill) {
                showError('编辑器未初始化，请刷新页面');
                return;
            }

            // 检查是否有内容作为上下文
            const currentContent = quill.getText().trim();
            
            if (currentContent.length < 50) {
                showError('请先写一些内容（至少50字），AI才能更好地理解故事方向');
                return;
            }

            // 打开模态框
            aiModal.classList.add('active');
            document.getElementById('aiLoading').style.display = 'block';
            document.getElementById('aiOptions').style.display = 'none';
            document.getElementById('aiError').style.display = 'none';
            document.getElementById('regenerateBtn').style.display = 'none';

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('Not authenticated');
                }

                console.log('调用AI v2续写API（小段落模式）...');
                console.log('故事ID:', storyId);
                console.log('当前内容长度:', currentContent.length);

                // 使用 v2 异步队列模式提交续写任务
                const response = await fetch('/api/ai/v2/continuation/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        storyId: parseInt(storyId),
                        nodeId: window.lastNodeId || null,
                        context: currentContent,
                        count: 3,
                        mode: 'segment'  // 小段落模式
                    })
                });

                console.log('AI API响应状态:', response.status);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API错误 (${response.status})`);
                }

                const data = await response.json();
                console.log('AI v2返回数据:', data);

                // 如果是重复任务，直接轮询已有任务
                const taskId = data.taskId;
                currentAiTaskId = taskId;

                // 更新加载文案
                const loadingText = document.getElementById('aiLoadingText');
                if (loadingText) {
                    loadingText.textContent = 'AI 正在创作中...';
                }

                // 异步轮询任务状态
                await pollTaskStatus(taskId);

            } catch (error) {
                console.error('AI续写错误:', error);
                document.getElementById('aiLoading').style.display = 'none';
                document.getElementById('aiError').style.display = 'block';
                document.getElementById('regenerateBtn').style.display = 'inline-block';
                
                let errorMessage = error.message || 'AI服务暂时不可用';
                
                // 友好的错误提示
                if (error.message === 'Not authenticated' || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用AI续写功能';
                    setTimeout(() => {
                        showConfirm('需要登录才能使用AI续写功能，是否前往登录页？', () => {
                            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
                        }, { title: '需要登录', confirmText: '前往登录', onCancel: closeAiModalFunc });
                    }, 1000);
                } else if (error.message.includes('任务正在处理')) {
                    errorMessage = '您有任务正在处理中，请等待完成后再提交';
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足';
                } else if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                }
                
                document.getElementById('aiErrorMessage').textContent = errorMessage;
            }
        }

        // 显示AI选项
        function displayAiOptions(options) {
            console.log('显示AI选项:', options);
            
            document.getElementById('aiLoading').style.display = 'none';
            document.getElementById('aiOptions').style.display = 'block';
            document.getElementById('regenerateBtn').style.display = 'inline-block';

            const optionsContainer = document.getElementById('aiOptions');
            optionsContainer.innerHTML = '';

            // 保存选项供后续使用
            aiOptions = options;

            options.forEach((option, index) => {
                const card = document.createElement('div');
                card.className = 'ai-option-card';
                card.innerHTML = `
                    <div class="ai-option-header">
                        <span class="ai-option-style">${option.style || '风格' + (index + 1)}</span>
                    </div>
                    <div class="ai-option-title">${option.title}</div>
                    <div class="ai-option-content">${option.content}</div>
                    <div class="ai-option-actions">
                        <button class="btn-use" onclick="useAiSuggestion(${index})">
                            <i class="fas fa-check"></i> 使用此续写
                        </button>
                        <button class="btn-preview" onclick="previewAiSuggestion(${index})">
                            <i class="fas fa-eye"></i> 查看完整
                        </button>
                    </div>
                `;
                optionsContainer.appendChild(card);
            });
        }

        // 使用AI续写（小段落模式：插入到编辑器）
        window.useAiSuggestion = function(index) {
            const option = aiOptions[index];
            
            console.log('用户选择了选项:', index, option);
            console.log('当前模式:', aiMode);
            
            // 获取当前光标位置
            const selection = quill.getSelection();
            const cursorPosition = selection ? selection.index : quill.getLength();
            
            // 在光标位置插入AI生成的内容
            // 先插入一个换行
            quill.insertText(cursorPosition, '\n', 'user');
            
            // 然后插入AI内容（按段落分割）
            const paragraphs = option.content.split('\n').filter(p => p.trim());
            let insertPosition = cursorPosition + 1;
            
            paragraphs.forEach((paragraph, i) => {
                quill.insertText(insertPosition, paragraph, 'user');
                insertPosition += paragraph.length;
                
                // 每段后面加换行（除了最后一段）
                if (i < paragraphs.length - 1) {
                    quill.insertText(insertPosition, '\n', 'user');
                    insertPosition += 1;
                }
            });
            
            // 更新字数
            updateWordCount();
            
            // 关闭模态框
            closeAiModalFunc();
            
            // 显示成功提示
            showSuccess('AI续写已插入编辑器，你可以继续编辑');
            
            // 聚焦编辑器到插入内容的末尾
            setTimeout(() => {
                quill.setSelection(insertPosition, 0);
                quill.focus();
            }, 300);
        };

        // 预览AI续写
        window.previewAiSuggestion = function(index) {
            const option = aiOptions[index];
            
            // 创建预览模态框
            const preview = document.createElement('div');
            preview.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                z-index: 3000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            
            preview.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 20px;
                    max-width: 800px;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 40px;
                ">
                    <h2 style="margin-top: 0; color: #333;">
                        ${option.title}
                    </h2>
                    <div style="
                        color: #666;
                        line-height: 1.8;
                        font-size: 16px;
                        white-space: pre-wrap;
                    ">
                        ${option.content}
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        margin-top: 30px;
                        padding: 12px 30px;
                        background: linear-gradient(135deg, var(--st-primary-500) 0%, var(--st-primary-700) 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        关闭
                    </button>
                </div>
            `;
            
            preview.addEventListener('click', function(e) {
                if (e.target === preview) {
                    preview.remove();
                }
            });
            
            document.body.appendChild(preview);
        };

        // 重新生成AI续写
        async function regenerateAiSuggestions() {
            console.log('重新生成AI续写');
            
            // 重置界面到选择器状态
            document.getElementById('surpriseTimeSelector').style.display = 'block';
            document.getElementById('aiStyleSelector').style.display = 'block';
            document.getElementById('startAiGenerationBtn').parentElement.style.display = 'block';
            document.getElementById('aiLoading').style.display = 'none';
            document.getElementById('aiOptions').style.display = 'none';
            document.getElementById('aiError').style.display = 'none';
            document.getElementById('regenerateBtn').style.display = 'none';
        }

        // 关闭AI模态框
        function closeAiModalFunc() {
            if (aiModal) {
                aiModal.classList.remove('active');
                console.log('关闭AI模态框');
            }
        }

        // ============================================
        // AI润色功能
        // ============================================

        let polishModal;
        let selectedPolishStyle = 'concise';
        let originalContent = '';
        let polishedContent = '';

        // 初始化润色功能
        function initPolishFeature() {
            console.log('开始初始化AI润色功能...');
            
            polishModal = document.getElementById('polishModal');
            const aiPolishBtn = document.getElementById('aiPolishBtn');
            const closePolishModal = document.getElementById('closePolishModal');
            const cancelPolishBtn = document.getElementById('cancelPolishBtn');
            const applyPolishBtn = document.getElementById('applyPolishBtn');
            const startPolishBtn = document.getElementById('startPolishBtn');

            if (!polishModal) {
                console.error('❌ 润色模态框元素未找到');
                return;
            }

            if (aiPolishBtn) {
                aiPolishBtn.addEventListener('click', showPolishModal);
                console.log('✅ AI润色按钮事件已绑定');
            }
            
            if (closePolishModal) {
                closePolishModal.addEventListener('click', closePolishModalFunc);
            }
            if (cancelPolishBtn) {
                cancelPolishBtn.addEventListener('click', closePolishModalFunc);
            }
            if (applyPolishBtn) {
                applyPolishBtn.addEventListener('click', applyPolish);
            }
            if (startPolishBtn) {
                startPolishBtn.addEventListener('click', performPolish);
                console.log('✅ 开始润色按钮事件已绑定');
            }

            // 点击模态框背景关闭
            polishModal.addEventListener('click', function(e) {
                if (e.target === polishModal) {
                    closePolishModalFunc();
                }
            });

            // 初始化风格按钮
            document.querySelectorAll('.polish-style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    // 移除所有active类
                    document.querySelectorAll('.polish-style-btn').forEach(b => b.classList.remove('active'));
                    // 添加active类到当前按钮
                    this.classList.add('active');
                    // 保存选中的风格
                    selectedPolishStyle = this.dataset.style;
                    console.log('选择润色风格:', selectedPolishStyle);
                    
                    // 移除自动润色逻辑，让用户手动点击"开始润色"按钮
                });
            });

            console.log('✅ AI润色功能初始化完成');
        }

        // 显示润色模态框
        function showPolishModal() {
            console.log('用户点击AI润色按钮');

            // 检查编辑器是否已初始化
            if (!quill) {
                showError('编辑器未初始化，请刷新页面');
                return;
            }

            // 获取选中的文本，如果没有选中则获取全部内容
            const selection = quill.getSelection();
            let contentToPolish;
            
            if (selection && selection.length > 0) {
                // 有选中文本，只润色选中部分
                contentToPolish = quill.getText(selection.index, selection.length).trim();
                console.log('润色选中文本，长度:', contentToPolish.length);
            } else {
                // 没有选中，润色全部内容
                contentToPolish = quill.getText().trim();
                console.log('润色全部内容，长度:', contentToPolish.length);
            }
            
            if (contentToPolish.length < 10) {
                showError('请先写一些内容（至少10字），或选中要润色的文本');
                return;
            }

            if (contentToPolish.length > 5000) {
                showError('内容过长（超过5000字），请选中部分文本进行润色');
                return;
            }

            // 保存原始内容
            originalContent = contentToPolish;

            // 打开模态框，显示选择器和按钮，不自动开始润色
            polishModal.classList.add('active');
            document.getElementById('polishStyleSelector').style.display = 'block';
            document.getElementById('startPolishBtnContainer').style.display = 'block';
            document.getElementById('polishLoading').style.display = 'none';
            document.getElementById('polishComparison').style.display = 'none';
            document.getElementById('polishError').style.display = 'none';
            document.getElementById('applyPolishBtn').style.display = 'none';

            // 显示原文预览
            document.getElementById('originalText').textContent = originalContent;
        }

// 执行润色
        async function performPolish() {
            console.log('开始执行 AI 润色，风格:', selectedPolishStyle);

            // 隐藏选择器和按钮，显示加载状态
            document.getElementById('polishStyleSelector').style.display = 'none';
            document.getElementById('startPolishBtnContainer').style.display = 'none';
            document.getElementById('polishLoading').style.display = 'block';
            document.getElementById('polishComparison').style.display = 'none';
            document.getElementById('polishError').style.display = 'none';
            document.getElementById('applyPolishBtn').style.display = 'none';

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                // ========== 新增：检查是否需要使用积分 ==========
                try {
                    // 获取配额信息
                    const quotaResponse = await fetch('/api/ai/v2/quota', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (quotaResponse.ok) {
                        const quotaData = await quotaResponse.json();
                        const quotaInfo = quotaData.quota || quotaData.quotas;
                        const costs = quotaData.costs;

                        // 检查润色配额
                        if (quotaInfo && quotaInfo.polish) {
                            const remaining = quotaInfo.polish.unlimited ? -1 : 
                                Math.max(0, quotaInfo.polish.limit - quotaInfo.polish.used);

                            // 配额用完且需要消耗积分
                            if (remaining === 0 && costs && costs.polish > 0) {
                                // 检查当前用户积分
                                const userPointsResponse = await fetch('/api/auth/me', {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });

                                if (userPointsResponse.ok) {
                                    const userData = await userPointsResponse.json();
                                    const userPoints = userData.user.points || 0;

                                    // 积分足够，弹窗确认
                                    if (userPoints >= costs.polish) {
                                        const confirmed = await showPointsConfirmDialog(
                                            'AI 润色',
                                            costs.polish,
                                            `本次操作将消耗 ${costs.polish} 积分（您的积分余额：${userPoints}）`
                                        );

                                        if (!confirmed) {
                                            console.log('用户取消使用积分');
                                            // 恢复 UI 状态
                                            document.getElementById('polishStyleSelector').style.display = 'block';
                                            document.getElementById('startPolishBtnContainer').style.display = 'block';
                                            document.getElementById('polishLoading').style.display = 'none';
                                            return;
                                        }
                                    } else {
                                        showError('积分不足，无法使用 AI 润色功能');
                                        // 恢复 UI 状态
                                        document.getElementById('polishStyleSelector').style.display = 'block';
                                        document.getElementById('startPolishBtnContainer').style.display = 'block';
                                        document.getElementById('polishLoading').style.display = 'none';
                                        return;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('检查配额和积分失败:', error);
                    // 继续执行，不阻止用户操作
                }
                // ===============================================

                console.log('调用 AI 润色 API (流式)...');

                // 使用流式 SSE 接口
                const polishLoadingText = document.querySelector('#polishLoading .loading-text, #polishLoading span');
                if (polishLoadingText) polishLoadingText.textContent = 'AI 正在润色中...';

                await new Promise((resolve, reject) => {
                    const stream = new SSEStream('/api/ai/stream/polish', {
                        body: {
                            content: originalContent,
                            style: selectedPolishStyle
                        },
                        onChunk: (text, fullText) => {
                            // 实时更新润色结果预览
                            polishedContent = fullText;
                            if (polishLoadingText) {
                                polishLoadingText.textContent = `AI 正在润色中... (${fullText.length}字)`;
                            }
                        },
                        onDone: (result) => {
                            polishedContent = result.fullText;
                            displayPolishResult();
                            resolve();
                        },
                        onError: (message) => {
                            reject(new Error(message));
                        }
                    });
                    stream.start().catch(reject);
                });

            } catch (error) {
                console.error('AI 润色错误:', error);
                document.getElementById('polishLoading').style.display = 'none';
                document.getElementById('polishError').style.display = 'block';
                
                let errorMessage = error.message || 'AI 服务暂时不可用';
                
                if (error.message.includes('登录') || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用 AI 润色功能';
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足，请充值或升级会员';
                } else if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                }
                
                document.getElementById('polishErrorMessage').textContent = errorMessage;
            }
        }

        // 显示润色结果
        function displayPolishResult() {
            console.log('显示润色结果');
            
            document.getElementById('polishLoading').style.display = 'none';
            document.getElementById('polishComparison').style.display = 'block';
            document.getElementById('applyPolishBtn').style.display = 'inline-block';

            // 显示原文和润色后的文本
            document.getElementById('originalText').textContent = originalContent;
            document.getElementById('polishedText').textContent = polishedContent;
        }

        // 应用润色
        function applyPolish() {
            console.log('应用润色结果');

            if (!polishedContent) {
                showError('没有润色结果可应用');
                return;
            }

            // 检查是否有选中的文本
            const selection = quill.getSelection();
            
            if (selection && selection.length > 0) {
                // 替换选中的文本
                quill.deleteText(selection.index, selection.length);
                quill.insertText(selection.index, polishedContent);
                quill.setSelection(selection.index + polishedContent.length, 0);
            } else {
                // 替换全部内容
                quill.setText(polishedContent);
                quill.setSelection(polishedContent.length, 0);
            }

            // 更新字数
            updateWordCount();

            // 关闭模态框
            closePolishModalFunc();

            // 显示成功提示
            showSuccess('润色已应用！你可以继续编辑');

            // 标记有未保存的更改
            hasUnsavedChanges = true;
        }

        // 关闭润色模态框
        function closePolishModalFunc() {
            if (polishModal) {
                polishModal.classList.remove('active');
                console.log('关闭润色模态框');
                
                // 清空数据
                originalContent = '';
                polishedContent = '';
                
                // 重置UI状态，确保下次打开时显示选择器
                document.getElementById('polishStyleSelector').style.display = 'block';
                document.getElementById('startPolishBtnContainer').style.display = 'block';
                document.getElementById('polishLoading').style.display = 'none';
                document.getElementById('polishComparison').style.display = 'none';
                document.getElementById('polishError').style.display = 'none';
                document.getElementById('applyPolishBtn').style.display = 'none';
            }
        }

        // ============================================
        // AI插图功能
        // ============================================

        let illustrationModal;
        let selectedIllustrationStyle = 'realistic';

        // 初始化AI插图功能
        function initIllustrationFeature() {
            console.log('开始初始化AI插图功能...');
            
            illustrationModal = document.getElementById('illustrationModal');
            const aiIllustrationBtn = document.getElementById('aiIllustrationBtn');
            const closeIllustrationModal = document.getElementById('closeIllustrationModal');
            const cancelIllustrationBtn = document.getElementById('cancelIllustrationBtn');
            const startGenerateIllustrationBtn = document.getElementById('startGenerateIllustrationBtn');

            if (!illustrationModal) {
                console.error('❌ AI插图模态框元素未找到');
                return;
            }

            if (aiIllustrationBtn) {
                aiIllustrationBtn.addEventListener('click', showIllustrationModal);
                console.log('✅ AI插图按钮事件已绑定');
            }
            
            if (closeIllustrationModal) {
                closeIllustrationModal.addEventListener('click', closeIllustrationModalFunc);
            }
            if (cancelIllustrationBtn) {
                cancelIllustrationBtn.addEventListener('click', closeIllustrationModalFunc);
            }
            if (startGenerateIllustrationBtn) {
                startGenerateIllustrationBtn.addEventListener('click', startGenerateIllustration);
            }

            // 点击模态框背景关闭
            illustrationModal.addEventListener('click', function(e) {
                if (e.target === illustrationModal) {
                    closeIllustrationModalFunc();
                }
            });

            // 初始化风格按钮
            document.querySelectorAll('.illustration-style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.illustration-style-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    selectedIllustrationStyle = this.dataset.style;
                    console.log('选择插图风格:', selectedIllustrationStyle);
                });
            });

            console.log('✅ AI插图功能初始化完成');
        }

        // 显示AI插图模态框
        function showIllustrationModal() {
            console.log('用户点击AI插图按钮');

            // 检查编辑器是否已初始化
            if (!quill) {
                showError('编辑器未初始化，请刷新页面');
                return;
            }

            // 获取当前内容
            const currentContent = quill.getText().trim();
            const wordCount = currentContent.length;

            console.log('当前内容字数:', wordCount);

            // 字数检测：至少需要100字才能生成插图
            if (wordCount < 100) {
                showError('内容太少（少于100字），请先写一些内容再生成插图');
                return;
            }

            // 计算允许的插图数量（每1000字1张）
            const maxAllowedIllustrations = Math.floor(wordCount / 1000);

            if (maxAllowedIllustrations === 0) {
                showError(`内容字数不足1000字（当前${wordCount}字），暂时无法生成插图。建议至少写够1000字后再添加插图。`);
                return;
            }

            // 计算编辑器中已有的图片数量
            const currentIllustrationCount = countImagesInEditor();

            console.log('字数:', wordCount, '允许插图数:', maxAllowedIllustrations, '已有插图:', currentIllustrationCount);

            // 检查是否超出限制
            if (currentIllustrationCount >= maxAllowedIllustrations) {
                showError(`插图数量已达上限！当前${wordCount}字，最多可添加${maxAllowedIllustrations}张插图（每1000字1张），已有${currentIllustrationCount}张。请增加内容字数或删除现有插图。`);
                return;
            }

            // 显示提示信息
            const remainingIllustrations = maxAllowedIllustrations - currentIllustrationCount;
            document.getElementById('illustrationLimitInfo').innerHTML = `
                <i class="fas fa-info-circle"></i> 
                当前 <strong>${wordCount}字</strong>，
                最多可添加 <strong>${maxAllowedIllustrations}张</strong> 插图（每1000字1张），
                已有 <strong>${currentIllustrationCount}张</strong>，
                还可生成 <strong>${remainingIllustrations}张</strong>
            `;

            // 打开模态框
            illustrationModal.classList.add('active');
            document.getElementById('illustrationStyleSelector').style.display = 'block';
            document.getElementById('illustrationLimitInfo').style.display = 'block';
            document.getElementById('illustrationLoading').style.display = 'none';
            document.getElementById('illustrationResult').style.display = 'none';
            document.getElementById('illustrationError').style.display = 'none';
        }

        // 计算编辑器中已有的图片数量
        function countImagesInEditor() {
            if (!quill) return 0;
            
            const delta = quill.getContents();
            let imageCount = 0;
            
            delta.ops.forEach(op => {
                if (op.insert && typeof op.insert === 'object' && op.insert.image) {
                    imageCount++;
                }
            });
            
            console.log('编辑器中已有图片数量:', imageCount);
            return imageCount;
        }

        // 监听插图任务状态（WebSocket 优先，降级轮询兜底）
        let illustrationPollingInterval = null;
        
        function watchIllustrationTask(taskId) {
            console.log('开始监听插图任务:', taskId);
            
            const handleTaskUpdate = (data) => {
                if (data.taskId !== taskId) return;
                console.log('收到插图任务状态更新:', data.status);

                if (data.status === 'completed') {
                    // 任务完成
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);

                    // 获取图片URL
                    const imageUrl = data.result?.imageUrl;

                    if (imageUrl) {
                        console.log('✅ 插图生成完成:', imageUrl);
                        insertIllustrationToEditor(imageUrl);
                        closeIllustrationModalFunc();
                        showSuccess('🎨 精美插图已生成并插入编辑器！');
                    } else {
                        document.getElementById('illustrationLoading').style.display = 'none';
                        document.getElementById('illustrationError').style.display = 'block';
                        document.getElementById('illustrationErrorMessage').textContent = '未找到生成的图片';
                    }
                } else if (data.status === 'failed') {
                    // 任务失败
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                    
                    document.getElementById('illustrationLoading').style.display = 'none';
                    document.getElementById('illustrationError').style.display = 'block';
                    document.getElementById('illustrationErrorMessage').textContent = data.errorMessage || '插图生成失败';
                }
            };
            
            // 通过 WebSocket 监听
            StoryTreeWS.on('task:status', handleTaskUpdate);
            
            // 同时注册降级轮询任务
            StoryTreeWS.watchTask(taskId, handleTaskUpdate);
        }

        // 插入插图到编辑器
        function insertIllustrationToEditor(imageUrl) {
            console.log('插入插图到编辑器:', imageUrl);

            if (!quill) {
                showError('编辑器未初始化');
                return;
            }

            // 获取当前光标位置，如果没有光标则插入到末尾
            const selection = quill.getSelection();
            const cursorPosition = selection ? selection.index : quill.getLength();
            
            // 在光标位置插入图片
            quill.insertEmbed(cursorPosition, 'image', imageUrl, 'user');
            
            // 在图片后插入换行
            quill.insertText(cursorPosition + 1, '\n', 'user');
            
            // 移动光标到图片后
            quill.setSelection(cursorPosition + 2, 0);

            // 标记有未保存的更改
            hasUnsavedChanges = true;
            
            console.log('✅ 插图已插入编辑器');
        }

        // 开始生成插图
// 开始生成插图
        async function startGenerateIllustration() {
            console.log('开始生成 AI 插图，风格:', selectedIllustrationStyle);

            // 隐藏选择器，显示加载状态
            document.getElementById('illustrationStyleSelector').style.display = 'none';
            document.getElementById('illustrationLimitInfo').style.display = 'none';
            document.getElementById('illustrationLoading').style.display = 'block';
            document.getElementById('illustrationResult').style.display = 'none';
            document.getElementById('illustrationError').style.display = 'none';

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                // ========== 新增：检查是否需要使用积分 ==========
                try {
                    // 获取配额信息
                    const quotaResponse = await fetch('/api/ai/v2/quota', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (quotaResponse.ok) {
                        const quotaData = await quotaResponse.json();
                        const quotaInfo = quotaData.quota || quotaData.quotas;
                        const costs = quotaData.costs;

                        // 检查插图配额
                        if (quotaInfo && quotaInfo.illustration) {
                            const remaining = quotaInfo.illustration.unlimited ? -1 : 
                                Math.max(0, quotaInfo.illustration.limit - quotaInfo.illustration.used);

                            // 配额用完且需要消耗积分
                            if (remaining === 0 && costs && costs.illustration > 0) {
                                // 检查当前用户积分
                                const userPointsResponse = await fetch('/api/auth/me', {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });

                                if (userPointsResponse.ok) {
                                    const userData = await userPointsResponse.json();
                                    const userPoints = userData.user.points || 0;

                                    // 积分足够，弹窗确认
                                    if (userPoints >= costs.illustration) {
                                        const confirmed = await showPointsConfirmDialog(
                                            'AI 插图',
                                            costs.illustration,
                                            `本次操作将消耗 ${costs.illustration} 积分（您的积分余额：${userPoints}）`
                                        );

                                        if (!confirmed) {
                                            console.log('用户取消使用积分');
                                            // 恢复 UI 状态
                                            document.getElementById('illustrationStyleSelector').style.display = 'block';
                                            document.getElementById('illustrationLimitInfo').style.display = 'block';
                                            document.getElementById('illustrationLoading').style.display = 'none';
                                            return;
                                        }
                                    } else {
                                        showError('积分不足，无法使用 AI 插图功能');
                                        // 恢复 UI 状态
                                        document.getElementById('illustrationStyleSelector').style.display = 'block';
                                        document.getElementById('illustrationLimitInfo').style.display = 'block';
                                        document.getElementById('illustrationLoading').style.display = 'none';
                                        return;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('检查配额和积分失败:', error);
                    // 继续执行，不阻止用户操作
                }
                // ===============================================

                // 获取当前内容
                const currentContent = quill.getText().trim();
                const chapterTitle = document.getElementById('chapterTitle').value.trim() || '未命名章节';

                // 获取故事 ID（write 页面使用的是全局变量 storyId）
                if (!storyId) {
                    throw new Error('未找到故事 ID，请刷新页面');
                }

                // 检查是否已保存章节（有 nodeId）
                const nodeId = window.lastNodeId;
                
                if (!nodeId) {
                    showError('请先保存草稿后再生成插图');
                    throw new Error('章节未保存');
                }

                console.log('提交 AI 插图任务...');
                console.log('故事 ID:', storyId);
                console.log('章节 ID:', nodeId);
                console.log('章节标题:', chapterTitle);
                console.log('内容长度:', currentContent.length);
                console.log('插图风格:', selectedIllustrationStyle);

                const response = await fetch('/api/ai/v2/illustration/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        storyId: parseInt(storyId),
                        nodeId: parseInt(nodeId),
                        chapterTitle: chapterTitle,
                        chapterContent: currentContent,
                        style: selectedIllustrationStyle
                    })
                });

                console.log('插图 API 响应状态:', response.status);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API 错误 (${response.status})`);
                }

                const data = await response.json();
                console.log('插图 API 返回数据:', data);

                // 更新加载状态文本
                const loadingElement = document.getElementById('illustrationLoading');
                loadingElement.innerHTML = `
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;"></i>
                    <p style="font-size: 18px; color: #333; margin-bottom: 10px;">AI 正在绘制精美插图...</p>
                    <p style="font-size: 14px; color: #999;">图片生成中，请耐心等待</p>
                    <p style="font-size: 13px; color: #666; margin-top: 15px;">
                        <i class="fas fa-info-circle"></i> 你可以关闭窗口继续编辑，完成后会自动插入
                    </p>
                `;

                // 使用 WebSocket 监听任务状态（自动降级轮询）
                watchIllustrationTask(data.taskId);

            } catch (error) {
                console.error('AI 插图生成错误:', error);
                document.getElementById('illustrationLoading').style.display = 'none';
                document.getElementById('illustrationError').style.display = 'block';
                
                let errorMessage = error.message || 'AI 服务暂时不可用';
                
                if (error.message.includes('登录') || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用 AI 插图功能';
                } else if (error.message.includes('保存') || error.message.includes('草稿')) {
                    errorMessage = '请先点击"保存草稿"按钮保存章节，然后再生成插图';
                } else if (error.message.includes('字数') || error.message.includes('插图数量')) {
                    errorMessage = error.message; // 使用原始错误信息
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足，请充值或升级会员';
                } else if (error.message.includes('网络')) {
                    errorMessage = '网络连接失败，请检查网络';
                }
                
                document.getElementById('illustrationErrorMessage').textContent = errorMessage;
            }
        }

        // 关闭AI插图模态框
        function closeIllustrationModalFunc() {
            if (illustrationModal) {
                illustrationModal.classList.remove('active');
                console.log('关闭AI插图模态框');
                
                // 清理轮询定时器
                if (illustrationPollingInterval) {
                    clearInterval(illustrationPollingInterval);
                    illustrationPollingInterval = null;
                    console.log('✅ 已停止任务轮询');
                }
            }
        }

// ==================== 侧边栏功能（立项书/大纲） ====================

// 全局变量：权限和编辑状态
let isStoryAuthor = false;  // 当前用户是否是故事作者
let outlineVersions = [];    // 大纲版本列表
let currentOutlineVersion = null; // 当前激活的大纲版本号
let isEditingProjectBrief = false; // 是否在编辑立项书模式
let isEditingOutline = false;      // 是否在编辑大纲模式
let currentOutlineData = null;     // 当前大纲原始数据
let isNewOutlineVersion = false;   // 是否在新建大纲版本模式
let newOutlineChangeNote = '';     // 新建大纲版本的版本说明

// 侧边栏初始化
function initSidebar() {
    // 标签页切换
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchSidebarTab(tabName);
        });
    });

    // 切换侧边栏显示/隐藏
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }

    // 立项书编辑按钮
    const editProjectBtn = document.getElementById('editProjectBtn');
    if (editProjectBtn) {
        editProjectBtn.addEventListener('click', toggleProjectBriefEdit);
    }

    // 立项书取消编辑按钮
    const cancelProjectBriefBtn = document.getElementById('cancelProjectBriefBtn');
    if (cancelProjectBriefBtn) {
        cancelProjectBriefBtn.addEventListener('click', cancelProjectBriefEdit);
    }

    // 大纲版本切换
    const versionSelect = document.getElementById('outlineVersionSelect');
    if (versionSelect) {
        versionSelect.addEventListener('change', function() {
            const version = parseInt(this.value);
            // 编辑模式下不允许切换版本；忽略临时"新版本"选项
            if (isEditingOutline || this.value === 'new') {
                this.value = isNewOutlineVersion ? 'new' : currentOutlineVersion;
                if (isEditingOutline) {
                    if (window.toast) toast.warning('请先保存或取消编辑后再切换版本');
                    else alert('请先保存或取消编辑后再切换版本');
                }
                return;
            }
            if (version && version !== currentOutlineVersion) {
                activateOutlineVersion(version);
            }
        });
    }

    // 大纲编辑按钮
    const editOutlineBtn = document.getElementById('editOutlineBtn');
    if (editOutlineBtn) {
        editOutlineBtn.addEventListener('click', toggleOutlineEdit);
    }

    // 大纲取消编辑按钮
    const cancelOutlineEditBtn = document.getElementById('cancelOutlineEditBtn');
    if (cancelOutlineEditBtn) {
        cancelOutlineEditBtn.addEventListener('click', cancelOutlineEdit);
    }

    // 新建大纲版本按钮
    const newOutlineVersionBtn = document.getElementById('newOutlineVersionBtn');
    if (newOutlineVersionBtn) {
        newOutlineVersionBtn.addEventListener('click', createNewOutlineVersion);
    }
}

// 切换侧边栏标签页
function switchSidebarTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const activeTab = document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`);
    const activePanel = document.getElementById(`panel${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);

    if (activeTab) activeTab.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
}

// 切换侧边栏显示/隐藏
function toggleSidebar() {
    const sidebar = document.getElementById('writeSidebar');
    if (sidebar) {
        sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
    }
}

// 加载立项书
async function loadProjectBrief() {
    const contentEl = document.getElementById('projectBriefContent');
    if (!contentEl || !storyId) return;

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/ai/creation/stories/${storyId}/project-brief`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取立项书失败');
        }

        const data = await response.json();

        if (!data.projectBrief) {
            contentEl.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fas fa-file-alt"></i>
                    <p>暂无立项书</p>
                    <p style="font-size: 12px; margin-top: 10px; color: var(--st-text-tertiary);">
                        使用 AI 辅助创作功能可生成立项书
                    </p>
                </div>
            `;
            return;
        }

        const brief = data.projectBrief;
        contentEl.innerHTML = `
            <div class="panel-section">
                <div class="panel-section-title">故事标题</div>
                <div class="panel-section-content">${brief.title || '未指定'}</div>
            </div>
            <div class="panel-section">
                <div class="panel-section-title">故事梗概</div>
                <div class="panel-section-content">${brief.synopsis || '暂无内容'}</div>
            </div>
            <div class="panel-section">
                <div class="panel-section-title">核心创意</div>
                <div class="panel-section-content">${brief.coreIdea || '暂无内容'}</div>
            </div>
            ${brief.targetAudience ? `
            <div class="panel-section">
                <div class="panel-section-title">目标读者</div>
                <div class="panel-section-content">${brief.targetAudience}</div>
            </div>
            ` : ''}
            ${brief.genre ? `
            <div class="panel-section">
                <div class="panel-section-title">类型标签</div>
                <div class="panel-section-content">${brief.genre}</div>
            </div>
            ` : ''}
            ${brief.writingStyle ? `
            <div class="panel-section">
                <div class="panel-section-title">期望文风</div>
                <div class="panel-section-content">${brief.writingStyle}</div>
            </div>
            ` : ''}
            ${brief.highlights && brief.highlights.length > 0 ? `
            <div class="panel-section">
                <div class="panel-section-title">作品亮点</div>
                <div class="panel-section-content">
                    <ul style="padding-left: 20px; margin: 0;">
                        ${brief.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('加载立项书失败:', error);
        contentEl.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>加载失败</p>
            </div>
        `;
    }
}

// 加载大纲
async function loadOutline() {
    const contentEl = document.getElementById('outlineContent');
    if (!contentEl || !storyId) return;

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        // 获取当前大纲
        const response = await fetch(`/api/ai/creation/stories/${storyId}/outlines/active`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取大纲失败');
        }

        const data = await response.json();

        if (!data.outline) {
            contentEl.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fas fa-list-ol"></i>
                    <p>暂无大纲</p>
                    <p style="font-size: 12px; margin-top: 10px; color: var(--st-text-tertiary);">
                        使用 AI 辅助创作功能可生成大纲
                    </p>
                </div>
            `;
            return;
        }

        const outline = data.outline;
        currentOutlineVersion = outline.version || 1;
        currentOutlineData = outline; // 保存原始数据用于编辑
        renderOutline(outline);

        // 显示编辑和新建版本按钮（仅主创和协作者可编辑）
        const editOutlineBtn = document.getElementById('editOutlineBtn');
        const newOutlineVersionBtn = document.getElementById('newOutlineVersionBtn');
        if (editOutlineBtn) editOutlineBtn.style.display = isStoryAuthor ? 'inline-flex' : 'none';
        if (newOutlineVersionBtn) newOutlineVersionBtn.style.display = isStoryAuthor ? 'inline-flex' : 'none';

        // 检查协作者身份，协作者也可以编辑大纲
        try {
            const roleResponse = await fetch(`/api/stories/${storyId}/role`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (roleResponse.ok) {
                const roleData = await roleResponse.json();
                if (roleData.is_collaborator) {
                    if (editOutlineBtn) editOutlineBtn.style.display = 'inline-flex';
                    if (newOutlineVersionBtn) newOutlineVersionBtn.style.display = 'inline-flex';
                }
            }
        } catch (e) { /* 忽略权限检查失败 */ }

        // 加载版本列表
        loadOutlineVersions();
    } catch (error) {
        console.error('加载大纲失败:', error);
        contentEl.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>加载失败</p>
            </div>
        `;
    }
}

// 渲染大纲内容
function renderOutline(outline) {
    const contentEl = document.getElementById('outlineContent');
    if (!contentEl) return;

    contentEl.innerHTML = `
        ${outline.worldBuilding ? `
        <div class="panel-section">
            <div class="panel-section-title">世界观设定</div>
            <div class="panel-section-content">${outline.worldBuilding}</div>
        </div>
        ` : ''}
        ${outline.characters && outline.characters.length > 0 ? `
        <div class="panel-section">
            <div class="panel-section-title">主要角色</div>
            ${outline.characters.map(c => `
                <div style="margin-bottom: 15px; padding: 10px; background: var(--st-bg-secondary); border-radius: 8px;">
                    <strong>${escapeHtml(c.name)}</strong>
                    <span style="margin-left: 10px; padding: 2px 6px; background: var(--st-primary-100); color: var(--st-primary-700); border-radius: 4px; font-size: 11px;">
                        ${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'love_interest' ? '感情线' : '配角'}
                    </span>
                    <p style="margin-top: 5px; font-size: 13px; color: var(--st-text-secondary);">${escapeHtml(c.description || '')}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}
        ${outline.plotStructure ? `
        <div class="panel-section">
            <div class="panel-section-title">故事结构</div>
            ${outline.plotStructure.act1 ? `<div style="margin-bottom: 10px;"><strong style="font-size: 12px; color: var(--st-primary-600);">第一幕</strong><p style="font-size: 13px; color: var(--st-text-secondary); margin-top: 4px;">${escapeHtml(outline.plotStructure.act1)}</p></div>` : ''}
            ${outline.plotStructure.act2 ? `<div style="margin-bottom: 10px;"><strong style="font-size: 12px; color: var(--st-primary-600);">第二幕</strong><p style="font-size: 13px; color: var(--st-text-secondary); margin-top: 4px;">${escapeHtml(outline.plotStructure.act2)}</p></div>` : ''}
            ${outline.plotStructure.act3 ? `<div style="margin-bottom: 10px;"><strong style="font-size: 12px; color: var(--st-primary-600);">第三幕</strong><p style="font-size: 13px; color: var(--st-text-secondary); margin-top: 4px;">${escapeHtml(outline.plotStructure.act3)}</p></div>` : ''}
        </div>
        ` : ''}
        ${outline.chapterOutlines && outline.chapterOutlines.length > 0 ? `
        <div class="panel-section">
            <div class="panel-section-title">章节大纲（${outline.chapterOutlines.length} 章）</div>
            ${outline.chapterOutlines.map(c => `
                <div style="margin-bottom: 10px; padding: 10px; background: var(--st-bg-secondary); border-radius: 8px;">
                    <strong>第${c.chapter || '0'}章：${escapeHtml(c.title || '无题')}</strong>
                    <p style="margin-top: 5px; font-size: 13px; color: var(--st-text-secondary);">${escapeHtml(c.summary || '暂无内容')}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}
        ${outline.changeNote ? `
        <div style="margin-top: 12px; padding: 8px 12px; background: var(--st-bg-secondary); border-radius: 6px; font-size: 12px; color: var(--st-text-tertiary);">
            <i class="fas fa-info-circle"></i> 版本说明：${escapeHtml(outline.changeNote)}
        </div>
        ` : ''}
    `;
}

// 加载大纲版本列表
async function loadOutlineVersions() {
    if (!storyId) return;
    const versionSelect = document.getElementById('outlineVersionSelect');
    if (!versionSelect) return;

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/ai/creation/stories/${storyId}/outlines`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        outlineVersions = data.outlines || [];

        // 更新下拉选项
        versionSelect.innerHTML = '';
        if (outlineVersions.length === 0) {
            versionSelect.innerHTML = '<option value="current">当前版本</option>';
            return;
        }

        outlineVersions.forEach(v => {
            const option = document.createElement('option');
            option.value = v.version;
            const date = new Date(v.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            option.textContent = `v${v.version}${v.isActive ? ' (当前)' : ''} - ${v.changeNote || date}`;
            if (v.isActive) option.selected = true;
            versionSelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载大纲版本列表失败:', error);
    }
}

// 激活指定版本的大纲
async function activateOutlineVersion(version) {
    if (!storyId) return;
    const contentEl = document.getElementById('outlineContent');
    
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        // 调用激活 API（仅作者可以激活，协作者也可以）
        const response = await fetch(`/api/ai/creation/stories/${storyId}/outlines/${version}/activate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '激活版本失败');
        }

        // 重新加载大纲
        if (contentEl) {
            contentEl.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>切换版本中...</span></div>';
        }
        await loadOutline();

        if (window.toast) {
            toast.success('已切换到 v' + version);
        }
    } catch (error) {
        console.error('激活大纲版本失败:', error);
        if (window.toast) {
            toast.error(error.message || '切换版本失败');
        } else {
            alert(error.message || '切换版本失败');
        }
        // 恢复下拉选项
        const versionSelect = document.getElementById('outlineVersionSelect');
        if (versionSelect) {
            versionSelect.value = currentOutlineVersion;
        }
    }
}

// 切换立项书编辑/查看模式
function toggleProjectBriefEdit() {
    if (!isStoryAuthor) {
        alert('只有故事作者可以编辑立项书');
        return;
    }

    isEditingProjectBrief = !isEditingProjectBrief;
    const editBtn = document.getElementById('editProjectBtn');
    const cancelBtn = document.getElementById('cancelProjectBriefBtn');

    if (isEditingProjectBrief) {
        // 进入编辑模式
        if (editBtn) editBtn.innerHTML = '<i class="fas fa-check"></i>';
        if (editBtn) editBtn.title = '保存立项书';
        if (cancelBtn) cancelBtn.style.display = '';
        renderEditableProjectBrief();
    } else {
        // 保存并退出编辑模式
        if (editBtn) editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        if (editBtn) editBtn.title = '编辑立项书';
        if (cancelBtn) cancelBtn.style.display = 'none';
        saveProjectBrief();
    }
}

// 取消立项书编辑
function cancelProjectBriefEdit() {
    isEditingProjectBrief = false;
    const editBtn = document.getElementById('editProjectBtn');
    const cancelBtn = document.getElementById('cancelProjectBriefBtn');
    if (editBtn) editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    if (editBtn) editBtn.title = '编辑立项书';
    if (cancelBtn) cancelBtn.style.display = 'none';
    // 重新加载显示模式（丢弃修改）
    loadProjectBrief();
}

// 渲染可编辑的立项书
async function renderEditableProjectBrief() {
    const contentEl = document.getElementById('projectBriefContent');
    if (!contentEl || !storyId) return;

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/ai/creation/stories/${storyId}/project-brief`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('获取立项书失败');
        const data = await response.json();

        if (!data.projectBrief) {
            contentEl.innerHTML = '<div class="loading-placeholder"><i class="fas fa-file-alt"></i><p>暂无立项书</p></div>';
            isEditingProjectBrief = false;
            return;
        }

        const brief = data.projectBrief;
        contentEl.innerHTML = `
            <div class="panel-section">
                <div class="panel-section-title">故事标题</div>
                <input type="text" id="editBriefTitle" class="edit-brief-input" value="${escapeHtml(brief.title || '')}" placeholder="输入故事标题" />
            </div>
            <div class="panel-section">
                <div class="panel-section-title">故事梗概</div>
                <textarea id="editBriefSynopsis" class="edit-brief-textarea" placeholder="输入故事梗概">${escapeHtml(brief.synopsis || '')}</textarea>
            </div>
            <div class="panel-section">
                <div class="panel-section-title">核心创意</div>
                <textarea id="editBriefCoreIdea" class="edit-brief-textarea" placeholder="输入核心创意">${escapeHtml(brief.coreIdea || '')}</textarea>
            </div>
            <div class="panel-section">
                <div class="panel-section-title">目标读者</div>
                <input type="text" id="editBriefTargetAudience" class="edit-brief-input" value="${escapeHtml(brief.targetAudience || '')}" placeholder="目标读者（可选）" />
            </div>
            <div class="panel-section">
                <div class="panel-section-title">类型标签</div>
                <input type="text" id="editBriefGenre" class="edit-brief-input" value="${escapeHtml(brief.genre || '')}" placeholder="类型标签（可选）" />
            </div>
            <div class="panel-section">
                <div class="panel-section-title">期望文风</div>
                <input type="text" id="editBriefWritingStyle" class="edit-brief-input" value="${escapeHtml(brief.writingStyle || '')}" placeholder="期望文风（可选）" />
            </div>
            <div style="margin-top: 12px; padding: 8px 12px; background: var(--st-primary-50); border-radius: 6px; font-size: 12px; color: var(--st-primary-700);">
                <i class="fas fa-info-circle"></i> 点击右上角 ✓ 保存修改
            </div>
        `;
    } catch (error) {
        console.error('加载立项书失败:', error);
        contentEl.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>';
        isEditingProjectBrief = false;
    }
}

// 保存立项书修改
async function saveProjectBrief() {
    if (!storyId) return;

    const title = document.getElementById('editBriefTitle')?.value?.trim();
    const synopsis = document.getElementById('editBriefSynopsis')?.value?.trim();
    const coreIdea = document.getElementById('editBriefCoreIdea')?.value?.trim();
    const targetAudience = document.getElementById('editBriefTargetAudience')?.value?.trim();
    const genre = document.getElementById('editBriefGenre')?.value?.trim();
    const writingStyle = document.getElementById('editBriefWritingStyle')?.value?.trim();

    const projectBrief = { title, synopsis, coreIdea, targetAudience, genre, writingStyle };

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/ai/creation/stories/${storyId}/project-brief`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ projectBrief })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '保存失败');
        }

        if (window.toast) {
            toast.success('立项书已保存');
        }
    } catch (error) {
        console.error('保存立项书失败:', error);
        if (window.toast) {
            toast.error(error.message || '保存立项书失败');
        } else {
            alert(error.message || '保存立项书失败');
        }
    }

    // 重新加载显示模式
    await loadProjectBrief();
}

// escapeHtml 已由 auth.js 全局提供

// 切换大纲编辑/查看模式
function toggleOutlineEdit() {
    isEditingOutline = !isEditingOutline;
    const editBtn = document.getElementById('editOutlineBtn');
    const cancelBtn = document.getElementById('cancelOutlineEditBtn');
    const newVersionBtn = document.getElementById('newOutlineVersionBtn');

    if (isEditingOutline) {
        // 进入编辑模式（编辑当前版本）
        isNewOutlineVersion = false;
        newOutlineChangeNote = '';
        if (editBtn) editBtn.innerHTML = '<i class="fas fa-check"></i>';
        if (editBtn) editBtn.title = '保存大纲';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (newVersionBtn) newVersionBtn.style.display = 'none';
        renderEditableOutline();
    } else {
        if (editBtn) editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        if (editBtn) editBtn.title = '编辑大纲';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (newVersionBtn) newVersionBtn.style.display = '';
        saveOutlineEdit();
    }
}

// 取消大纲编辑（丢弃修改，恢复原始数据）
function cancelOutlineEdit() {
    isEditingOutline = false;
    isNewOutlineVersion = false;
    newOutlineChangeNote = '';
    const editBtn = document.getElementById('editOutlineBtn');
    const cancelBtn = document.getElementById('cancelOutlineEditBtn');
    const newVersionBtn = document.getElementById('newOutlineVersionBtn');
    if (editBtn) editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    if (editBtn) editBtn.title = '编辑大纲';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (newVersionBtn) newVersionBtn.style.display = '';
    // 移除临时"新版本"选项
    const versionSelect = document.getElementById('outlineVersionSelect');
    if (versionSelect) {
        const newOption = versionSelect.querySelector('option[value="new"]');
        if (newOption) newOption.remove();
    }
    // 恢复原始数据显示
    if (currentOutlineData) {
        renderOutline(currentOutlineData);
    }
}

// 渲染可编辑的大纲
function renderEditableOutline() {
    const contentEl = document.getElementById('outlineContent');
    if (!contentEl || !currentOutlineData) return;

    const outline = currentOutlineData;

    contentEl.innerHTML = `
        ${outline.worldBuilding !== undefined ? `
        <div class="panel-section">
            <div class="panel-section-title">世界观设定</div>
            <textarea id="editOutlineWorldBuilding" class="edit-brief-textarea" placeholder="描述世界观设定">${escapeHtml(outline.worldBuilding || '')}</textarea>
        </div>
        ` : ''}
        ${outline.characters && outline.characters.length > 0 ? `
        <div class="panel-section">
            <div class="panel-section-title">主要角色</div>
            ${outline.characters.map((c, i) => `
                <div style="margin-bottom: 12px; padding: 10px; background: var(--st-bg-secondary); border-radius: 8px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
                        <input type="text" id="editCharName_${i}" class="edit-brief-input" value="${escapeHtml(c.name || '')}" placeholder="角色名" style="flex: 1; min-width: 80px;" />
                        <select id="editCharRole_${i}" class="edit-brief-input" style="width: 100px; max-width: 100%;">
                            <option value="protagonist" ${c.role === 'protagonist' ? 'selected' : ''}>主角</option>
                            <option value="antagonist" ${c.role === 'antagonist' ? 'selected' : ''}>反派</option>
                            <option value="love_interest" ${c.role === 'love_interest' ? 'selected' : ''}>感情线</option>
                            <option value="supporting" ${c.role === 'supporting' ? 'selected' : ''}>配角</option>
                        </select>
                    </div>
                    <textarea id="editCharDesc_${i}" class="edit-brief-textarea" placeholder="角色描述" style="min-height: 60px;">${escapeHtml(c.description || '')}</textarea>
                </div>
            `).join('')}
        </div>
        ` : ''}
        ${outline.plotStructure ? `
        <div class="panel-section">
            <div class="panel-section-title">故事结构</div>
            ${outline.plotStructure.act1 !== undefined ? `
            <div style="margin-bottom: 10px;">
                <strong style="font-size: 12px; color: var(--st-primary-600);">第一幕</strong>
                <textarea id="editPlotAct1" class="edit-brief-textarea" style="min-height: 60px; margin-top: 4px;">${escapeHtml(outline.plotStructure.act1 || '')}</textarea>
            </div>` : ''}
            ${outline.plotStructure.act2 !== undefined ? `
            <div style="margin-bottom: 10px;">
                <strong style="font-size: 12px; color: var(--st-primary-600);">第二幕</strong>
                <textarea id="editPlotAct2" class="edit-brief-textarea" style="min-height: 60px; margin-top: 4px;">${escapeHtml(outline.plotStructure.act2 || '')}</textarea>
            </div>` : ''}
            ${outline.plotStructure.act3 !== undefined ? `
            <div style="margin-bottom: 10px;">
                <strong style="font-size: 12px; color: var(--st-primary-600);">第三幕</strong>
                <textarea id="editPlotAct3" class="edit-brief-textarea" style="min-height: 60px; margin-top: 4px;">${escapeHtml(outline.plotStructure.act3 || '')}</textarea>
            </div>` : ''}
        </div>
        ` : ''}
        ${outline.chapterOutlines && outline.chapterOutlines.length > 0 ? `
        <div class="panel-section">
            <div class="panel-section-title">章节大纲（${outline.chapterOutlines.length} 章）</div>
            ${outline.chapterOutlines.map((c, i) => `
                <div style="margin-bottom: 10px; padding: 10px; background: var(--st-bg-secondary); border-radius: 8px;">
                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; color: var(--st-text-tertiary); white-space: nowrap;">第${c.chapter || (i+1)}章</span>
                        <input type="text" id="editChapterTitle_${i}" class="edit-brief-input" value="${escapeHtml(c.title || '')}" placeholder="章节标题" style="flex: 1;" />
                    </div>
                    <textarea id="editChapterSummary_${i}" class="edit-brief-textarea" placeholder="章节摘要" style="min-height: 50px;">${escapeHtml(c.summary || '')}</textarea>
                </div>
            `).join('')}
        </div>
        ` : ''}
        <div style="margin-top: 12px; padding: 8px 12px; background: var(--st-primary-50); border-radius: 6px; font-size: 12px; color: var(--st-primary-700);">
            <i class="fas fa-info-circle"></i> ${isNewOutlineVersion ? '修改内容后点击右上角 ✓ 保存为新版本（' + escapeHtml(newOutlineChangeNote) + '）' : '点击右上角 ✓ 保存修改'}
        </div>
    `;
}

// 保存大纲编辑
async function saveOutlineEdit() {
    if (!storyId || !currentOutlineData) return;

    const outline = { ...currentOutlineData };

    // 收集编辑后的值
    const worldBuildingEl = document.getElementById('editOutlineWorldBuilding');
    if (worldBuildingEl) outline.worldBuilding = worldBuildingEl.value.trim();

    const act1El = document.getElementById('editPlotAct1');
    if (act1El && outline.plotStructure) outline.plotStructure.act1 = act1El.value.trim();
    const act2El = document.getElementById('editPlotAct2');
    if (act2El && outline.plotStructure) outline.plotStructure.act2 = act2El.value.trim();
    const act3El = document.getElementById('editPlotAct3');
    if (act3El && outline.plotStructure) outline.plotStructure.act3 = act3El.value.trim();

    // 收集角色编辑
    if (outline.characters) {
        outline.characters = outline.characters.map((c, i) => {
            const nameEl = document.getElementById(`editCharName_${i}`);
            const roleEl = document.getElementById(`editCharRole_${i}`);
            const descEl = document.getElementById(`editCharDesc_${i}`);
            return {
                ...c,
                name: nameEl ? nameEl.value.trim() : c.name,
                role: roleEl ? roleEl.value : c.role,
                description: descEl ? descEl.value.trim() : c.description
            };
        });
    }

    // 收集章节编辑
    if (outline.chapterOutlines) {
        outline.chapterOutlines = outline.chapterOutlines.map((c, i) => {
            const titleEl = document.getElementById(`editChapterTitle_${i}`);
            const summaryEl = document.getElementById(`editChapterSummary_${i}`);
            return {
                ...c,
                title: titleEl ? titleEl.value.trim() : c.title,
                summary: summaryEl ? summaryEl.value.trim() : c.summary
            };
        });
    }

    // 重置新建版本状态（在异步操作前保存，避免后续状态混乱）
    const wasNewVersion = isNewOutlineVersion;
    const savedChangeNote = newOutlineChangeNote;
    isNewOutlineVersion = false;
    newOutlineChangeNote = '';

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        if (wasNewVersion) {
            // 新建版本模式：POST 创建新版本
            const response = await fetch(`/api/ai/creation/stories/${storyId}/outlines`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    outline,
                    changeNote: savedChangeNote || '手动创建新版本'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '创建新版本失败');
            }

            const data = await response.json();

            if (window.toast) {
                toast.success('新版本 v' + (data.version || '?') + ' 已创建');
            }

            // 重新加载大纲和版本列表
            await loadOutline();
        } else {
            // 编辑当前版本模式：PUT 更新当前版本
            const version = currentOutlineVersion || 1;
            const response = await fetch(`/api/ai/creation/stories/${storyId}/outlines/${version}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    outline,
                    changeNote: '手动编辑'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '保存失败');
            }

            if (window.toast) {
                toast.success('大纲已保存');
            }

            // 重新渲染当前大纲
            currentOutlineData = outline;
            renderOutline(outline);
        }
    } catch (error) {
        console.error('保存大纲失败:', error);
        if (window.toast) {
            toast.error(error.message || '保存大纲失败');
        } else {
            alert(error.message || '保存大纲失败');
        }
        // 保存失败时恢复编辑模式数据
        if (wasNewVersion) {
            currentOutlineData = outline;
            renderOutline(outline);
        }
    }

    // 恢复编辑按钮状态
    const editBtn = document.getElementById('editOutlineBtn');
    const cancelBtn = document.getElementById('cancelOutlineEditBtn');
    const newVersionBtn = document.getElementById('newOutlineVersionBtn');
    if (editBtn) editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    if (editBtn) editBtn.title = '编辑大纲';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (newVersionBtn) newVersionBtn.style.display = '';
}

// 创建新的大纲版本
async function createNewOutlineVersion() {
    if (!storyId) return;
    if (!currentOutlineData) {
        if (window.toast) {
            toast.error('没有可编辑的大纲内容');
        } else {
            alert('没有可编辑的大纲内容');
        }
        return;
    }

    const changeNote = prompt('请输入新版本的说明（可选）：', '');
    if (changeNote === null) return; // 用户取消

    // 记录新建版本信息和版本说明，进入编辑模式
    isNewOutlineVersion = true;
    newOutlineChangeNote = changeNote || '手动创建新版本';

    // 如果已在编辑模式，先退出（不保存），再重新进入
    if (isEditingOutline) {
        isEditingOutline = false;
    }

    // 进入编辑模式
    isEditingOutline = true;
    const editBtn = document.getElementById('editOutlineBtn');
    const cancelBtn = document.getElementById('cancelOutlineEditBtn');
    const newVersionBtn = document.getElementById('newOutlineVersionBtn');
    if (editBtn) editBtn.innerHTML = '<i class="fas fa-check"></i>';
    if (editBtn) editBtn.title = '保存新版本';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (newVersionBtn) newVersionBtn.style.display = 'none';

    // 更新下拉栏：添加临时新版本选项并选中
    const versionSelect = document.getElementById('outlineVersionSelect');
    if (versionSelect) {
        const newOption = document.createElement('option');
        newOption.value = 'new';
        newOption.textContent = '新版本 - ' + (changeNote || '手动创建新版本');
        newOption.selected = true;
        // 取消其他选项的选中状态
        Array.from(versionSelect.options).forEach(opt => opt.selected = false);
        versionSelect.appendChild(newOption);
    }

    renderEditableOutline();
}
