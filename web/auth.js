// 认证功能 JavaScript

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
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 保存token到localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // 跳转到主页
                window.location.href = '/';
            } else {
                // 显示错误信息
                if (data.error.includes('用户名')) {
                    showError('usernameError', data.error);
                } else if (data.error.includes('邮箱')) {
                    showError('emailError', data.error);
                } else {
                    alert(data.error || '注册失败，请重试');
                }
            }
        } catch (error) {
            console.error('注册错误:', error);
            alert('网络错误，请检查网络连接');
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
                // 保存token到localStorage
                if (rememberMe) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                }
                
                // 跳转到主页或返回页面
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
                window.location.href = redirectUrl;
            } else {
                // 显示错误信息
                if (data.error.includes('邮箱') || data.error.includes('密码')) {
                    showError('emailError', data.error);
                    showError('passwordError', data.error);
                } else {
                    alert(data.error || '登录失败，请重试');
                }
            }
        } catch (error) {
            console.error('登录错误:', error);
            alert('网络错误，请检查网络连接');
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
