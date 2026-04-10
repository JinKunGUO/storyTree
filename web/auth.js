// 认证功能 JavaScript

// 邀请码验证
let inviteCodeVerified = false;
let verifiedInviteCode = null;

async function verifyInviteCode() {
    const input = document.getElementById('invitationCode');
    const code = input.value.trim().toUpperCase();
    const successMsg = document.getElementById('inviteCodeSuccess');
    const errorMsg = document.getElementById('inviteCodeError');
    
    // 清除之前的消息
    successMsg.style.display = 'none';
    errorMsg.textContent = '';
    
    if (!code) {
        return;
    }
    
    try {
        const response = await fetch(`/api/invitations/validate/${code}`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
            inviteCodeVerified = true;
            verifiedInviteCode = code;
            successMsg.textContent = `✓ 邀请码有效！注册成功后你将获得 ${data.bonusPoints} 积分奖励`;
            successMsg.style.display = 'block';
            input.style.borderColor = '#4caf50';
        } else {
            inviteCodeVerified = false;
            verifiedInviteCode = null;
            errorMsg.textContent = data.error || '邀请码无效';
            input.style.borderColor = '#e74c3c';
        }
    } catch (error) {
        console.error('验证邀请码失败:', error);
        errorMsg.textContent = '验证失败，请稍后重试';
    }
}

// 工具函数
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// 密码强度检测
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 8) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!strengthFill || !strengthText) return;
    
    const colors = ['#e74c3c', '#f39c12', '#f39c12', '#27ae60', '#27ae60'];
    const texts = ['太弱', '较弱', '一般', '良好', '很强'];
    
    strengthFill.style.width = (strength * 20) + '%';
    strengthFill.style.backgroundColor = colors[strength - 1] || '#e74c3c';
    strengthText.textContent = '密码强度: ' + (texts[strength - 1] || '太弱');
}

// 表单验证
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateUsername(username) {
    return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

function validatePassword(password) {
    return password.length >= 6;
}

// 显示错误信息
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function clearError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

// 注册表单处理
function handleRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const invitationCode = document.getElementById('invitationCode')?.value.trim().toUpperCase() || null;
        
        let isValid = true;
        
        // 清除所有错误
        ['usernameError', 'emailError', 'passwordError', 'confirmPasswordError'].forEach(id => clearError(id));
        
        // 验证用户名
        if (!validateUsername(username)) {
            showError('usernameError', '用户名必须为3-20位字母、数字或下划线');
            isValid = false;
        }
        
        // 验证邮箱
        if (!validateEmail(email)) {
            showError('emailError', '请输入有效的邮箱地址');
            isValid = false;
        }
        
        // 验证密码
        if (!validatePassword(password)) {
            showError('passwordError', '密码至少6位字符');
            isValid = false;
        }
        
        // 验证确认密码
        if (password !== confirmPassword) {
            showError('confirmPasswordError', '两次输入的密码不一致');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // 显示加载状态
        const button = document.getElementById('registerBtn');
        const buttonText = button.querySelector('.button-text');
        const buttonLoading = button.querySelector('.button-loading');
        
        button.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'block';
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, invitationCode })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('注册成功，开始保存token');
                console.log('Token:', data.token ? '存在 (长度: ' + data.token.length + ')' : '不存在');
                console.log('User:', data.user ? data.user.username : '不存在');
                
                // 保存token到localStorage
                try {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    console.log('✅ 已保存到localStorage');
                    
                    // 验证保存
                    const savedToken = localStorage.getItem('token');
                    if (savedToken) {
                        console.log('✅ Token保存成功，验证通过');
                    } else {
                        console.error('❌ Token保存失败！');
                        throw new Error('Token保存失败');
                    }
                } catch (e) {
                    console.error('保存token错误:', e);
                    window.toast ? toast.warning('注册成功但保存失败，请检查浏览器设置（可能是隐私模式）') : alert('注册成功但保存失败，请检查浏览器设置（可能是隐私模式）');
                    return;
                }
                
                // 跳转到主页
                console.log('准备跳转到首页');
                window.location.href = '/';
            } else {
                // 显示错误信息
                if (data.error.includes('用户名')) {
                    showError('usernameError', data.error);
                } else if (data.error.includes('邮箱')) {
                    showError('emailError', data.error);
                } else {
                    window.toast ? toast.error(data.error || '注册失败，请重试') : alert(data.error || '注册失败，请重试');
                }
            }
        } catch (error) {
            console.error('注册错误:', error);
            window.toast ? toast.error('网络错误，请检查网络连接') : alert('网络错误，请检查网络连接');
        } finally {
            button.disabled = false;
            buttonText.style.display = 'block';
            buttonLoading.style.display = 'none';
        }
    });
}

