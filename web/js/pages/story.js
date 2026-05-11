        // 页面初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化 WebSocket 连接
            StoryTreeWS.connect();
            
            loadStoryDetail();

            // 分享按钮
            document.getElementById('shareBtn')?.addEventListener('click', function() {
                if (window.currentStory) {
                    shareManager.showSharePanel({
                        storyId: window.currentStory.id,
                        title: window.currentStory.title,
                        description: window.currentStory.description,
                        image: window.currentStory.coverImage
                    });
                }
            });

            // 标签页切换
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const tabId = this.dataset.tab;
                    
                    // 切换按钮状态
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    // 切换内容
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById(tabId + 'Tab').classList.add('active');
                    
                    // 如果切换到分支图标签，初始化树状图
                    if (tabId === 'tree' && window.treeData) {
                        setTimeout(() => {
                            initTreeChart();
                        }, 100);
                    }
                    
                    // 如果切换到统计分析标签，初始化统计图表
                    if (tabId === 'stats' && window.treeStats) {
                        setTimeout(() => {
                            initStatsChart();
                        }, 100);
                    }
                });
            });
        });

        // 加载故事详情
        async function loadStoryDetail() {
            const urlParams = new URLSearchParams(window.location.search);
            const storyId = urlParams.get('id');
            const nodeId = urlParams.get('node');

            // 如果有 node 参数，说明要跳转到特定章节（如评论通知）
            if (nodeId) {
                const hash = window.location.hash || '';
                window.location.href = `/chapter.html?id=${nodeId}${hash}`;
                return;
            }

            console.log('开始加载故事，ID:', storyId);

            if (!storyId) {
                showError('故事ID不存在');
                window.location.href = '/discover.html';
                return;
            }

            try {
                // 获取token（如果已登录）
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                // 加载故事信息
                console.log('正在请求API...');
                const response = await fetch(`/api/stories/${storyId}`, { headers });
                console.log('API响应状态:', response.status);
                
                if (!response.ok) {
                    throw new Error('加载故事失败');
                }

                const data = await response.json();
                console.log('API返回数据:', data);
                
                const story = data.story || data; // 兼容两种返回格式
                const nodes = data.nodes || []; // 获取章节列表
                
                console.log('解析后的story:', story);
                console.log('解析后的nodes:', nodes);
                
                renderStory(story);
                renderChapters(nodes);
                
                // 加载树状图数据
                await loadTreeData(storyId);
                
                // 隐藏加载状态，显示内容
                console.log('准备显示内容...');
                document.getElementById('loadingState').style.display = 'none';
                document.getElementById('storyContent').style.display = 'block';
                console.log('内容已显示');
                
                // 初始化树状图（默认在分支图标签页）
                // 使用 setTimeout 确保容器已经渲染完成
                if (window.treeData) {
                    setTimeout(() => {
                        initTreeChart();
                    }, 100);
                }

                // 排序按钮
                document.querySelectorAll('.sort-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        const sortOrder = this.dataset.sort;
                        const sortedChapters = sortOrder === 'asc' ? nodes : [...nodes].reverse();
                        renderChapters(sortedChapters);
                    });
                });

            } catch (error) {
                console.error('加载故事错误:', error);
                console.error('错误堆栈:', error.stack);
                showError('加载失败，请稍后重试');
                
                // 即使出错也隐藏加载状态
                document.getElementById('loadingState').style.display = 'none';
            }
        }

        // 渲染故事信息
        function renderStory(story) {
            try {
                console.log('开始渲染故事信息...');
                console.log('原始story数据:', story);
                
                // 字段名转换：后端使用下划线命名，前端统一使用驼峰命名
                if (story.cover_image && !story.coverImage) {
                    story.coverImage = story.cover_image;
                }
                if (story.author_id && !story.authorId) {
                    story.authorId = story.author_id;
                }
                if (story.created_at && !story.createdAt) {
                    story.createdAt = story.created_at;
                }
                
                console.log('转换后story数据:', story);
                
                // 保存故事数据到全局变量
                window.currentStory = story;
                
                document.getElementById('storyTitle').textContent = story.title || '未命名故事';
                // 更新导航栏面包屑中的故事名
                const navStoryTitle = document.getElementById('navStoryTitle');
                if (navStoryTitle) navStoryTitle.textContent = story.title || '故事详情';
                document.getElementById('storyAuthor').textContent = story.author?.username || '未知作者';
                
                // 安全处理日期
                try {
                    const date = new Date(story.createdAt);
                    document.getElementById('storyDate').textContent = date.toLocaleDateString('zh-CN');
                } catch (e) {
                    console.error('日期格式错误:', e);
                    document.getElementById('storyDate').textContent = '未知时间';
                }
                
                document.getElementById('storyGenre').textContent = story.genre || '未分类';
                document.getElementById('storyDescription').textContent = story.description || '暂无简介';
                
                // 统计数据
                document.getElementById('viewCount').textContent = story.views || 0;
                document.getElementById('chapterCount').textContent = story.nodeCount || 0;
                document.getElementById('wordCount').textContent = calculateWordCount(story);

                // 封面图片
                if (story.coverImage) {
                    document.getElementById('storyCover').src = story.coverImage;
                }

                // 作者信息
                if (story.author) {
                    document.getElementById('authorName').textContent = story.author.username;
                    if (story.author.avatar) {
                        document.getElementById('authorAvatar').src = story.author.avatar;
                    }
                    
                    // 加载作者统计信息
                    loadAuthorStats(story.author.id);
                    
                    // 初始化关注作者按钮
                    initFollowAuthorButton(story.author.id);
                }

                // 检查是否是作者，显示编辑按钮
                checkIfAuthor(story);

                // 开始阅读按钮
                const startReadBtn = document.getElementById('startReadBtn');
                // 移除旧的事件监听器
                const newStartReadBtn = startReadBtn.cloneNode(true);
                startReadBtn.parentNode.replaceChild(newStartReadBtn, startReadBtn);
                
                newStartReadBtn.addEventListener('click', () => {
                    // 优先从已加载的章节列表中取第一章（parent_id 为 null 的根章节）
                    const storyData = window.currentStory;
                    if (storyData && storyData.nodes && storyData.nodes.length > 0) {
                        // 找根章节（parent_id 为 null）
                        const rootChapter = storyData.nodes.find(n => !n.parent_id) || storyData.nodes[0];
                        window.location.href = `/chapter?id=${rootChapter.id}`;
                    } else {
                        // 降级：点击章节列表中的第一项
                        const firstChapter = document.querySelector('.chapter-item');
                        if (firstChapter) {
                            firstChapter.click();
                        } else {
                            showError('还没有章节可以阅读');
                        }
                    }
                });
                
                console.log('故事信息渲染完成');
            } catch (error) {
                console.error('渲染故事信息时出错:', error);
                console.error('错误堆栈:', error.stack);
                throw error; // 重新抛出错误以便外层捕获
            }
        }

        // 加载作者统计信息
        async function loadAuthorStats(authorId) {
            try {
                console.log('🔄 开始加载作者统计信息, authorId:', authorId);
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                // 获取作者信息
                const response = await fetch(`/api/users/${authorId}`, { headers });
                console.log('📡 API响应状态:', response.status);
                
                if (!response.ok) {
                    console.error('❌ API请求失败:', response.status);
                    return;
                }

                const data = await response.json();
                console.log('📦 API返回数据:', data);
                const user = data.user;

                // 更新作者统计信息
                if (user._count) {
                    const storiesCount = user._count.authored_stories || 0;
                    const followersCount = user._count.followers || 0;
                    
                    console.log('📊 作者统计:', {
                        作品数: storiesCount,
                        关注者数: followersCount
                    });
                    
                    document.getElementById('authorStories').textContent = storiesCount;
                    document.getElementById('authorFollowers').textContent = followersCount;
                    
                    console.log('✅ 作者统计信息更新完成');
                } else {
                    console.warn('⚠️ API返回数据中没有_count字段');
                }
            } catch (error) {
                console.error('❌ 加载作者统计信息失败:', error);
            }
        }

        // 初始化关注作者按钮
        async function initFollowAuthorButton(authorId) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const followBtn = document.getElementById('followBtn');
            
            if (!token) {
                // 未登录用户
                followBtn.addEventListener('click', () => {
                    showError('请先登录');
                    setTimeout(() => window.location.href = '/login.html', 1500);
                });
                return;
            }

            try {
                // 检查当前用户
                const meResponse = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!meResponse.ok) return;

                const userData = await meResponse.json();
                const currentUserId = userData.user.id;

                // 如果是作者本人，隐藏关注按钮
                if (currentUserId === authorId) {
                    followBtn.style.display = 'none';
                    return;
                }

                // 检查是否已关注作者
                const userResponse = await fetch(`/api/users/${authorId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (userResponse.ok) {
                    const userInfo = await userResponse.json();
                    updateFollowAuthorButton(userInfo.user.isFollowing, authorId);
                }
            } catch (error) {
                console.error('初始化关注按钮失败:', error);
            }
        }

        // 更新关注作者按钮状态
        function updateFollowAuthorButton(isFollowing, authorId) {
            const followBtn = document.getElementById('followBtn');
            
            if (isFollowing) {
                followBtn.innerHTML = '<i class="fas fa-check"></i> 已关注';
                followBtn.style.background = 'var(--st-primary-500)';
                followBtn.style.color = 'white';
            } else {
                followBtn.innerHTML = '<i class="fas fa-plus"></i> 关注';
                followBtn.style.background = '';
                followBtn.style.color = '';
            }

            // 移除旧的事件监听器
            const newFollowBtn = followBtn.cloneNode(true);
            followBtn.parentNode.replaceChild(newFollowBtn, followBtn);

            // 添加新的事件监听器
            newFollowBtn.addEventListener('click', () => toggleFollowAuthor(authorId));
        }

        // 切换关注作者状态
        async function toggleFollowAuthor(authorId) {
            console.log('🎯 toggleFollowAuthor 被调用, authorId:', authorId);
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                setTimeout(() => window.location.href = '/login.html', 1500);
                return;
            }

            const followBtn = document.getElementById('followBtn');
            const isFollowing = followBtn.innerHTML.includes('已关注');
            console.log('📌 当前关注状态:', isFollowing ? '已关注' : '未关注');
            followBtn.disabled = true;

            try {
                if (isFollowing) {
                    // 取消关注
                    console.log('📤 发送取消关注请求...');
                    const response = await fetch(`/api/users/${authorId}/follow`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('取消关注失败');

                    followBtn.innerHTML = '<i class="fas fa-plus"></i> 关注';
                    followBtn.style.background = '';
                    followBtn.style.color = '';
                    showSuccess('已取消关注');
                    console.log('✅ 取消关注成功');
                } else {
                    // 关注
                    console.log('📤 发送关注请求...');
                    const response = await fetch(`/api/users/${authorId}/follow`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || '关注失败');
                    }

                    followBtn.innerHTML = '<i class="fas fa-check"></i> 已关注';
                    followBtn.style.background = 'var(--st-primary-500)';
                    followBtn.style.color = 'white';
                    showSuccess('关注成功');
                    console.log('✅ 关注成功');
                }
                
                // 重新加载作者统计信息以获取准确的关注者数量
                console.log('🔄 准备重新加载作者统计信息...');
                await loadAuthorStats(authorId);
            } catch (error) {
                console.error('❌ 关注操作失败:', error);
                showError(error.message || '操作失败，请重试');
            } finally {
                followBtn.disabled = false;
            }
        }

        // 检查是否是作者,并获取用户在故事中的角色
        async function checkIfAuthor(story) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            // 先隐藏所有按钮，避免重复显示
            document.getElementById('followStoryBtn').style.display = 'none';
            document.getElementById('applyCollaborationBtn').style.display = 'none';
            document.getElementById('editStoryBtn').style.display = 'none';
            document.getElementById('storySettingsBtn').style.display = 'none';
            document.getElementById('aiCreateChapterBtn').style.display = 'none';
            document.getElementById('userRoleBadge').style.display = 'none';
            
            if (!token) {
                // 未登录用户显示关注和申请协作按钮
                const followBtn = document.getElementById('followStoryBtn');
                const applyBtn = document.getElementById('applyCollaborationBtn');
                
                followBtn.style.display = 'inline-flex';
                applyBtn.style.display = 'inline-flex';
                
                // 使用克隆节点的方式移除所有旧的事件监听器
                const newFollowBtn = followBtn.cloneNode(true);
                const newApplyBtn = applyBtn.cloneNode(true);
                followBtn.parentNode.replaceChild(newFollowBtn, followBtn);
                applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
                
                newFollowBtn.addEventListener('click', () => {
                    showError('请先登录');
                    setTimeout(() => window.location.href = '/login.html', 1500);
                });
                newApplyBtn.addEventListener('click', () => {
                    showError('请先登录');
                    setTimeout(() => window.location.href = '/login.html', 1500);
                });
                return;
            }

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData = await response.json();
                    const currentUserId = userData.user.id;

                    // 获取用户在故事中的角色
                    const roleResponse = await fetch(`/api/stories/${story.id}/role`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (roleResponse.ok) {
                        const roleData = await roleResponse.json();
                        
                        // 显示角色标识
                        const roleBadge = document.getElementById('userRoleBadge');
                        const roleText = document.getElementById('userRoleText');
                        
                        if (roleData.is_author) {
                            roleBadge.style.display = 'inline-flex';
                            roleBadge.className = 'user-role-badge role-author';
                            roleText.innerHTML = '<i class="fas fa-crown"></i> 主创';
                            
                            // 显示置顶故事按钮
                            const pinBtn = document.getElementById('pinStoryBtn');
                            pinBtn.style.display = 'inline-flex';
                            pinBtn.addEventListener('click', () => openPinStoryModal(story.id));
                            
                            // 显示编辑和设置按钮
                            const editBtn = document.getElementById('editStoryBtn');
                            editBtn.style.display = 'inline-flex';
                            editBtn.addEventListener('click', () => openEditModal(story));
                            
                            const settingsBtn = document.getElementById('storySettingsBtn');
                            settingsBtn.style.display = 'inline-flex';
                            settingsBtn.addEventListener('click', () => {
                                window.location.href = `/story-settings.html?id=${story.id}`;
                            });
                            
                            // 加载待处理的协作申请数量，显示在设置按钮上
                            loadPendingRequestsCount(story.id);
                            
const aiCreateBtn = document.getElementById('aiCreateChapterBtn');
                            aiCreateBtn.style.display = 'inline-flex';
                            
                            // 加载配额信息显示在按钮上
                            loadAiChapterQuotaInfo();
                            
                            aiCreateBtn.addEventListener('click', () => {
                                const parentId = window.currentSelectedNodeId;
                                if (parentId) {
                                    openAiChapterModal(story, parentId);
                                } else {
                                    showError('请先点击分支图中的一个章节，再使用 AI 创作功能');
                                }
                            });
                            
                            // 作者不需要看到关注和申请协作按钮
                            document.getElementById('followStoryBtn').style.display = 'none';
                            document.getElementById('applyCollaborationBtn').style.display = 'none';
                        } else if (roleData.is_collaborator) {
                            roleBadge.style.display = 'inline-flex';
                            roleBadge.className = 'user-role-badge role-collaborator';
                            roleText.innerHTML = '<i class="fas fa-users"></i> 共创者';
                            
                            // 协作者显示"已追更"按钮（协作者默认关注故事）
                            const followBtn = document.getElementById('followStoryBtn');
                            const newFollowBtn = followBtn.cloneNode(true);
                            followBtn.parentNode.replaceChild(newFollowBtn, followBtn);
                            
                            newFollowBtn.style.display = 'inline-flex';
                            newFollowBtn.innerHTML = '<i class="fas fa-star"></i> 已追更';
                            newFollowBtn.style.background = '#f093fb';
                            newFollowBtn.style.color = 'white';
                            newFollowBtn.addEventListener('click', () => toggleFollowStory(story.id));
                            
                            // 协作者显示"退出协作"按钮
                            const applyBtn = document.getElementById('applyCollaborationBtn');
                            const newApplyBtn = applyBtn.cloneNode(true);
                            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
                            
                            newApplyBtn.style.display = 'inline-flex';
                            newApplyBtn.innerHTML = '<i class="fas fa-user-times"></i> 退出协作';
                            newApplyBtn.style.background = '#ff6b6b';
                            newApplyBtn.style.color = 'white';
                            newApplyBtn.addEventListener('click', () => quitCollaboration(story.id));
                            
// 只有在允许续写时，协作者才能使用 AI 续写章节功能
                            if (roleData.allow_branch) {
                                const aiCreateBtn = document.getElementById('aiCreateChapterBtn');
                                aiCreateBtn.style.display = 'inline-flex';
                                
                                // 加载配额信息显示在按钮上
                                loadAiChapterQuotaInfo();
                                
                                aiCreateBtn.addEventListener('click', () => {
                                    const parentId = window.currentSelectedNodeId;
                                    if (parentId) {
                                        openAiChapterModal(story, parentId);
                                    } else {
                                        showError('请先点击分支图中的一个章节，再使用 AI 创作功能');
                                    }
                                });
                                console.log('✅ 协作者 - 允许续写，显示 AI 续写按钮');
                            } else {
                                console.log('❌ 协作者 - 故事已关闭续写功能，不显示 AI 续写按钮');
                            }
                        } else if (roleData.is_follower) {
                            roleBadge.style.display = 'inline-flex';
                            roleBadge.className = 'user-role-badge role-follower';
                            roleText.innerHTML = '<i class="fas fa-star"></i> 粉丝';
                        }
                        
                        // 根据角色显示相应按钮
                        if (!roleData.is_author && !roleData.is_collaborator) {
                            // 显示关注按钮 - 先克隆以移除旧事件
                            const followBtn = document.getElementById('followStoryBtn');
                            const newFollowBtn = followBtn.cloneNode(true);
                            followBtn.parentNode.replaceChild(newFollowBtn, followBtn);
                            
                            newFollowBtn.style.display = 'inline-flex';
                            
                            if (roleData.is_follower) {
                                newFollowBtn.innerHTML = '<i class="fas fa-star"></i> 已追更';
                                newFollowBtn.style.background = '#f093fb';
                                newFollowBtn.style.color = 'white';
                            } else {
                                newFollowBtn.innerHTML = '<i class="far fa-star"></i> 追更';
                            }
                            
                            newFollowBtn.addEventListener('click', () => toggleFollowStory(story.id));
                            
                            // 只有在允许续写且没有待处理申请时，才显示申请协作按钮
                            if (roleData.allow_branch && !roleData.has_pending_request) {
                                const applyBtn = document.getElementById('applyCollaborationBtn');
                                const newApplyBtn = applyBtn.cloneNode(true);
                                applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
                                
                                newApplyBtn.style.display = 'inline-flex';
                                newApplyBtn.addEventListener('click', () => openApplyCollaborationModal(story.id));
                                console.log('✅ 允许协作，显示申请按钮');
                            } else if (!roleData.allow_branch) {
                                console.log('❌ 故事已关闭协作功能，不显示申请按钮');
                            } else if (roleData.has_pending_request) {
                                console.log('⏳ 已有待处理申请，不显示申请按钮');
                            }
                        }
                        
                        // 更新粉丝数
                        if (roleData.follower_count !== undefined) {
                            document.getElementById('followerCount').textContent = roleData.follower_count;
                        }
                    }
                }
            } catch (error) {
                console.error('检查作者权限错误:', error);
            }
        }

// 加载待处理的协作申请数量
        async function loadPendingRequestsCount(storyId) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) return;

            try {
                const response = await fetch(`/api/collaboration-requests/story/${storyId}?status=pending`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) return;

                const data = await response.json();
                console.log('徽章-API 返回的数据:', data);
                const pendingRequests = data.requests || [];
                const pendingCount = pendingRequests.length;

                // 更新设置按钮上的徽章显示
                const badge = document.getElementById('settingsBadge');
                if (pendingCount > 0) {
                    badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            } catch (error) {
                console.error('加载协作申请数量失败:', error);
            }
        }

        // ========== 新增：加载 AI 创作章节配额信息 ==========
        async function loadAiChapterQuotaInfo() {
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
                console.log('📊 AI 创作章节配额信息:', data);

                // 防御性检查：确保数据结构正确
                const quotaData = data.quota || data.quotas;
                if (!quotaData) {
                    console.error('❌ API 返回的数据缺少 quota 字段:', data);
                    return;
                }

                // 更新徽章显示（使用 continuation 配额，因为 AI 创作章节也是续写功能）
                if (quotaData.continuation && data.costs) {
                    updateAiChapterQuotaBadge(quotaData.continuation, data.costs.continuation);
                }

            } catch (error) {
                console.error('❌ 加载配额信息失败:', error);
                // 静默失败，不影响功能使用
            }
        }

        // 更新 AI 创作章节按钮的配额徽章
        function updateAiChapterQuotaBadge(quota, cost) {
            const badge = document.getElementById('aiChapterQuota');
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
        // ===============================================

        // 切换关注故事状态
        async function toggleFollowStory(storyId) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                setTimeout(() => window.location.href = '/login.html', 1500);
                return;
            }

            const followBtn = document.getElementById('followStoryBtn');
            const isFollowing = followBtn.innerHTML.includes('已追更');
            followBtn.disabled = true;

            try {
                if (isFollowing) {
                    const response = await fetch(`/api/stories/${storyId}/follow`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('取消关注失败');

                    followBtn.innerHTML = '<i class="far fa-star"></i> 追更';
                    followBtn.style.background = '';
                    followBtn.style.color = '';
                    showSuccess('已取消关注');
                    
                    // 更新粉丝数
                    const count = parseInt(document.getElementById('followerCount').textContent);
                    document.getElementById('followerCount').textContent = Math.max(0, count - 1);
                } else {
                    const response = await fetch(`/api/stories/${storyId}/follow`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('关注失败');

                    followBtn.innerHTML = '<i class="fas fa-star"></i> 已追更';
                    followBtn.style.background = '#f093fb';
                    followBtn.style.color = 'white';
                    showSuccess('关注成功');
                    
                    // 更新粉丝数
                    const count = parseInt(document.getElementById('followerCount').textContent);
                    document.getElementById('followerCount').textContent = count + 1;
                }
            } catch (error) {
                console.error('关注操作失败:', error);
                showError(error.message || '操作失败，请重试');
            } finally {
                followBtn.disabled = false;
            }
        }

        // 打开协作申请模态框
        async function openApplyCollaborationModal(storyId) {
            // 先检查故事是否允许协作者续写
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    showError('请先登录');
                    setTimeout(() => window.location.href = '/login.html', 1500);
                    return;
                }

                // 获取故事的角色信息（包含allow_branch字段）
                const roleResponse = await fetch(`/api/stories/${storyId}/role`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (roleResponse.ok) {
                    const roleData = await roleResponse.json();
                    console.log('故事设置:', roleData);
                    
                    // 检查是否允许协作者续写
                    if (!roleData.allow_branch) {
                        showError('抱歉，该故事主创已关闭协作功能，暂不接受新的协作申请');
                        console.log('❌ 故事已关闭协作功能，拒绝申请');
                        return;
                    }
                }

                // 允许续写，打开申请模态框
                window.currentApplyStoryId = storyId;
                
                // 设置默认留言文字
                const textarea = document.getElementById('collaborationMessage');
                const defaultMessage = '您好！我对这个故事很感兴趣，希望能参与共同创作。我会认真对待每一个章节，为故事增添精彩内容。期待与您一起创作！';
                textarea.value = defaultMessage;
                
                // 标记这是默认文字
                textarea.dataset.isDefault = 'true';
                
                // 添加焦点事件：用户点击时清除默认文字
                const handleFocus = function() {
                    if (textarea.dataset.isDefault === 'true') {
                        textarea.value = '';
                        textarea.dataset.isDefault = 'false';
                        textarea.style.color = '#333'; // 恢复正常文字颜色
                    }
                };
                
                // 添加失焦事件：如果用户没有输入任何内容，恢复默认文字
                const handleBlur = function() {
                    if (textarea.value.trim() === '') {
                        textarea.value = defaultMessage;
                        textarea.dataset.isDefault = 'true';
                        textarea.style.color = '#999'; // 设置为灰色表示是默认文字
                    }
                };
                
                // 移除旧的事件监听器（如果存在）
                textarea.removeEventListener('focus', handleFocus);
                textarea.removeEventListener('blur', handleBlur);
                
                // 添加新的事件监听器
                textarea.addEventListener('focus', handleFocus);
                textarea.addEventListener('blur', handleBlur);
                
                // 初始设置为灰色
                textarea.style.color = '#999';
                
                document.getElementById('applyCollaborationModal').classList.add('active');
            } catch (error) {
                console.error('检查协作设置失败:', error);
                showError('无法获取故事信息，请稍后重试');
            }
        }

        // 关闭协作申请模态框
        function closeApplyCollaborationModal() {
            document.getElementById('applyCollaborationModal').classList.remove('active');
        }

        // 提交协作申请
        async function submitCollaborationRequest() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                return;
            }

            const message = document.getElementById('collaborationMessage').value.trim();
            if (!message) {
                showError('请填写申请留言');
                return;
            }

            const submitBtn = document.getElementById('submitCollaborationRequest');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';

            try {
                const response = await fetch('/api/collaboration-requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        story_id: window.currentApplyStoryId,
                        message: message
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '提交失败');
                }

                const data = await response.json();
                
                if (data.auto_approved) {
                    showSuccess('申请已自动通过！现在你是这个故事的协作者了，页面即将刷新');
                } else {
                    showSuccess('申请已提交，请等待主创审核，页面即将刷新');
                }
                
                // ✅ 统一处理：无论自动通过还是需要审核，都刷新页面
                // 这样确保所有按钮状态（包括续写按钮）都能正确更新
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (error) {
                console.error('提交申请失败:', error);
                showError(error.message || '提交失败，请重试');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 提交申请';
            }
        }

        // 退出协作
        async function quitCollaboration(storyId) {
            // 弹出确认对话框
            showConfirm('确定要退出协作吗？<br><br>退出后：<br>• 你将失去共创者身份<br>• 无法再续写新的章节<br>• 已创作的章节不会被删除<br>• 可以重新申请成为协作者', async () => {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                return;
            }

            try {
                const response = await fetch(`/api/stories/${storyId}/collaborators/leave`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '退出协作失败');
                }

                showSuccess('已退出协作');
                
                // 1.5秒后刷新页面，更新按钮状态
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } catch (error) {
                console.error('退出协作失败:', error);
                showError(error.message || '退出协作失败，请重试');
            }
            }, { title: '退出协作', confirmText: '确认退出' });
        }

        // 初始化协作申请模态框事件
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('closeApplyCollaborationModal')?.addEventListener('click', closeApplyCollaborationModal);
            document.getElementById('cancelApplyCollaboration')?.addEventListener('click', closeApplyCollaborationModal);
            document.getElementById('submitCollaborationRequest')?.addEventListener('click', submitCollaborationRequest);
            
            document.getElementById('applyCollaborationModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeApplyCollaborationModal();
                }
            });
        });

        // ========== 新增：置顶故事功能 ==========
        
        // 打开置顶故事模态框
        async function openPinStoryModal(storyId) {
            window.currentPinStoryId = storyId;
            
            // 重置天数输入
            const daysInput = document.getElementById('pinDays');
            daysInput.value = 7;
            
            // 加载用户积分余额
            await loadUserPointsForPin();
            
            // 更新费用显示
            updatePinCostDisplay(7);
            
            // 显示模态框
            document.getElementById('pinStoryModal').classList.add('active');
            
            // 添加天数变化监听
            daysInput.oninput = function() {
                const days = parseInt(this.value) || 0;
                updatePinCostDisplay(days);
            };
        }
        
        // 关闭置顶故事模态框
        function closePinStoryModal() {
            document.getElementById('pinStoryModal').classList.remove('active');
        }
        
        // 加载用户积分余额
        async function loadUserPointsForPin() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                return;
            }
            
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    const userPoints = userData.user.points || 0;
                    
                    document.getElementById('userPointsBalance').textContent = userPoints;
                    updateRemainingPoints(userPoints, 350);
                }
            } catch (error) {
                console.error('加载用户积分失败:', error);
            }
        }
        
        // 更新置顶费用显示
        function updatePinCostDisplay(days) {
            const dailyCost = 50;
            const totalCost = dailyCost * days;
            
            document.getElementById('pinDailyCost').textContent = dailyCost;
            document.getElementById('pinDaysDisplay').textContent = days;
            document.getElementById('pinPointsCost').textContent = totalCost;
            
            // 更新剩余积分
            const userPoints = parseInt(document.getElementById('userPointsBalance').textContent) || 0;
            updateRemainingPoints(userPoints, totalCost);
        }
        
        // 更新剩余积分显示
        function updateRemainingPoints(currentPoints, cost) {
            const remaining = currentPoints - cost;
            const remainingEl = document.getElementById('remainingPoints');
            remainingEl.textContent = remaining;
            
            if (remaining < 0) {
                remainingEl.style.color = '#f44336';
            } else {
                remainingEl.style.color = 'var(--st-primary-500)';
            }
        }
        
        // 确认置顶故事
        async function confirmPinStory() {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                showError('请先登录');
                return;
            }
            
            const days = parseInt(document.getElementById('pinDays').value);
            
            // 验证天数
            if (!days || days < 1 || days > 30) {
                showError('置顶天数必须在 1-30 天之间');
                return;
            }
            
            const confirmBtn = document.getElementById('confirmPinStory');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
            
            try {
                const response = await fetch(`/api/points-features/stories/${window.currentPinStoryId}/pin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ days })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '置顶失败');
                }
                
                const data = await response.json();
                
                showSuccess(`故事已置顶${days}天，消耗${data.cost}积分`);
                closePinStoryModal();
                
                // 刷新页面更新状态
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('置顶故事失败:', error);
                showError(error.message || '置顶失败，请重试');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-thumbtack"></i> 确认置顶';
            }
        }
        
        // 初始化置顶故事模态框事件
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('closePinStoryModal')?.addEventListener('click', closePinStoryModal);
            document.getElementById('cancelPinStory')?.addEventListener('click', closePinStoryModal);
            document.getElementById('confirmPinStory')?.addEventListener('click', confirmPinStory);
            
            document.getElementById('pinStoryModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closePinStoryModal();
                }
            });
        });
        
        // ===============================================

        // 打开编辑模态框
        function openEditModal(story) {
            const modal = document.getElementById('editModal');
            
            // 填充表单数据
            document.getElementById('editTitle').value = story.title || '';
            document.getElementById('editDescription').value = story.description || '';
            
            // 显示封面预览
            const coverPreview = document.getElementById('editCoverPreview');
            if (story.coverImage) {
                coverPreview.innerHTML = `<img src="${story.coverImage}" alt="封面">`;
            } else {
                coverPreview.innerHTML = '<i class="fas fa-image"></i>';
            }
            
            // 显示模态框
            modal.classList.add('active');
        }

        // 关闭编辑模态框
        function closeEditModal() {
            const modal = document.getElementById('editModal');
            modal.classList.remove('active');
        }

        // 保存编辑
        async function saveStoryEdit() {
            const title = document.getElementById('editTitle').value.trim();
            const description = document.getElementById('editDescription').value.trim();

            // 验证
            if (!title) {
                showError('请输入故事标题');
                return;
            }

            if (!description) {
                showError('请输入故事简介');
                return;
            }

            const saveBtn = document.getElementById('saveEdit');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                // 检查是否有新的封面图片
                const coverInput = document.getElementById('editCoverInput');
                const coverFile = coverInput.files[0];
                
                let coverImage = window.currentStory.coverImage; // 保持原有封面
                
                // 如果用户选择了新的封面图片，先上传
                if (coverFile) {
                    console.log('检测到新封面图片，开始上传...');
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传封面中...';
                    
                    const formData = new FormData();
                    formData.append('cover', coverFile);
                    
                    const uploadResponse = await fetch(`/api/upload/story/${window.currentStory.id}/cover`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    
                    if (!uploadResponse.ok) {
                        const uploadError = await uploadResponse.json();
                        throw new Error(uploadError.error || '封面上传失败');
                    }
                    
                    const uploadData = await uploadResponse.json();
                    coverImage = uploadData.story.cover_image; // 使用后端返回的cover_image字段
                    console.log('封面上传成功:', coverImage);
                }
                
                // 更新故事信息
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
                const response = await fetch(`/api/stories/${window.currentStory.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title,
                        description,
                        cover_image: coverImage // 使用下划线命名，匹配后端字段
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '保存失败');
                }

                const data = await response.json();
                console.log('故事更新成功:', data);
                
                showSuccess('保存成功！');
                closeEditModal();
                
                // 立即更新页面上的封面图片和标题、简介
                window.currentStory.title = title;
                window.currentStory.description = description;
                window.currentStory.coverImage = coverImage;
                
                document.getElementById('storyTitle').textContent = title;
                document.getElementById('storyDescription').textContent = description;
                if (coverImage) {
                    document.getElementById('storyCover').src = coverImage;
                }
                
                // 延迟刷新页面以确保用户看到更新
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('保存故事错误:', error);
                showError(error.message || '保存失败，请重试');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
            }
        }

        // 初始化编辑模态框事件
        document.addEventListener('DOMContentLoaded', function() {
            // 关闭按钮
            document.getElementById('closeEditModal')?.addEventListener('click', closeEditModal);
            document.getElementById('cancelEdit')?.addEventListener('click', closeEditModal);
            
            // 保存按钮
            document.getElementById('saveEdit')?.addEventListener('click', saveStoryEdit);
            
            // 点击模态框背景关闭
            document.getElementById('editModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeEditModal();
                }
            });

            // 封面上传
            document.getElementById('editCoverBtn')?.addEventListener('click', function() {
                document.getElementById('editCoverInput').click();
            });

            document.getElementById('editCoverInput')?.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        document.getElementById('editCoverPreview').innerHTML = 
                            `<img src="${e.target.result}" alt="封面预览">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        });

        // 加载章节列表
        async function loadChapters(storyId) {
            try {
                const chaptersResponse = await fetch(`/api/stories/${storyId}/nodes`);
                if (!chaptersResponse.ok) {
                    throw new Error('加载章节失败');
                }

                const chapters = await chaptersResponse.json();
                renderChapters(chapters);

                // 排序按钮
                document.querySelectorAll('.sort-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        
                        const sortOrder = this.dataset.sort;
                        const sortedChapters = sortOrder === 'asc' ? chapters : [...chapters].reverse();
                        renderChapters(sortedChapters);
                    });
                });

            } catch (error) {
                console.error('加载章节错误:', error);
                showError('加载章节失败');
            }
        }

