<template>
  <view class="register-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="circle circle-1" />
      <view class="circle circle-2" />
    </view>

    <!-- 顶部返回 -->
    <view class="header">
      <view class="back-btn" @tap="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">创建账号</text>
      <view class="placeholder-view" />
    </view>

    <!-- 注册表单 -->
    <scroll-view class="form-scroll" scroll-y>
      <view class="form-section">
        <view class="welcome-text">
          <text class="welcome-title">加入 StoryTree</text>
          <text class="welcome-sub">开启你的创作旅程</text>
        </view>

        <view class="form-card">
          <!-- 用户名 -->
          <view class="form-item">
            <text class="form-label">用户名</text>
            <view class="input-group" :class="{ 'input-error': errors.username }">
              <input
                v-model="form.username"
                class="input"
                type="text"
                placeholder="2-20个字符，支持中英文"
                placeholder-class="placeholder"
                maxlength="20"
                @blur="validateUsername"
              />
            </view>
            <text v-if="errors.username" class="error-text">{{ errors.username }}</text>
          </view>

          <!-- 邮箱 -->
          <view class="form-item">
            <text class="form-label">邮箱</text>
            <view class="input-group" :class="{ 'input-error': errors.email }">
              <input
                v-model="form.email"
                class="input"
                type="text"
                placeholder="请输入有效的邮箱地址"
                placeholder-class="placeholder"
                @blur="validateEmail"
              />
            </view>
            <text v-if="errors.email" class="error-text">{{ errors.email }}</text>
          </view>

          <!-- 密码 -->
          <view class="form-item">
            <text class="form-label">密码</text>
            <view class="input-group" :class="{ 'input-error': errors.password }">
              <input
                v-model="form.password"
                class="input"
                :type="showPassword ? 'text' : 'password'"
                placeholder="至少8位，包含字母和数字"
                placeholder-class="placeholder"
                maxlength="32"
                @blur="validatePassword"
              />
              <text class="eye-icon" @tap="showPassword = !showPassword">
                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
              </text>
            </view>
            <!-- 密码强度条 -->
            <view v-if="form.password" class="password-strength">
              <view
                class="strength-bar"
                :class="`strength-${passwordStrength.level}`"
                :style="{ width: passwordStrength.width }"
              />
              <text class="strength-text" :class="`text-${passwordStrength.level}`">
                {{ passwordStrength.label }}
              </text>
            </view>
            <text v-if="errors.password" class="error-text">{{ errors.password }}</text>
          </view>

          <!-- 确认密码 -->
          <view class="form-item">
            <text class="form-label">确认密码</text>
            <view class="input-group" :class="{ 'input-error': errors.confirmPassword }">
              <input
                v-model="form.confirmPassword"
                class="input"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="请再次输入密码"
                placeholder-class="placeholder"
                maxlength="32"
                @blur="validateConfirmPassword"
              />
              <text class="eye-icon" @tap="showConfirmPassword = !showConfirmPassword">
                {{ showConfirmPassword ? '👁️' : '👁️‍🗨️' }}
              </text>
            </view>
            <text v-if="errors.confirmPassword" class="error-text">{{ errors.confirmPassword }}</text>
          </view>

          <!-- 邀请码（可选） -->
          <view class="form-item">
            <text class="form-label">邀请码 <text class="optional-tag">（可选）</text></text>
            <view class="input-group">
              <input
                v-model="form.invitationCode"
                class="input"
                type="text"
                placeholder="填写邀请码可获得额外积分"
                placeholder-class="placeholder"
                maxlength="20"
              />
            </view>
          </view>

          <!-- 协议 -->
          <view class="agreement-row" @tap="agreeTerms = !agreeTerms">
            <view class="checkbox" :class="{ checked: agreeTerms }">
              <text v-if="agreeTerms" class="check-mark">✓</text>
            </view>
            <text class="agreement-text">
              我已阅读并同意
              <text class="link-text" @tap.stop="viewTerms">《用户协议》</text>
              和
              <text class="link-text" @tap.stop="viewPrivacy">《隐私政策》</text>
            </text>
          </view>

          <!-- 注册按钮 -->
          <button
            class="btn-primary"
            :disabled="loading || !agreeTerms"
            :loading="loading"
            @tap="handleRegister"
          >
            {{ loading ? '注册中...' : '立即注册' }}
          </button>

          <!-- 登录入口 -->
          <view class="login-row">
            <text class="login-text">已有账号？</text>
            <text class="login-link" @tap="goLogin">立即登录</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { register } from '@/api/auth'

const userStore = useUserStore()

const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const agreeTerms = ref(false)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  invitationCode: '',
})

const errors = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// 页面加载时，读取分享落地时存入的邀请码并自动填入（URL 直接带 invite 参数也兼容）
onLoad((query: any) => {
  // 优先使用 URL 参数（如从注册页直接链接进入），其次用 storage 里缓存的
  const codeFromUrl = query?.invite || query?.inviteCode || ''
  const codeFromStorage = uni.getStorageSync('pendingInviteCode') || ''
  const code = codeFromUrl || codeFromStorage
  if (code) {
    form.invitationCode = code
  }
})

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = form.password
  if (!pwd) return { level: 'weak', width: '0%', label: '' }

  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 1) return { level: 'weak', width: '33%', label: '弱' }
  if (score <= 3) return { level: 'medium', width: '66%', label: '中' }
  return { level: 'strong', width: '100%', label: '强' }
})

function validateUsername() {
  if (!form.username.trim()) {
    errors.username = '请输入用户名'
    return false
  }
  if (form.username.trim().length < 2) {
    errors.username = '用户名至少2个字符'
    return false
  }
  errors.username = ''
  return true
}