// 登录表单处理
function handleLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        let isValid = true;
        
        // 清除所有错误
        ['emailError', 'passwordError'].forEach(id => clearError(id));
        
        // 验证邮箱
        if (!validateEmail(email)) {
            showError('emailError', '请输入有效的邮箱地址');
            isValid = false;
        }
        
        // 验证密码
        if (!password) {
            showError('passwordError', '请输入密码');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // 显示加载状态
        const button = document.getElementById('loginBtn');
        const buttonText = button.querySelector('.button-text');
        const buttonLoading = button.querySelector('.button-loading');
        
        button.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'block';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('登录成功，开始保存token');
                console.log('Token:', data.token ? '存在 (长度: ' + data.token.length + ')' : '不存在');
                console.log('User:', data.user ? data.user.username : '不存在');
                console.log('记住我:', rememberMe);
                
                // 保存token到localStorage或sessionStorage
                try {
                    if (rememberMe) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        console.log('✅ 已保存到localStorage');
                    } else {
                        sessionStorage.setItem('token', data.token);
                        sessionStorage.setItem('user', JSON.stringify(data.user));
                        console.log('✅ 已保存到sessionStorage');
                    }
                    
                    // 验证保存
                    const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
                    if (savedToken) {
                        console.log('✅ Token保存成功，验证通过');
                    } else {
                        console.error('❌ Token保存失败！');
                        throw new Error('Token保存失败');
                    }
                } catch (e) {
                    console.error('保存token错误:', e);
                    window.toast ? toast.warning('登录成功但保存失败，请检查浏览器设置（可能是隐私模式）') : alert('登录成功但保存失败，请检查浏览器设置（可能是隐私模式）');
                    return;
                }
                
                // 跳转到主页或返回页面
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
                console.log('准备跳转到:', redirectUrl);
                window.location.href = redirectUrl;
            } else {
                // 显示错误信息
                if (data.error.includes('邮箱') || data.error.includes('密码')) {
                    showError('emailError', data.error);
                    showError('passwordError', data.error);
                } else {
                    window.toast ? toast.error(data.error || '登录失败，请重试') : alert(data.error || '登录失败，请重试');
                }
            }
        } catch (error) {
            console.error('登录错误:', error);
            window.toast ? toast.error('网络错误，请检查网络连接') : alert('网络错误，请检查网络连接');
        } finally {
            button.disabled = false;
            buttonText.style.display = 'block';
            buttonLoading.style.display = 'none';
        }
    });
}

// 密码强度实时检测
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }
    
    // 初始化表单
    if (document.getElementById('registerForm')) {
        handleRegister();
    }
    
    if (document.getElementById('loginForm')) {
        handleLogin();
    }
    
    // 检查是否已登录
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token && (window.location.pathname === '/login' || window.location.pathname === '/register')) {
        window.location.href = '/';
    }
});

// 触摸设备优化
if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
    
    // 为触摸设备添加触摸反馈
    document.querySelectorAll('.auth-button, .toggle-password').forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.98)';
        });
        
        button.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// 检查登录状态
function checkAuthStatus() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
    
    console.log('检查登录状态, token:', token ? '存在' : '不存在');
    console.log('用户信息:', user);
    
    // 如果在需要登录的页面但未登录，跳转到登录页
    const protectedPages = ['/create', '/write', '/profile', '/admin'];
    const currentPath = window.location.pathname;
    
    if (protectedPages.includes(currentPath) && !token) {
        console.log('未登录，跳转到登录页');
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`;
        return false;
    }
    
    // 更新导航栏用户信息
    updateNavbar(user);
    
    return !!token;
}

// 更新导航栏显示
function updateNavbar(user) {
    const profileLink = document.getElementById('profileLink');
    
    if (user && profileLink) {
        const level = user.level || 1;
        const levelBadgeHtml = `<span class="nav-level-badge">Lv${level}</span>`;
        profileLink.innerHTML = `<i class="fas fa-user"></i> ${user.username} ${levelBadgeHtml}`;
    }
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    console.log('已退出登录');
    window.location.href = '/login';
}