// 渲染章节列表
        async function renderChapters(chapters) {
            const container = document.getElementById('chaptersList');
            
            // 使用缓存的用户 ID，避免重复调用 API
            let currentUserId = window.currentUserId;
            
            // 如果还没有缓存用户 ID，且需要判断作者身份，则获取一次
            if (!currentUserId && chapters.length > 0) {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (token) {
                    try {
                        const response = await fetch('/api/auth/me', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            const userData = await response.json();
                            currentUserId = userData.user.id;
                            // 缓存用户 ID 供后续使用
                            window.currentUserId = currentUserId;
                        }
                    } catch (error) {
                        console.error('获取用户信息失败:', error);
                    }
                }
            }
            
            // 调试：输出章节数据
            console.log('渲染章节列表，章节数量:', chapters.length);
            if (chapters.length > 0) {
                console.log('第一个章节数据:', chapters[0]);
                console.log('AI 字段检查:', {
                    ai_generated: chapters[0].ai_generated,
                    aiGenerated: chapters[0].aiGenerated
                });
            }
            
            if (chapters.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-book"></i>
                        <p>还没有章节</p>
                        <p style="margin-top: 10px; color: #999; font-size: 14px;">点击"续写分支"或"AI 创作"来添加章节</p>
                    </div>
                `;
                return;
            }

            const story = window.currentStory;
            const isStoryAuthor = story && currentUserId && (story.authorId === currentUserId || story.author?.id === currentUserId);

            container.innerHTML = chapters.map((chapter, index) => {
                // 调试每个章节的 AI 字段
                const hasAI = chapter.aiGenerated || chapter.ai_generated;
                const isChapterAuthor = currentUserId && chapter.author_id === currentUserId;
                const canDelete = isStoryAuthor || isChapterAuthor;
                
                console.log(`章节 ${index + 1} "${chapter.title}" AI 标记:`, hasAI);
                
                return `
                <div class="chapter-item" data-chapter-id="${chapter.id}">
                    <div class="chapter-number">${index + 1}</div>
                    <div class="chapter-info">
                        <div class="chapter-title">
                            ${chapter.title}
                            ${hasAI ? '<span class="ai-badge"><i class="fas fa-robot"></i> AI 创作</span>' : ''}
                        </div>
                        <div class="chapter-meta">
                            <span><i class="fas fa-eye"></i> ${chapter.readCount || chapter.read_count || chapter.views || 0} 阅读</span>
                            <span><i class="fas fa-comment"></i> ${chapter.commentCount || 0} 评论</span>
                            <span><i class="fas fa-user"></i> ${chapter.author?.username || '未知作者'}</span>
                            <span><i class="fas fa-clock"></i> ${new Date(chapter.createdAt || chapter.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                    </div>
                    <div class="chapter-actions" style="display: flex; align-items: center; gap: 10px;">
                        <div class="chapter-status ${chapter.isPublished || chapter.is_published ? 'status-published' : 'status-draft'}">
                            ${chapter.isPublished || chapter.is_published ? '已发布' : '草稿'}
                        </div>
                        ${(!chapter.isPublished && !chapter.is_published) && (isChapterAuthor || isStoryAuthor) ? `
                            <button class="chapter-action-btn" onclick="event.stopPropagation(); publishChapter(${chapter.id}, '${chapter.title.replace(/'/g, "\\'")}')}" title="发布草稿" style="
                                padding: 8px 12px;
                                background: #059669;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.3s;
                                font-size: 14px;
                            ">
                                <i class="fas fa-paper-plane"></i> 发布
                            </button>
                        ` : ''}
                        ${canDelete ? `
                            <button class="chapter-action-btn" onclick="event.stopPropagation(); deleteChapter(${chapter.id}, '${chapter.title.replace(/'/g, "\\'")}')}" title="删除章节" style="
                                padding: 8px 12px;
                                background: #f44336;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.3s;
                                font-size: 14px;
                            ">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');

            // 添加点击事件
            container.querySelectorAll('.chapter-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    // 如果点击的是操作按钮，不跳转
                    if (e.target.closest('.chapter-action-btn') || e.target.closest('button')) {
                        return;
                    }
                    const chapterId = this.dataset.chapterId;
                    window.location.href = `/chapter?id=${chapterId}`;
                });
            });
        }

        // 计算总字数
        function calculateWordCount(story) {
            // 这里应该从后端获取实际字数
            return story.wordCount || 0;
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
            messageEl.className = `message message-${type}`;
            messageEl.innerHTML = `
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
                <span>${message}</span>
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
                            使用 <strong>${featureName}</strong> 功能
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
                                ${description}
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

        // ============================================
        // AI创作章节功能
        // ============================================

        // AI创作章节相关变量
        let selectedAiSurpriseTime = 'immediate';
        let selectedAiChapterStyle = 'suspense';
        let selectedAiWordCount = 1500; // 默认1500字
        let currentAiChapterTaskId = null;
        let aiChapterOptions = [];
        let aiChapterModalOpen = false; // 弹窗是否处于打开状态（用于判断轮询结果如何展示）

        // 初始化AI创作章节模态框
        document.addEventListener('DOMContentLoaded', function() {
            // 关闭按钮
            document.getElementById('closeAiChapterModal')?.addEventListener('click', closeAiChapterModal);
            document.getElementById('cancelAiChapter')?.addEventListener('click', closeAiChapterModal);
            
            // 点击模态框背景关闭
            document.getElementById('aiChapterModal')?.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeAiChapterModal();
                }
            });

            // 惊喜时间按钮
            document.querySelectorAll('#aiSurpriseTimeSelector .surprise-time-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('#aiSurpriseTimeSelector .surprise-time-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                    selectedAiSurpriseTime = this.dataset.time;
                    console.log('选择惊喜时间:', selectedAiSurpriseTime);
                    
                    // 如果选择自定义，显示自定义时间选择器
                    const customTimeSelector = document.getElementById('customAiTimeSelector');
                    if (selectedAiSurpriseTime === 'custom') {
                        customTimeSelector.style.display = 'block';
                        // 设置最小时间为当前时间+5分钟（使用本地时间）
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 5);
                        
                        // 转换为本地时间格式（yyyy-MM-ddTHH:mm）
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                        
                        const dateTimeInput = document.getElementById('customAiDateTime');
                        dateTimeInput.min = minDateTime;
                        // 默认显示当前时间+5分钟
                        dateTimeInput.value = minDateTime;
                        
                        // 自动保存选中的时间（设置为custom时间）
                        selectedAiSurpriseTime = minDateTime;
                        console.log('默认自定义时间（本地）:', selectedAiSurpriseTime);
                    } else {
                        customTimeSelector.style.display = 'none';
                    }
                });
            });
            
            // 自定义时间输入框 - 失去焦点时自动保存
            document.getElementById('customAiDateTime')?.addEventListener('change', function() {
                const customDateTime = this.value;
                if (!customDateTime) {
                    showError('请选择一个时间');
                    return;
                }
                
                const selectedTime = new Date(customDateTime);
                const now = new Date();
                
                if (selectedTime <= now) {
                    showError('请选择未来的时间');
                    // 重置为最小时间（当前+5分钟），使用本地时间
                    now.setMinutes(now.getMinutes() + 5);
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const resetDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
                    this.value = resetDateTime;
                    selectedAiSurpriseTime = resetDateTime;
                    return;
                }
                
                // 自动保存自定义时间
                selectedAiSurpriseTime = customDateTime;
                console.log('自动保存自定义时间:', selectedAiSurpriseTime);
                showSuccess('已设置自定义时间：' + selectedTime.toLocaleString('zh-CN'));
            });
            
            // 确认自定义时间按钮（保留，但主要功能已由change事件处理）
            document.getElementById('confirmCustomAiTime')?.addEventListener('click', function() {
                const customDateTime = document.getElementById('customAiDateTime').value;
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
                selectedAiSurpriseTime = customDateTime;
                console.log('确认自定义时间:', selectedAiSurpriseTime);
                showSuccess('已设置自定义时间：' + selectedTime.toLocaleString('zh-CN'));
            });

            // 风格按钮
            document.querySelectorAll('#aiAiStyleSelector .surprise-time-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('#aiAiStyleSelector .surprise-time-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                    selectedAiChapterStyle = this.dataset.style;
                    console.log('选择续写风格:', selectedAiChapterStyle);
                });
            });

            // 字数选择按钮
            document.querySelectorAll('#aiWordCountSelector .surprise-time-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('#aiWordCountSelector .surprise-time-btn').forEach(b => {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                    
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
                const customBtn = document.querySelector('#aiWordCountSelector .surprise-time-btn[data-wordcount="custom"]');
                customBtn.innerHTML = `<i class="fas fa-edit"></i> 自定义<br><span style="font-size: 12px; opacity: 0.8;">${customValue}字</span>`;
                
                showSuccess(`已设置期望字数：${customValue}字`);
            });

            // 开始生成按钮（两个按钮）
            document.getElementById('startAiChapterGenerationDraft')?.addEventListener('click', () => startAiChapterGeneration(false));
            document.getElementById('startAiChapterGenerationPublish')?.addEventListener('click', () => startAiChapterGeneration(true));
            
            // 重新生成按钮
            document.getElementById('regenerateAiChapter')?.addEventListener('click', regenerateAiChapter);
        });

