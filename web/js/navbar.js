/**
 * StoryTree 标准导航栏 JS
 * 提供：滚动阴影、认证状态显示、移动端菜单、退出登录
 * 使用方式：在页面底部引入 <script src="js/navbar.js"></script>
 */

(function () {
    // ===== 导航栏滚动阴影 =====
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        }, { passive: true });
    }

    // ===== 认证状态显示 =====
    function checkAuthStatus() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const loginLink = document.getElementById('loginLink');
        const registerLink = document.getElementById('registerLink');
        const profileLink = document.getElementById('profileLink');
        const logoutLink = document.getElementById('logoutLink');
        const myStoriesLink = document.getElementById('myStoriesLink');
        const notificationIcon = document.getElementById('notificationIcon');

        if (token) {
            if (loginLink) loginLink.style.display = 'none';
            if (registerLink) registerLink.style.display = 'none';
            if (profileLink) profileLink.style.display = 'flex';
            if (logoutLink) logoutLink.style.display = 'flex';
            if (myStoriesLink) myStoriesLink.style.display = 'flex';
            if (notificationIcon) {
                notificationIcon.style.display = 'flex';
                loadUnreadCount();
            }
        } else {
            if (loginLink) loginLink.style.display = 'flex';
            if (registerLink) registerLink.style.display = 'flex';
            if (profileLink) profileLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'none';
            if (myStoriesLink) myStoriesLink.style.display = 'none';
            if (notificationIcon) notificationIcon.style.display = 'none';
        }
    }

    // ===== 未读消息数 =====
    async function loadUnreadCount() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch('/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const badge = document.getElementById('notificationBadge');
                if (badge && data.unreadCount > 0) {
                    badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
                    badge.style.display = 'inline-block';
                }
            }
        } catch (e) { /* 静默失败 */ }
    }

    // ===== 移动端菜单 =====
    window.toggleMobileMenu = function () {
        const navMenu = document.getElementById('navMenu');
        const toggle = document.getElementById('mobileMenuToggle');
        if (!navMenu || !toggle) return;
        const isOpen = navMenu.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(isOpen));
        const icon = toggle.querySelector('i');
        if (icon) icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
    };

    // 点击菜单外部关闭
    document.addEventListener('click', (e) => {
        const navMenu = document.getElementById('navMenu');
        const toggle = document.getElementById('mobileMenuToggle');
        if (navMenu?.classList.contains('active') && !navMenu.contains(e.target) && !toggle?.contains(e.target)) {
            navMenu.classList.remove('active');
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
                const icon = toggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        }
    });

    // ===== 退出登录 =====
    window.logout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
        return false;
    };

    // ===== 初始化 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuthStatus);
    } else {
        checkAuthStatus();
    }
})();

