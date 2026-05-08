/**
 * StoryTree - 分享功能组件
 * 提供复制链接、社交媒体分享等功能
 */

// XSS 防护：转义 HTML 特殊字符
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class ShareManager {
    constructor() {
        this.platforms = {
            copy: {
                name: '复制链接',
                icon: 'fas fa-link',
                color: '#6c757d'
            },
            wechat: {
                name: '微信',
                icon: 'fab fa-weixin',
                color: '#07c160'
            },
            weibo: {
                name: '微博',
                icon: 'fab fa-weibo',
                color: '#e6162d'
            },
            qq: {
                name: 'QQ',
                icon: 'fab fa-qq',
                color: '#12b7f5'
            },
            qzone: {
                name: 'QQ空间',
                icon: 'fas fa-star',
                color: '#ffc700'
            },
            twitter: {
                name: 'Twitter',
                icon: 'fab fa-twitter',
                color: '#1da1f2'
            },
            facebook: {
                name: 'Facebook',
                icon: 'fab fa-facebook',
                color: '#1877f2'
            }
        };
    }

    /**
     * 显示分享面板
     * @param {Object} options - 分享选项
     * @param {number} options.storyId - 故事ID
     * @param {number} options.nodeId - 章节ID（可选）
     * @param {string} options.title - 分享标题
     * @param {string} options.description - 分享描述
     * @param {string} options.image - 分享图片URL（可选）
     */
    showSharePanel(options) {
        const { storyId, nodeId, title, description, image } = options;

        // 生成分享链接
        const shareUrl = this.generateShareUrl(storyId, nodeId);

        // 创建模态框HTML
        const modalHtml = `
            <div class="share-modal" id="shareModal">
                <div class="share-modal-content">
                    <div class="share-modal-header">
                        <h3>
                            <i class="fas fa-share-alt"></i>
                            分享到
                        </h3>
                        <button class="close-btn" onclick="shareManager.closeSharePanel()">×</button>
                    </div>
                    <div class="share-modal-body">
                        <div class="share-info">
                            ${image ? `<img src="${image}" alt="${title}" class="share-preview-image">` : ''}
                            <h4 class="share-title">${title}</h4>
                            <p class="share-description">${description || ''}</p>
                        </div>
                        <div class="share-platforms">
                            ${this.renderPlatforms(storyId, nodeId, title, description, shareUrl)}
                        </div>
                        <div class="share-link-box">
                            <input 
                                type="text" 
                                class="share-link-input" 
                                value="${shareUrl}" 
                                readonly 
                                id="shareLinkInput"
                            >
                            <button class="copy-link-btn" onclick="shareManager.copyLink('${shareUrl}', ${storyId}, ${nodeId || 'null'})">
                                <i class="fas fa-copy"></i>
                                复制链接
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('shareModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 添加样式（如果还没有）
        this.injectStyles();

        // 显示模态框
        setTimeout(() => {
            document.getElementById('shareModal').classList.add('active');
        }, 10);

        // 点击外部关闭
        document.getElementById('shareModal').addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') {
                this.closeSharePanel();
            }
        });
    }

    /**
     * 渲染分享平台按钮
     */
    renderPlatforms(storyId, nodeId, title, description, shareUrl) {
        const platforms = ['copy', 'wechat', 'weibo', 'qq', 'qzone'];
        
        return platforms.map(platform => {
            const config = this.platforms[platform];
            return `
                <button 
                    class="share-platform-btn" 
                    style="border-color: ${config.color};"
                    onclick="shareManager.shareTo('${platform}', ${storyId}, ${nodeId || 'null'}, '${encodeURIComponent(title)}', '${encodeURIComponent(description)}', '${encodeURIComponent(shareUrl)}')"
                    title="${config.name}"
                >
                    <i class="${config.icon}" style="color: ${config.color};"></i>
                    <span>${config.name}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * 生成分享链接
     */
    generateShareUrl(storyId, nodeId) {
        const baseUrl = window.location.origin;
        if (nodeId) {
            return `${baseUrl}/chapter?id=${nodeId}`;
        }
        return `${baseUrl}/story?id=${storyId}`;
    }

    /**
     * 分享到指定平台
     */
    async shareTo(platform, storyId, nodeId, encodedTitle, encodedDescription, encodedUrl) {
        const title = decodeURIComponent(encodedTitle);
        const description = decodeURIComponent(encodedDescription);
        const shareUrl = decodeURIComponent(encodedUrl);

        // 记录分享统计
        await this.recordShare(storyId, nodeId, platform);

        switch (platform) {
            case 'copy':
                this.copyLink(shareUrl, storyId, nodeId);
                break;

            case 'wechat':
                this.shareToWechat(shareUrl, title);
                break;

            case 'weibo':
                this.shareToWeibo(shareUrl, title, description);
                break;

            case 'qq':
                this.shareToQQ(shareUrl, title, description);
                break;

            case 'qzone':
                this.shareToQzone(shareUrl, title, description);
                break;

            case 'twitter':
                this.shareToTwitter(shareUrl, title);
                break;

            case 'facebook':
                this.shareToFacebook(shareUrl);
                break;

            default:
                console.warn('Unknown platform:', platform);
        }
    }

    /**
     * 复制链接
     */
    async copyLink(url, storyId, nodeId) {
        try {
            await navigator.clipboard.writeText(url);
            this.showToast('链接已复制到剪贴板', 'success');
            
            // 注意：不在这里记录，因为shareTo函数已经记录过了
        } catch (error) {
            console.error('复制失败:', error);
            // 降级方案：使用传统方法
            const input = document.getElementById('shareLinkInput');
            input.select();
            document.execCommand('copy');
            this.showToast('链接已复制', 'success');
        }
    }

    /**
     * 分享到微信（显示二维码）
     */
    shareToWechat(url, title) {
        // 生成二维码并显示
        const qrcodeHtml = `
            <div class="qrcode-overlay" id="qrcodeOverlay">
                <div class="qrcode-content">
                    <h3>微信扫码分享</h3>
                    <div id="qrcodeContainer"></div>
                    <p>使用微信扫描二维码分享给好友</p>
                    <button class="close-qrcode-btn" onclick="shareManager.closeQRCode()">关闭</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', qrcodeHtml);

        // 这里需要引入QRCode库（可以使用qrcode.js）
        // 简化版：显示提示
        document.getElementById('qrcodeContainer').innerHTML = `
            <div class="qrcode-placeholder">
                <i class="fab fa-weixin" style="font-size: 80px; color: #07c160;"></i>
                <p>请在微信中打开以下链接：</p>
                <input type="text" value="${url}" readonly style="width: 100%; padding: 8px; margin-top: 10px;">
            </div>
        `;

        this.showToast('请使用微信扫码分享', 'info');
    }

    /**
     * 分享到微博
     */
    shareToWeibo(url, title, description) {
        const text = `${title} - ${description}`;
        const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
        window.open(weiboUrl, '_blank', 'width=600,height=400');
    }

    /**
     * 分享到QQ
     */
    shareToQQ(url, title, description) {
        const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`;
        window.open(qqUrl, '_blank', 'width=600,height=400');
    }

    /**
     * 分享到QQ空间
     */
    shareToQzone(url, title, description) {
        const qzoneUrl = `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`;
        window.open(qzoneUrl, '_blank', 'width=600,height=400');
    }

    /**
     * 分享到Twitter
     */
    shareToTwitter(url, title) {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    }

    /**
     * 分享到Facebook
     */
    shareToFacebook(url) {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(facebookUrl, '_blank', 'width=600,height=400');
    }

    /**
     * 记录分享统计
     */
    async recordShare(storyId, nodeId, platform) {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
            
            const response = await fetch('/api/shares', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    story_id: parseInt(storyId),
                    node_id: nodeId ? parseInt(nodeId) : null,
                    platform
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('记录分享失败:', response.status, errorData);
            } else {
                const data = await response.json();
                console.log('分享记录成功:', data);
            }
        } catch (error) {
            console.error('记录分享错误:', error);
        }
    }

    /**
     * 关闭分享面板
     */
    closeSharePanel() {
        const modal = document.getElementById('shareModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * 关闭二维码
     */
    closeQRCode() {
        const overlay = document.getElementById('qrcodeOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `share-toast share-toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('shareStyles')) {
            return;
        }

        const styles = `
            <style id="shareStyles">
                /* 分享模态框 */
                .share-modal {
                    display: block;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .share-modal.active {
                    opacity: 1;
                }

                .share-modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                }

                .share-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                }

                .share-modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #333;
                }

                .share-modal-header h3 i {
                    margin-right: 8px;
                    color: #4a90e2;
                }

                .share-modal-header .close-btn {
                    background: none;
                    border: none;
                    font-size: 28px;
                    color: #999;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    line-height: 1;
                }

                .share-modal-header .close-btn:hover {
                    color: #333;
                }

                .share-modal-body {
                    padding: 20px;
                }

                .share-info {
                    margin-bottom: 20px;
                    text-align: center;
                }

                .share-preview-image {
                    width: 100%;
                    max-height: 150px;
                    object-fit: cover;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }

                .share-title {
                    font-size: 16px;
                    color: #333;
                    margin: 0 0 8px 0;
                }

                .share-description {
                    font-size: 14px;
                    color: #666;
                    margin: 0;
                    line-height: 1.5;
                }

                .share-platforms {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .share-platform-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 15px 10px;
                    background: white;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .share-platform-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .share-platform-btn i {
                    font-size: 24px;
                }

                .share-platform-btn span {
                    font-size: 12px;
                    color: #666;
                }

                .share-link-box {
                    display: flex;
                    gap: 10px;
                }

                .share-link-input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    background: #f8f9fa;
                }

                .copy-link-btn {
                    padding: 10px 20px;
                    background: #4a90e2;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    white-space: nowrap;
                    transition: background 0.3s ease;
                }

                .copy-link-btn:hover {
                    background: #357abd;
                }

                .copy-link-btn i {
                    margin-right: 5px;
                }

                /* 二维码覆盖层 */
                .qrcode-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .qrcode-content {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    text-align: center;
                    max-width: 400px;
                }

                .qrcode-content h3 {
                    margin: 0 0 20px 0;
                    color: #333;
                }

                #qrcodeContainer {
                    margin: 20px 0;
                }

                .qrcode-placeholder {
                    padding: 20px;
                }

                .close-qrcode-btn {
                    margin-top: 20px;
                    padding: 10px 30px;
                    background: #4a90e2;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }

                /* Toast提示 */
                .share-toast {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-100px);
                    background: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10002;
                    opacity: 0;
                    transition: all 0.3s ease;
                }

                .share-toast.show {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }

                .share-toast-success {
                    border-left: 4px solid #28a745;
                }

                .share-toast-success i {
                    color: #28a745;
                }

                .share-toast-info {
                    border-left: 4px solid #4a90e2;
                }

                .share-toast-info i {
                    color: #4a90e2;
                }

                /* 响应式 */
                @media (max-width: 768px) {
                    .share-modal-content {
                        width: 95%;
                    }

                    .share-platforms {
                        grid-template-columns: repeat(3, 1fr);
                    }

                    .share-link-box {
                        flex-direction: column;
                    }

                    .copy-link-btn {
                        width: 100%;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// 创建全局实例
const shareManager = new ShareManager();