// 打开 AI 创作章节模态框
        function openAiChapterModal(story, parentId) {
            console.log('打开 AI 创作章节模态框，故事:', story, '父节点 ID:', parentId);
            
            // 保存父节点 ID 到全局变量
            window.aiChapterParentId = parentId;
            
            const modal = document.getElementById('aiChapterModal');
            
            // 重置界面
            document.getElementById('aiSurpriseTimeSelector').style.display = 'block';
            document.getElementById('aiAiStyleSelector').style.display = 'block';
            document.getElementById('aiWordCountSelector').style.display = 'block';
            document.getElementById('customWordCountInput').style.display = 'none'; // 隐藏自定义输入框
            document.querySelector('#startAiChapterGenerationDraft').parentElement.style.display = 'flex';
            document.getElementById('aiChapterLoading').style.display = 'none';
            document.getElementById('aiChapterOptions').style.display = 'none';
            document.getElementById('aiChapterError').style.display = 'none';
            document.getElementById('regenerateAiChapter').style.display = 'none';
            
            // 重置选择
            selectedAiSurpriseTime = 'immediate';
            selectedAiChapterStyle = 'suspense';
            selectedAiWordCount = 1500;
            
            // 重置按钮状态
            document.querySelectorAll('#aiSurpriseTimeSelector .surprise-time-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.time === 'immediate');
            });
            document.querySelectorAll('#aiAiStyleSelector .surprise-time-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.style === 'suspense');
            });
            document.querySelectorAll('#aiWordCountSelector .surprise-time-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.wordcount === '1500');
            });
            
            // 重置自定义按钮文字
            const customBtn = document.querySelector('#aiWordCountSelector .surprise-time-btn[data-wordcount="custom"]');
            if (customBtn) {
                customBtn.innerHTML = '<i class="fas fa-edit"></i> 自定义';
            }
            
            // ========== 新增：加载配额信息并更新徽章 ==========
            loadAiChapterQuotaInfo();
            // ===============================================
            
            // 显示模态框
            aiChapterModalOpen = true;
            modal.classList.add('active');
        }

        // 关闭AI创作章节模态框
        function closeAiChapterModal() {
            const modal = document.getElementById('aiChapterModal');
            modal.classList.remove('active');
            aiChapterModalOpen = false;

            // 如果立即生成任务仍在轮询中，显示持久提示条告知用户
            if (currentAiChapterTaskId && document.getElementById('aiChapterLoading').style.display !== 'none') {
                showAiGeneratingBanner();
            }
        }

        // 显示顶部提示条：AI 正在后台生成章节
        function showAiGeneratingBanner() {
            if (document.getElementById('aiGeneratingBanner')) return; // 已存在则不重复创建
            const banner = document.createElement('div');
            banner.id = 'aiGeneratingBanner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                background: linear-gradient(135deg, var(--st-primary-500) 0%, var(--st-primary-700) 100%);
                color: white;
                text-align: center;
                padding: 12px 20px;
                font-size: 15px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.2);
            `;
            banner.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                AI 正在后台生成章节，完成后页面将自动刷新...
                <button onclick="reopenAiChapterProgress();" style="
                    margin-left: 15px;
                    padding: 5px 14px;
                    background: rgba(255,255,255,0.25);
                    border: 1px solid rgba(255,255,255,0.5);
                    border-radius: 6px;
                    color: white;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                ">查看进度</button>
            `;
            document.body.prepend(banner);
        }

        // 隐藏顶部提示条
        function hideAiGeneratingBanner() {
            const banner = document.getElementById('aiGeneratingBanner');
            if (banner) banner.remove();
        }

        // 从提示条重新打开弹窗：仅显示加载进度，隐藏配置 UI（避免歧义）
        function reopenAiChapterProgress() {
            // 隐藏所有配置区域
            const surpriseSelector = document.getElementById('aiSurpriseTimeSelector');
            const styleSelector = document.getElementById('aiAiStyleSelector');
            const wordCountSelector = document.getElementById('aiWordCountSelector');
            const actionBtns = document.querySelector('#startAiChapterGenerationDraft')?.parentElement;
            if (surpriseSelector) surpriseSelector.style.display = 'none';
            if (styleSelector) styleSelector.style.display = 'none';
            if (wordCountSelector) wordCountSelector.style.display = 'none';
            if (actionBtns) actionBtns.style.display = 'none';

            // 确保只显示加载状态
            const loading = document.getElementById('aiChapterLoading');
            const options = document.getElementById('aiChapterOptions');
            const error = document.getElementById('aiChapterError');
            if (loading) loading.style.display = 'block';
            if (options) options.style.display = 'none';
            if (error) error.style.display = 'none';

            // 打开弹窗
            document.getElementById('aiChapterModal').classList.add('active');
            aiChapterModalOpen = true;
        }