function validateEmail() {
  const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.email.trim()) {
    errors.email = '请输入邮箱'
    return false
  }
  if (!emailReg.test(form.email.trim())) {
    errors.email = '邮箱格式不正确'
    return false
  }
  errors.email = ''
  return true
}

function validatePassword() {
  if (!form.password) {
    errors.password = '请输入密码'
    return false
  }
  if (form.password.length < 8) {
    errors.password = '密码至少8位'
    return false
  }
  if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
    errors.password = '密码需包含字母和数字'
    return false
  }
  errors.password = ''
  return true
}

function validateConfirmPassword() {
  if (!form.confirmPassword) {
    errors.confirmPassword = '请确认密码'
    return false
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次密码不一致'
    return false
  }
  errors.confirmPassword = ''
  return true
}

async function handleRegister() {
  const valid =
    validateUsername() &&
    validateEmail() &&
    validatePassword() &&
    validateConfirmPassword()

  if (!valid) return

  if (!agreeTerms.value) {
    uni.showToast({ title: '请先同意用户协议', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const params: any = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
    }
    if (form.invitationCode.trim()) {
      params.invitationCode = form.invitationCode.trim()
    }

    const res = await register(params)
    userStore.login(res.token, res.user as any)
    // 注册成功后清除缓存的邀请码
    uni.removeStorageSync('pendingInviteCode')
    uni.showToast({ title: '注册成功！', icon: 'success' })

    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1500)
  } catch (err: any) {
    uni.showToast({ title: err.message || '注册失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

function goLogin() {
  uni.redirectTo({ url: '/pages/auth/login/index' })
}

function viewTerms() {
  uni.showModal({
    title: '用户协议',
    content: '请前往网页端查看完整用户协议',
    showCancel: false,
    confirmText: '知道了',
  })
}

function viewPrivacy() {
  uni.showModal({
    title: '隐私政策',
    content: '请前往网页端查看完整隐私政策',
    showCancel: false,
    confirmText: '知道了',
  })
}
</script>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
}

.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;

  .circle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.08;

    &-1 {
      width: 500rpx;
      height: 500rpx;
      background: #7c6af7;
      top: -150rpx;
      right: -150rpx;
    }

    &-2 {
      width: 300rpx;
      height: 300rpx;
      background: #a78bfa;
      bottom: 100rpx;
      left: -80rpx;
    }
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 100rpx 32rpx 20rpx;

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .back-icon {
      font-size: 40rpx;
      color: #e2e8f0;
    }
  }

  .header-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #ffffff;
  }

  .placeholder-view {
    width: 64rpx;
  }
}

.form-scroll {
  height: calc(100vh - 160rpx);
}

.form-section {
  padding: 0 32rpx 60rpx;
}

.welcome-text {
  display: flex;
  flex-direction: column;
  margin-bottom: 40rpx;

  .welcome-title {
    font-size: 48rpx;
    font-weight: 700;
    color: #ffffff;
  }

  .welcome-sub {
    font-size: 26rpx;
    color: #94a3b8;
    margin-top: 8rpx;
  }
}

.form-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 32rpx;
  padding: 40rpx 32rpx;
  backdrop-filter: blur(20px);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.form-item {
  margin-bottom: 32rpx;

  .form-label {
    font-size: 26rpx;
    color: #94a3b8;
    margin-bottom: 12rpx;
    display: block;
  }

  .optional-tag {
    font-size: 22rpx;
    color: #64748b;
  }
}

.input-group {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  padding: 0 24rpx;
  height: 96rpx;

  &.input-error {
    border-color: #ef4444;
  }

  .input {
    flex: 1;
    font-size: 28rpx;
    color: #e2e8f0;
    height: 100%;
  }

  .eye-icon {
    font-size: 32rpx;
    padding: 10rpx;
  }
}

.placeholder {
  color: #64748b;
}

.error-text {
  font-size: 22rpx;
  color: #ef4444;
  margin-top: 8rpx;
  display: block;
}

.password-strength {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  gap: 16rpx;

  .strength-bar {
    height: 6rpx;
    border-radius: 3rpx;
    transition: width 0.3s;

    &.strength-weak { background: #ef4444; }
    &.strength-medium { background: #f59e0b; }
    &.strength-strong { background: #10b981; }
  }

  .strength-text {
    font-size: 22rpx;

    &.text-weak { color: #ef4444; }
    &.text-medium { color: #f59e0b; }
    &.text-strong { color: #10b981; }
  }
}

.agreement-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 32rpx;

  .checkbox {
    width: 36rpx;
    height: 36rpx;
    border: 2rpx solid rgba(255, 255, 255, 0.2);
    border-radius: 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 4rpx;

    &.checked {
      background: #7c6af7;
      border-color: #7c6af7;
    }

    .check-mark {
      font-size: 22rpx;
      color: #ffffff;
    }
  }

  .agreement-text {
    font-size: 24rpx;
    color: #94a3b8;
    line-height: 1.6;
  }

  .link-text {
    color: #7c6af7;
  }
}

.btn-primary {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  border-radius: 16rpx;
  font-size: 32rpx;
  color: #ffffff;
  font-weight: 600;
  border: none;
  margin-bottom: 24rpx;

  &[disabled] {
    opacity: 0.5;
  }
}

.login-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8rpx;

  .login-text {
    font-size: 26rpx;
    color: #64748b;
  }

  .login-link {
    font-size: 26rpx;
    color: #7c6af7;
    font-weight: 600;
  }
}
</style>