// 开始 AI 章节生成
        async function startAiChapterGeneration(publishImmediately = true) {
            console.log('开始 AI 章节生成');
            console.log('惊喜时间:', selectedAiSurpriseTime);
            console.log('风格:', selectedAiChapterStyle);
            console.log('期望字数:', selectedAiWordCount);
            console.log('发布状态:', publishImmediately ? '自动发布' : '保存为草稿');
            
            // 隐藏选择器，显示加载状态
            document.getElementById('aiSurpriseTimeSelector').style.display = 'none';
            document.getElementById('aiAiStyleSelector').style.display = 'none';
            document.getElementById('aiWordCountSelector').style.display = 'none';
            document.querySelector('#startAiChapterGenerationDraft').parentElement.style.display = 'none';
            document.getElementById('aiChapterLoading').style.display = 'block';
            document.getElementById('aiChapterOptions').style.display = 'none';
            document.getElementById('aiChapterError').style.display = 'none';

            // 根据惊喜时间和发布状态更新加载文本
            const loadingText = document.getElementById('aiChapterLoadingText');
            if (selectedAiSurpriseTime === 'immediate') {
                loadingText.textContent = 'AI 正在思考中，请稍候...';
            } else {
                const timeMap = {
                    '1hour': '1 小时后',
                    'tonight': '今晚 22:00',
                    'tomorrow': '明天 8:00'
                };
                const action = publishImmediately ? '创作并发布' : '创作（保存为草稿）';
                loadingText.textContent = `任务已提交，AI 将在${timeMap[selectedAiSurpriseTime]}${action}新章节`;
            }

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
                                            'AI 续写章节',
                                            costs.continuation,
                                            `本次操作将消耗 ${costs.continuation} 积分（您的积分余额：${userPoints}）`
                                        );

                                        if (!confirmed) {
                                            console.log('用户取消使用积分');
                                            // 恢复 UI 状态
                                            document.getElementById('aiSurpriseTimeSelector').style.display = 'block';
                                            document.getElementById('aiAiStyleSelector').style.display = 'block';
                                            document.getElementById('aiWordCountSelector').style.display = 'block';
                                            document.querySelector('#startAiChapterGenerationDraft').parentElement.style.display = 'flex';
                                            document.getElementById('aiChapterLoading').style.display = 'none';
                                            return;
                                        }
                                    } else {
                                        showError('积分不足，无法使用 AI 续写章节功能');
                                        // 恢复 UI 状态
                                        document.getElementById('aiSurpriseTimeSelector').style.display = 'block';
                                        document.getElementById('aiAiStyleSelector').style.display = 'block';
                                        document.getElementById('aiWordCountSelector').style.display = 'block';
                                        document.querySelector('#startAiChapterGenerationDraft').parentElement.style.display = 'flex';
                                        document.getElementById('aiChapterLoading').style.display = 'none';
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

                const story = window.currentStory;
                if (!story) {
                    throw new Error('故事信息不存在');
                }

                console.log('调用 AI API...');

                // 处理自定义时间：转换为ISO格式（包含时区信息）
                let surpriseTimeToSend = selectedAiSurpriseTime;
                
                if (selectedAiSurpriseTime && 
                    selectedAiSurpriseTime !== 'immediate' && 
                    selectedAiSurpriseTime !== '1hour' && 
                    selectedAiSurpriseTime !== 'tonight' && 
                    selectedAiSurpriseTime !== 'tomorrow') {
                    // 自定义时间：转换为ISO格式（UTC时间）
                    const localDate = new Date(selectedAiSurpriseTime);
                    surpriseTimeToSend = localDate.toISOString();
                    console.log('🕐 本地时间:', selectedAiSurpriseTime);
                    console.log('🌍 转换为ISO(UTC):', surpriseTimeToSend);
                    console.log('📅 用户本地时间:', localDate.toLocaleString('zh-CN'));
                }

                // 调用AI v2 API
                const response = await fetch('/api/ai/v2/continuation/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        storyId: parseInt(story.id),
                        nodeId: window.aiChapterParentId || null, // 使用选中的节点作为父节点
                        context: '', // 不需要当前内容，AI会基于前三章生成
                        style: selectedAiChapterStyle,
                        count: 3,
                        mode: 'chapter', // 整章模式
                        surpriseTime: surpriseTimeToSend !== 'immediate' ? surpriseTimeToSend : null,
                        publishImmediately: publishImmediately, // 传递发布状态
                        wordCount: selectedAiWordCount // 传递期望字数
                    })
                });

                console.log('AI API响应状态:', response.status);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API错误 (${response.status})`);
                }

                const data = await response.json();
                console.log('AI API返回数据:', data);

                currentAiChapterTaskId = data.taskId;

                if (selectedAiSurpriseTime === 'immediate') {
                    // 立即生成：轮询任务状态
                    await pollAiChapterTaskStatus(data.taskId);
                } else {
                    // 延迟生成：显示成功消息并开始轮询
                    document.getElementById('aiChapterLoading').style.display = 'none';
                    const message = publishImmediately 
                        ? '任务已提交，完成后将自动发布章节' 
                        : '任务已提交，完成后将保存为草稿';
                    showSuccess(message);
                    
                    // 关闭模态框
                    setTimeout(() => {
                        closeAiChapterModal();
                    }, 2000);
                    
                    // 计算任务执行时间（用于优化轮询）
                    let scheduledTime = null;
                    if (selectedAiSurpriseTime === '1hour') {
                        scheduledTime = new Date(Date.now() + 60 * 60 * 1000);
                    } else if (selectedAiSurpriseTime === 'tonight') {
                        scheduledTime = new Date();
                        scheduledTime.setHours(22, 0, 0, 0);
                        if (scheduledTime <= new Date()) {
                            scheduledTime.setDate(scheduledTime.getDate() + 1);
                        }
                    } else if (selectedAiSurpriseTime === 'tomorrow') {
                        scheduledTime = new Date();
                        scheduledTime.setDate(scheduledTime.getDate() + 1);
                        scheduledTime.setHours(8, 0, 0, 0);
                    } else {
                        // 自定义时间
                        scheduledTime = new Date(selectedAiSurpriseTime);
                    }
                    
                    // 开始后台轮询，完成后自动刷新页面
                    startBackgroundPolling(data.taskId, scheduledTime);
                }

            } catch (error) {
                console.error('AI章节生成错误:', error);
                document.getElementById('aiChapterLoading').style.display = 'none';
                document.getElementById('aiChapterError').style.display = 'block';
                document.getElementById('regenerateAiChapter').style.display = 'inline-block';
                
                let errorMessage = error.message || 'AI服务暂时不可用';
                
                if (error.message.includes('登录') || error.message.includes('401')) {
                    errorMessage = '请先登录后再使用AI功能';
                } else if (error.message.includes('积分') || error.message.includes('配额')) {
                    errorMessage = '积分或配额不足';
                }
                
                document.getElementById('aiChapterErrorMessage').textContent = errorMessage;
            }
        }

        // 监听AI章节任务状态（WebSocket 优先，降级轮询兜底）
        async function pollAiChapterTaskStatus(taskId) {
            console.log('开始监听AI章节任务状态:', taskId, 'WebSocket:', StoryTreeWS.isConnected() ? '已连接' : '未连接');
            
            const handleTaskUpdate = (data) => {
                if (data.taskId !== taskId) return;
                console.log('收到AI章节任务状态更新:', data.status);

                if (data.status === 'completed') {
                    // 任务完成：关闭弹窗并刷新页面
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                    
                    console.log('任务完成，结果:', data.result);
                    hideAiGeneratingBanner();
                    closeAiChapterModal();
                    showSuccess('AI 章节生成完成！即将刷新页面...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else if (data.status === 'failed') {
                    // 任务失败
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                    
                    if (aiChapterModalOpen) {
                        document.getElementById('aiChapterLoading').style.display = 'none';
                        document.getElementById('aiChapterError').style.display = 'block';
                        document.getElementById('aiChapterErrorMessage').textContent = data.errorMessage || '生成失败';
                        document.getElementById('regenerateAiChapter').style.display = 'inline-block';
                    } else {
                        hideAiGeneratingBanner();
                        showError('AI 章节生成失败：' + (data.errorMessage || '未知错误'));
                    }
                }
            };
            
            // 通过 WebSocket 监听
            StoryTreeWS.on('task:status', handleTaskUpdate);
            
            // 同时注册降级轮询任务
            StoryTreeWS.watchTask(taskId, handleTaskUpdate);
        }

        // 后台监听定时任务（WebSocket 优先，降级轮询兜底）
        function startBackgroundPolling(taskId, scheduledTime) {
            console.log('📅 开始后台监听定时任务:', taskId);
            console.log('⏰ 预计执行时间:', scheduledTime ? scheduledTime.toLocaleString('zh-CN') : '未知');
            
            const handleTaskUpdate = (data) => {
                if (data.taskId !== taskId) return;
                console.log('📬 收到定时任务状态更新:', data.status);

                if (data.status === 'completed') {
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                    
                    console.log('✅ 定时任务完成，刷新页面');
                    showSuccess('AI章节创作完成！正在刷新页面...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else if (data.status === 'failed') {
                    StoryTreeWS.off('task:status', handleTaskUpdate);
                    StoryTreeWS.unwatchTask(taskId);
                    
                    console.error('❌ 定时任务失败:', data.errorMessage);
                    showError('AI章节创作失败：' + (data.errorMessage || '未知错误'));
                }
            };
            
            // 计算距离执行时间还有多久
            const now = new Date();
            let delayUntilStart = 0;
            
            if (scheduledTime && scheduledTime > now) {
                delayUntilStart = scheduledTime - now;
                const minutes = Math.floor(delayUntilStart / 60000);
                console.log(`⏳ 距离执行还有 ${minutes} 分钟，到时间后才开始监听`);
            }
            
            // 在定时任务执行时间到达后，注册 WebSocket 监听 + 降级轮询
            setTimeout(() => {
                console.log('🔔 到达预定时间，开始监听任务状态');
                StoryTreeWS.on('task:status', handleTaskUpdate);
                StoryTreeWS.watchTask(taskId, handleTaskUpdate);
            }, delayUntilStart);
        }

        // 显示AI章节结果
        function displayAiChapterResult(result) {
            console.log('显示AI章节结果:', result);
            
            document.getElementById('aiChapterLoading').style.display = 'none';
            document.getElementById('aiChapterOptions').style.display = 'block';
            document.getElementById('regenerateAiChapter').style.display = 'inline-block';

            const optionsContainer = document.getElementById('aiChapterOptions');
            optionsContainer.innerHTML = '';

            // 保存选项供后续使用
            const options = result.options || [];
            aiChapterOptions = options;

            if (options.length === 0) {
                optionsContainer.innerHTML = '<p style="text-align: center; color: #999;">未生成续写选项</p>';
                return;
            }

            options.forEach((option, index) => {
                const card = document.createElement('div');
                card.className = 'ai-option-card';
                
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
                        <button class="btn-use" onclick="acceptAiChapterOption(${index}, false)" style="background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);">
                            <i class="fas fa-save"></i> 保存为草稿
                        </button>
                        <button class="btn-use" onclick="acceptAiChapterOption(${index}, true)">
                            <i class="fas fa-check"></i> 接受并发布
                        </button>
                        <button class="btn-preview" onclick="previewAiChapterOption(${index})">
                            <i class="fas fa-eye"></i> 查看完整
                        </button>
                    </div>
                `;
                optionsContainer.appendChild(card);
            });
        }

        // 接受AI章节选项
        window.acceptAiChapterOption = async function(index, publishImmediately = true) {
            const option = aiChapterOptions[index];
            
            console.log('用户接受AI章节:', index, option, '发布状态:', publishImmediately);
            
            if (!currentAiChapterTaskId) {
                showError('任务ID不存在');
                return;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                // 显示加载状态
                showMessage(publishImmediately ? '正在创建并发布章节...' : '正在保存为草稿...', 'info');

                // 调用后端API接受AI续写并创建节点
                const response = await fetch('/api/ai/v2/continuation/accept', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        taskId: currentAiChapterTaskId,
                        optionIndex: index,
                        publishImmediately: publishImmediately
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || '创建章节失败');
                }

                const data = await response.json();
                console.log('章节创建成功:', data);

                // 关闭模态框
                closeAiChapterModal();

                // 显示成功消息
                const successMessage = data.message || (publishImmediately ? 'AI章节已发布！' : 'AI章节已保存为草稿！');
                showSuccess(successMessage + ' 即将刷新页面...');

                // 刷新页面显示新章节
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('接受AI章节错误:', error);
                showError(error.message || '创建章节失败');
            }
        };

        // 预览AI章节选项
        window.previewAiChapterOption = function(index) {
            const option = aiChapterOptions[index];
            
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

        // 重新生成AI章节
        function regenerateAiChapter() {
            console.log('重新生成AI章节');
            
            // 重置界面到选择器状态
            document.getElementById('aiSurpriseTimeSelector').style.display = 'block';
            document.getElementById('aiAiStyleSelector').style.display = 'block';
            document.getElementById('aiWordCountSelector').style.display = 'block';
            document.querySelector('#startAiChapterGenerationDraft').parentElement.style.display = 'flex';
            document.getElementById('aiChapterLoading').style.display = 'none';
            document.getElementById('aiChapterOptions').style.display = 'none';
            document.getElementById('aiChapterError').style.display = 'none';
            document.getElementById('regenerateAiChapter').style.display = 'none';
        }

        // ============================================
        // 删除章节功能
        // ============================================

        // 删除章节
        window.deleteChapter = async function(chapterId, chapterTitle) {
            console.log('准备删除章节:', chapterId, chapterTitle);
            
            // 显示确认对话框
            showDangerConfirm(`确定要删除章节《${chapterTitle}》吗？<br><br>此操作不可撤销！`, async () => {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                
                if (!token) {
                    throw new Error('请先登录');
                }

                // 显示加载状态
                showMessage('正在删除章节...', 'info');

                // 调用后端API删除章节
                const response = await fetch(`/api/nodes/${chapterId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    
                    // 特殊处理有子章节的情况
                    if (errorData.hasChildren) {
                        throw new Error(`该章节有 ${errorData.childCount} 个子章节，无法删除。\n请先删除所有子章节。`);
                    }
                    
                    throw new Error(errorData.error || '删除章节失败');
                }

                const data = await response.json();
                console.log('章节删除成功:', data);

                // 显示成功消息
                showSuccess('章节删除成功！即将刷新页面...');

                // 刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('删除章节错误:', error);
                showError(error.message || '删除章节失败');
            }
            }, { title: '删除章节', confirmText: '确认删除' });
        };

        // 发布草稿章节
        window.publishChapter = async function(chapterId, chapterTitle) {
            console.log('准备发布草稿章节:', chapterId, chapterTitle);

            if (!confirm(`确定要将草稿章节《${chapterTitle}》正式发布吗？\n\n发布后所有读者均可看到此章节。`)) {
                return;
            }

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    throw new Error('请先登录');
                }

                showMessage('正在发布章节...', 'info');

                const response = await fetch(`/api/nodes/${chapterId}/publish`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || '发布章节失败');
                }

                const data = await response.json();
                console.log('章节发布成功:', data);

                showSuccess('草稿已发布！即将刷新页面...');

                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('发布章节错误:', error);
                showError(error.message || '发布章节失败');
            }
        };

// ============================================
        // 分支树和统计功能
        // ============================================

        let treeChart = null;
        let statsChart = null;
        let currentLayout = 'vertical';
// 加载树状图数据
        async function loadTreeData(storyId) {
            try {
                // 获取 token（如果已登录）
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                // 加载树状图数据
                const treeResponse = await fetch(`/api/stories/${storyId}/tree`, { headers });
                
                if (!treeResponse.ok) {
                    const errorData = await treeResponse.json().catch(() => ({}));
                    console.error('加载树状图失败:', treeResponse.status, errorData);
                    throw new Error(errorData.error || '加载树状图数据失败');
                }

                const data = await treeResponse.json();
                window.treeData = data.tree;
                window.treeStats = data.stats;
                
                // 渲染统计卡片
                renderStatsCards(data.stats);
                
                console.log('树状图数据加载成功:', data);
            } catch (error) {
                console.error('加载树状图数据错误:', error);
                // 显示错误提示（可选）
                // showError('无法加载分支图和统计数据');
            }
        }

        // 渲染统计卡片
        function renderStatsCards(stats) {
            const container = document.getElementById('storyStatsGrid');
            if (!container || !stats) return;

            const total = (stats.aiNodes || 0) + (stats.humanNodes || 0);
            const aiRatio = total > 0 ? Math.round((stats.aiNodes || 0) / total * 100) : 0;

            container.innerHTML = `
                <!-- 左列：主卡片（总章节数） -->
                <div class="stat-card stat-card--primary">
                    <div class="stat-card-icon"><i class="fas fa-book-open"></i></div>
                    <div class="stat-card-value">${stats.totalNodes || 0}</div>
                    <div class="stat-card-label">总章节数</div>
                </div>

                <!-- 中列：创作来源组合卡 -->
                <div class="stat-card-group">
                    <div class="stat-card-group-title">创作来源</div>
                    <div class="stat-card-group-items">
                        <div class="stat-card-row">
                            <div class="stat-card-icon-wrap stat-icon--ai"><i class="fas fa-robot"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-value">${stats.aiNodes || 0}</div>
                                <div class="stat-card-label">AI 创作</div>
                            </div>
                        </div>
                        <div class="stat-card-row">
                            <div class="stat-card-icon-wrap stat-icon--human"><i class="fas fa-user-edit"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-value">${stats.humanNodes || 0}</div>
                                <div class="stat-card-label">人工创作</div>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card-ratio">
                        <div class="stat-card-ratio-bar">
                            <div class="stat-card-ratio-fill" style="width:${aiRatio}%"></div>
                        </div>
                        <div class="stat-card-ratio-labels">
                            <span>AI ${aiRatio}%</span>
                            <span>人工 ${100 - aiRatio}%</span>
                        </div>
                    </div>
                </div>

                <!-- 右列：互动数据组合卡 -->
                <div class="stat-card-group">
                    <div class="stat-card-group-title">互动数据</div>
                    <div class="stat-card-group-items">
                        <div class="stat-card-row">
                            <div class="stat-card-icon-wrap stat-icon--reads"><i class="fas fa-eye"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-value">${formatNumber(stats.totalReads || 0)}</div>
                                <div class="stat-card-label">总阅读量</div>
                            </div>
                        </div>
                        <div class="stat-card-row">
                            <div class="stat-card-icon-wrap stat-icon--branches"><i class="fas fa-code-branch"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-value">${stats.totalBranches || 0}</div>
                                <div class="stat-card-label">分支数</div>
                            </div>
                        </div>
                        <div class="stat-card-row">
                            <div class="stat-card-icon-wrap stat-icon--comments"><i class="fas fa-comment"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-value">${stats.totalComments || 0}</div>
                                <div class="stat-card-label">总评论</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 格式化数字
        function formatNumber(num) {
            if (num >= 10000) {
                return (num / 10000).toFixed(1) + '万';
            }
            return num.toString();
        }

        // 初始化树状图
        function initTreeChart() {
            if (!window.treeData) return;

            const chartDom = document.getElementById('treeChart');
            if (!chartDom) return;

            // 如果已有图表实例，先销毁
            if (treeChart) {
                treeChart.dispose();
            }

            treeChart = echarts.init(chartDom);

            const option = getTreeOption(window.treeData, currentLayout);
            treeChart.setOption(option);

            // 点击事件 - 传入鼠标坐标，用于定位浮层
            treeChart.on('click', function(params) {
                if (params.data && params.data.id) {
                    showNodeDetail(params.data, params.event?.offsetX, params.event?.offsetY);
                }
            });
            
            // 鼠标悬停事件 - 高亮从根节点到当前节点的路径
            treeChart.on('mouseover', function(params) {
                if (params.data && params.data.id) {
                    highlightPathToRoot(params.data);
                }
            });
            
            // 鼠标移出事件 - 取消高亮
            treeChart.on('mouseout', function(params) {
                downplayAllNodes();
            });

            // 响应式
            window.addEventListener('resize', () => {
                treeChart && treeChart.resize();
            });

            // 监听用户 roam（拖拽/滚轮缩放）操作，实时同步 zoom 到 window.currentZoom
            // 这样 applyHighlightStyles 中 setOption 时不会重置用户的视角
            treeChart.on('georoam', function() {
                const opt = treeChart.getOption();
                if (opt && opt.series && opt.series[0] && opt.series[0].zoom != null) {
                    window.currentZoom = opt.series[0].zoom;
                }
            });
            // ECharts tree 系列的 roam 事件通过 'restore' 触发，也监听一下
            treeChart.getZr().on('mousewheel', function() {
                setTimeout(() => {
                    if (!treeChart) return;
                    try {
                        const opt = treeChart.getOption();
                        if (opt && opt.series && opt.series[0] && opt.series[0].zoom != null) {
                            window.currentZoom = opt.series[0].zoom;
                        }
                    } catch(e) {}
                }, 50);
            });

            // 工具栏事件
            initTreeToolbar();
        }
        
        // 当前高亮的路径节点 ID 集合（用于自定义样式渲染）
        let highlightedNodeIds = new Set();
        let highlightedHoveredId = null; // 当前悬停的节点 ID

        // 高亮从根节点到当前节点的路径
        function highlightPathToRoot(nodeData) {
            if (!treeChart || !nodeData || !nodeData.id) return;

            // 收集路径节点 ID（根 → 当前节点）
            const pathIds = new Set();
            const rawData = window.treeData; // 使用原始未裁剪数据查路径
            collectPathIds(rawData, nodeData.id, pathIds);

            highlightedNodeIds = pathIds;
            highlightedHoveredId = nodeData.id;

            // 通过 setOption 将高亮状态写入节点 itemStyle
            applyHighlightStyles();
        }

        // 根据 ID 收集从根到目标节点的路径（所有祖先 + 自身）
        function collectPathIds(node, targetId, pathIds) {
            if (!node) return false;
            if (node.id === targetId) {
                pathIds.add(node.id);
                return true;
            }
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    if (collectPathIds(child, targetId, pathIds)) {
                        pathIds.add(node.id);
                        return true;
                    }
                }
            }
            return false;
        }

        // 将高亮状态写入图表节点样式（通过重新 setOption）
        function applyHighlightStyles() {
            if (!treeChart || !window.treeData) return;

            const processedData = processTreeDataForDisplay(
                JSON.parse(JSON.stringify(window.treeData)),
                0, 5, null, currentLayout || 'vertical'
            );

            // 递归给节点加上高亮/暗化样式
            function applyStyle(node) {
                if (!node) return;

                const isHovered = node.id === highlightedHoveredId;
                const isOnPath = highlightedNodeIds.has(node.id);
                const hasHighlight = highlightedNodeIds.size > 0;

                if (!hasHighlight) {
                    // 无高亮状态，恢复默认
                    delete node.itemStyle;
                    delete node.label;
                } else if (isHovered) {
                    // 当前悬停节点：强高亮
                    node.itemStyle = {
                        color: '#6366F1',
                        borderColor: '#4338CA',
                        borderWidth: 3,
                        shadowBlur: 16,
                        shadowColor: 'rgba(99, 102, 241, 0.6)'
                    };
                    node.label = {
                        color: '#4338CA',
                        fontWeight: 'bold',
                        fontSize: 14,
                        fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
                    };
                } else if (isOnPath) {
                    // 路径上的祖先节点：次高亮
                    node.itemStyle = {
                        color: '#C7D2FE',
                        borderColor: '#6366F1',
                        borderWidth: 2.5,
                        shadowBlur: 8,
                        shadowColor: 'rgba(99, 102, 241, 0.35)'
                    };
                    node.label = {
                        color: '#4338CA',
                        fontWeight: '600',
                        fontSize: 13,
                        fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
                    };
                } else {
                    // 非路径节点：淡化
                    node.itemStyle = {
                        color: '#F3F4F6',
                        borderColor: '#D1D5DB',
                        borderWidth: 1,
                        opacity: 0.45
                    };
                    node.label = {
                        color: '#9CA3AF',
                        fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
                    };
                }

                if (node.children) {
                    node.children.forEach(applyStyle);
                }
            }

            applyStyle(processedData);

            treeChart.setOption({
                series: [{ data: [processedData], zoom: window.currentZoom || 1 }]
            }, { notMerge: false, lazyUpdate: false });
        }

        // 取消所有节点的高亮
        function downplayAllNodes() {
            if (!treeChart) return;
            highlightedNodeIds = new Set();
            highlightedHoveredId = null;
            applyHighlightStyles();
        }

        // 获取树状图配置
function getTreeOption(treeData, layout) {
            const isVertical = layout === 'vertical';
            const isRadial = layout === 'radial';
            const isHorizontal = layout === 'horizontal';

            let orient = 'TB';
            let layoutOption = 'orthogonal';
            let symbolSize = 10;

            if (isRadial) {
                layoutOption = 'radial';
                symbolSize = 9;
            } else if (isHorizontal) {
                orient = 'LR';
                symbolSize = 10;
            }

            // 统一字体（中英文混排）
            const FONT_FAMILY = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

            // 处理树数据：扁平化过长的分支，用省略号简化中间章节
            const processedData = processTreeDataForDisplay(JSON.parse(JSON.stringify(treeData)), 0, 5, null, layout);

            // 各布局的间距配置
            const layoutPadding = isRadial
                ? { top: '8%', left: '8%', bottom: '8%', right: '8%' }
                : isHorizontal
                    ? { top: '5%', left: '12%', bottom: '5%', right: '18%' }
                    : { top: '10%', left: '8%', bottom: '10%', right: '8%' };

            return {
                tooltip: {
                    trigger: 'item',
                    triggerOn: 'mousemove',
                    backgroundColor: 'rgba(255, 255, 255, 0.97)',
                    borderColor: '#E5E7EB',
                    borderWidth: 1,
                    padding: [12, 16],
                    textStyle: {
                        color: '#374151',
                        fontSize: 13,
                        fontFamily: FONT_FAMILY
                    },
                    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.12); border-radius: 10px;',
                    formatter: function(params) {
                        const data = params.data;
                        if (data.isEllipsis) {
                            return `<div style="min-width:120px;font-family:${FONT_FAMILY}">
                                <div style="font-weight:600;color:#6366F1;margin-bottom:4px;">${data.name}</div>
                                <div style="color:#9CA3AF;font-size:12px;">点击展开更多章节</div>
                            </div>`;
                        }
                        if (data.isVirtualRoot || !data.id) return '';
                        const draftBadge = data.isPublished === false 
                            ? '<div style="display:inline-block;background:#FEF3C7;color:#D97706;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-bottom:6px;">草稿</div>' 
                            : '';
                        return `<div style="min-width:150px;font-family:${FONT_FAMILY}">
                            ${draftBadge}
                            <div style="font-weight:700;color:#111827;margin-bottom:8px;font-size:14px;border-bottom:1px solid #F3F4F6;padding-bottom:6px;">${data.name}</div>
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="color:#9CA3AF;width:44px;">作者</span><span style="color:#374151;font-weight:500;">${data.author || '未知'}</span></div>
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="color:#9CA3AF;width:44px;">阅读</span><span style="color:#374151;font-weight:500;">${data.readCount || 0}</span></div>
                            <div style="display:flex;align-items:center;gap:6px;"><span style="color:#9CA3AF;width:44px;">分支</span><span style="color:#374151;font-weight:500;">${data.branchCount || 0}</span></div>
                        </div>`;
                    }
                },
                series: [
                    {
                        type: 'tree',
                        data: [processedData],
                        top: layoutPadding.top,
                        left: layoutPadding.left,
                        bottom: layoutPadding.bottom,
                        right: layoutPadding.right,
                        symbolSize: symbolSize,
                        orient: orient,
                        layout: layoutOption,
                        initialTreeDepth: -1,
                        roam: true,
                        zoom: window.currentZoom || 1,
                        scaleLimit: { min: 0.1, max: 3 },
                        // 节点间距：水平/竖向布局增大间距以减少重叠
                        nodeGap: isRadial ? 14 : (isHorizontal ? 32 : 26),
                        layerPadding: isRadial ? 100 : (isHorizontal ? 150 : 90),
                        // 禁用 emphasis 内置高亮（使用自定义 itemStyle 方案）
                        emphasis: {
                            focus: 'none',
                            disabled: true
                        },
                        expandAndCollapse: true,
                        animationDuration: 400,
                        animationDurationUpdate: 500,
                        lineStyle: {
                            color: '#A5B4FC',
                            width: 1.5,
                            curveness: isRadial ? 0.3 : 0.05
                        },
                        itemStyle: {
                            color: '#EEF2FF',
                            borderColor: '#818CF8',
                            borderWidth: 1.5,
                            shadowBlur: 3,
                            shadowColor: 'rgba(99, 102, 241, 0.15)'
                        },
                        label: {
                            show: true,
                            position: isVertical ? 'top' : (isHorizontal ? 'left' : 'top'),
                            verticalAlign: 'middle',
                            align: isVertical ? 'center' : (isHorizontal ? 'right' : 'center'),
                            fontSize: 12,
                            fontWeight: 'normal',
                            color: '#374151',
                            fontFamily: FONT_FAMILY,
                            distance: isHorizontal ? 8 : 5,
                            formatter: function(params) {
                                const name = params.name;
                                const limit = isHorizontal ? 7 : 5;
                                return name.length > limit ? name.substring(0, limit) + '…' : name;
                            }
                        },
                        leaves: {
                            label: {
                                position: isVertical ? 'bottom' : (isHorizontal ? 'right' : 'bottom'),
                                verticalAlign: 'middle',
                                align: isVertical ? 'center' : (isHorizontal ? 'left' : 'center'),
                                fontSize: 12,
                                fontWeight: 'normal',
                                color: '#374151',
                                fontFamily: FONT_FAMILY,
                                distance: isHorizontal ? 8 : 5,
                                formatter: function(params) {
                                    const name = params.name;
                                    const limit = isHorizontal ? 7 : 5;
                                    return name.length > limit ? name.substring(0, limit) + '…' : name;
                                }
                            },
                            itemStyle: {
                                color: '#F0FDF4',
                                borderColor: '#4ADE80',
                                borderWidth: 1.5
                            }
                        }
                    }
                ]
            };
        }
        
        // 处理树数据：扁平化过长的分支，用省略号简化中间章节
        // expandedChains: 已经展开的链的标识集合，值为已显示的前缀节点数量
        function processTreeDataForDisplay(node, depth = 0, maxChainLength = 5, expandedChains = null, layout = 'vertical') {
            if (!node) return node;
            
            // 初始化已展开链集合
            if (!expandedChains) {
                expandedChains = window.expandedEllipsisChains || new Map();
            }
            
            const FONT_FAMILY = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            const isHorizontal = layout === 'horizontal';
            const isRadial = layout === 'radial';
            
            // 水平布局：奇偶层标签上下错开，避免同层文字重叠
            // 偶数层（0,2,4...）：标签在节点上方（offset 向上）
            // 奇数层（1,3,5...）：标签在节点下方（offset 向下）
            let nodeLabelOverride = null;
            if (isHorizontal && !node.isEllipsis) {
                const isEven = depth % 2 === 0;
                nodeLabelOverride = {
                    position: 'left',
                    verticalAlign: isEven ? 'bottom' : 'top',
                    offset: isEven ? [0, -10] : [0, 10],
                    fontSize: 12,
                    fontWeight: 'normal',
                    fontFamily: FONT_FAMILY,
                    color: '#374151'
                };
            } else if (isRadial && !node.isEllipsis) {
                // 径向布局：奇偶层交替上下偏移
                const isEven = depth % 2 === 0;
                nodeLabelOverride = {
                    offset: isEven ? [0, -8] : [0, 8],
                    fontSize: 12,
                    fontWeight: 'normal',
                    fontFamily: FONT_FAMILY,
                    color: '#374151'
                };
            }
            
            // 创建节点副本，附加深度信息和奇偶层 label 配置
            // 优先级：nodeLabelOverride（奇偶层错开）> 原始 node.label（合并字体）> 统一默认
            let finalLabel;
            if (node.isEllipsis) {
                // 省略号节点：保留自身 label，只统一字体
                finalLabel = node.label
                    ? { ...node.label, fontFamily: FONT_FAMILY }
                    : undefined;
            } else if (nodeLabelOverride) {
                // 水平/径向布局：奇偶层配置覆盖原有 label
                finalLabel = node.label
                    ? { ...node.label, ...nodeLabelOverride }
                    : nodeLabelOverride;
            } else {
                // 竖向布局：无论节点是否有原始 label，都强制统一字体/颜色/字重
                // 这样叶子节点不会被 leaves.label 的颜色差异影响
                finalLabel = {
                    ...(node.label || {}),
                    fontFamily: FONT_FAMILY,
                    fontWeight: 'normal',
                    color: '#374151'
                };
            }
            
            // 草稿节点样式：虚线边框 + 橙色 + 标签带"[草稿]"前缀
            const isDraft = node.isPublished === false;
            let draftItemStyle = {};
            let draftName = node.name;
            
            if (isDraft && !node.isEllipsis && !node.isVirtualRoot) {
                draftItemStyle = {
                    color: '#FEF3C7',  // 浅橙色背景
                    borderColor: '#F59E0B',  // 橙色边框
                    borderWidth: 2,
                    borderType: 'dashed',  // 虚线
                    shadowBlur: 4,
                    shadowColor: 'rgba(245, 158, 11, 0.3)'
                };
                // 标签颜色也改为橙色
                if (finalLabel) {
                    finalLabel = { ...finalLabel, color: '#D97706', fontWeight: '600' };
                }
                // 名称前加"[草稿]"标记
                draftName = `[草稿] ${node.name}`;
            }
            
            const processedNode = {
                ...node,
                name: draftName,
                _depth: depth,
                ...(finalLabel ? { label: finalLabel } : {}),
                ...(isDraft && Object.keys(draftItemStyle).length > 0 ? { itemStyle: { ...(node.itemStyle || {}), ...draftItemStyle } } : {})
            };
            
            // 处理子节点
            if (node.children && node.children.length > 0) {
                // 如果当前节点只有一个子节点（链式结构）
                if (node.children.length === 1) {
                    const child = node.children[0];
                    
                    // 检查是否还有孙节点
                    if (child.children && child.children.length === 1) {
                        // 计算链的长度
                        let chainLength = 1;
                        let current = child;
                        const chainNodes = [child];
                        
                        while (current.children && current.children.length === 1) {
                            current = current.children[0];
                            chainNodes.push(current);
                            chainLength++;
                        }
                        
                        // 检查这条链的展开状态
                        const chainKey = `chain-${node.id}-${chainNodes[chainNodes.length - 1].id}`;
                        const expandedCount = expandedChains.get(chainKey) || 0;
                        // 双向展开：前缀 (1+expandedCount) + 后缀 (1+expandedCount) + lastNode
                        // 完全展开条件：2*(1+expandedCount) >= chainNodes.length - 1
                        const isFullyExpanded = (2 * (1 + expandedCount)) >= chainNodes.length - 1;
                        
                        // 如果链太长且未完全展开，需要简化
                        if (chainLength > maxChainLength && !isFullyExpanded) {
                            // 保留：第一个、最后一个、以及中间的省略号节点
                            const firstNode = chainNodes[0];
                            const lastNode = chainNodes[chainNodes.length - 1];
                            
                            // 计算要显示的节点（双向展开策略）
                            // expandedCount 表示单侧额外展开的数量
                            // 初始：前缀 1 个，后缀 1 个（+ lastNode）
                            // 每次点击：前缀和后缀各多展开 3 个
                            const basePrefixCount = 1;  // 初始前缀显示数
                            const baseSuffixCount = 1;  // 初始后缀显示数（不含 lastNode）
                            
                            // 可用的中间节点总数（不含 lastNode）
                            const availableMiddle = chainNodes.length - 1; // chainNodes[0..length-2] 是可分配的
                            
                            // 计算前缀和后缀的目标数量
                            let targetPrefix = basePrefixCount + expandedCount;
                            let targetSuffix = baseSuffixCount + expandedCount;
                            
                            // 确保前缀 + 后缀不超过可用节点数
                            if (targetPrefix + targetSuffix > availableMiddle) {
                                // 超出时均匀分配
                                const total = availableMiddle;
                                targetPrefix = Math.min(targetPrefix, total);
                                targetSuffix = Math.min(targetSuffix, total - targetPrefix);
                            }
                            
                            const prefixCount = targetPrefix;
                            const suffixCount = Math.max(0, targetSuffix);
                            
                            // 获取前缀节点（从前往后）
                            const prefixNodes = chainNodes.slice(0, prefixCount);
                            // 获取后缀节点（从后往前，不含 lastNode）
                            const suffixNodes = suffixCount > 0 ? chainNodes.slice(chainNodes.length - 1 - suffixCount, chainNodes.length - 1) : [];
                            // 中间仍然隐藏的节点数
                            const remainingHiddenCount = Math.max(0, availableMiddle - prefixCount - suffixCount);
                            
                            // 构建新的子节点结构
                            const newChildren = [];
                            
                            // 添加前缀节点（通过 processTreeDataForDisplay 处理，获得奇偶层 label）
                            let currentParent = processedNode;
                            prefixNodes.forEach((prefixNode, index) => {
                                // 用正确的 depth 处理，使奇偶层 label 生效
                                const processedPrefixNode = processTreeDataForDisplay(
                                    { ...prefixNode, children: [] },
                                    depth + 1 + index, maxChainLength, expandedChains, layout
                                );
                                const newNode = {
                                    ...processedPrefixNode,
                                    children: index === prefixNodes.length - 1 ? [] : undefined
                                };
                                if (index === 0) {
                                    newChildren.push(newNode);
                                } else {
                                    let last = newChildren[newChildren.length - 1];
                                    while (last.children && last.children.length > 0) {
                                        last = last.children[last.children.length - 1];
                                    }
                                    last.children = [newNode];
                                }
                                currentParent = newNode;
                            });
                            
                            // 如果还有隐藏的节点，添加省略号节点
                            if (remainingHiddenCount > 0) {
                                const ellipsisNode = {
                                    id: `ellipsis-${depth}-${firstNode.id}`,
                                    name: `...(${remainingHiddenCount}章)...`,
                                    value: remainingHiddenCount,
                                    isEllipsis: true,
                                    chainKey: chainKey,
                                    expandedCount: prefixCount, // 记录已展开的数量
                                    totalNodes: chainNodes.length,
                                    author: '...',
                                    readCount: 0,
                                    branchCount: 0,
                                    itemStyle: {
                                        color: '#999',
                                        borderColor: '#ccc'
                                    },
                                    label: {
                                        color: '#9CA3AF',
                                        fontSize: 12,
                                        fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
                                    },
                                    // 保存所有被折叠的节点信息
                                    allChainNodes: chainNodes,
                                    prefixCount: prefixCount,
                                    suffixCount: suffixCount
                                };
                                
                                // 将省略号节点添加到前缀的最后一个节点
                                let lastPrefix = newChildren[newChildren.length - 1];
                                while (lastPrefix.children && lastPrefix.children.length > 0) {
                                    lastPrefix = lastPrefix.children[lastPrefix.children.length - 1];
                                }
                                lastPrefix.children = [ellipsisNode];
                                currentParent = ellipsisNode;
                                
                                // 添加后缀节点到省略号节点（同样通过 processTreeDataForDisplay 处理）
                                // 后缀节点的 depth = 省略号节点之后，即 depth + 1 + prefixCount + 1 + index
                                const suffixBaseDepth = depth + 1 + prefixCount + 1;
                                suffixNodes.forEach((suffixNode, index) => {
                                    const processedSuffixNode = processTreeDataForDisplay(
                                        { ...suffixNode, children: [] },
                                        suffixBaseDepth + index, maxChainLength, expandedChains, layout
                                    );
                                    const newNode = {
                                        ...processedSuffixNode,
                                        children: index === suffixNodes.length - 1 ? [] : undefined
                                    };
                                    if (index === 0) {
                                        if (!currentParent.children) {
                                            currentParent.children = [];
                                        }
                                        currentParent.children.push(newNode);
                                    } else {
                                        let last = currentParent.children[currentParent.children.length - 1];
                                        while (last.children && last.children.length > 0) {
                                            last = last.children[last.children.length - 1];
                                        }
                                        last.children = [newNode];
                                    }
                                });
                                
                                // 将最后一个后缀节点连接到链尾
                                let lastSuffix = currentParent.children[currentParent.children.length - 1];
                                while (lastSuffix.children && lastSuffix.children.length > 0) {
                                    lastSuffix = lastSuffix.children[lastSuffix.children.length - 1];
                                }
                                lastSuffix.children = [{
                                    ...lastNode,
                                    children: lastNode.children ? lastNode.children.map(c => processTreeDataForDisplay(c, depth + 1, maxChainLength, expandedChains, layout)) : []
                                }];
                            } else {
                                // 没有隐藏节点了，直接连接到最后一个节点
                                let lastPrefix = newChildren[newChildren.length - 1];
                                while (lastPrefix.children && lastPrefix.children.length > 0) {
                                    lastPrefix = lastPrefix.children[lastPrefix.children.length - 1];
                                }
                                lastPrefix.children = [{
                                    ...lastNode,
                                    children: lastNode.children ? lastNode.children.map(c => processTreeDataForDisplay(c, depth + 1, maxChainLength, expandedChains, layout)) : []
                                }];
                            }
                            
                            processedNode.children = newChildren;
                        } else {
                            // 链不长或已完全展开，直接展开整条链的所有节点
                            // 关键：不能简单递归处理子节点，否则子节点会重新检测到子链并再次折叠
                            // 必须将整条链的所有节点串联起来，只在链尾节点上递归处理其子节点
                            const lastNode = chainNodes[chainNodes.length - 1];
                            const newChildren = [];
                            
                            chainNodes.forEach((chainNode, index) => {
                                const isLast = index === chainNodes.length - 1;
                                // 链中间节点：children 设为空，由下面手动串联
                                // 链尾节点：保留原始 children 并递归处理
                                const nodeToProcess = isLast
                                    ? chainNode  // 链尾保留原始 children
                                    : { ...chainNode, children: [] };  // 中间节点清空 children
                                    
                                const processedChainNode = processTreeDataForDisplay(
                                    nodeToProcess,
                                    depth + 1 + index, maxChainLength, expandedChains, layout
                                );
                                
                                if (index === 0) {
                                    newChildren.push(processedChainNode);
                                } else {
                                    // 找到前一个节点的末端，串联上去
                                    let last = newChildren[newChildren.length - 1];
                                    while (last.children && last.children.length > 0) {
                                        last = last.children[last.children.length - 1];
                                    }
                                    last.children = [processedChainNode];
                                }
                            });
                            
                            processedNode.children = newChildren;
                        }
                    } else {
                        // 只有一个子节点但孙节点为空或有多个，正常处理
                        processedNode.children = node.children.map(c => processTreeDataForDisplay(c, depth + 1, maxChainLength, expandedChains, layout));
                    }
                } else {
                    // 有多个子节点（分支），对每个子节点递归处理
                    processedNode.children = node.children.map(c => processTreeDataForDisplay(c, depth + 1, maxChainLength, expandedChains, layout));
                }
            }
            
            return processedNode;
        }

        // 初始化工具栏
        function initTreeToolbar() {
            // 防止重复绑定事件
            if (window.treeToolbarInitialized) {
                return;
            }
            window.treeToolbarInitialized = true;
            
            // 布局切换
            document.getElementById('layoutVertical')?.addEventListener('click', function() {
                setLayout('vertical');
            });
            document.getElementById('layoutHorizontal')?.addEventListener('click', function() {
                setLayout('horizontal');
            });
            document.getElementById('layoutRadial')?.addEventListener('click', function() {
                setLayout('radial');
            });

            // 缩放控制 - 使用全局变量记录当前缩放比例
            window.currentZoom = window.currentZoom || 1;
            
            document.getElementById('zoomIn')?.addEventListener('click', function() {
                if (!treeChart) return;
                window.currentZoom = Math.min(window.currentZoom * 1.2, 3);
                treeChart.setOption({
                    series: [{
                        zoom: window.currentZoom
                    }]
                });
            });

            document.getElementById('zoomOut')?.addEventListener('click', function() {
                if (!treeChart) return;
                window.currentZoom = Math.max(window.currentZoom / 1.2, 0.1);
                treeChart.setOption({
                    series: [{
                        zoom: window.currentZoom
                    }]
                });
            });

            document.getElementById('resetZoom')?.addEventListener('click', function() {
                if (!treeChart) return;
                window.currentZoom = 1;
                // 重新初始化图表以恢复初始位置和缩放
                initTreeChart();
            });

            // 导出图片
            document.getElementById('exportImage')?.addEventListener('click', function() {
                if (!treeChart) {
                    showError('请先加载分支图');
                    return;
                }
                
                try {
                    // 保存当前的缩放比例和配置
                    const currentZoom = window.currentZoom || 1;
                    const currentOption = treeChart.getOption();
                    
                    // 临时重置为完整视图（zoom=1，自动居中）
                    treeChart.setOption({
                        series: [{
                            zoom: 1,
                            center: null // 重置中心点，让图表自动居中
                        }]
                    });
                    
                    // 等待图表更新完成后再导出
                    setTimeout(() => {
                        // 导出完整的分支图
                        const url = treeChart.getDataURL({
                            type: 'png',
                            pixelRatio: 2,
                            backgroundColor: '#fff',
                            excludeComponents: ['toolbox'] // 排除工具栏
                        });
                        
                        // 恢复之前的缩放和位置
                        treeChart.setOption({
                            series: [{
                                zoom: currentZoom
                            }]
                        });
                        
                        // 创建下载链接
                        const link = document.createElement('a');
                        const storyTitle = window.currentStory?.title || 'story';
                        const timestamp = new Date().toISOString().slice(0, 10);
                        link.download = `${storyTitle}-分支图-${timestamp}.png`;
                        link.href = url;
                        link.click();
                        
                        showSuccess('分支图导出成功');
                    }, 100); // 给图表100ms时间更新
                    
                } catch (error) {
                    console.error('导出图片失败:', error);
                    showError('导出失败，请重试');
                }
            });

            // 关闭节点详情
            document.getElementById('closeNodeDetail')?.addEventListener('click', function() {
                document.getElementById('nodeDetail').classList.remove('active');
            });

            // 阅读章节
            document.getElementById('readNode')?.addEventListener('click', function() {
                const nodeId = this.dataset.nodeId;
                if (nodeId) {
                    window.location.href = `/chapter?id=${nodeId}`;
                }
            });

            // 续写分支
            document.getElementById('continueNode')?.addEventListener('click', function() {
                const nodeId = this.dataset.nodeId;
                const storyId = window.currentStory?.id;
                if (nodeId && storyId) {
                    window.location.href = `/write?storyId=${storyId}&parentId=${nodeId}`;
                }
            });

            // 发布草稿（树状图节点详情面板中）
            document.getElementById('publishDraftNode')?.addEventListener('click', function() {
                const nodeId = this.dataset.nodeId;
                const nodeTitle = this.dataset.nodeTitle || '该章节';
                if (nodeId) {
                    publishChapter(parseInt(nodeId), nodeTitle);
                }
            });

            // 删除章节（树状图节点详情面板中）
            document.getElementById('deleteNodeBtn')?.addEventListener('click', function() {
                const nodeId = this.dataset.nodeId;
                const nodeTitle = this.dataset.nodeTitle || '该章节';
                if (nodeId) {
                    // 关闭浮层后再弹确认框
                    document.getElementById('nodeDetail').classList.remove('active');
                    deleteChapter(parseInt(nodeId), nodeTitle);
                }
            });
        }

        // 设置布局
        function setLayout(layout) {
            currentLayout = layout;
            
            // 不同布局使用不同的初始缩放比例
            // 水平/径向布局节点多时容易重叠，默认缩小以展示全貌
            if (layout === 'horizontal' || layout === 'radial') {
                window.currentZoom = 0.7;
            } else {
                window.currentZoom = 1;
            }
            
            // 更新按钮状态
            document.querySelectorAll('.tree-toolbar-left .toolbar-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById('layout' + layout.charAt(0).toUpperCase() + layout.slice(1))?.classList.add('active');

            // 重新初始化图表
            initTreeChart();
        }
        
        // 展开省略号节点，显示被折叠的中间章节
        // 每次点击从两侧各展开3个节点
        function expandEllipsisNode(ellipsisNodeData) {
            if (!ellipsisNodeData.chainKey) {
                console.log('没有可展开的链标识');
                return;
            }
            
            // 将链标识保存到全局Map中
            if (!window.expandedEllipsisChains) {
                window.expandedEllipsisChains = new Map();
            }
            
            // 获取当前单侧额外展开数量，默认为0
            const currentExpandedCount = window.expandedEllipsisChains.get(ellipsisNodeData.chainKey) || 0;
            
            // 每次两侧各多展开3个
            const newExpandedCount = currentExpandedCount + 3;
            
            // 记录新的展开数量
            window.expandedEllipsisChains.set(ellipsisNodeData.chainKey, newExpandedCount);
            
            console.log('展开链:', ellipsisNodeData.chainKey);
            console.log('双侧各额外展开: 前后各+3，expandedCount:', currentExpandedCount, '->', newExpandedCount,
                        '(前缀显示', 1 + newExpandedCount, '个, 后缀显示', 1 + newExpandedCount, '个)');
            
            // 局部更新图表（使用 setOption 而不是重新初始化）
            if (treeChart) {
                const option = getTreeOption(window.treeData, currentLayout);
                treeChart.setOption(option, {
                    notMerge: false, // 合并配置，实现局部更新
                    lazyUpdate: false
                });
            }
            
            // 计算剩余隐藏数
            const totalNodes = ellipsisNodeData.totalNodes || 0;
            const availableMiddle = totalNodes - 1; // 不含 lastNode
            const shownPrefix = 1 + newExpandedCount; // basePrefixCount + expandedCount
            const shownSuffix = 1 + newExpandedCount; // baseSuffixCount + expandedCount
            const remaining = Math.max(0, availableMiddle - Math.min(shownPrefix, availableMiddle) - Math.max(0, Math.min(shownSuffix, availableMiddle - Math.min(shownPrefix, availableMiddle))));
            if (remaining > 0) {
                showSuccess(`已展开，还剩 ${remaining} 个章节未显示`);
            } else {
                showSuccess('已全部展开');
            }
        }

        // 显示节点详情
        async function showNodeDetail(nodeData, clickX, clickY) {
            // 如果是省略号节点，展开被折叠的中间章节
            if (nodeData.isEllipsis) {
                console.log('点击省略号节点，展开被折叠的章节，链标识:', nodeData.chainKey, '当前隐藏:', nodeData.value, '章');
                expandEllipsisNode(nodeData);
                return;
            }
            
            // 如果是虚拟根节点（故事标题），不处理
            if (nodeData.isVirtualRoot || !nodeData.id) {
                return;
            }
            
            const detailPanel = document.getElementById('nodeDetail');
            
            document.getElementById('nodeTitle').textContent = nodeData.name;
            document.getElementById('nodeDetailContent').innerHTML = `
                <div class="detail-item">
                    <div class="detail-label">作者</div>
                    <div class="detail-value" style="font-size:13px;">${nodeData.author || '未知'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">阅读量</div>
                    <div class="detail-value">${nodeData.readCount || 0}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">评论数</div>
                    <div class="detail-value">${nodeData.commentCount || 0}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">分支数</div>
                    <div class="detail-value">${nodeData.branchCount || 0}</div>
                </div>
            `;

            // 保存节点ID到按钮
            document.getElementById('readNode').dataset.nodeId = nodeData.id;
            document.getElementById('continueNode').dataset.nodeId = nodeData.id;
            const publishDraftBtn = document.getElementById('publishDraftNode');
            publishDraftBtn.dataset.nodeId = nodeData.id;
            publishDraftBtn.dataset.nodeTitle = nodeData.name;
            const deleteNodeBtn = document.getElementById('deleteNodeBtn');
            deleteNodeBtn.dataset.nodeId = nodeData.id;
            deleteNodeBtn.dataset.nodeTitle = nodeData.name;
            
            // 保存当前选中的节点ID到全局变量，供AI创作使用
            window.currentSelectedNodeId = nodeData.id;
            console.log('当前选中节点:', nodeData.id, nodeData.name);

            // 默认隐藏受权限控制的按钮
            publishDraftBtn.style.display = 'none';
            deleteNodeBtn.style.display = 'none';
            document.getElementById('continueNode').style.display = 'none';

            // 检查用户权限
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            if (token) {
                try {
                    const storyId = window.currentStory?.id;
                    if (storyId) {
                        const roleResponse = await fetch(`/api/stories/${storyId}/role`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (roleResponse.ok) {
                            const roleData = await roleResponse.json();
                            console.log('用户角色:', roleData);
                            const currentUserId = window.currentUserId;
                            const nodeAuthorId = nodeData.authorId;
                            const isNodeAuthor = currentUserId && nodeAuthorId && currentUserId === nodeAuthorId;

                            // 续写分支：作者或允许续写的协作者
                            if (roleData.is_author || (roleData.is_collaborator && roleData.allow_branch)) {
                                document.getElementById('continueNode').style.display = '';
                            }

                            // 发布草稿：节点是草稿 且（故事主创 或 节点作者本人）
                            if (!nodeData.isPublished && (roleData.is_author || isNodeAuthor)) {
                                publishDraftBtn.style.display = '';
                            }

                            // 删除章节：故事主创 或 节点作者本人（与章节列表逻辑一致）
                            if (roleData.is_author || isNodeAuthor) {
                                deleteNodeBtn.style.display = '';
                            }
                        }
                    }
                } catch (error) {
                    console.error('检查权限失败:', error);
                }
            }

            // ===== 定位浮层到节点附近 =====
            const container = document.getElementById('treeChart').parentElement; // tree-chart-container
            const containerRect = container.getBoundingClientRect();
            const panelWidth = 280;

            // 先显示弹窗（不可见）以获取真实高度
            detailPanel.style.visibility = 'hidden';
            detailPanel.style.left = '0px';
            detailPanel.style.top = '0px';
            detailPanel.classList.add('active');
            const panelHeight = detailPanel.offsetHeight || 260;

            let posX = (clickX !== undefined ? clickX : containerRect.width / 2) + 12;
            let posY = (clickY !== undefined ? clickY : containerRect.height / 2) - 60;

            // 防止超出右边界
            if (posX + panelWidth > containerRect.width - 8) {
                posX = (clickX !== undefined ? clickX : containerRect.width / 2) - panelWidth - 12;
            }
            // 防止超出下边界（同时考虑容器内和视口边界）
            // 将容器内坐标转换为视口坐标来检查
            const panelViewportBottom = containerRect.top + posY + panelHeight;
            const viewportHeight = window.innerHeight;
            if (panelViewportBottom > viewportHeight - 8) {
                // 优先向上偏移，确保弹窗底部不超出视口
                posY = posY - (panelViewportBottom - viewportHeight + 8);
            }
            if (posY + panelHeight > containerRect.height - 8) {
                posY = containerRect.height - panelHeight - 8;
            }
            // 防止超出上边界
            if (posY < 8) posY = 8;
            // 防止超出左边界
            if (posX < 8) posX = 8;

            detailPanel.style.left = posX + 'px';
            detailPanel.style.top = posY + 'px';
            detailPanel.style.visibility = 'visible';
        }

        // 初始化统计图表
        function initStatsChart() {
            if (!window.treeStats) return;

            const chartDom = document.getElementById('statsChart');
            if (!chartDom) return;

            if (statsChart) {
                statsChart.dispose();
            }

            statsChart = echarts.init(chartDom);

            const stats = window.treeStats;

            const COLORS = {
                ai:       '#8B5CF6',
                human:    '#3B82F6',
                branches: '#F59E0B',
                reads:    '#10B981',
                comments: '#EC4899',
            };

            // x 轴分两组：章节来源 + 互动数据，共5个坐标
            // 坐标：['AI创作', '人工创作', '分支数', '总阅读', '总评论']
            const xData = ['AI 创作', '人工创作', '分支数', '总阅读', '总评论'];
            const barData = [
                { value: stats.aiNodes || 0,       color: COLORS.ai,       label: 'AI 创作' },
                { value: stats.humanNodes || 0,    color: COLORS.human,    label: '人工创作' },
                { value: stats.totalBranches || 0, color: COLORS.branches, label: '分支数' },
                { value: stats.totalReads || 0,    color: COLORS.reads,    label: '总阅读' },
                { value: stats.totalComments || 0, color: COLORS.comments, label: '总评论' },
            ];

            const option = {
                tooltip: {
                    trigger: 'axis',
                    confine: true,
                    axisPointer: {
                        type: 'shadow',
                        shadowStyle: { color: 'rgba(99,102,241,0.05)' }
                    },
                    backgroundColor: 'rgba(255,255,255,0.97)',
                    borderColor: '#E5E7EB',
                    borderWidth: 1,
                    padding: [10, 14],
                    textStyle: { color: '#374151', fontSize: 13 },
                    extraCssText: 'box-shadow: 0 6px 20px rgba(0,0,0,0.1); border-radius: 10px;',
                    formatter: function(params) {
                        const p = params[0];
                        return `<div style="display:flex;align-items:center;gap:10px;">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};"></span>
                            <span style="color:#6B7280;">${p.name}</span>
                            <span style="font-weight:700;color:#111827;margin-left:8px;">${p.value.toLocaleString()}</span>
                        </div>`;
                    }
                },
                // 用 visualMap 给每根柱子独立上色
                visualMap: {
                    show: false,
                    dimension: 0,
                    pieces: barData.map((d, i) => ({ value: i, color: d.color }))
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '8%',
                    top: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: xData,
                    axisLine: { lineStyle: { color: '#E5E7EB' } },
                    axisTick: { show: false },
                    axisLabel: {
                        color: '#6B7280',
                        fontSize: 13,
                        margin: 12,
                        rich: {
                            group: {
                                color: '#9CA3AF',
                                fontSize: 11,
                                padding: [4, 0, 0, 0]
                            }
                        }
                    },
                    // 分组标注线：在 AI创作/人工创作 和 分支数 之间加分隔
                    splitLine: { show: false }
                },
                yAxis: {
                    type: 'value',
                    splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } },
                    axisLabel: { color: '#9CA3AF', fontSize: 12 },
                    axisLine: { show: false },
                    axisTick: { show: false }
                },
                series: [
                    {
                        type: 'bar',
                        barMaxWidth: 52,
                        barCategoryGap: '30%',
                        data: barData.map((d, i) => ({
                            value: d.value,
                            itemStyle: {
                                color: d.color,
                                borderRadius: [5, 5, 0, 0]
                            }
                        })),
                        label: {
                            show: true,
                            position: 'top',
                            color: '#6B7280',
                            fontSize: 12,
                            fontWeight: 600,
                            formatter: function(params) {
                                return params.value.toLocaleString();
                            }
                        }
                    }
                ],
                // 在 x 轴下方添加分组标注
                graphic: [
                    {
                        type: 'group',
                        children: [
                            // "章节来源"分组标注
                            {
                                type: 'text',
                                style: {
                                    text: '── 章节来源 ──',
                                    fill: '#C4B5FD',
                                    fontSize: 11,
                                    fontWeight: 500
                                },
                                left: '14%',
                                bottom: 12
                            },
                            // "互动数据"分组标注
                            {
                                type: 'text',
                                style: {
                                    text: '── 互动数据 ──',
                                    fill: '#6EE7B7',
                                    fontSize: 11,
                                    fontWeight: 500
                                },
                                left: '55%',
                                bottom: 12
                            }
                        ]
                    }
                ]
            };

            statsChart.setOption(option);

            window.addEventListener('resize', () => {
                statsChart && statsChart.resize();
            });
        }
